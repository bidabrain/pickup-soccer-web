import { useI18n } from '../lib/i18n'

export default function PinInput({
  value,
  onChange,
  label,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
  autoFocus?: boolean
}) {
  const { t } = useI18n()
  return (
    <div>
      {label && <label className="mb-1 block text-xs text-gray-500">{label}</label>}
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder={t('pin.placeholder')}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg tracking-[0.4em] outline-none focus:border-emerald-500"
      />
    </div>
  )
}
