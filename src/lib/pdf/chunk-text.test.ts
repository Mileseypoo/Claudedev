import { describe, it, expect } from 'vitest'
import { chunkText } from '@/lib/pdf/chunk-text'

describe('chunkText', () => {
  it('text of length 5000 with defaults produces 3 chunks', () => {
    const text = 'a'.repeat(5000)
    const chunks = chunkText(text)
    // Math.ceil((5000 - 400) / (2048 - 400)) = Math.ceil(4600/1648) = 3
    expect(chunks).toHaveLength(3)
  })

  it('each chunk is at most chunkSize characters', () => {
    const text = 'a'.repeat(5000)
    const chunks = chunkText(text, 2048, 400)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2048)
    }
  })

  it('overlap: content at position chunkSize-overlap appears in both chunk 0 and chunk 1', () => {
    // Use distinct characters to verify overlap position
    const segment1 = 'A'.repeat(1648) // chunkSize - overlap = 2048 - 400 = 1648
    const overlap = 'B'.repeat(400)   // the 400 chars that should appear in both chunks
    const segment2 = 'C'.repeat(1648)
    const text = segment1 + overlap + segment2
    const chunks = chunkText(text, 2048, 400)
    // chunk 0: chars 0-2047 = segment1 + overlap
    // chunk 1: chars 1648-3695 = overlap + segment2
    expect(chunks[0]).toContain(overlap)
    expect(chunks[1]).toContain(overlap)
  })

  it('text shorter than chunkSize returns array of length 1', () => {
    const text = 'short text'
    const chunks = chunkText(text, 2048, 400)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(text)
  })

  it('empty string returns empty array', () => {
    const chunks = chunkText('')
    expect(chunks).toHaveLength(0)
  })
})
