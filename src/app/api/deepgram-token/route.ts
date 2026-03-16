// Source: https://deepgram.com/learn/protecting-api-key
// This route issues a short-lived Deepgram API key (30s TTL).
// The browser uses this key to open a direct WebSocket to Deepgram.
// The real API key never reaches the browser.
import { deepgramClient } from '@/lib/deepgram'

export async function POST() {
  const projectId = process.env.DEEPGRAM_PROJECT_ID

  if (!projectId) {
    return Response.json({ error: 'DEEPGRAM_PROJECT_ID not configured' }, { status: 500 })
  }

  const response = await deepgramClient.manage.v1.projects.keys.create(projectId, {
    comment: 'browser-temp',
    scopes: ['usage:write'],
    time_to_live_in_seconds: 30,
  })

  if (!response || !response.key) {
    return Response.json({ error: 'Token creation failed' }, { status: 500 })
  }

  return Response.json({
    token: response.key,
    wsUrl: 'wss://api.deepgram.com/v1/listen',
  })
}
