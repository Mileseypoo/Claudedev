// Source: https://deepgram.com/learn/protecting-api-key
// This route issues a short-lived Deepgram JWT (30s TTL).
// The browser uses this token to open a direct WebSocket to Deepgram.
// The real API key never reaches the browser.
//
// SDK v5 uses auth.v1.tokens.grant() (not the v3/v4 manage.createProjectKey() pattern).
import { deepgramClient } from '@/lib/deepgram'

export async function POST() {
  const response = await deepgramClient.auth.v1.tokens.grant()

  if (!response || !response.access_token) {
    return Response.json({ error: 'Token creation failed' }, { status: 500 })
  }

  return Response.json({
    token: response.access_token,
    wsUrl: 'wss://api.deepgram.com/v1/listen',
  })
}
