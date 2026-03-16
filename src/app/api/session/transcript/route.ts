import { getServerSupabase } from '@/lib/supabase/server'
import type { TranscriptChunk } from '@/types/session'

// GET /api/session/transcript?sessionId=xxx
// Returns all transcript chunks for a session, ordered by sequence.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return Response.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const { client, tenantId } = getServerSupabase()

  const { data, error } = await client
    .from('transcript_chunks')
    .select('id, session_id, tenant_id, sequence, text, start_seconds, duration_seconds, is_final, created_at')
    .eq('session_id', sessionId)
    .eq('tenant_id', tenantId)
    .order('sequence', { ascending: true })

  if (error) {
    return Response.json({ error: 'Failed to fetch transcript' }, { status: 500 })
  }

  // Map snake_case DB columns to camelCase TranscriptChunk interface
  const chunks: TranscriptChunk[] = (data ?? []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    tenantId: row.tenant_id,
    sequence: row.sequence,
    text: row.text,
    startSeconds: row.start_seconds,
    durationSeconds: row.duration_seconds,
    isFinal: row.is_final,
    createdAt: row.created_at,
  }))

  return Response.json({ chunks })
}
