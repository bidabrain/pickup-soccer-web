const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function weekday(iso: string): string {
  const [Y, M, D] = iso.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(Y, M - 1, D)).getUTCDay()]
}

// "周三 6/19 · 19:00"
export function whenLabel(date: string, time: string): string {
  const [, M, D] = date.split('-').map(Number)
  return `${weekday(date)} ${M}/${D} · ${time}`
}

// "6/19 周三"
export function labelDate(iso: string): string {
  const [, M, D] = iso.split('-').map(Number)
  return `${M}/${D} ${weekday(iso)}`
}

// 短时区名，如 "KST" / "GMT+9"
export function tzLabel(timezone: string, startUtc: number): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
      .formatToParts(new Date(startUtc))
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timezone
  } catch {
    return timezone
  }
}

// 某时区的「今天」(YYYY-MM-DD)。非法时区时回退到本地，避免抛异常导致白屏
export function todayInTZ(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date())
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  }
}

// 今天起 8 个日期（含今天，共 7 天窗口内）
export function dateOptions(timezone: string): string[] {
  const [Y, M, D] = todayInTZ(timezone).split('-').map(Number)
  const base = Date.UTC(Y, M - 1, D)
  return Array.from({ length: 8 }, (_, i) => new Date(base + i * 86400000).toISOString().slice(0, 10))
}

export function shareUrl(id: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}#/match/${id}`
}
