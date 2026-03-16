import { getServerSupabase } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { client, tenantId } = getServerSupabase()
  const { id } = await params

  // Fetch upload to get storage_path for cleanup
  const { data: upload, error: fetchError } = await client
    .from('uploads')
    .select('storage_path')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !upload) {
    return Response.json({ error: 'Upload not found' }, { status: 404 })
  }

  // Remove from Supabase Storage if PDF (has storage_path)
  if (upload.storage_path) {
    await client.storage.from('uploads').remove([upload.storage_path])
  }

  // Delete from DB — document_chunks cascade automatically via FK
  await client
    .from('uploads')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  return Response.json({ success: true })
}
