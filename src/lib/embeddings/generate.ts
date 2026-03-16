import OpenAI from 'openai'

/**
 * Generates embeddings using OpenAI text-embedding-3-small (1536 dimensions).
 * Batch limit: 100 texts per API call to avoid 413 errors.
 */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const BATCH_SIZE = 100

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    })
    results.push(...response.data.map((d) => d.embedding))
  }
  return results
}
