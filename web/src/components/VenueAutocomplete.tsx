import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'

// 场地输入：边打字边用 OpenStreetMap (Photon) 搜索地址，结果在下拉菜单展示。
// - 从下拉选择 → onChange(选中的地址文本, lat, lon)，调用方据此显示小地图。
// - 手动输入文字（不选）→ onChange(文本, null, null)，保持原有纯文字行为，无地图。
// 完全可选：搜不到或不联网时，输入框仍是普通文本框，不影响创建。

interface Feature {
  geometry: { coordinates: [number, number] } // [lon, lat]
  properties: Record<string, string>
}

interface Props {
  value: string
  onChange: (text: string, lat: number | null, lon: number | null) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

// 把 Photon 的地址字段拼成「主名 + 次级地址」两行展示
function buildLabel(p: Record<string, string>): { title: string; subtitle: string } {
  const title = p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || p.city || p.country || '—'
  const seen = new Set([title])
  const subtitle = [p.district, p.city, p.county, p.state, p.country]
    .filter((x) => x && !seen.has(x) && (seen.add(x), true))
    .join(', ')
  return { title, subtitle }
}

export default function VenueAutocomplete({ value, onChange, placeholder, className, autoFocus }: Props) {
  const { t, lang } = useI18n()
  const [results, setResults] = useState<Feature[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [loading, setLoading] = useState(false)
  const lastPicked = useRef<string | null>(null) // 选中后的文本，避免再次触发搜索
  const boxRef = useRef<HTMLDivElement>(null)

  // 防抖搜索：输入 >= 2 字、且不是刚选中的文本时，300ms 后查询 Photon
  useEffect(() => {
    const q = value.trim()
    if (q.length < 2 || q === lastPicked.current) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const lng = lang === 'en' ? 'en' : 'default' // Photon 仅支持部分语言，其余用 default
        const res = await fetch(
          `https://photon.komoot.io/api?q=${encodeURIComponent(q)}&limit=5&lang=${lng}`,
          { signal: ctrl.signal },
        )
        const data = await res.json()
        const feats = ((data.features ?? []) as Feature[]).filter((f) => Array.isArray(f.geometry?.coordinates))
        setResults(feats)
        setActive(-1)
        setOpen(true)
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [value, lang])

  // 点击输入框外部关闭下拉
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pick(f: Feature) {
    const { title, subtitle } = buildLabel(f.properties)
    const label = subtitle ? `${title}, ${subtitle}` : title
    const [lon, lat] = f.geometry.coordinates
    lastPicked.current = label
    onChange(label, lat, lon)
    setOpen(false)
    setResults([])
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      pick(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          lastPicked.current = null // 用户手动改字 → 清除已选地点，回到纯文字
          onChange(e.target.value, null, null)
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        className={className}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {open && (results.length > 0 || loading) && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-400">{t('venue.searching')}</li>
          )}
          {results.map((f, i) => {
            const { title, subtitle } = buildLabel(f.properties)
            return (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // 防止点击前输入框先失焦
                  onClick={() => pick(f)}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left hover:bg-emerald-50 ${i === active ? 'bg-emerald-50' : ''}`}
                >
                  <span className="text-sm text-gray-900">{title}</span>
                  {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
