import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'

const QuerySchema = z.object({
  sessionId: z.string().uuid(),
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({ sessionId: url.searchParams.get('sessionId') })

  if (!parsed.success) {
    return Response.json({ error: 'Invalid sessionId' }, { status: 400 })
  }

  const { client, tenantId } = getServerSupabase()

  const { data, error } = await client
    .from('answer_cards')
    .select(
      'id, session_id, tenant_id, topic_key, question_text, terse_answer, full_answer, source_ref, card_type, fired_at, created_at',
    )
    .eq('session_id', parsed.data.sessionId)
    .eq('tenant_id', tenantId)
    .order('fired_at', { ascending: true })

  if (error) {
    return Response.json({ error: 'Fetch failed' }, { status: 500 })
  }

  // Map DB snake_case to camelCase AnswerCard type
  const cards = (data ?? []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    tenantId: row.tenant_id,
    topicKey: row.topic_key,
    questionText: row.question_text,
    terseAnswer: row.terse_answer,
    fullAnswer: row.full_answer,
    sourceRef: row.source_ref ?? '',
    cardType: row.card_type,
    firedAt: row.fired_at,
    createdAt: row.created_at,
  }))

  return Response.json({ cards })
}
