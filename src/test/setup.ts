import '@testing-library/jest-dom'
import { vi } from 'vitest'

// --- MediaRecorder mock ---
class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null

  start() {
    this.state = 'recording'
  }
  pause() {
    this.state = 'paused'
  }
  resume() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
  }

  static isTypeSupported(_mimeType: string): boolean {
    return true
  }
}

vi.stubGlobal('MediaRecorder', MockMediaRecorder)

// --- WakeLock mock ---
const mockWakeLockSentinel = {
  release: vi.fn().mockResolvedValue(undefined),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  type: 'screen' as const,
  released: false,
  onrelease: null,
}

vi.stubGlobal('navigator', {
  ...navigator,
  wakeLock: {
    request: vi.fn().mockResolvedValue(mockWakeLockSentinel),
  },
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn(), kind: 'audio' }],
    }),
  },
})

// --- Supabase mock client (exported for per-test use) ---
export const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  then: vi.fn().mockResolvedValue({ data: null, error: null }),
}
