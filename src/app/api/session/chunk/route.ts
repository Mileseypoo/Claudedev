import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'

// Zod schema for incoming chunk payload
const ChunkSchema = z.object({
  sessionId: z.uuid(),
  sequence: z.number().int().nonnegative(),
  text: z.string().min(1),
  startSeconds: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative().optional(),
})

export async function POST(request: Request) {
  const body = ChunkSchema.safeParse(await request.json())
  if (!body.success) {
    return Response.json({ error: 'Invalid chunk' }, { status: 400 })
  }

  const { client, tenantId } = getServerSupabase()

  const { error } = await client.from('transcript_chunks').insert({
    session_id: body.data.sessionId,
    tenant_id: tenantId,
    sequence: body.data.sequence,
    text: body.data.text,
    start_seconds: body.data.startSeconds,
    duration_seconds: body.data.durationSeconds ?? null,
    is_final: true,
  })

  if (error) {
    return Response.json({ error: 'Save failed' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
