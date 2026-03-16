import { extractText, getDocumentProxy } from 'unpdf'

/**
 * Extracts plain text from a PDF ArrayBuffer using unpdf.
 * IMPORTANT: Calls pdf.destroy() after extraction to release memory.
 * Works on Vercel serverless (no native modules required).
 */
export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  await pdf.destroy()
  return text
}
