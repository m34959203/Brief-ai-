// Brief AI — API: Обновление раздела документа (inline-редактирование)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateSection, getDocument } from '@/lib/db/repositories/brief-documents';
import { trackEvent } from '@/lib/analytics/tracker';

const updateSectionSchema = z.object({
  content: z.unknown(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; section: string }> }
) {
  try {
    const { id, section } = await params;

    const validSections = ['problem', 'goal', 'tasks', 'functional_requirements', 'non_functional_requirements', 'effects', 'implementation'];
    if (!validSections.includes(section)) {
      return NextResponse.json(
        { error: `Невалидный раздел. Допустимые: ${validSections.join(', ')}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = updateSectionSchema.parse(body);

    const doc = await updateSection(id, section, data.content);
    if (!doc) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 });
    }

    trackEvent('document_edited', {
      document_id: id,
      section,
    });

    return NextResponse.json({
      sections: doc.sections,
      version: doc.version,
    });
  } catch (error) {
    console.error('[API] Update section error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
