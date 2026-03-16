import { describe, it, expect, vi } from 'vitest'

const mockEmbeddingsCreate = vi.fn()

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        embeddings: {
          create: mockEmbeddingsCreate,
        },
      }
    }),
  }
})

describe('generateEmbedding', () => {
  it('returns array of length 1536', async () => {
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.1) }],
    })
    const { generateEmbedding } = await import('@/lib/embeddings/generate')
    const result = await generateEmbedding('hello world')
    expect(result).toHaveLength(1536)
    expect(typeof result[0]).toBe('number')
  })

  it('calls embeddings.create with model text-embedding-3-small', async () => {
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0) }],
    })
    const { generateEmbedding } = await import('@/lib/embeddings/generate')
    await generateEmbedding('test')
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'text-embedding-3-small' })
    )
  })
})

describe('generateEmbeddings', () => {
  it('batches 150 texts into 2 calls (100 + 50)', async () => {
    mockEmbeddingsCreate.mockImplementation((params: { input: string[] }) => ({
      data: params.input.map(() => ({ embedding: new Array(1536).fill(0) })),
    }))
    const { generateEmbeddings } = await import('@/lib/embeddings/generate')
    const texts = Array.from({ length: 150 }, (_, i) => `text ${i}`)
    await generateEmbeddings(texts)
    expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2)
  })

  it('returns flat array of 150 embeddings', async () => {
    mockEmbeddingsCreate.mockImplementation((params: { input: string[] }) => ({
      data: params.input.map(() => ({ embedding: new Array(1536).fill(0) })),
    }))
    const { generateEmbeddings } = await import('@/lib/embeddings/generate')
    const texts = Array.from({ length: 150 }, (_, i) => `text ${i}`)
    const result = await generateEmbeddings(texts)
    expect(result).toHaveLength(150)
    expect(result[0]).toHaveLength(1536)
  })

  it('returns empty array for empty input', async () => {
    const { generateEmbeddings } = await import('@/lib/embeddings/generate')
    const result = await generateEmbeddings([])
    expect(result).toHaveLength(0)
  })
})
