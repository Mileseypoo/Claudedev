export type UploadStatus = 'processing' | 'indexed' | 'error'

export interface Upload {
  id: string
  tenant_id: string
  filename: string
  file_type: 'csv' | 'pdf'
  storage_path: string | null
  status: UploadStatus
  error_message: string | null
  row_count: number | null
  chunk_count: number | null
  created_at: string
  updated_at: string
}

export interface Listing {
  id: string
  tenant_id: string
  property_id: string
  address: string
  area: string
  price_aed: number
  bedrooms: number
  bathrooms: number
  size_sqft: number
  status: 'available' | 'sold' | 'reserved'
  developer: string
  community: string
  property_type: string
  sold_date: string | null
  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  tenant_id: string
  upload_id: string
  chunk_index: number
  content: string
  created_at: string
}

export interface ListingStatsData {
  count_by_status: {
    available: number
    sold: number
    reserved: number
  }
  avg_price_by_bedrooms: Record<string, number>
  price_range_by_area: Record<string, { min: number; max: number; median: number }>
  recently_sold_count: number
  total_listings: number
  calculated_at: string
}

export interface ListingStats {
  tenant_id: string
  stats: ListingStatsData
  updated_at: string
}

export type ListingRow = {
  property_id: string
  address: string
  area: string
  price_aed: number
  bedrooms: number
  bathrooms: number
  size_sqft: number
  status: 'available' | 'sold' | 'reserved'
  developer: string
  community: string
  property_type: string
  sold_date?: string | null
}

export interface CsvValidationResult {
  rows: ListingRow[]
  errors: string[]
}
