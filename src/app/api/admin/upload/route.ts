import { waitUntil } from '@vercel/functions'
import { getServerSupabase } from '@/lib/supabase/server'
import { parseCsv } from '@/lib/csv/parse-listings'
import { extractPdfText } from '@/lib/pdf/extract-text'
import { chunkText } from '@/lib/pdf/chunk-text'
import { generateEmbeddings } from '@/lib/embeddings/generate'
import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  const fileType = file.name.endsWith('.csv')
    ? 'csv'
    : file.name.endsWith('.pdf')
      ? 'pdf'
      : null

  if (!fileType) {
    return Response.json(
      { error: 'Unsupported file type. Upload CSV or PDF.' },
      { status: 400 },
    )
  }

  if (fileType === 'pdf' && file.size > MAX_PDF_SIZE) {
    return Response.json({ error: 'File exceeds 50MB limit' }, { status: 400 })
  }

  const { client, tenantId } = getServerSupabase()

  if (fileType === 'csv') {
    const csvString = await file.text()
    const { rows, errors } = parseCsv(csvString)

    if (errors.length > 0) {
      return Response.json({ errors }, { status: 400 })
    }

    // Create uploads record
    const { data: uploadRecord } = await client
      .from('uploads')
      .insert({
        tenant_id: tenantId,
        filename: file.name,
        file_type: 'csv',
        status: 'indexed',
        row_count: rows.length,
      })
      .select()
      .single()

    // Upsert listings — DATA-06: CSV rows go to typed SQL table, NOT vector store
    const listingRows = rows.map((row) => ({ ...row, tenant_id: tenantId }))
    await client
      .from('listings')
      .upsert(listingRows, { onConflict: 'tenant_id,property_id' })

    // Recalculate aggregate stats
    await client.rpc('recalculate_listing_stats', { p_tenant_id: tenantId })

    return Response.json(
      { uploadId: uploadRecord?.id, rowCount: rows.length },
      { status: 201 },
    )
  }

  // PDF: store in Supabase Storage, return 202, process in background
  const buffer = await file.arrayBuffer()
  const storagePath = `${tenantId}/${Date.now()}-${file.name}`

  await client.storage
    .from('uploads')
    .upload(storagePath, buffer, { contentType: 'application/pdf' })

  const { data: uploadRecord } = await client
    .from('uploads')
    .insert({
      tenant_id: tenantId,
      filename: file.name,
      file_type: 'pdf',
      storage_path: storagePath,
      status: 'processing',
    })
    .select()
    .single()

  const uploadId = uploadRecord?.id as string

  waitUntil(processPdfBackground(uploadId, buffer, tenantId, client))

  return Response.json({ uploadId }, { status: 202 })
}

async function processPdfBackground(
  uploadId: string,
  buffer: ArrayBuffer,
  tenantId: string,
  client: SupabaseClient,
): Promise<void> {
  try {
    const text = await extractPdfText(buffer)
    const chunks = chunkText(text)
    const embeddings = await generateEmbeddings(chunks)

    const chunkRows = chunks.map((content, i) => ({
      tenant_id: tenantId,
      upload_id: uploadId,
      chunk_index: i,
      content,
      embedding: JSON.stringify(embeddings[i]),
    }))

    await client.from('document_chunks').insert(chunkRows)
    await client
      .from('uploads')
      .update({ status: 'indexed', chunk_count: chunks.length })
      .eq('id', uploadId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await client
      .from('uploads')
      .update({ status: 'error', error_message: message })
      .eq('id', uploadId)
  }
}
