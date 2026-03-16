import { getServerSupabase } from '@/lib/supabase/server'

export async function GET() {
  const { client, tenantId } = getServerSupabase()

  const { data } = await client
    .from('listing_stats')
    .select('stats')
    .eq('tenant_id', tenantId)
    .single()

  return Response.json({ stats: data?.stats ?? null })
}
