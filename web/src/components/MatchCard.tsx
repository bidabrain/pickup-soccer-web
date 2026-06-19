import { useNavigate } from 'react-router-dom'
import type { MatchListItem } from '../lib/api'
import { whenLabel, tzLabel, shareUrl } from '../lib/format'
import { useI18n } from '../lib/i18n'

function Badge({ m }: { m: MatchListItem }) {
  const { t } = useI18n()
  if (m.locked) return <span className="rounded-full bg-gray-200 px-3 py-1 text-xs text-gray-500">{t('card.ended')}</span>
  if (m.shortfall > 0)
    return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{t('card.shortfall', { n: m.shortfall })}</span>
  if (m.waiting > 0)
    return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">{t('card.fullWaiting', { n: m.waiting })}</span>
  return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">{t('card.full')}</span>
}

export default function MatchCard({ m }: { m: MatchListItem }) {
  const navigate = useNavigate()
  const { t, locale } = useI18n()

  async function share(e: React.MouseEvent) {
    e.stopPropagation()
    const url = shareUrl(m.id)
    try {
      await navigator.clipboard.writeText(url)
      alert(t('share.copied', { url }))
    } catch {
      prompt(t('share.manual'), url)
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
          <p className="font-medium text-gray-900">{whenLabel(m.date, m.time, locale)}</p>
          <p className="truncate text-sm text-gray-500">
            {m.venue} · {tzLabel(m.timezone, m.start_utc)}
          </p>
        </div>
        <Badge m={m} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-4 text-xs text-gray-500">
          <span>{t('card.people', { c: m.confirmed, m: m.max_players })}</span>
          <span>{t('card.perPerson', { fee: m.fee.toLocaleString(locale) })}</span>
        </div>
        <button onClick={share} className="text-xs text-emerald-700 hover:underline">
          {t('common.share')}
        </button>
      </div>
    </div>
  )
}
