'use client'
import type { Upload } from '@/types/admin'

interface Props {
  uploads: Upload[]
  onDelete: (id: string) => Promise<void>
}

function StatusBadge({ upload }: { upload: Upload }) {
  if (upload.status === 'indexed') {
    return <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">Indexed</span>
  }
  if (upload.status === 'processing') {
    return <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">Processing</span>
  }
  return (
    <div>
      <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">Error</span>
      {upload.error_message && (
        <p className="text-xs text-red-600 mt-1">{upload.error_message}</p>
      )}
    </div>
  )
}

export function UploadedFilesList({ uploads, onDelete }: Props) {
  if (uploads.length === 0) {
    return <p className="text-gray-500 text-sm">No files uploaded yet.</p>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="pb-2 font-medium">Filename</th>
          <th className="pb-2 font-medium">Type</th>
          <th className="pb-2 font-medium">Date</th>
          <th className="pb-2 font-medium">Status</th>
          <th className="pb-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {uploads.map((upload) => (
          <tr key={upload.id} className="border-b py-2">
            <td className="py-2 pr-4">{upload.filename}</td>
            <td className="py-2 pr-4 uppercase">{upload.file_type}</td>
            <td className="py-2 pr-4">{new Date(upload.created_at).toLocaleDateString()}</td>
            <td className="py-2 pr-4"><StatusBadge upload={upload} /></td>
            <td className="py-2">
              <button
                onClick={() => onDelete(upload.id)}
                className="text-red-600 hover:text-red-800 text-xs font-medium"
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
