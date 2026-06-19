// FCM HTTP v1 API（服务账号 + JWT 鉴权，无需 Legacy Server Key）
// 每次推送实时获取 access token，Worker 无状态，低频场景可接受

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const enc = new TextEncoder()

  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).buffer)
  const claim  = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).buffer)

  const signingInput = `${header}.${claim}`

  // 解析 PEM 私钥
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(signingInput)
  )

  const jwt = `${signingInput}.${b64url(sig)}`

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const { access_token } = await resp.json() as { access_token: string }
  return access_token
}

export async function notifyTopic(
  serviceAccountJson: string | undefined,
  topic: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  if (!serviceAccountJson) {
    console.log('[FCM] FIREBASE_SERVICE_ACCOUNT not set, skipping')
    return
  }

  await (async () => {
    const sa = JSON.parse(serviceAccountJson) as ServiceAccount
    console.log(`[FCM] sending to topic=${topic}, project=${sa.project_id}`)

    const token = await getAccessToken(sa)
    console.log('[FCM] access token obtained')

    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            topic,
            notification: { title, body },
            data,
            android: { priority: 'high' },
          },
        }),
      }
    )
    const respText = await resp.text()
    console.log(`[FCM] response status=${resp.status} body=${respText}`)
  })().catch((e) => console.error('[FCM] error:', e)) // 失败不影响主流程
}
