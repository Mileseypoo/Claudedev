import { getServerSupabase } from '@/lib/supabase/server'
import type { Upload } from '@/types/admin'

export async function GET() {
  const { client, tenantId } = getServerSupabase()

  const { data, error } = await client
    .from('uploads')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ uploads: (data ?? []) as Upload[] })
}
