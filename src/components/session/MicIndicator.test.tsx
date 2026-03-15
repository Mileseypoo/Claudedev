import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MicIndicator } from './MicIndicator'

describe('MicIndicator', () => {
  it("renders with aria-label 'Recording active' when isRecording is true", () => {
    render(<MicIndicator isRecording={true} />)
    const indicator = screen.getByTestId('mic-indicator')
    expect(indicator).toHaveAttribute('aria-label', 'Recording active')
  })

  it("renders with aria-label 'Recording inactive' when isRecording is false", () => {
    render(<MicIndicator isRecording={false} />)
    const indicator = screen.getByTestId('mic-indicator')
    expect(indicator).toHaveAttribute('aria-label', 'Recording inactive')
  })

  it('applies animate-pulse class when isRecording is true', () => {
    render(<MicIndicator isRecording={true} />)
    const indicator = screen.getByTestId('mic-indicator')
    expect(indicator.className).toContain('animate-pulse')
  })

  it('does not render pulsing class when isRecording is false', () => {
    render(<MicIndicator isRecording={false} />)
    const indicator = screen.getByTestId('mic-indicator')
    expect(indicator.className).not.toContain('animate-pulse')
  })
})
