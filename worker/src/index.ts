// Pickup Football API — Cloudflare Worker + D1
// M1 核心切片：health / 列表 / 建场 / 详情 / 报名（含 PIN 判重 + 时区窗口）。
// M2 再补：改/删报名、编辑本场、抽队长、PIN 限流。

import { hashPin, pinLookup, randomSecret } from './crypto'
import { wallTimeToUtcMs, todayInTZ, addDaysISO } from './time'

export interface Env {
  DB: D1Database
}

const DAY = 86400000

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}
function err(code: string, status: number, message?: string): Response {
  return json({ error: code, message: message ?? code }, status)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
    const url = new URL(req.url)
    const path = url.pathname.replace(/\/+$/, '')

    try {
      if (req.method === 'GET' && path === '/api/health') return json({ ok: true })
      if (req.method === 'GET' && path === '/api/matches') return listMatches(env)
      if (req.method === 'POST' && path === '/api/matches') return createMatch(req, env)

      const detail = path.match(/^\/api\/matches\/([^/]+)$/)
      if (detail && req.method === 'GET') return getMatch(env, detail[1])

      const reg = path.match(/^\/api\/matches\/([^/]+)\/registrations$/)
      if (reg && req.method === 'POST') return register(req, env, reg[1])

      return err('NOT_FOUND', 404)
    } catch (e) {
      return err('INTERNAL', 500, e instanceof Error ? e.message : String(e))
    }
  },

  // 每日清理：删除开赛已超过 30 天的场次（registrations 级联删除）
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await env.DB.prepare('DELETE FROM matches WHERE start_utc < ?')
      .bind(Date.now() - 30 * DAY)
      .run()
  },
}

async function listMatches(env: Env): Promise<Response> {
  const now = Date.now()
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.date, m.time, m.timezone, m.start_utc, m.venue, m.fee,
            m.max_players, m.note, m.captains_drawn,
            (SELECT COUNT(*) FROM registrations r WHERE r.match_id = m.id) AS reg_count
       FROM matches m
      WHERE m.start_utc >= ?
      ORDER BY m.start_utc ASC`
  ).bind(now - 30 * DAY).all()

  const list = (results as Record<string, number>[]).map((m) => {
    const confirmed = Math.min(m.reg_count, m.max_players)
    const waiting = Math.max(0, m.reg_count - m.max_players)
    const shortfall = Math.max(0, m.max_players - m.reg_count)
    return { ...m, confirmed, waiting, shortfall, locked: now > m.start_utc }
  })
  return json(list)
}

async function createMatch(req: Request, env: Env): Promise<Response> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return err('VALIDATION', 400, 'invalid json')

  const date = String(b.date ?? '')
  const time = String(b.time ?? '')
  const venue = String(b.venue ?? '').trim()
  const timezone = String(b.timezone ?? 'Asia/Seoul')
  const fee = Number(b.fee)
  const max_players = Number(b.max_players)
  const note = b.note ? String(b.note) : null
  const pin = String(b.pin ?? '')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('VALIDATION', 400, 'bad date')
  if (!/^\d{2}:\d{2}$/.test(time)) return err('VALIDATION', 400, 'bad time')
  if (!venue) return err('VALIDATION', 400, 'venue required')
  if (!/^\d{6}$/.test(pin)) return err('VALIDATION', 400, 'pin must be 6 digits')
  if (!Number.isInteger(fee) || fee < 0) return err('VALIDATION', 400, 'fee invalid')
  if (!Number.isInteger(max_players) || max_players < 1) return err('VALIDATION', 400, 'max_players invalid')

  let today: string
  try {
    today = todayInTZ(timezone)
  } catch {
    return err('VALIDATION', 400, 'bad timezone')
  }
  if (date < today || date > addDaysISO(today, 7)) {
    return err('VALIDATION', 400, 'date must be within 7 days')
  }

  const start_utc = wallTimeToUtcMs(date, time, timezone)
  const id = crypto.randomUUID()
  const organizer_pin_hash = await hashPin(pin)
  const match_secret = randomSecret()

  await env.DB.prepare(
    `INSERT INTO matches
       (id,date,time,timezone,start_utc,venue,fee,max_players,note,organizer_pin_hash,match_secret,captains_drawn,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?)`
  ).bind(id, date, time, timezone, start_utc, venue, fee, max_players, note,
         organizer_pin_hash, match_secret, Date.now()).run()

  return json({ id }, 201)
}

async function getMatch(env: Env, id: string): Promise<Response> {
  const m = (await env.DB.prepare(
    `SELECT id,date,time,timezone,start_utc,venue,fee,max_players,note,captains_drawn,created_at
       FROM matches WHERE id = ?`
  ).bind(id).first()) as Record<string, number> | null
  if (!m) return err('NOT_FOUND', 404)

  const { results } = await env.DB.prepare(
    `SELECT id,name,position,is_captain,created_at
       FROM registrations WHERE match_id = ? ORDER BY position ASC`
  ).bind(id).all()

  const registrations = (results as Record<string, number>[]).map((r) => ({
    ...r,
    status: r.position <= m.max_players ? 'confirmed' : 'waiting',
  }))

  return json({ ...m, locked: Date.now() > m.start_utc, registrations })
}

async function register(req: Request, env: Env, matchId: string): Promise<Response> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return err('VALIDATION', 400, 'invalid json')

  const name = String(b.name ?? '').trim()
  const pin = String(b.pin ?? '')
  if (!name) return err('VALIDATION', 400, 'name required')
  if (!/^\d{6}$/.test(pin)) return err('VALIDATION', 400, 'pin must be 6 digits')

  const m = (await env.DB.prepare('SELECT start_utc, match_secret FROM matches WHERE id = ?')
    .bind(matchId).first()) as { start_utc: number; match_secret: string } | null
  if (!m) return err('NOT_FOUND', 404)
  if (Date.now() > m.start_utc) return err('MATCH_LOCKED', 403)

  const lookup = await pinLookup(pin, m.match_secret)
  const pin_hash = await hashPin(pin)
  const row = (await env.DB.prepare(
    'SELECT COALESCE(MAX(position),0)+1 AS pos FROM registrations WHERE match_id = ?'
  ).bind(matchId).first()) as { pos: number }
  const position = row.pos
  const id = crypto.randomUUID()

  try {
    await env.DB.prepare(
      `INSERT INTO registrations (id,match_id,name,pin_hash,pin_lookup,position,is_captain,created_at)
       VALUES (?,?,?,?,?,?,0,?)`
    ).bind(id, matchId, name, pin_hash, lookup, position, Date.now()).run()
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return err('PIN_DUPLICATE', 409, 'pin already used in this match')
    }
    throw e
  }

  return json({ id, position }, 201)
}
