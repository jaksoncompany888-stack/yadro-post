import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Страницы, которые не требуют авторизации
const PUBLIC_PATHS = [
  '/login',
  '/api',
  '/_next',
  '/favicon.ico',
]

// Dev токен для разработчиков (можно менять)
const DEV_TOKEN = process.env.DEV_ACCESS_TOKEN || 'yadro-dev-2026'

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

  // Dev токен в URL — для разработчиков на сервере
  const devToken = request.nextUrl.searchParams.get('dev_token')
  if (devToken === DEV_TOKEN) {
    // Устанавливаем cookie и редиректим без параметра
    const response = NextResponse.redirect(new URL(pathname, request.url))
    response.cookies.set('dev_access', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24, // 24 часа
      sameSite: 'lax',
    })
    return response
  }

  // Проверяем dev_access cookie (для разработчиков)
  const devAccess = request.cookies.get('dev_access')?.value
  if (devAccess === 'true') {
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
