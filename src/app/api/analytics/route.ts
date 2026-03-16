// Brief AI — API: Запись аналитического события
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { trackEvent as dbTrackEvent } from '@/lib/db/repositories/analytics';
import { getAuthUser } from '@/lib/auth';

const eventSchema = z.object({
  event_name: z.string().min(1),
  event_params: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = eventSchema.parse(body);

    const auth = await getAuthUser();

    await dbTrackEvent({
      user_id: auth?.userId,
      event_name: data.event_name,
      event_params: data.event_params,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Ошибка валидации' },
        { status: 400 }
      );
    }
    console.error('[API] Analytics error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
