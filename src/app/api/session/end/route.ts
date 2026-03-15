import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'
import { MIN_SESSION_DURATION_SECONDS } from '@/lib/constants'

// POST: finalizes a session
const EndSessionSchema = z.object({
  sessionId: z.string().uuid(),
  durationSeconds: z.number().int().nonnegative(),
})

export async function POST(request: Request) {
  let body: z.infer<typeof EndSessionSchema>

  try {
    const parsed = EndSessionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }
    body = parsed.data
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { client } = getServerSupabase()

  const { error } = await client
    .from('sessions')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      duration_seconds: body.durationSeconds,
    })
    .eq('id', body.sessionId)

  if (error) {
    return Response.json({ error: 'Failed to end session' }, { status: 500 })
  }

  const shortSession = body.durationSeconds < MIN_SESSION_DURATION_SECONDS

  return Response.json({ ok: true, shortSession })
}
