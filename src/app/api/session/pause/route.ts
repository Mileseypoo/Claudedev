import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'

// POST: pauses or resumes a session
const PauseSessionSchema = z.object({
  sessionId: z.string().uuid(),
  action: z.enum(['pause', 'resume']),
})

export async function POST(request: Request) {
  let body: z.infer<typeof PauseSessionSchema>

  try {
    const parsed = PauseSessionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }
    body = parsed.data
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client } = getServerSupabase()

  const updateData =
    body.action === 'pause'
      ? { status: 'paused', paused_at: new Date().toISOString() }
      : { status: 'active', paused_at: null }

  const { error } = await client
    .from('sessions')
    .update(updateData)
    .eq('id', body.sessionId)

  if (error) {
    return Response.json({ error: 'Failed to update session' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
