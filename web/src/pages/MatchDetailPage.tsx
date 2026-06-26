import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, errorKey, type MatchDetail, type Registration } from '../lib/api'
import { whenLabel, tzLabel, shareUrl } from '../lib/format'
import { useI18n } from '../lib/i18n'
import Modal from '../components/Modal'
import PinInput from '../components/PinInput'

type ModalState =
  | { type: 'register' }
  | { type: 'manage'; reg: Registration }
  | { type: 'edit' }
  | { type: 'delete' }
  | { type: 'captains' }
  | null

const CAPTAIN_COLORS = ['bg-blue-100 text-blue-800', 'bg-red-100 text-red-800']

export default function MatchDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { t, locale } = useI18n()
  const [m, setM] = useState<MatchDetail | null>(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<ModalState>(null)

  // 报名 / 管理等弹窗打开时，通知原生客户端关闭下拉刷新，避免填写时误触刷新
  useEffect(() => {
    const bridge = (window as { AndroidBridge?: { setPullToRefresh?: (enabled: boolean) => void } }).AndroidBridge
    bridge?.setPullToRefresh?.(modal === null)
  }, [modal])

  const load = useCallback(() => {
    api.getMatch(id).then(setM).catch((e) => setError(t(errorKey(e))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  useEffect(load, [load])

  function refresh() {
    setModal(null)
    load()
  }

  async function share() {
    const url = shareUrl(id)
    try {
      await navigator.clipboard.writeText(url)
      alert(t('share.copied', { url }))
    } catch {
      prompt(t('share.manual'), url)
    }
  }

  if (error) {
    return (
      <Shell onBack={() => navigate('/')}>
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
      </Shell>
    )
  }
  if (!m) {
    return (
      <Shell onBack={() => navigate('/')}>
        <p className="text-sm text-gray-400">{t('common.loading')}</p>
      </Shell>
    )
  }

  const confirmed = m.registrations.filter((r) => r.status === 'confirmed')
  const waiting = m.registrations.filter((r) => r.status === 'waiting')
  const shortfall = m.max_players - confirmed.length
  const summary =
    shortfall > 0
      ? { text: t('detail.sumShort', { n: confirmed.length, s: shortfall }), cls: 'text-orange-600' }
      : waiting.length > 0
        ? { text: t('detail.sumWaiting', { n: confirmed.length, w: waiting.length }), cls: 'text-emerald-600' }
        : { text: t('detail.sumFull', { n: confirmed.length }), cls: 'text-emerald-600' }
  const captains = confirmed.filter((r) => r.is_captain)
  const captainColor = (rid: string) => {
    const i = captains.findIndex((c) => c.id === rid)
    return i >= 0 ? CAPTAIN_COLORS[i % CAPTAIN_COLORS.length] : ''
  }

  return (
    <Shell onBack={() => navigate('/')} onShare={share}>
      <p className="text-lg font-medium text-gray-900">{whenLabel(m.date, m.time, locale)}</p>
      <p className="mt-0.5 text-sm text-gray-400">{tzLabel(m.timezone, m.start_utc)}</p>

      <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-4">
        <div className="flex items-baseline gap-3">
          <span className="w-20 shrink-0 text-sm text-gray-500">{t('detail.venueLabel')}</span>
          <span className="text-base font-medium text-gray-900">{m.venue}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="w-20 shrink-0 text-sm text-gray-500">{t('detail.feeLabel')}</span>
          <span className="text-base font-medium text-gray-900">{t('card.perPerson', { fee: m.fee.toLocaleString(locale) })}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="w-20 shrink-0 text-sm text-gray-500">{t('detail.onFieldLabel')}</span>
          <span className="text-base font-medium text-gray-900">{t('detail.players', { n: m.max_players })}</span>
        </div>
      </div>

      {m.note && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-base leading-relaxed text-gray-700">{m.note}</p>}
      {m.locked && <p className="mt-2 text-sm text-gray-400">{t('detail.endedReadonly')}</p>}

      {captains.length === 2 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-100 p-3">
          <span className="text-sm text-gray-500">{t('detail.captain')}</span>
          {captains.map((c) => (
            <span key={c.id} className={`rounded-full px-3 py-1 text-xs font-medium ${captainColor(c.id)}`}>
              {c.name}
            </span>
          ))}
        </div>
      )}

      <p className={`mt-6 mb-3 text-xl font-bold ${summary.cls}`}>{summary.text}</p>
      <div className="divide-y divide-gray-100">
        {confirmed.map((r) => (
          <button
            key={r.id}
            onClick={() => setModal({ type: 'manage', reg: r })}
            className="flex w-full items-center justify-between py-2 text-left text-sm disabled:opacity-100"
          >
            <span>
              <span className="text-gray-400">{r.position}.</span> {r.name}
              {r.is_captain ? <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${captainColor(r.id)}`}>{t('detail.captainBadge')}</span> : null}
              {r.paid ? <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">{t('detail.paid')}</span> : null}
            </span>
            <span className="text-xs text-gray-400">{m.locked ? t('detail.markPaid') : t('common.manage')}</span>
          </button>
        ))}
      </div>

      {waiting.length > 0 && (
        <div className="mt-3 rounded-lg bg-orange-50 p-3">
          <p className="mb-1 text-xs text-orange-800">{t('detail.waiting', { n: waiting.length })}</p>
          <div className="divide-y divide-orange-100">
            {waiting.map((r) => (
              <button
                key={r.id}
                onClick={() => setModal({ type: 'manage', reg: r })}
                className="flex w-full items-center justify-between py-1.5 text-left text-sm text-orange-900"
              >
                <span>
                  <span className="opacity-60">{r.position}.</span> {r.name}
                  {r.paid ? <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">{t('detail.paid')}</span> : null}
                </span>
                <span className="text-xs opacity-60">{m.locked ? t('detail.markPaid') : t('common.manage')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!m.locked && (
        <div className="mt-6 space-y-2">
          <button
            onClick={() => setModal({ type: 'register' })}
            className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700"
          >
            {t('detail.register')}
          </button>
          <div className="flex gap-2">
            <button onClick={() => setModal({ type: 'captains' })} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm text-gray-700 hover:bg-gray-100">
              {t('detail.draw')}
            </button>
            <button onClick={() => setModal({ type: 'edit' })} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm text-gray-700 hover:bg-gray-100">
              {t('detail.edit')}
            </button>
            <button onClick={() => setModal({ type: 'delete' })} className="flex-1 rounded-xl border border-red-200 py-2.5 text-sm text-red-600 hover:bg-red-50">
              {t('detail.delete')}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">{t('detail.hint')}</p>
        </div>
      )}

      {modal?.type === 'register' && <RegisterModal id={id} onClose={() => setModal(null)} onDone={refresh} />}
      {modal?.type === 'manage' && <ManageModal mid={id} reg={modal.reg} locked={m.locked} onClose={() => setModal(null)} onDone={refresh} />}
      {modal?.type === 'edit' && <EditModal m={m} onClose={() => setModal(null)} onDone={refresh} />}
      {modal?.type === 'delete' && (
        <DeleteModal id={id} count={m.registrations.length} onClose={() => setModal(null)} onDone={() => navigate('/')} />
      )}
      {modal?.type === 'captains' && <CaptainsModal id={id} onClose={() => setModal(null)} onDone={refresh} />}
    </Shell>
  )
}

function Shell({ children, onBack, onShare }: { children: React.ReactNode; onBack: () => void; onShare?: () => void }) {
  const { t } = useI18n()
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center gap-3 bg-emerald-800 px-4 py-4">
        <button onClick={onBack} aria-label={t('common.back')} className="text-xl text-white">
          &larr;
        </button>
        <span className="flex-1 text-lg font-medium text-white">{t('detail.title')}</span>
        {onShare && (
          <button onClick={onShare} className="text-sm text-emerald-100 hover:text-white">
            {t('common.share')}
          </button>
        )}
      </header>
      <main className="mx-auto max-w-md p-4 pb-10">{children}</main>
    </div>
  )
}

const primaryBtn = 'w-full rounded-xl bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50'
const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-emerald-500'

function RegisterModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setError('')
    if (!name.trim()) return setError(t('reg.errName'))
    if (pin.length !== 6) return setError(t('reg.errPin'))
    setBusy(true)
    try {
      await api.register(id, name.trim(), pin)
      onDone()
    } catch (e) {
      setError(t(errorKey(e)))
      setBusy(false)
    }
  }
  return (
    <Modal title={t('reg.title')} onClose={onClose}>
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('reg.name')} className={field} autoFocus />
        <PinInput value={pin} onChange={setPin} label={t('reg.pin')} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={go} disabled={busy} className={primaryBtn}>
          {t('reg.submit')}
        </button>
      </div>
    </Modal>
  )
}

function ManageModal({ mid, reg, locked, onClose, onDone }: { mid: string; reg: Registration; locked: boolean; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(reg.name)
  const [paid, setPaid] = useState(reg.paid === 1)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    setError('')
    if (!name.trim()) return setError(t('manage.errName'))
    if (pin.length !== 6) return setError(t('manage.errPin'))
    setBusy(true)
    try {
      // 锁场后名字不可改，提交原名字，仅「已付活动费」生效
      await api.editReg(mid, reg.id, locked ? reg.name : name.trim(), paid, pin)
      onDone()
    } catch (e) {
      setError(t(errorKey(e)))
      setBusy(false)
    }
  }
  async function remove() {
    setError('')
    if (pin.length !== 6) return setError(t('manage.errPin'))
    if (!confirm(t('manage.confirm'))) return
    setBusy(true)
    try {
      await api.deleteReg(mid, reg.id, pin)
      onDone()
    } catch (e) {
      setError(t(errorKey(e)))
      setBusy(false)
    }
  }
  return (
    <Modal title={t(locked ? 'manage.payTitle' : 'manage.title', { name: reg.name })} onClose={onClose}>
      <div className="space-y-3">
        {locked ? (
          <p className="rounded-lg bg-gray-100 p-2 text-sm text-gray-600">{t('manage.payOnly')}</p>
        ) : (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('reg.name')} className={field} />
        )}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
          <span className="text-sm text-gray-700">{t('manage.paid')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={paid}
            onClick={() => setPaid(!paid)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${paid ? 'bg-emerald-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${paid ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>
        <PinInput value={pin} onChange={setPin} label={t('manage.pin')} autoFocus />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={save} disabled={busy} className={primaryBtn}>
          {t('manage.save')}
        </button>
        {!locked && (
          <button onClick={remove} disabled={busy} className="w-full rounded-xl border border-red-200 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
            {t('manage.delete')}
          </button>
        )}
      </div>
    </Modal>
  )
}

function EditModal({ m, onClose, onDone }: { m: MatchDetail; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [time, setTime] = useState(m.time)
  const [venue, setVenue] = useState(m.venue)
  const [fee, setFee] = useState(String(m.fee))
  const [maxPlayers, setMaxPlayers] = useState(String(m.max_players))
  const [note, setNote] = useState(m.note ?? '')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setError('')
    if (pin.length !== 6) return setError(t('edit.errPin'))
    setBusy(true)
    try {
      await api.editMatch(m.id, {
        pin,
        time,
        venue: venue.trim(),
        fee: Number(fee),
        max_players: Number(maxPlayers),
        note: note.trim() || null,
      })
      onDone()
    } catch (e) {
      setError(t(errorKey(e)))
      setBusy(false)
    }
  }
  return (
    <Modal title={t('edit.title')} onClose={onClose}>
      <div className="space-y-3">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
        <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder={t('edit.venue')} className={field} />
        <div className="flex gap-3">
          <input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} className={field} placeholder={t('edit.fee')} />
          <input type="number" min={1} value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} className={field} placeholder={t('edit.max')} />
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={field} placeholder={t('edit.note')} />
        <PinInput value={pin} onChange={setPin} label={t('edit.pin')} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={go} disabled={busy} className={primaryBtn}>
          {t('edit.save')}
        </button>
      </div>
    </Modal>
  )
}

function DeleteModal({ id, count, onClose, onDone }: { id: string; count: number; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setError('')
    if (pin.length !== 6) return setError(t('del.errPin'))
    setBusy(true)
    try {
      await api.deleteMatch(id, pin)
      onDone()
    } catch (e) {
      setError(t(errorKey(e)))
      setBusy(false)
    }
  }
  return (
    <Modal title={t('del.title')} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{t('del.warn', { n: count })}</p>
        <PinInput value={pin} onChange={setPin} label={t('del.pin')} autoFocus />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={go} disabled={busy} className="w-full rounded-xl bg-red-600 py-2.5 font-medium text-white hover:bg-red-700 disabled:opacity-50">
          {t('del.confirm')}
        </button>
      </div>
    </Modal>
  )
}

function CaptainsModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setError('')
    if (pin.length !== 6) return setError(t('edit.errPin'))
    setBusy(true)
    try {
      await api.drawCaptains(id, pin)
      onDone()
    } catch (e) {
      setError(t(errorKey(e)))
      setBusy(false)
    }
  }
  return (
    <Modal title={t('draw.title')} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{t('draw.desc')}</p>
        <PinInput value={pin} onChange={setPin} label={t('draw.pin')} autoFocus />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={go} disabled={busy} className={primaryBtn}>
          {t('draw.submit')}
        </button>
      </div>
    </Modal>
  )
}
