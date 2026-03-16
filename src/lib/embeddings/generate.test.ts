import { describe, it, vi } from 'vitest'

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: Array.from({ length: 100 }, () => ({ embedding: new Array(1536).fill(0) })),
      }),
    },
  })),
}))

describe('generateEmbedding', () => {
  it.todo('returns array of length 1536')
})

describe('generateEmbeddings', () => {
  it.todo('150 texts calls OpenAI twice (2 batches of max 100)')
  it.todo('returns flat array of 150 embeddings')
})
