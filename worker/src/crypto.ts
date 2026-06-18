// PIN 安全：PBKDF2 加盐哈希（验证用）+ HMAC（同场判重用）。
// 全部基于 Web Crypto，零依赖，Workers 原生支持。

const enc = new TextEncoder()
const b64 = (buf: ArrayBuffer | Uint8Array): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)))
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

// 生成 PIN 哈希，格式 "pbkdf2$<iter>$<salt>$<hash>"
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  return `pbkdf2$100000$${b64(salt)}$${b64(bits)}`
}

// 恒定时间验证 PIN
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, iter, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'pbkdf2') return false
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: +iter, hash: 'SHA-256' }, key, 256)
  return timingSafeEqual(b64(bits), hashB64)
}

// 每场随机密钥（base64），用作该场 HMAC 的 key
export function randomSecret(bytes = 32): string {
  return b64(crypto.getRandomValues(new Uint8Array(bytes)))
}

// 确定性 HMAC：同一 PIN + 同一 match_secret -> 同一结果，用于同场判重
export async function pinLookup(pin: string, secretB64: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', unb64(secretB64),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(pin))
  return b64(sig)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
