import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check auth cookie
  const auth = request.cookies.get('site-auth')
  if (auth?.value === process.env.SITE_PASSWORD) {
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
