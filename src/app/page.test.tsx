import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// --- Mock next/navigation (must be before imports that use it) ---
const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockRouter = { push: mockPush, replace: mockReplace }
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
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
const mockRequestMic = vi.fn().mockResolvedValue({ stream: {} })
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

// --- Mock fetch for recovery "start fresh" endpoint ---
const mockFetch = vi.fn().mockResolvedValue({ ok: true })
vi.stubGlobal('fetch', mockFetch)

// --- localStorage mock ---
const mockStorageData: Record<string, string> = {}
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorageData[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { mockStorageData[key] = val }),
  removeItem: vi.fn((key: string) => { delete mockStorageData[key] }),
  clear: vi.fn(() => { Object.keys(mockStorageData).forEach(k => delete mockStorageData[k]) }),
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  configurable: true,
  writable: true,
})

const SESSION_RECOVERY_KEY = 'dictator_session_recovery'

// Import pages at the top (modules are cached after first import)
import HomePage from './page'
import ActivePage from './(session)/active/page'
import RecoveryPage from './(session)/recovery/page'

beforeEach(() => {
  vi.clearAllMocks()
  mockLifecycleStatus = 'idle'
  mockSessionId = null
  // Clear storage data
  Object.keys(mockStorageData).forEach(k => delete mockStorageData[k])
  // Re-attach implementations cleared by vi.clearAllMocks
  mockLocalStorage.getItem.mockImplementation((key: string) => mockStorageData[key] ?? null)
  mockLocalStorage.setItem.mockImplementation((key: string, val: string) => { mockStorageData[key] = val })
  mockLocalStorage.removeItem.mockImplementation((key: string) => { delete mockStorageData[key] })
  mockLocalStorage.clear.mockImplementation(() => { Object.keys(mockStorageData).forEach(k => delete mockStorageData[k]) })
  mockRequestMic.mockResolvedValue({ stream: {} })
  mockLifecycleStart.mockResolvedValue(undefined)
  mockFetch.mockResolvedValue({ ok: true })
})

// =====================================================================
// HOME PAGE TESTS
// =====================================================================

describe('Home page', () => {
  it('renders start screen when no recovery key in localStorage', () => {
    render(<HomePage />)
    expect(screen.getByText(/Start Session/i)).toBeInTheDocument()
  })

  it('renders recovery screen when dictator_session_recovery exists in localStorage', async () => {
    mockStorageData[SESSION_RECOVERY_KEY] = JSON.stringify({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'active',
      startedAt: '2026-03-15T20:00:00.000Z',
    })
    render(<HomePage />)
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/recovery')
    })
  })

  it('tapping Start Session opens the consent modal', () => {
    render(<HomePage />)
    const startButton = screen.getByText(/Start Session/i)
    fireEvent.click(startButton)
    expect(screen.getByText(/Client has consented/i)).toBeInTheDocument()
  })

  it('confirming consent calls lifecycle.start() and navigates to /active', async () => {
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
  it('renders mic indicator and session timer', () => {
    render(<ActivePage />)
    // MicIndicator has data-testid="mic-indicator"
    expect(screen.getByTestId('mic-indicator')).toBeInTheDocument()
    // SessionTimer shows 00:00:00
    expect(screen.getByText('00:00:00')).toBeInTheDocument()
  })

  it('renders Pause and End controls', () => {
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
    render(<RecoveryPage />)
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    })
  })

  it('shows session info when SESSION_RECOVERY_KEY exists', async () => {
    mockStorageData[SESSION_RECOVERY_KEY] = JSON.stringify({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'active',
      startedAt: '2026-03-15T20:00:00.000Z',
    })
    render(<RecoveryPage />)
    await waitFor(() => {
      expect(screen.getByText(/Resume session/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Start fresh/i)).toBeInTheDocument()
  })

  it('Resume button navigates to /active with sessionId', async () => {
    mockStorageData[SESSION_RECOVERY_KEY] = JSON.stringify({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'active',
      startedAt: '2026-03-15T20:00:00.000Z',
    })
    render(<RecoveryPage />)
    await waitFor(() => {
      expect(screen.getByText(/Resume session/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Resume session/i))
    expect(mockPush).toHaveBeenCalledWith('/active?sessionId=550e8400-e29b-41d4-a716-446655440000')
  })

  it('Start fresh clears SESSION_RECOVERY_KEY and navigates to /', async () => {
    mockStorageData[SESSION_RECOVERY_KEY] = JSON.stringify({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'active',
      startedAt: '2026-03-15T20:00:00.000Z',
    })
    render(<RecoveryPage />)
    await waitFor(() => {
      expect(screen.getByText(/Start fresh/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Start fresh/i))
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(SESSION_RECOVERY_KEY)
    expect(mockReplace).toHaveBeenCalledWith('/')
  })
})
