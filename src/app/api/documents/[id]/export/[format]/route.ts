// Brief AI — API: Экспорт документа (PDF/Markdown)
import { NextRequest, NextResponse } from 'next/server';
import { getDocument, markExported } from '@/lib/db/repositories/brief-documents';
import { exportToMarkdown, exportToHTML } from '@/lib/document/exporter';
import { trackEvent } from '@/lib/analytics/tracker';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; format: string }> }
) {
  try {
    const { id, format } = await params;

    if (format !== 'md' && format !== 'pdf') {
      return NextResponse.json(
        { error: 'Формат: md или pdf' },
        { status: 400 }
      );
    }

    const doc = await getDocument(id);
    if (!doc) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 });
    }

    await markExported(id);

    if (format === 'md') {
      const markdown = exportToMarkdown(doc);

      trackEvent('document_exported', { format: 'md', document_id: id });

      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="brief-${id}.md"`,
        },
      });
    }

    // PDF: генерируем HTML и возвращаем (клиент может использовать print)
    const html = exportToHTML(doc);

    trackEvent('document_exported', { format: 'pdf', document_id: id });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('[API] Export error:', error);
    return NextResponse.json({ error: 'Ошибка экспорта' }, { status: 500 });
  }
}
