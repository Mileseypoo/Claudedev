import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// --- Mock next/navigation ---
const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
}))

// --- Mock useSessionLifecycle ---
const mockLifecycleStart = vi.fn()
const mockLifecycleEnd = vi.fn()
const mockLifecyclePause = vi.fn()
const mockLifecycleResume = vi.fn()
const mockLifecycleInterrupt = vi.fn()
const mockLifecycleRestore = vi.fn()
let mockLifecycleStatus = 'idle'
let mockSessionId: string | null = null

vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({
    status: mockLifecycleStatus,
    sessionId: mockSessionId,
    elapsedSeconds: 0,
    start: mockLifecycleStart,
    pause: mockLifecyclePause,
    resume: mockLifecycleResume,
    end: mockLifecycleEnd,
    interrupt: mockLifecycleInterrupt,
    restore: mockLifecycleRestore,
  }),
}))

// --- Mock useAudioCapture ---
const mockRequestMic = vi.fn()
const mockStartRecording = vi.fn()
const mockPauseRecording = vi.fn()
const mockResumeRecording = vi.fn()
const mockStopRecording = vi.fn()

vi.mock('@/hooks/useAudioCapture', () => ({
  useAudioCapture: () => ({
    requestMic: mockRequestMic,
    startRecording: mockStartRecording,
    pauseRecording: mockPauseRecording,
    resumeRecording: mockResumeRecording,
    stopRecording: mockStopRecording,
    mimeType: 'audio/webm',
    isRecording: false,
    isPaused: false,
    error: null,
  }),
}))

// --- Mock useDeepgramStream ---
const mockStartStream = vi.fn()
const mockStopStream = vi.fn()
const mockPauseStream = vi.fn()
const mockSendAudioChunk = vi.fn()

vi.mock('@/hooks/useDeepgramStream', () => ({
  useDeepgramStream: () => ({
    startStream: mockStartStream,
    stopStream: mockStopStream,
    pauseStream: mockPauseStream,
    sendAudioChunk: mockSendAudioChunk,
    connectionState: 'idle',
  }),
}))

// --- Mock useWakeLock ---
const mockRequestWakeLock = vi.fn()
const mockReleaseWakeLock = vi.fn()

vi.mock('@/hooks/useWakeLock', () => ({
  useWakeLock: () => ({
    wakeLockActive: false,
    needsManualWarning: false,
    requestWakeLock: mockRequestWakeLock,
    releaseWakeLock: mockReleaseWakeLock,
  }),
}))

// --- Mock useVisibilityGuard ---
vi.mock('@/hooks/useVisibilityGuard', () => ({
  useVisibilityGuard: vi.fn(),
}))

// --- localStorage mock ---
const mockLocalStorage: Record<string, string> = {}
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { mockLocalStorage[key] = val }),
    removeItem: vi.fn((key: string) => { delete mockLocalStorage[key] }),
    clear: vi.fn(() => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]) }),
  },
  configurable: true,
  writable: true,
})

const SESSION_RECOVERY_KEY = 'dictator_session_recovery'

beforeEach(() => {
  vi.clearAllMocks()
  mockLifecycleStatus = 'idle'
  mockSessionId = null
  // Clear local storage mock data
  Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k])
})

// =====================================================================
// HOME PAGE TESTS
// =====================================================================

describe('Home page', () => {
  it('renders start screen when no recovery key in localStorage', async () => {
    const { default: HomePage } = await import('./page')
    render(<HomePage />)
    expect(screen.getByText(/Start Session/i)).toBeInTheDocument()
  })

  it('renders recovery screen when dictator_session_recovery exists in localStorage', async () => {
    mockLocalStorage[SESSION_RECOVERY_KEY] = JSON.stringify({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'active',
      startedAt: '2026-03-15T20:00:00.000Z',
    })
    const { default: HomePage } = await import('./page')
    render(<HomePage />)
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/recovery')
    })
  })

  it('tapping Start Session opens the consent modal', async () => {
    const { default: HomePage } = await import('./page')
    render(<HomePage />)
    const startButton = screen.getByText(/Start Session/i)
    fireEvent.click(startButton)
    expect(screen.getByText(/Client has consented/i)).toBeInTheDocument()
  })

  it('confirming consent calls lifecycle.start() and navigates to /active', async () => {
    mockLifecycleStart.mockResolvedValue(undefined)
    const { default: HomePage } = await import('./page')
    render(<HomePage />)

    // Open consent modal
    fireEvent.click(screen.getByText(/Start Session/i))

    // Confirm consent
    const confirmButton = screen.getByText(/Start Recording/i)
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockLifecycleStart).toHaveBeenCalledWith(expect.any(String))
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/active')
    })
  })
})

// =====================================================================
// ACTIVE SESSION PAGE TESTS
// =====================================================================

describe('Active session page', () => {
  it('renders mic indicator and session timer', async () => {
    const { default: ActivePage } = await import('./(session)/active/page')
    render(<ActivePage />)
    // MicIndicator has data-testid="mic-indicator"
    expect(screen.getByTestId('mic-indicator')).toBeInTheDocument()
    // SessionTimer shows 00:00:00
    expect(screen.getByText('00:00:00')).toBeInTheDocument()
  })

  it('renders Pause and End controls', async () => {
    const { default: ActivePage } = await import('./(session)/active/page')
    render(<ActivePage />)
    expect(screen.getByText(/Pause/i)).toBeInTheDocument()
    expect(screen.getByText(/End/i)).toBeInTheDocument()
  })
})

// =====================================================================
// RECOVERY PAGE TESTS
// =====================================================================

describe('Recovery page', () => {
  it('redirects to / when no SESSION_RECOVERY_KEY in localStorage', async () => {
    const { default: RecoveryPage } = await import('./(session)/recovery/page')
    render(<RecoveryPage />)
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    })
  })

  it('shows session info when SESSION_RECOVERY_KEY exists', async () => {
    mockLocalStorage[SESSION_RECOVERY_KEY] = JSON.stringify({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'active',
      startedAt: '2026-03-15T20:00:00.000Z',
    })
    const { default: RecoveryPage } = await import('./(session)/recovery/page')
    render(<RecoveryPage />)
    await waitFor(() => {
      expect(screen.getByText(/Resume session/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Start fresh/i)).toBeInTheDocument()
  })

  it('Resume button navigates to /active with sessionId', async () => {
    mockLocalStorage[SESSION_RECOVERY_KEY] = JSON.stringify({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'active',
      startedAt: '2026-03-15T20:00:00.000Z',
    })
    const { default: RecoveryPage } = await import('./(session)/recovery/page')
    render(<RecoveryPage />)
    await waitFor(() => {
      expect(screen.getByText(/Resume session/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Resume session/i))
    expect(mockPush).toHaveBeenCalledWith('/active?sessionId=550e8400-e29b-41d4-a716-446655440000')
  })

  it('Start fresh clears SESSION_RECOVERY_KEY and navigates to /', async () => {
    mockLocalStorage[SESSION_RECOVERY_KEY] = JSON.stringify({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'active',
      startedAt: '2026-03-15T20:00:00.000Z',
    })
    const { default: RecoveryPage } = await import('./(session)/recovery/page')
    render(<RecoveryPage />)
    await waitFor(() => {
      expect(screen.getByText(/Start fresh/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Start fresh/i))
    expect(window.localStorage.removeItem).toHaveBeenCalledWith(SESSION_RECOVERY_KEY)
    expect(mockReplace).toHaveBeenCalledWith('/')
  })
})
