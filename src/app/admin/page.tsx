'use client'
import { useState, useEffect, useCallback } from 'react'
import { FileUploadZone } from './components/FileUploadZone'
import { UploadedFilesList } from './components/UploadedFilesList'
import { StatsPreview } from './components/StatsPreview'
import type { Upload, ListingStatsData } from '@/types/admin'

export default function AdminPage() {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [stats, setStats] = useState<ListingStatsData | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const fetchUploads = useCallback(async () => {
    const res = await fetch('/api/admin/uploads')
    if (res.ok) {
      const data = await res.json()
      setUploads(data.uploads)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/admin/stats')
    if (res.ok) {
      const data = await res.json()
      setStats(data.stats)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchUploads()
    fetchStats()
  }, [fetchUploads, fetchStats])

  // 5-second polling while any upload is processing
  useEffect(() => {
    const hasProcessing = uploads.some((u) => u.status === 'processing')
    if (!hasProcessing) return
    const id = setInterval(fetchUploads, 5000)
    return () => clearInterval(id)
  }, [uploads, fetchUploads])

  async function handleUpload(file: File) {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await fetch('/api/admin/upload', { method: 'POST', body: formData })
      await fetchUploads()
      await fetchStats()
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/uploads/${id}`, { method: 'DELETE' })
    await fetchUploads()
    await fetchStats()
  }

  return (
    <main className="max-w-4xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Portal</h1>
        <a
          href="/api/admin/template"
          download
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Download template
        </a>
      </div>

      <FileUploadZone onUpload={handleUpload} isUploading={isUploading} />

      <StatsPreview stats={stats} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Uploaded Files</h2>
        <UploadedFilesList uploads={uploads} onDelete={handleDelete} />
      </section>
    </main>
  )
}
