import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDestroy = vi.fn().mockResolvedValue(undefined)
const mockPdf = { destroy: mockDestroy }

vi.mock('unpdf', () => ({
  getDocumentProxy: vi.fn().mockResolvedValue(mockPdf),
  extractText: vi.fn().mockResolvedValue({ text: 'extracted text content', totalPages: 1 }),
}))

describe('extractPdfText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDestroy.mockResolvedValue(undefined)
  })

  it('returns non-empty string from PDF buffer', async () => {
    const { extractPdfText } = await import('@/lib/pdf/extract-text')
    const buffer = new ArrayBuffer(100)
    const result = await extractPdfText(buffer)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toBe('extracted text content')
  })

  it('calls pdf.destroy() after extraction', async () => {
    const { extractPdfText } = await import('@/lib/pdf/extract-text')
    const { getDocumentProxy } = await import('unpdf')
    const mockGetDocumentProxy = vi.mocked(getDocumentProxy)
    mockGetDocumentProxy.mockResolvedValue(mockPdf as any)
    const buffer = new ArrayBuffer(100)
    await extractPdfText(buffer)
    expect(mockDestroy).toHaveBeenCalled()
  })

  it('propagates errors from getDocumentProxy', async () => {
    const { extractPdfText } = await import('@/lib/pdf/extract-text')
    const { getDocumentProxy } = await import('unpdf')
    vi.mocked(getDocumentProxy).mockRejectedValueOnce(new Error('PDF parse error'))
    const buffer = new ArrayBuffer(100)
    await expect(extractPdfText(buffer)).rejects.toThrow('PDF parse error')
  })
})
