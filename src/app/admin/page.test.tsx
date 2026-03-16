// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AdminPage from '@/app/admin/page'
import type { Upload, ListingStatsData } from '@/types/admin'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
}))

const mockUploadIndexed: Upload = {
  id: 'upload-1',
  tenant_id: 'tenant-1',
  filename: 'listings.csv',
  file_type: 'csv',
  storage_path: null,
  status: 'indexed',
  error_message: null,
  row_count: 42,
  chunk_count: null,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
}

const mockUploadProcessing: Upload = {
  ...mockUploadIndexed,
  id: 'upload-2',
  filename: 'brochure.pdf',
  file_type: 'pdf',
  status: 'processing',
  row_count: null,
}

const mockUploadError: Upload = {
  ...mockUploadIndexed,
  id: 'upload-3',
  filename: 'bad.pdf',
  file_type: 'pdf',
  status: 'error',
  error_message: 'Could not extract text',
}

const mockStats: ListingStatsData = {
  total_listings: 42,
  count_by_status: { available: 30, sold: 10, reserved: 2 },
  avg_price_by_bedrooms: {},
  price_range_by_area: {},
  recently_sold_count: 5,
  calculated_at: '2024-01-15T10:00:00Z',
}

function mockFetch(uploads: Upload[], stats: ListingStatsData | null = null) {
  vi.spyOn(global, 'fetch').mockImplementation((url: RequestInfo | URL) => {
    const urlStr = url.toString()
    if (urlStr.includes('/api/admin/uploads') && !urlStr.includes('/api/admin/uploads/')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ uploads }),
      } as Response)
    }
    if (urlStr.includes('/api/admin/stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ stats }),
      } as Response)
    }
    if (urlStr.includes('/api/admin/uploads/') && urlStr.endsWith('/upload-1')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
  })
}

describe('Admin Portal', () => {
  beforeEach(() => {
    mockFetch([mockUploadIndexed], mockStats)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders heading "Admin Portal"', async () => {
    render(<AdminPage />)
    expect(screen.getByText(/admin portal/i)).toBeInTheDocument()
  })

  it('renders upload zone element', async () => {
    render(<AdminPage />)
    // Should have a file input or a drop zone
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeTruthy()
  })

  it('renders Indexed status badge', async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Indexed')).toBeInTheDocument()
    })
  })

  it('renders Processing status badge', async () => {
    mockFetch([mockUploadProcessing])
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Processing')).toBeInTheDocument()
    })
  })

  it('renders Error badge with error message', async () => {
    mockFetch([mockUploadError])
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Could not extract text')).toBeInTheDocument()
    })
  })

  it('delete button calls DELETE API', async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Indexed')).toBeInTheDocument()
    })
    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    fireEvent.click(deleteBtn)
    await waitFor(() => {
      const fetchCalls = vi.mocked(global.fetch).mock.calls
      const deleteCall = fetchCalls.find(
        ([url, opts]) => typeof url === 'string' && url.includes('upload-1') && (opts as RequestInit)?.method === 'DELETE'
      )
      expect(deleteCall).toBeTruthy()
    })
  })

  it('renders total listings count in stats preview', async () => {
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText(/42/)).toBeInTheDocument()
    })
  })

  it('template CSV download link is present', async () => {
    render(<AdminPage />)
    const link = screen.getByRole('link', { name: /download template/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toContain('/api/admin/template')
  })

  it('starts polling when upload has processing status', async () => {
    mockFetch([mockUploadProcessing])
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    render(<AdminPage />)
    await waitFor(() => {
      expect(screen.getByText('Processing')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000)
    })
  })
})
