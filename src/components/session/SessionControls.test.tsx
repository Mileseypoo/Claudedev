import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionControls } from './SessionControls'

describe('SessionControls', () => {
  it('Pause button calls onPause immediately without confirmation', async () => {
    const onPause = vi.fn()
    const onEnd = vi.fn()
    const onResume = vi.fn()

    render(
      <SessionControls
        onPause={onPause}
        onResume={onResume}
        onEnd={onEnd}
        isPaused={false}
      />,
    )

    const pauseButton = screen.getByText(/pause/i)
    await userEvent.click(pauseButton)

    expect(onPause).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('End button requires a second tap to confirm before onEnd is called', async () => {
    const onPause = vi.fn()
    const onEnd = vi.fn()
    const onResume = vi.fn()

    render(
      <SessionControls
        onPause={onPause}
        onResume={onResume}
        onEnd={onEnd}
        isPaused={false}
      />,
    )

    // First tap shows "Confirm end" state
    const endButton = screen.getByText(/end session/i)
    await userEvent.click(endButton)

    // onEnd should NOT be called after first tap
    expect(onEnd).not.toHaveBeenCalled()

    // Button should now show confirmation text
    const confirmButton = screen.getByText(/confirm end/i)
    expect(confirmButton).toBeTruthy()

    // Second tap calls onEnd
    await userEvent.click(confirmButton)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('shows Resume button when isPaused is true', () => {
    render(
      <SessionControls
        onPause={vi.fn()}
        onResume={vi.fn()}
        onEnd={vi.fn()}
        isPaused={true}
      />,
    )

    expect(screen.getByText(/resume/i)).toBeTruthy()
  })

  it('Resume button calls onResume immediately', async () => {
    const onResume = vi.fn()

    render(
      <SessionControls
        onPause={vi.fn()}
        onResume={onResume}
        onEnd={vi.fn()}
        isPaused={true}
      />,
    )

    const resumeButton = screen.getByText(/resume/i)
    await userEvent.click(resumeButton)

    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('End button has min-h-[56px] for thumb-sized tap target', () => {
    render(
      <SessionControls
        onPause={vi.fn()}
        onResume={vi.fn()}
        onEnd={vi.fn()}
        isPaused={false}
      />,
    )

    const endButton = screen.getByText(/end session/i)
    expect(endButton.className).toContain('min-h-[56px]')
  })
})
