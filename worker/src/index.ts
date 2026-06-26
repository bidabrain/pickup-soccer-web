// Pickup Football API — Cloudflare Worker + D1
// 接口：health / 列表 / 建场 / 详情 / 报名 / 编辑本场 / 删除本场 /
//       改报名 / 删报名 / 抽队长。写接口含限流；PIN 验证失败计数限流。

import { hashPin, verifyPin, pinLookup, randomSecret } from './crypto'
import { wallTimeToUtcMs, todayInTZ, addDaysISO } from './time'
import { rateCheck, rateBump, rateConsume } from './ratelimit'
import { notifyTopic } from './notify'

export interface Env {
  DB: D1Database
  FIREBASE_SERVICE_ACCOUNT?: string
}

const DAY = 86400000
const PIN_WINDOW = 10 * 60 * 1000 // PIN 失败窗口 10 分钟
const PIN_LIMIT = 10 // 10 分钟内最多 10 次失败

const ALLOWED_ORIGINS = ['https://bidabrain.github.io', 'http://localhost:5173']

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function err(code: string, status: number, message?: string): Response {
  return json({ error: code, message: message ?? code }, status)
}

function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? 'local'
}

function randInt(maxExclusive: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % maxExclusive
}
function pickTwo<T>(arr: T[]): [T, T] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return [a[0], a[1]]
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = corsHeaders(req)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(req.url)
    const path = url.pathname.replace(/\/+$/, '')
    const ip = clientIp(req)

    let res: Response
    try {
      res = await route(req, env, ctx, path, ip)
    } catch (e) {
      res = err('INTERNAL', 500, e instanceof Error ? e.message : String(e))
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
    return res
  },

  // 每日清理：删除开赛超 30 天的场次 + 其报名 + 过期限流记录
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const now = Date.now()
    await env.DB.batch([
      env.DB.prepare('DELETE FROM registrations WHERE match_id IN (SELECT id FROM matches WHERE start_utc < ?)').bind(now - 30 * DAY),
      env.DB.prepare('DELETE FROM matches WHERE start_utc < ?').bind(now - 30 * DAY),
      env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - DAY),
    ])
  },
}

async function route(req: Request, env: Env, ctx: ExecutionContext, path: string, ip: string): Promise<Response> {
  if (req.method === 'GET' && path === '/api/health') return json({ ok: true })
  if (req.method === 'GET' && path === '/api/matches') return listMatches(env)
  if (req.method === 'POST' && path === '/api/matches') return createMatch(req, env, ctx, ip)

  const detail = path.match(/^\/api\/matches\/([^/]+)$/)
  if (detail) {
    const id = detail[1]
    if (req.method === 'GET') return getMatch(env, id)
    if (req.method === 'PUT') return editMatch(req, env, ctx, id, ip)
    if (req.method === 'DELETE') return deleteMatch(req, env, ctx, id, ip)
  }

  const regList = path.match(/^\/api\/matches\/([^/]+)\/registrations$/)
  if (regList && req.method === 'POST') return register(req, env, regList[1], ip)

  const regItem = path.match(/^\/api\/matches\/([^/]+)\/registrations\/([^/]+)$/)
  if (regItem) {
    const [, mid, rid] = regItem
    if (req.method === 'PUT') return editReg(req, env, mid, rid, ip)
    if (req.method === 'DELETE') return deleteReg(req, env, ctx, mid, rid, ip)
  }

  const captains = path.match(/^\/api\/matches\/([^/]+)\/captains$/)
  if (captains && req.method === 'POST') return drawCaptains(req, env, captains[1], ip)

  return err('NOT_FOUND', 404)
}

