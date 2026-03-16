// Brief AI — Middleware: защита маршрутов
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'dev-secret-key'
);

// Маршруты, требующие аутентификации
const PROTECTED_PATHS = [
  '/api/wizard/sessions',
  '/api/documents',
  '/dashboard',
];

// Исключения: демо-режим шага 1
const PUBLIC_PATHS = [
  '/api/wizard/sessions', // POST для создания демо-сессии
  '/api/analytics',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Статические ресурсы и auth-маршруты — пропускаем
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/wizard/demo')
  ) {
    return NextResponse.next();
  }

  // Проверяем защищённые маршруты
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (!isProtected) {
    return NextResponse.next();
  }

  // Демо-режим: POST /api/wizard/sessions разрешён без auth
  if (pathname === '/api/wizard/sessions' && request.method === 'POST') {
    return NextResponse.next();
  }

  // Проверка JWT
  const accessToken = request.cookies.get('access_token')?.value;
  if (!accessToken) {
    // API — 401, страницы — редирект на логин
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(accessToken, SECRET);
    // Добавляем userId в заголовки для API-роутов
    const response = NextResponse.next();
    response.headers.set('x-user-id', payload.userId as string);
    return response;
  } catch {
    // Токен истёк — пробуем refresh
    const refreshToken = request.cookies.get('refresh_token')?.value;
    if (refreshToken) {
      try {
        await jwtVerify(refreshToken, SECRET);
        // Refresh валиден — пропускаем (access обновится в getAuthUser)
        return NextResponse.next();
      } catch {
        // Оба токена невалидны
      }
    }

    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
