import { describe, it, expect } from 'vitest'
import { parseCsv } from '@/lib/csv/parse-listings'

const VALID_CSV = `property_id,address,area,price_aed,bedrooms,bathrooms,size_sqft,status,developer,community,property_type
PROP001,123 Main St,Dubai Marina,1500000,2,2,1200,available,Emaar,Marina Walk,apartment
PROP002,456 Palm Dr,Palm Jumeirah,3500000,3,3,2100,sold,Nakheel,Palm Fronds,villa`

describe('parseCsv', () => {
  it('returns all valid rows when CSV has all required columns with valid data', () => {
    const result = parseCsv(VALID_CSV)
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].property_id).toBe('PROP001')
    expect(result.rows[0].price_aed).toBe(1500000)
    expect(typeof result.rows[0].price_aed).toBe('number')
    expect(result.rows[0].bedrooms).toBe(2)
    expect(result.rows[0].status).toBe('available')
  })

  it('returns per-column error messages when required columns are missing', () => {
    const csv = `property_id,address,area,bedrooms,bathrooms,size_sqft,status,developer,community,property_type
PROP001,123 Main St,Dubai Marina,2,2,1200,available,Emaar,Marina Walk,apartment`
    const result = parseCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Missing required column: price_aed')
  })

  it('returns row-level errors for rows with invalid enum values or type mismatches', () => {
    const csv = `property_id,address,area,price_aed,bedrooms,bathrooms,size_sqft,status,developer,community,property_type
PROP001,123 Main St,Dubai Marina,1500000,2,2,1200,pending,Emaar,Marina Walk,apartment`
    const result = parseCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('Row 2')
  })

  it('returns row-level errors when multiple columns are missing', () => {
    const csv = `property_id,address,area,size_sqft,status,developer,community,property_type
PROP001,123 Main St,Dubai Marina,1200,available,Emaar,Marina Walk,apartment`
    const result = parseCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.errors.length).toBe(3)
    expect(result.errors.some(e => e.includes('price_aed'))).toBe(true)
    expect(result.errors.some(e => e.includes('bedrooms'))).toBe(true)
    expect(result.errors.some(e => e.includes('bathrooms'))).toBe(true)
  })

  it('returns row-level error when price_aed is not numeric', () => {
    const csv = `property_id,address,area,price_aed,bedrooms,bathrooms,size_sqft,status,developer,community,property_type
PROP001,123 Main St,Dubai Marina,not-a-number,2,2,1200,available,Emaar,Marina Walk,apartment`
    const result = parseCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('accepts optional sold_date column and includes it in rows', () => {
    const csvWithDate = `property_id,address,area,price_aed,bedrooms,bathrooms,size_sqft,status,developer,community,property_type,sold_date
PROP001,123 Main St,Dubai Marina,1500000,2,2,1200,available,Emaar,Marina Walk,apartment,2024-01-15`
    const result = parseCsv(csvWithDate)
    expect(result.errors).toHaveLength(0)
    expect(result.rows[0].sold_date).toBe('2024-01-15')
  })

  it('handles CSV without sold_date column gracefully', () => {
    const result = parseCsv(VALID_CSV)
    expect(result.errors).toHaveLength(0)
    expect(result.rows[0].sold_date).toBeUndefined()
  })

  it('handles BOM and whitespace headers', () => {
    const csvWithBom = '\uFEFF' + `property_id, address ,area,price_aed,bedrooms,bathrooms,size_sqft,status,developer,community,property_type\nPROP001,123 Main St,Dubai Marina,1500000,2,2,1200,available,Emaar,Marina Walk,apartment`
    const result = parseCsv(csvWithBom)
    expect(result.errors).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
  })
})
