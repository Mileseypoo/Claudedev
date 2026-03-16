/**
 * Splits text into overlapping fixed-size chunks for embedding generation.
 * Default chunkSize=2048 chars (~512 tokens), overlap=400 chars (~20%).
 * Returns empty array for empty input to prevent infinite loop.
 */
export function chunkText(text: string, chunkSize = 2048, overlap = 400): string[] {
  if (!text) return []
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    if (end === text.length) break
    start += chunkSize - overlap
  }
  return chunks
}
