/**
 * Session status values — mirrors the status check constraint in the DB migration.
 * Note: 'interrupted' is a client-only transient state (not persisted to DB).
 */
export type SessionStatus = 'active' | 'paused' | 'ended' | 'recovered' | 'interrupted'

export interface Session {
  id: string
  tenantId: string
  agentId: string | null
  status: SessionStatus
  consentConfirmedAt: string   // ISO timestamp
  startedAt: string
  pausedAt: string | null
  endedAt: string | null
  durationSeconds: number | null
  createdAt: string
  updatedAt: string
}

export interface TranscriptChunk {
  id: string
  sessionId: string
  tenantId: string
  sequence: number
  text: string
  startSeconds: number
  durationSeconds: number | null
  isFinal: boolean
  createdAt: string
}

/**
 * Written to localStorage on every session state transition.
 * Key: SESSION_RECOVERY_KEY ('dictator_session_recovery')
 * Cleared on clean session end. Persists through crashes/accidental closes.
 */
export interface SessionRecoveryState {
  sessionId: string
  status: SessionStatus
  startedAt: string
}
