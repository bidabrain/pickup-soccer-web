import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorKey, type MatchListItem } from '../lib/api'
import { useI18n } from '../lib/i18n'
import MatchCard from '../components/MatchCard'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function HomePage() {
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const [matches, setMatches] = useState<MatchListItem[] | null>(null)
  const [error, setError] = useState('')
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    api.listMatches().then(setMatches).catch((e) => setError(t(errorKey(e))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between gap-2 bg-emerald-800 px-4 py-4">
        <span className="text-lg font-medium text-white">Pickup Football</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <a
            href="https://github.com/bidabrain/pickup-soccer-web/releases/download/1.0.0/pickup-soccer-client.apk"
            className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M17.523 15.341a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8m-11.046 0a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8M17.7 9H6.3L5 11.4V17h14v-5.6L17.7 9zM3.513 8.28l1.92-3.46a.4.4 0 0 1 .694.4L4.22 8.5A8.48 8.48 0 0 1 12 6a8.48 8.48 0 0 1 7.78 2.5l-1.906-3.28a.4.4 0 1 1 .692-.4l1.921 3.46C22.24 9.82 23 12.07 23 14.5V18a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3.5C1 12.07 1.76 9.82 3.513 8.28z" />
            </svg>
            {t('nav.download')}
          </a>
          <button
            onClick={() => setShowGuide(true)}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
          >
            {t('nav.guide')}
          </button>
        </div>
      </header>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4" onClick={() => setShowGuide(false)}>
          <div
            className="mx-auto flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <span className="font-medium text-gray-900">{t('nav.guide')}</span>
              <button onClick={() => setShowGuide(false)} aria-label={t('common.close')} className="text-xl leading-none text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            <div className="overflow-auto p-3">
              <img src={`${import.meta.env.BASE_URL}usage-guide-${lang}.svg?v=2`} alt={t('nav.guide')} className="w-full" />
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-md p-4 pb-24">
        <p className="mb-3 text-sm text-gray-500">{t('home.current')}</p>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!matches && !error && <p className="text-sm text-gray-400">{t('common.loading')}</p>}
        {matches && matches.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            {t('home.empty')}
          </div>
        )}
        {matches?.map((m) => (
          <MatchCard key={m.id} m={m} />
        ))}
      </main>

      <button
        onClick={() => navigate('/create')}
        aria-label={t('home.newMatch')}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-3xl leading-none text-white shadow-lg hover:bg-emerald-700"
      >
        +
      </button>
    </div>
  )
}
