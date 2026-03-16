'use client'
import { useRef, useState, DragEvent } from 'react'

interface Props {
  onUpload: (file: File) => Promise<void>
  isUploading: boolean
}

const MAX_SIZE = 50 * 1024 * 1024

export function FileUploadZone({ onUpload, isUploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setSizeError(null)
    if (file.size > MAX_SIZE) {
      setSizeError('File exceeds 50MB limit')
      return
    }
    await onUpload(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isUploading ? (
          <p className="text-gray-500">Uploading...</p>
        ) : (
          <p className="text-gray-500">Drop CSV or PDF here, or click to browse</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.pdf"
          onChange={handleChange}
          className="hidden"
        />
      </div>
      {sizeError && <p className="text-red-600 text-sm mt-1">{sizeError}</p>}
    </div>
  )
}
