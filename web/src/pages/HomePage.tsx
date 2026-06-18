import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, msgOf, type MatchListItem } from '../lib/api'
import MatchCard from '../components/MatchCard'

export default function HomePage() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState<MatchListItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listMatches().then(setMatches).catch((e) => setError(msgOf(e)))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-emerald-800 px-4 py-4">
        <span className="text-lg font-medium text-white">Pickup Football</span>
      </header>

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
