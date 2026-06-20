import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorKey } from '../lib/api'
import { dateOptions, labelDate } from '../lib/format'
import { useI18n } from '../lib/i18n'
import PinInput from '../components/PinInput'

const TIMEZONES: string[] = (() => {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    return fn ? fn('timeZone') : ['Asia/Seoul', 'Asia/Tokyo', 'Asia/Shanghai']
  } catch {
    return ['Asia/Seoul', 'Asia/Tokyo', 'Asia/Shanghai']
  }
})()

const TZ_GROUPS: [string, string[]][] = (() => {
  const groups: Record<string, string[]> = {}
  for (const tz of TIMEZONES) {
    const region = tz.includes('/') ? tz.split('/')[0] : 'Other'
    ;(groups[region] ??= []).push(tz)
  }
  return Object.entries(groups)
})()

export default function CreateMatchPage() {
  const navigate = useNavigate()
  const { t, locale } = useI18n()
  const [timezone, setTimezone] = useState('Asia/Seoul')
  const dates = useMemo(() => dateOptions(timezone), [timezone])
  const [date, setDate] = useState(dates[0])
  const [time, setTime] = useState('19:00')
  const [venue, setVenue] = useState('')
  const [fee, setFee] = useState('10000')
  const [maxPlayers, setMaxPlayers] = useState('10')
  const [note, setNote] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const validDate = dates.includes(date) ? date : dates[0]

  async function submit() {
    setError('')
    if (!venue.trim()) return setError(t('create.errVenue'))
    if (pin.length !== 6) return setError(t('create.errManagePin'))
    setBusy(true)
    try {
      const { id } = await api.createMatch({
        date: validDate,
        time,
        timezone,
        venue: venue.trim(),
        fee: Number(fee),
        max_players: Number(maxPlayers),
        note: note.trim() || null,
        pin,
      })
      navigate(`/match/${id}`)
    } catch (e) {
      setError(t(errorKey(e)))
      setBusy(false)
    }
  }

  const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-emerald-500'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center gap-3 bg-emerald-800 px-4 py-4">
        <button onClick={() => navigate('/')} aria-label={t('common.back')} className="text-xl text-white">
          &larr;
        </button>
        <span className="text-lg font-medium text-white">{t('create.title')}</span>
      </header>

      <main className="mx-auto max-w-md space-y-4 p-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{t('create.tz')}</label>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={field}>
            {TZ_GROUPS.map(([region, zones]) => (
              <optgroup key={region} label={region}>
                {zones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">{t('create.date')}</label>
          <select value={validDate} onChange={(e) => setDate(e.target.value)} className={field}>
            {dates.map((d, i) => (
              <option key={d} value={d}>
                {i === 0 ? `${t('create.today')} ` : ''}
                {labelDate(d, locale)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">{t('create.time')}</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">{t('create.venue')}</label>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder={t('create.venuePlaceholder')} className={field} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-500">{t('create.fee')}</label>
            <input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} className={field} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-500">{t('create.max')}</label>
            <input type="number" min={1} value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} className={field} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">{t('create.note')}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={field} />
        </div>

        <div className="rounded-lg bg-amber-50 p-3">
          <PinInput value={pin} onChange={setPin} label={t('create.managePin')} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? t('create.submitting') : t('create.submit')}
        </button>
      </main>
    </div>
  )
}
