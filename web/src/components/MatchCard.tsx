import { useNavigate } from 'react-router-dom'
import type { MatchListItem } from '../lib/api'
import { whenLabel, tzLabel, shareUrl } from '../lib/format'

function Badge({ m }: { m: MatchListItem }) {
  if (m.locked) return <span className="rounded-full bg-gray-200 px-3 py-1 text-xs text-gray-500">已结束</span>
  if (m.shortfall > 0)
    return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">还差 {m.shortfall} 人</span>
  if (m.waiting > 0)
    return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">已满 +{m.waiting} 候补</span>
  return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">已满</span>
}

export default function MatchCard({ m }: { m: MatchListItem }) {
  const navigate = useNavigate()

  async function share(e: React.MouseEvent) {
    e.stopPropagation()
    const url = shareUrl(m.id)
    try {
      await navigator.clipboard.writeText(url)
      alert('分享链接已复制：\n' + url)
    } catch {
      prompt('复制此分享链接：', url)
    }
  }

  return (
    <div
      onClick={() => navigate(`/match/${m.id}`)}
      className={`mb-3 cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 ${
        m.locked ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{whenLabel(m.date, m.time)}</p>
          <p className="truncate text-sm text-gray-500">
            {m.venue} · {tzLabel(m.timezone, m.start_utc)}
          </p>
        </div>
        <Badge m={m} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-4 text-xs text-gray-500">
          <span>
            {m.confirmed} / {m.max_players} 人
          </span>
          <span>¥{m.fee} / 人</span>
        </div>
        <button onClick={share} className="text-xs text-emerald-700 hover:underline">
          分享
        </button>
      </div>
    </div>
  )
}
