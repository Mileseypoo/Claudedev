import Papa from 'papaparse'
import { z } from 'zod'
import type { CsvValidationResult } from '@/types/admin'

const REQUIRED_COLS = [
  'property_id', 'address', 'area', 'price_aed',
  'bedrooms', 'bathrooms', 'size_sqft', 'status',
  'developer', 'community', 'property_type',
] as const

export const ListingRowSchema = z.object({
  property_id: z.string().min(1),
  address: z.string().min(1),
  area: z.string().min(1),
  price_aed: z.coerce.number().positive(),
  bedrooms: z.coerce.number().nonnegative().int(),
  bathrooms: z.coerce.number().nonnegative().int(),
  size_sqft: z.coerce.number().positive(),
  status: z.enum(['available', 'sold', 'reserved']),
  developer: z.string().min(1),
  community: z.string().min(1),
  property_type: z.string().min(1),
  sold_date: z.string().optional(),
})

export type ListingRow = z.infer<typeof ListingRowSchema>

export function parseCsv(csvString: string): CsvValidationResult {
  const result = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/^\uFEFF/, ''),
  })

  const fields = result.meta.fields ?? []
  const missingCols = REQUIRED_COLS.filter((col) => !fields.includes(col))
  if (missingCols.length > 0) {
    return {
      rows: [],
      errors: missingCols.map((col) => `Missing required column: ${col}`),
    }
  }

  const rows: ListingRow[] = []
  const errors: string[] = []

  result.data.forEach((rawRow, i) => {
    const parsed = ListingRowSchema.safeParse(rawRow)
    if (parsed.success) {
      rows.push(parsed.data)
    } else {
      const messages = parsed.error.issues.map((issue) => issue.message).join(', ')
      errors.push(`Row ${i + 2}: ${messages}`)
    }
  })

  return { rows, errors }
}
