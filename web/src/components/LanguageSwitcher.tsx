import { useI18n, LANGS, type Lang } from '../lib/i18n'

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n()
  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label="Language"
      className="rounded-lg border border-emerald-600 bg-emerald-700 px-2 py-1.5 text-sm text-white outline-none"
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code} className="text-gray-900">
          {l.label}
        </option>
      ))}
    </select>
  )
}
