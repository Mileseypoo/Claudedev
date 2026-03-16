import { describe, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
}))

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({ uploads: [] }),
})

describe('Admin Portal', () => {
  it.todo('renders heading "Admin Portal"')
  it.todo('renders upload zone element')
  it.todo('renders status badge "Indexed" when upload.status is "indexed"')
})
