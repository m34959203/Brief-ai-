// Brief AI — Аутентификация (JWT на jose)
// JWT: access 15 мин, refresh 7 дней (httpOnly cookie)

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'dev-secret-key'
);

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

export interface TokenPayload {
  userId: string;
  email: string;
}

export async function createAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(SECRET);
}

export async function createRefreshToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export async function setAuthCookies(payload: TokenPayload): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const accessToken = await createAccessToken(payload);
  const refreshToken = await createRefreshToken(payload);

  const cookieStore = await cookies();

  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 минут
    path: '/',
  });

  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 дней
    path: '/',
  });

  return { accessToken, refreshToken };
}

export async function getAuthUser(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (accessToken) {
    const user = await verifyToken(accessToken);
    if (user) return user;
  }

  // Пробуем refresh token
  const refreshToken = cookieStore.get('refresh_token')?.value;
  if (refreshToken) {
    const user = await verifyToken(refreshToken);
    if (user) {
      // Обновляем access token
      await setAuthCookies(user);
      return user;
    }
  }

  return null;
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
}
