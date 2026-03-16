import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { password, from } = await request.json()

  if (!password || password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const redirectTo = typeof from === 'string' && from.startsWith('/') ? from : '/'
  const response = NextResponse.json({ ok: true, redirectTo })

  // Secure, HTTP-only cookie storing sentinel (not the password itself)
  response.cookies.set('site-auth', 'dictator-authenticated-v1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return response
}
