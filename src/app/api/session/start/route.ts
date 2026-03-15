import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'

// POST: creates a session record; called from useSessionLifecycle.start()
const StartSessionSchema = z.object({
  consentConfirmedAt: z.string().datetime(),
})

export async function POST(request: Request) {
  let body: z.infer<typeof StartSessionSchema>

  try {
    const parsed = StartSessionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }
    body = parsed.data
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client, tenantId } = getServerSupabase()

  const { data, error } = await client
    .from('sessions')
    .insert({
      tenant_id: tenantId,
      status: 'active',
      consent_confirmed_at: body.consentConfirmedAt,
    })
    .select('id')
    .single()

  if (error) {
    return Response.json({ error: 'Failed to create session' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionId = (data as any)?.id
  return Response.json({ sessionId }, { status: 201 })
}