// 校验 PIN：先查是否被限流，再验。失败则计数。返回 null 表示通过，否则返回错误响应。
async function guardPin(
  env: Env, ip: string, matchId: string, pin: string, hash: string
): Promise<Response | null> {
  const bucket = `pin:${ip}:${matchId}`
  if (!(await rateCheck(env, bucket, PIN_LIMIT, PIN_WINDOW))) return err('RATE_LIMITED', 429)
  if (!(await verifyPin(pin, hash))) {
    await rateBump(env, bucket, PIN_WINDOW)
    return err('PIN_INVALID', 401)
  }
  return null
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

async function createMatch(req: Request, env: Env, ctx: ExecutionContext, ip: string): Promise<Response> {
  if (!(await rateConsume(env, `create:${ip}`, 10, 60000))) return err('RATE_LIMITED', 429)

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
  if (date < today || date > addDaysISO(today, 7)) return err('VALIDATION', 400, 'date must be within 7 days')

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

  // 通知：推送「新场次」给订阅了 pickup_new_matches topic 的 App 用户
  ctx.waitUntil(notifyTopic(
    env.FIREBASE_SERVICE_ACCOUNT,
    'pickup_new_matches',
    '⚽ 新约球场次',
    `${date} ${time} · ${venue}`,
    { type: 'new_match', matchId: id }
  ))

  return json({ id }, 201)
}

async function getMatch(env: Env, id: string): Promise<Response> {
  const m = (await env.DB.prepare(
    `SELECT id,date,time,timezone,start_utc,venue,fee,max_players,note,captains_drawn,created_at
       FROM matches WHERE id = ?`
  ).bind(id).first()) as Record<string, number> | null
  if (!m) return err('NOT_FOUND', 404)

  // seq = 现存报名按报名顺序的实时排名（1..n，无空洞）。
  // position 只是登记顺序的稳定排序键，退出后不重排，故名次必须动态算，不能直接用 position 数值。
  const { results } = await env.DB.prepare(
    `SELECT id,name,is_captain,paid,created_at,
            ROW_NUMBER() OVER (ORDER BY position ASC) AS position
       FROM registrations WHERE match_id = ? ORDER BY position ASC`
  ).bind(id).all()

  const registrations = (results as Record<string, number>[]).map((r) => ({
    ...r,
    status: r.position <= m.max_players ? 'confirmed' : 'waiting',
  }))

  return json({ ...m, locked: Date.now() > m.start_utc, registrations })
}

async function editMatch(req: Request, env: Env, ctx: ExecutionContext, id: string, ip: string): Promise<Response> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return err('VALIDATION', 400, 'invalid json')
  const pin = String(b.pin ?? '')

  const m = (await env.DB.prepare(
    'SELECT date,time,timezone,start_utc,venue,fee,max_players,note,organizer_pin_hash FROM matches WHERE id = ?'
  ).bind(id).first()) as {
    date: string; time: string; timezone: string; start_utc: number
    venue: string; fee: number; max_players: number; note: string | null; organizer_pin_hash: string
  } | null
  if (!m) return err('NOT_FOUND', 404)
  if (Date.now() > m.start_utc) return err('MATCH_LOCKED', 403)

  const bad = await guardPin(env, ip, id, pin, m.organizer_pin_hash)
  if (bad) return bad

  // date 锁死，不可改；其余字段合并（未传则沿用原值）
  const time = b.time !== undefined ? String(b.time) : m.time
  const venue = b.venue !== undefined ? String(b.venue).trim() : m.venue
  const fee = b.fee !== undefined ? Number(b.fee) : m.fee
  const max_players = b.max_players !== undefined ? Number(b.max_players) : m.max_players
  const note = b.note !== undefined ? (b.note ? String(b.note) : null) : m.note

  if (!/^\d{2}:\d{2}$/.test(time)) return err('VALIDATION', 400, 'bad time')
  if (!venue) return err('VALIDATION', 400, 'venue required')
  if (!Number.isInteger(fee) || fee < 0) return err('VALIDATION', 400, 'fee invalid')
  if (!Number.isInteger(max_players) || max_players < 1) return err('VALIDATION', 400, 'max_players invalid')

  const start_utc = wallTimeToUtcMs(m.date, time, m.timezone) // 改时间需重算开赛时刻
  await env.DB.prepare(
    'UPDATE matches SET time=?,venue=?,fee=?,max_players=?,note=?,start_utc=? WHERE id=?'
  ).bind(time, venue, fee, max_players, note, start_utc, id).run()

  // 通知：推送场次更新给已报名该场的 App 用户
  ctx.waitUntil(notifyTopic(
    env.FIREBASE_SERVICE_ACCOUNT,
    `pickup_match_${id}`,
    '📝 场次信息已更新',
    `${m.date} · ${venue} 的场次有变动，请查看详情`,
    { type: 'change', matchId: id }
  ))

  return json({ ok: true })
}

