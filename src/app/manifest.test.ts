import { describe, it, expect } from 'vitest'
import manifest from './manifest'

describe('PWA manifest', () => {
  it('manifest returns display: standalone', () => {
    const m = manifest()
    expect(m.display).toBe('standalone')
  })

  it('manifest includes name, short_name, start_url, background_color, theme_color, icons', () => {
    const m = manifest()
    expect(m.name).toBe('Dictator — Sales Copilot')
    expect(m.short_name).toBe('Dictator')
    expect(m.start_url).toBe('/')
    expect(m.background_color).toBe('#0f0f1a')
    expect(m.theme_color).toBe('#0f0f1a')
    expect(m.icons).toBeDefined()
    expect(Array.isArray(m.icons)).toBe(true)
    expect(m.icons!.length).toBeGreaterThanOrEqual(2)
  })

  it('manifest icons include 192x192 and 512x512 entries', () => {
    const m = manifest()
    const sizes = m.icons!.map((icon) => icon.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('manifest returns orientation: portrait', () => {
    const m = manifest()
    expect(m.orientation).toBe('portrait')
  })
})
