// Brief AI — API: Текущий пользователь
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getUserById } from '@/lib/db/repositories/users';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await getUserById(auth.userId);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
