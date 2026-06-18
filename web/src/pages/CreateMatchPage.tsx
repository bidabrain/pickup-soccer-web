import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, msgOf } from '../lib/api'
import { dateOptions, labelDate } from '../lib/format'
import PinInput from '../components/PinInput'

const TIMEZONES: string[] = (() => {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    return fn ? fn('timeZone') : ['Asia/Seoul', 'Asia/Tokyo', 'Asia/Shanghai']
  } catch {
    return ['Asia/Seoul', 'Asia/Tokyo', 'Asia/Shanghai']
  }
})()

export default function CreateMatchPage() {
  const navigate = useNavigate()
  const [timezone, setTimezone] = useState('Asia/Seoul')
  const dates = useMemo(() => dateOptions(timezone), [timezone])
  const [date, setDate] = useState(dates[0])
  const [time, setTime] = useState('19:00')
  const [venue, setVenue] = useState('')
  const [fee, setFee] = useState('20')
  const [maxPlayers, setMaxPlayers] = useState('10')
  const [note, setNote] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // 切换时区后，若当前选中日期已不在新窗口内，回退到第一天
  const validDate = dates.includes(date) ? date : dates[0]

  async function submit() {
    setError('')
    if (!venue.trim()) return setError('请填写场地')
    if (pin.length !== 6) return setError('请设置 6 位数字管理 PIN')
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
      setError(msgOf(e))
      setBusy(false)
    }
  }

  const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-emerald-500'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center gap-3 bg-emerald-800 px-4 py-4">
        <button onClick={() => navigate(-1)} aria-label="返回" className="text-xl text-white">
          &larr;
        </button>
        <span className="text-lg font-medium text-white">新建预约</span>
      </header>

      <main className="mx-auto max-w-md space-y-4 p-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">时区</label>
          <input
            list="tz-list"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={field}
          />
          <datalist id="tz-list">
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">日期 · 仅限今天起 7 天内</label>
          <select value={validDate} onChange={(e) => setDate(e.target.value)} className={field}>
            {dates.map((d, i) => (
              <option key={d} value={d}>
                {i === 0 ? '今天 ' : ''}
                {labelDate(d)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">时间</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">场地</label>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="如 滨江体育公园 3 号场" className={field} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-500">每人费用（元）</label>
            <input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} className={field} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-500">上场人数</label>
            <input type="number" min={1} value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} className={field} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-gray-500">备注 · 选填</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={field} />
        </div>

        <div className="rounded-lg bg-amber-50 p-3">
          <PinInput value={pin} onChange={setPin} label="设置管理 PIN · 用于日后修改本场" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? '创建中…' : '创建预约'}
        </button>
      </main>
    </div>
  )
}
