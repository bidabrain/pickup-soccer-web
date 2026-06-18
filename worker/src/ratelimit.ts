// 基于 D1 的简单滑动窗口限流。低流量场景足够，完全自管、可本地测试。
import type { Env } from './index'

// 只读检查：是否仍在限额内（不增加计数）。true = 允许。
export async function rateCheck(env: Env, bucket: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  const row = (await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE bucket = ?')
    .bind(bucket).first()) as { count: number; window_start: number } | null
  if (!row) return true
  if (now - row.window_start >= windowMs) return true
  return row.count < limit
}

// 记一次（失败/消耗）。窗口过期则重置为 1，否则 +1。
export async function rateBump(env: Env, bucket: string, windowMs: number): Promise<void> {
  const now = Date.now()
  const row = (await env.DB.prepare('SELECT window_start FROM rate_limits WHERE bucket = ?')
    .bind(bucket).first()) as { window_start: number } | null
  if (!row || now - row.window_start >= windowMs) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (bucket, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET count = 1, window_start = ?`
    ).bind(bucket, now, now).run()
  } else {
    await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE bucket = ?').bind(bucket).run()
  }
}

// 检查并消耗（用于无 PIN 的写接口防灌水：每次都计数）。true = 允许。
export async function rateConsume(env: Env, bucket: string, limit: number, windowMs: number): Promise<boolean> {
  if (!(await rateCheck(env, bucket, limit, windowMs))) return false
  await rateBump(env, bucket, windowMs)
  return true
}
