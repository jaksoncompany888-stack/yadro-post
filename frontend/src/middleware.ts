import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Страницы, которые не требуют авторизации
const PUBLIC_PATHS = [
  '/login',
  '/api',
  '/_next',
  '/favicon.ico',
]

// Проверяем, является ли путь публичным
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname.startsWith(path))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''

  // Пропускаем публичные пути
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Для локальной разработки (localhost) — пропускаем авторизацию
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return NextResponse.next()
  }

  // Проверяем токен в cookies (localStorage недоступен в middleware)
  const token = request.cookies.get('token')?.value

  // Если нет токена — редирект на логин
  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)',
  ],
}
