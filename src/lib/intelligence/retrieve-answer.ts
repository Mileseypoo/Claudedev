import { generateEmbedding } from '@/lib/embeddings/generate'
import { getServerSupabase } from '@/lib/supabase/server'

/**
 * Retrieves available listings from SQL.
 * DATA-06: listings are ALWAYS queried from SQL, never RAG.
 * Returns JSON string for Claude to synthesize an answer from.
 */
export async function retrieveFromListings(_queryText: string): Promise<string> {
  const { client, tenantId } = getServerSupabase()
  const { data } = await client
    .from('listings')
    .select(
      'property_id, address, area, price_aed, bedrooms, bathrooms, size_sqft, status, developer, community, property_type',
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'available')
    .order('price_aed', { ascending: true })
    .limit(20)
  return JSON.stringify(data ?? [])
}

/**
 * Retrieves relevant PDF chunks via pgvector similarity search.
 * Uses same embedding model as Phase 2 indexing (text-embedding-3-small).
 * match_threshold: 0.5 (lower than Phase 2 default — real questions are short and jargon-heavy).
 */
export async function retrieveFromPDF(queryText: string): Promise<
  Array<{
    content: string
    sourceRef: string
    documentId: string
  }>
> {
  const embedding = await generateEmbedding(queryText)
  const { client, tenantId } = getServerSupabase()

  const { data, error } = await client.rpc('match_document_chunks', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: 5,
    p_tenant_id: tenantId,
  })

  if (error || !data) return []

  return (
    data as Array<{ id: string; document_id: string; content: string; similarity: number }>
  ).map((row) => ({
    content: row.content,
    sourceRef: `/admin/uploads/${row.document_id}`,
    documentId: row.document_id,
  }))
}

/**
 * Reads pre-calculated listing_stats JSONB — no aggregation at query time.
 * Stats are recalculated by recalculate_listing_stats() on every CSV upsert (Phase 2).
 */
export async function retrieveStats(): Promise<string> {
  const { client, tenantId } = getServerSupabase()
  const { data } = await client
    .from('listing_stats')
    .select('stats')
    .eq('tenant_id', tenantId)
    .single()
  return data ? JSON.stringify(data.stats) : '{}'
}
