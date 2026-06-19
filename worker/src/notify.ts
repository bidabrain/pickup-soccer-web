// FCM Legacy HTTP API 封装（fire-and-forget，绝不影响主流程）
// 使用前提：在 Cloudflare Worker 中通过 `wrangler secret put FIREBASE_SERVER_KEY` 设置密钥

export async function notifyTopic(
  serverKey: string | undefined,
  topic: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  if (!serverKey) return // 未配置则静默跳过

  await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      Authorization: `key=${serverKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: `/topics/${topic}`,
      notification: { title, body },
      data,
      android: { priority: 'high' },
    }),
  }).catch(() => {}) // 推送失败不影响 API 响应
}
