import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

// Fixed sentinel value stored in the cookie — password validation happens
// in the API route (Node.js runtime) which reliably reads process.env.
// Middleware only checks this sentinel to avoid Edge runtime env var issues.
const AUTH_SENTINEL = 'dictator-authenticated-v1'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check auth cookie contains the sentinel value
  const auth = request.cookies.get('site-auth')
  if (auth?.value === AUTH_SENTINEL) {
    return NextResponse.next()
  }

  // Redirect to login, preserving destination
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Run on all page routes — Next.js automatically excludes /_next/* and static files
  matcher: ['/((?!_next).*)'],
}
