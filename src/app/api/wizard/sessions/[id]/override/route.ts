// Brief AI — API: Override предупреждения
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { overrideWarning } from '@/lib/engine/wizard-engine';
import { trackEvent } from '@/lib/analytics/tracker';

const overrideSchema = z.object({
  warning_id: z.string(),
  warning_description: z.string(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const data = overrideSchema.parse(body);

    await overrideWarning(sessionId, data.warning_id, data.warning_description);

    trackEvent('ai_override_used', {
      warning_type: data.warning_id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API] Override error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