async function deleteMatch(req: Request, env: Env, ctx: ExecutionContext, id: string, ip: string): Promise<Response> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return err('VALIDATION', 400, 'invalid json')
  const pin = String(b.pin ?? '')

  const m = (await env.DB.prepare('SELECT start_utc, organizer_pin_hash FROM matches WHERE id = ?')
    .bind(id).first()) as { start_utc: number; organizer_pin_hash: string } | null
  if (!m) return err('NOT_FOUND', 404)
  if (Date.now() > m.start_utc) return err('MATCH_LOCKED', 403)

  const bad = await guardPin(env, ip, id, pin, m.organizer_pin_hash)
  if (bad) return bad

  // 先拿场次信息用于通知文案
  const mInfo = (await env.DB.prepare('SELECT date, venue FROM matches WHERE id = ?')
    .bind(id).first()) as { date: string; venue: string } | null

  await env.DB.batch([
    env.DB.prepare('DELETE FROM registrations WHERE match_id = ?').bind(id),
    env.DB.prepare('DELETE FROM matches WHERE id = ?').bind(id),
  ])

  // 通知：推送场次取消给已报名该场的 App 用户
  if (mInfo) {
    ctx.waitUntil(notifyTopic(
      env.FIREBASE_SERVICE_ACCOUNT,
      `pickup_match_${id}`,
      '❌ 场次已取消',
      `${mInfo.date} · ${mInfo.venue} 的场次已被组织者取消`,
      { type: 'cancel', matchId: id }
    ))
  }

  return json({ ok: true })
}

async function register(req: Request, env: Env, matchId: string, ip: string): Promise<Response> {
  if (!(await rateConsume(env, `reg:${ip}`, 20, 60000))) return err('RATE_LIMITED', 429)

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
  const id = crypto.randomUUID()

  // 单条 INSERT...SELECT 原子地算出 position 并插入：D1 写串行化下并发报名不会撞号
  let position: number
  try {
    const inserted = (await env.DB.prepare(
      `INSERT INTO registrations (id, match_id, name, pin_hash, pin_lookup, position, is_captain, created_at)
       SELECT ?, ?, ?, ?, ?, COALESCE(MAX(position), 0) + 1, 0, ?
         FROM registrations WHERE match_id = ?
       RETURNING position`
    ).bind(id, matchId, name, pin_hash, lookup, Date.now(), matchId).first()) as { position: number } | null
    position = inserted?.position ?? 1
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return err('PIN_DUPLICATE', 409, 'pin already used in this match')
    }
    throw e
  }
  return json({ id, position }, 201)
}

async function editReg(req: Request, env: Env, mid: string, rid: string, ip: string): Promise<Response> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return err('VALIDATION', 400, 'invalid json')
  const pin = String(b.pin ?? '')
  const name = String(b.name ?? '').trim()
  const paid = b.paid ? 1 : 0
  if (!name) return err('VALIDATION', 400, 'name required')

  const r = (await env.DB.prepare(
    `SELECT r.pin_hash AS pin_hash, m.start_utc AS start_utc
       FROM registrations r JOIN matches m ON m.id = r.match_id
      WHERE r.id = ? AND r.match_id = ?`
  ).bind(rid, mid).first()) as { pin_hash: string; start_utc: number } | null
  if (!r) return err('NOT_FOUND', 404)

  const bad = await guardPin(env, ip, mid, pin, r.pin_hash)
  if (bad) return bad

  // 开赛后转为只读，但仍允许修改「已付活动费」（付款通常在踢完球后进行）；名字等其他字段不可改
  if (Date.now() > r.start_utc) {
    await env.DB.prepare('UPDATE registrations SET paid = ? WHERE id = ?').bind(paid, rid).run()
  } else {
    await env.DB.prepare('UPDATE registrations SET name = ?, paid = ? WHERE id = ?').bind(name, paid, rid).run()
  }
  return json({ ok: true })
}

