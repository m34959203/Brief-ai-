// Brief AI — API: Регистрация
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/auth/password';
import { setAuthCookies } from '@/lib/auth';
import { createUser, getUserByEmail } from '@/lib/db/repositories/users';

const registerSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Пароль минимум 8 символов'),
  name: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    // Проверка: email уже занят
    const existing = await getUserByEmail(data.email);
    if (existing) {
      return NextResponse.json(
        { error: 'Пользователь с таким email уже существует' },
        { status: 409 }
      );
    }

    // Хэширование пароля (Argon2id)
    const passwordHash = await hashPassword(data.password);

    // Создание пользователя
    const user = await createUser({
      email: data.email,
      password_hash: passwordHash,
      name: data.name,
    });

    // Установка JWT cookies
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
    console.error('[Auth] Register error:', error);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
