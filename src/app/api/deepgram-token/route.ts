// POC: returns the API key directly from the server — key never hardcoded in client bundle.
// TODO production: replace with manage.v1.projects.keys.create() using an admin-scoped key
// to issue short-lived tokens. Source: https://deepgram.com/learn/protecting-api-key
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY

  if (!apiKey) {
    return Response.json({ error: 'DEEPGRAM_API_KEY not configured' }, { status: 500 })
  }

  return Response.json({
    token: apiKey,
    wsUrl: 'wss://api.deepgram.com/v1/listen',
  })
}
