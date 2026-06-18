// 时区工具：墙上时间 + IANA 时区 -> 绝对 UTC 毫秒（处理 DST）。

export function wallTimeToUtcMs(date: string, time: string, timeZone: string): number {
  const [Y, M, D] = date.split('-').map(Number)
  const [h, m] = time.split(':').map(Number)
  let utc = Date.UTC(Y, M - 1, D, h, m)
  const off1 = tzOffsetMs(utc, timeZone)
  utc -= off1
  const off2 = tzOffsetMs(utc, timeZone) // DST 边界再校正一次
  if (off2 !== off1) utc = Date.UTC(Y, M - 1, D, h, m) - off2
  return utc
}

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value])) as Record<string, string>
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs
}

// 某时区当前的「今天」(YYYY-MM-DD)
export function todayInTZ(timeZone: string, now: number = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(now))
}

// ISO 日期 (YYYY-MM-DD) 加天数
export function addDaysISO(iso: string, days: number): string {
  const [Y, M, D] = iso.split('-').map(Number)
  const t = Date.UTC(Y, M - 1, D) + days * 86400000
  return new Date(t).toISOString().slice(0, 10)
}
