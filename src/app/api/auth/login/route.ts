// Brief AI — API: Вход
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPassword } from '@/lib/auth/password';
import { setAuthCookies } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db/repositories/users';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    const user = await getUserByEmail(data.email);
    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(user.password_hash, data.password);
    if (!valid) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    const tokens = await setAuthCookies({
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
      access_token: tokens.accessToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[Auth] Login error:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
