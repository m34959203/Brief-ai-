// Brief AI — API: Получение состояния сессии
import { NextRequest, NextResponse } from 'next/server';
import { getSessionState } from '@/lib/engine/wizard-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const state = await getSessionState(id);

    if (!state) {
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 });
    }

    return NextResponse.json({
      session_id: state.session_id,
      project_id: state.project_id,
      current_step: state.current_step,
      structured_facts: state.structured_facts,
      context_summary: state.context_summary,
      steps_data: state.steps_data,
    });
  } catch (error) {
    console.error('[API] Get session error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
