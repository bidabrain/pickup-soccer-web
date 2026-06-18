import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, msgOf, type MatchDetail, type Registration } from '../lib/api'
import { whenLabel, tzLabel, shareUrl } from '../lib/format'
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
  const [m, setM] = useState<MatchDetail | null>(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<ModalState>(null)

  const load = useCallback(() => {
    api.getMatch(id).then(setM).catch((e) => setError(msgOf(e)))
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
      alert('分享链接已复制：\n' + url)
    } catch {
      prompt('复制此分享链接：', url)
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
        <p className="text-sm text-gray-400">加载中…</p>
      </Shell>
    )
  }

  const confirmed = m.registrations.filter((r) => r.status === 'confirmed')
  const waiting = m.registrations.filter((r) => r.status === 'waiting')
  const captains = confirmed.filter((r) => r.is_captain)
  const captainColor = (rid: string) => {
    const i = captains.findIndex((c) => c.id === rid)
    return i >= 0 ? CAPTAIN_COLORS[i % CAPTAIN_COLORS.length] : ''
  }

  return (
    <Shell onBack={() => navigate('/')} onShare={share}>
      <p className="text-lg font-medium text-gray-900">{whenLabel(m.date, m.time)}</p>
      <p className="mt-1 text-sm text-gray-500">
        {m.venue} · {tzLabel(m.timezone, m.start_utc)} · ₩{m.fee.toLocaleString()}/人 · 上场 {m.max_players} 人
      </p>
      {m.note && <p className="mt-2 rounded-lg bg-gray-100 p-2 text-sm text-gray-600">{m.note}</p>}
      {m.locked && <p className="mt-2 text-sm text-gray-400">该场已结束，仅可查看</p>}

      {captains.length === 2 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-100 p-3">
          <span className="text-sm text-gray-500">队长</span>
          {captains.map((c) => (
            <span key={c.id} className={`rounded-full px-3 py-1 text-xs font-medium ${captainColor(c.id)}`}>
              {c.name}
            </span>
          ))}
        </div>
      )}

      <p className="mt-5 mb-2 text-xs text-gray-500">已报名 {confirmed.length} 人</p>
      <div className="divide-y divide-gray-100">
        {confirmed.map((r) => (
          <button
            key={r.id}
            disabled={m.locked}
            onClick={() => setModal({ type: 'manage', reg: r })}
            className="flex w-full items-center justify-between py-2 text-left text-sm disabled:opacity-100"
          >
            <span>
              <span className="text-gray-400">{r.position}.</span> {r.name}
              {r.is_captain ? <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${captainColor(r.id)}`}>队长</span> : null}
              {r.paid ? <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">已付</span> : null}
            </span>
            {!m.locked && <span className="text-xs text-gray-400">管理</span>}
          </button>
        ))}
      </div>

      {waiting.length > 0 && (
        <div className="mt-3 rounded-lg bg-orange-50 p-3">
          <p className="mb-1 text-xs text-orange-800">候补名单 (Waiting List) · {waiting.length} 人</p>
          <div className="divide-y divide-orange-100">
            {waiting.map((r) => (
              <button
                key={r.id}
                disabled={m.locked}
                onClick={() => setModal({ type: 'manage', reg: r })}
                className="flex w-full items-center justify-between py-1.5 text-left text-sm text-orange-900"
              >
                <span>
                  <span className="opacity-60">{r.position}.</span> {r.name}
                  {r.paid ? <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">已付</span> : null}
                </span>
                {!m.locked && <span className="text-xs opacity-60">管理</span>}
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
            报名参加
          </button>
          <div className="flex gap-2">
            <button onClick={() => setModal({ type: 'captains' })} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm text-gray-700 hover:bg-gray-100">
              随机抽队长
            </button>
            <button onClick={() => setModal({ type: 'edit' })} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm text-gray-700 hover:bg-gray-100">
              编辑本场
            </button>
            <button onClick={() => setModal({ type: 'delete' })} className="flex-1 rounded-xl border border-red-200 py-2.5 text-sm text-red-600 hover:bg-red-50">
              删除本场
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">报名后可点自己的名字修改/删除 · 编辑与删除本场需管理 PIN</p>
        </div>
      )}

      {modal?.type === 'register' && <RegisterModal id={id} onClose={() => setModal(null)} onDone={refresh} />}
      {modal?.type === 'manage' && <ManageModal mid={id} reg={modal.reg} onClose={() => setModal(null)} onDone={refresh} />}
      {modal?.type === 'edit' && <EditModal m={m} onClose={() => setModal(null)} onDone={refresh} />}
      {modal?.type === 'delete' && (
        <DeleteModal id={id} count={m.registrations.length} onClose={() => setModal(null)} onDone={() => navigate('/')} />
      )}
      {modal?.type === 'captains' && <CaptainsModal id={id} onClose={() => setModal(null)} onDone={refresh} />}
    </Shell>
  )
}

function Shell({ children, onBack, onShare }: { children: React.ReactNode; onBack: () => void; onShare?: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center gap-3 bg-emerald-800 px-4 py-4">
        <button onClick={onBack} aria-label="返回" className="text-xl text-white">
          &larr;
        </button>
        <span className="flex-1 text-lg font-medium text-white">场次详情</span>
        {onShare && (
          <button onClick={onShare} className="text-sm text-emerald-100 hover:text-white">
            分享
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
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setError('')
    if (!name.trim()) return setError('请输入名字')
    if (pin.length !== 6) return setError('请设置 6 位数字 PIN')
    setBusy(true)
    try {
      await api.register(id, name.trim(), pin)
      onDone()
    } catch (e) {
      setError(msgOf(e))
      setBusy(false)
    }
  }
  return (
    <Modal title="报名参加" onClose={onClose}>
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字" className={field} autoFocus />
        <PinInput value={pin} onChange={setPin} label="设置 PIN · 日后改/删自己的报名需要它" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={go} disabled={busy} className={primaryBtn}>
          确认报名
        </button>
      </div>
    </Modal>
  )
}

function ManageModal({ mid, reg, onClose, onDone }: { mid: string; reg: Registration; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(reg.name)
  const [paid, setPaid] = useState(reg.paid === 1)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    setError('')
    if (!name.trim()) return setError('请输入名字')
    if (pin.length !== 6) return setError('请输入你的 PIN')
    setBusy(true)
    try {
      await api.editReg(mid, reg.id, name.trim(), paid, pin)
      onDone()
    } catch (e) {
      setError(msgOf(e))
      setBusy(false)
    }
  }
  async function remove() {
    setError('')
    if (pin.length !== 6) return setError('请输入你的 PIN')
    if (!confirm('确认删除这条报名？')) return
    setBusy(true)
    try {
      await api.deleteReg(mid, reg.id, pin)
      onDone()
    } catch (e) {
      setError(msgOf(e))
      setBusy(false)
    }
  }
  return (
    <Modal title={`管理报名 · ${reg.name}`} onClose={onClose}>
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="名字" className={field} />
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
          <span className="text-sm text-gray-700">已付活动费</span>
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
        <PinInput value={pin} onChange={setPin} label="输入你报名时设置的 PIN" autoFocus />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={save} disabled={busy} className={primaryBtn}>
          保存修改
        </button>
        <button onClick={remove} disabled={busy} className="w-full rounded-xl border border-red-200 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
          删除报名
        </button>
      </div>
    </Modal>
  )
}

function EditModal({ m, onClose, onDone }: { m: MatchDetail; onClose: () => void; onDone: () => void }) {
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
    if (pin.length !== 6) return setError('请输入管理 PIN')
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
      setError(msgOf(e))
      setBusy(false)
    }
  }
  return (
    <Modal title="编辑本场（日期不可改）" onClose={onClose}>
      <div className="space-y-3">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
        <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="场地" className={field} />
        <div className="flex gap-3">
          <input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} className={field} placeholder="费用" />
          <input type="number" min={1} value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} className={field} placeholder="人数" />
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={field} placeholder="备注" />
        <PinInput value={pin} onChange={setPin} label="管理 PIN" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={go} disabled={busy} className={primaryBtn}>
          保存
        </button>
      </div>
    </Modal>
  )
}

function DeleteModal({ id, count, onClose, onDone }: { id: string; count: number; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setError('')
    if (pin.length !== 6) return setError('请输入管理 PIN')
    setBusy(true)
    try {
      await api.deleteMatch(id, pin)
      onDone()
    } catch (e) {
      setError(msgOf(e))
      setBusy(false)
    }
  }
  return (
    <Modal title="删除本场" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">将永久删除本场，并移除 {count} 名报名球员。此操作不可恢复。</p>
        <PinInput value={pin} onChange={setPin} label="管理 PIN" autoFocus />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={go} disabled={busy} className="w-full rounded-xl bg-red-600 py-2.5 font-medium text-white hover:bg-red-700 disabled:opacity-50">
          确认删除
        </button>
      </div>
    </Modal>
  )
}

function CaptainsModal({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    setError('')
    if (pin.length !== 6) return setError('请输入管理 PIN')
    setBusy(true)
    try {
      await api.drawCaptains(id, pin)
      onDone()
    } catch (e) {
      setError(msgOf(e))
      setBusy(false)
    }
  }
  return (
    <Modal title="随机抽 2 名队长" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">从「确认上场」名单中随机抽取 2 人作为队长。可重复抽，覆盖上次结果。</p>
        <PinInput value={pin} onChange={setPin} label="管理 PIN" autoFocus />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={go} disabled={busy} className={primaryBtn}>
          抽取
        </button>
      </div>
    </Modal>
  )
}
