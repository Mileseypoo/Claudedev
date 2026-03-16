import { describe, it, vi } from 'vitest'

vi.mock('unpdf', () => ({
  extractText: vi.fn().mockResolvedValue({ text: 'extracted text', pages: 1 }),
}))

describe('extractPdfText', () => {
  it.todo('returns non-empty string from PDF buffer')
})