async function deleteReg(req: Request, env: Env, ctx: ExecutionContext, mid: string, rid: string, ip: string): Promise<Response> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return err('VALIDATION', 400, 'invalid json')
  const pin = String(b.pin ?? '')

  const r = (await env.DB.prepare(
    `SELECT r.pin_hash AS pin_hash, m.start_utc AS start_utc
       FROM registrations r JOIN matches m ON m.id = r.match_id
      WHERE r.id = ? AND r.match_id = ?`
  ).bind(rid, mid).first()) as { pin_hash: string; start_utc: number } | null
  if (!r) return err('NOT_FOUND', 404)
  if (Date.now() > r.start_utc) return err('MATCH_LOCKED', 403)

  const bad = await guardPin(env, ip, mid, pin, r.pin_hash)
  if (bad) return bad

  // 删除前检查：若删除的是「确认上场」名额，候补名单中第一位将转正
  const match = (await env.DB.prepare(
    'SELECT max_players, date, venue FROM matches WHERE id = ?'
  ).bind(mid).first()) as { max_players: number; date: string; venue: string } | null

  // 计算被删除报名的排名（按 position 升序第几位）
  const rankRow = (await env.DB.prepare(
    'SELECT COUNT(*) + 1 AS rank FROM registrations WHERE match_id = ? AND position < (SELECT position FROM registrations WHERE id = ?)'
  ).bind(mid, rid).first()) as { rank: number } | null

  const wasConfirmed = match && rankRow && rankRow.rank <= match.max_players

  // 删除前统计是否有候补
  const totalRow = (await env.DB.prepare(
    'SELECT COUNT(*) AS total FROM registrations WHERE match_id = ?'
  ).bind(mid).first()) as { total: number } | null
  const hasWaiting = match && totalRow && totalRow.total > match.max_players

  await env.DB.prepare('DELETE FROM registrations WHERE id = ?').bind(rid).run()

  // 若确认名额被释放且存在候补，推送转正通知
  if (wasConfirmed && hasWaiting && match) {
    ctx.waitUntil(notifyTopic(
      env.FIREBASE_SERVICE_ACCOUNT,
      `pickup_match_${mid}`,
      '🎉 候补名单有变动',
      `${match.date} · ${match.venue} 有名额空出，候补名单第一位已转为确认上场`,
      { type: 'promotion', matchId: mid }
    ))
  }

  return json({ ok: true })
}

async function drawCaptains(req: Request, env: Env, id: string, ip: string): Promise<Response> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return err('VALIDATION', 400, 'invalid json')
  const pin = String(b.pin ?? '')

  const m = (await env.DB.prepare('SELECT start_utc, max_players, organizer_pin_hash FROM matches WHERE id = ?')
    .bind(id).first()) as { start_utc: number; max_players: number; organizer_pin_hash: string } | null
  if (!m) return err('NOT_FOUND', 404)
  if (Date.now() > m.start_utc) return err('MATCH_LOCKED', 403)

  const bad = await guardPin(env, ip, id, pin, m.organizer_pin_hash)
  if (bad) return bad

  // 确认上场 = 现存报名按报名顺序的前 max_players 名（用实时名次，不能用 position 数值，
  // 否则有人退出后名次靠前的确认者可能被漏掉）。已退出者无行，绝不会被抽中。
  const { results } = await env.DB.prepare(
    `SELECT id,name FROM (
       SELECT id,name, ROW_NUMBER() OVER (ORDER BY position ASC) AS seq
         FROM registrations WHERE match_id = ?
     ) WHERE seq <= ? ORDER BY seq ASC`
  ).bind(id, m.max_players).all()
  const confirmed = results as { id: string; name: string }[]
  if (confirmed.length < 2) return err('VALIDATION', 400, 'need at least 2 confirmed players')

  const [c1, c2] = pickTwo(confirmed)
  await env.DB.batch([
    env.DB.prepare('UPDATE registrations SET is_captain = 0 WHERE match_id = ?').bind(id),
    env.DB.prepare('UPDATE registrations SET is_captain = 1 WHERE id = ?').bind(c1.id),
    env.DB.prepare('UPDATE registrations SET is_captain = 1 WHERE id = ?').bind(c2.id),
    env.DB.prepare('UPDATE matches SET captains_drawn = 1 WHERE id = ?').bind(id),
  ])
  return json({ captains: [c1, c2] })
}
