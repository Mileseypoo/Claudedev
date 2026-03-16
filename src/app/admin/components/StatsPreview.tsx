import type { ListingStatsData } from '@/types/admin'

interface Props {
  stats: ListingStatsData | null
}

export function StatsPreview({ stats }: Props) {
  if (!stats) {
    return (
      <div className="rounded-lg border border-gray-200 p-4 text-gray-500">
        No listings indexed yet.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-2">
      <h2 className="font-semibold text-gray-700">Listings Summary</h2>
      <p className="text-2xl font-bold">{stats.total_listings} listings indexed</p>
      <div className="flex gap-4 text-sm text-gray-600">
        <span>{stats.count_by_status.available} available</span>
        <span>{stats.count_by_status.sold} sold</span>
        <span>{stats.count_by_status.reserved} reserved</span>
      </div>
      {stats.recently_sold_count > 0 && (
        <p className="text-sm text-gray-500">{stats.recently_sold_count} sold in last 30 days</p>
      )}
    </div>
  )
}
