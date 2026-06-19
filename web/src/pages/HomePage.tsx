import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, msgOf, type MatchListItem } from '../lib/api'
import MatchCard from '../components/MatchCard'

export default function HomePage() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState<MatchListItem[] | null>(null)
  const [error, setError] = useState('')
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    api.listMatches().then(setMatches).catch((e) => setError(msgOf(e)))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between bg-emerald-800 px-4 py-4">
        <span className="text-lg font-medium text-white">Pickup Football</span>
        <button
          onClick={() => setShowGuide(true)}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
        >
          使用说明
        </button>
      </header>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4" onClick={() => setShowGuide(false)}>
          <div
            className="mx-auto flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <span className="font-medium text-gray-900">使用说明</span>
              <button onClick={() => setShowGuide(false)} aria-label="关闭" className="text-xl leading-none text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            <div className="overflow-auto p-3">
              <img src={`${import.meta.env.BASE_URL}usage-guide.svg`} alt="Pickup Football 使用说明" className="w-full" />
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-md p-4 pb-24">
        <p className="mb-3 text-sm text-gray-500">当前预约场次</p>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!matches && !error && <p className="text-sm text-gray-400">加载中…</p>}
        {matches && matches.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            还没有预约，点右下角 + 新建一个
          </div>
        )}
        {matches?.map((m) => (
          <MatchCard key={m.id} m={m} />
        ))}
      </main>

      <button
        onClick={() => navigate('/create')}
        aria-label="新建预约"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-3xl leading-none text-white shadow-lg hover:bg-emerald-700"
      >
        +
      </button>
    </div>
  )
}
