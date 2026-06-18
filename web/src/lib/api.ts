const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://pickup-soccer-api.bidabrain.workers.dev'

export interface MatchListItem {
  id: string
  date: string
  time: string
  timezone: string
  start_utc: number
  venue: string
  fee: number
  max_players: number
  note: string | null
  captains_drawn: number
  reg_count: number
  confirmed: number
  waiting: number
  shortfall: number
  locked: boolean
}

export interface Registration {
  id: string
  name: string
  position: number
  is_captain: number
  paid: number
  created_at: number
  status: 'confirmed' | 'waiting'
}

export interface MatchDetail {
  id: string
  date: string
  time: string
  timezone: string
  start_utc: number
  venue: string
  fee: number
  max_players: number
  note: string | null
  captains_drawn: number
  created_at: number
  locked: boolean
  registrations: Registration[]
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, status: number, message?: string) {
    super(message ?? code)
    this.code = code
    this.status = status
  }
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(data?.error ?? 'ERROR', res.status, data?.message)
  return data as T
}

export interface CreateBody {
  date: string; time: string; timezone: string; venue: string
  fee: number; max_players: number; note: string | null; pin: string
}
export interface EditBody {
  pin: string; time?: string; venue?: string; fee?: number; max_players?: number; note?: string | null
}

export const api = {
  listMatches: () => req<MatchListItem[]>('/api/matches'),
  getMatch: (id: string) => req<MatchDetail>(`/api/matches/${id}`),
  createMatch: (body: CreateBody) => req<{ id: string }>('/api/matches', { method: 'POST', body: JSON.stringify(body) }),
  editMatch: (id: string, body: EditBody) => req<{ ok: true }>(`/api/matches/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMatch: (id: string, pin: string) => req<{ ok: true }>(`/api/matches/${id}`, { method: 'DELETE', body: JSON.stringify({ pin }) }),
  register: (id: string, name: string, pin: string) => req<{ id: string; position: number }>(`/api/matches/${id}/registrations`, { method: 'POST', body: JSON.stringify({ name, pin }) }),
  editReg: (mid: string, rid: string, name: string, paid: boolean, pin: string) => req<{ ok: true }>(`/api/matches/${mid}/registrations/${rid}`, { method: 'PUT', body: JSON.stringify({ name, paid, pin }) }),
  deleteReg: (mid: string, rid: string, pin: string) => req<{ ok: true }>(`/api/matches/${mid}/registrations/${rid}`, { method: 'DELETE', body: JSON.stringify({ pin }) }),
  drawCaptains: (id: string, pin: string) => req<{ captains: { id: string; name: string }[] }>(`/api/matches/${id}/captains`, { method: 'POST', body: JSON.stringify({ pin }) }),
}

export function msgOf(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'PIN_INVALID': return 'PIN 错误'
      case 'PIN_DUPLICATE': return '该 PIN 与本场其他人重复，请换一个'
      case 'RATE_LIMITED': return '尝试过于频繁，请约 10 分钟后再试'
      case 'MATCH_LOCKED': return '该场已开赛，不可修改'
      case 'NOT_FOUND': return '未找到（可能已被清除）'
      case 'VALIDATION': return e.message || '输入有误'
      default: return e.message || '操作失败'
    }
  }
  return '网络错误，请重试'
}
