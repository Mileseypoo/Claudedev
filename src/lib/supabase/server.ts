import { createClient } from '@supabase/supabase-js'
import { DEFAULT_TENANT_ID } from '@/lib/constants'

/**
 * Server-side Supabase client with tenant context injection.
 * Uses the service role key — never expose this to the browser.
 *
 * The `rpc` helper sets app.tenant_id before running any query so that
 * Supabase RLS policies using current_setting('app.tenant_id') fire correctly.
 *
 * v2 upgrade path: replace DEFAULT_TENANT_ID with auth.jwt()->>'tenant_id'
 */
export function getServerSupabase() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  return {
    client,
    tenantId: DEFAULT_TENANT_ID,
    async rpc<T>(query: (c: typeof client) => Promise<T>): Promise<T> {
      await client.rpc('set_config', {
        setting_name: 'app.tenant_id',
        new_value: DEFAULT_TENANT_ID,
        is_local: true,
      })
      return query(client)
    },
  }
}
