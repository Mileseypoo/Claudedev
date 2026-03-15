import { describe, it } from 'vitest'

describe('useSessionLifecycle', () => {
  it.todo('consent confirm transitions state to active and calls getUserMedia')
  it.todo('pause transitions state to paused and calls MediaRecorder.pause()')
  it.todo('resume transitions state to active and calls MediaRecorder.resume()')
  it.todo('localStorage key dictator_session_recovery written on session start')
  it.todo('localStorage key cleared on clean session end')
})
