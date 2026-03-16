// Brief AI — Экспортёр ТЗ (Markdown + HTML/PDF)

import type { BriefDocument } from '@/lib/db/repositories/brief-documents';

const SECTION_TITLES: Record<string, string> = {
  problem: '1. Проблема',
  goal: '2. Цель проекта',
  tasks: '3. Основные задачи',
  functional_requirements: '4. Функциональные требования',
  non_functional_requirements: '5. Нефункциональные требования',
  effects: '6. Эффекты проекта',
  implementation: '7. Требования к реализации',
};

// =============================================
// Экспорт в Markdown
// =============================================
export function exportToMarkdown(doc: BriefDocument): string {
  const lines: string[] = [];

  lines.push('# Техническое задание');
  lines.push('');
  lines.push(`> Создано с помощью Brief AI | Полнота: ${doc.completeness_score}%`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Основные разделы
  const sectionOrder = ['problem', 'goal', 'tasks', 'functional_requirements', 'non_functional_requirements', 'effects', 'implementation'];

  for (const key of sectionOrder) {
    const title = SECTION_TITLES[key] || key;
    const content = (doc.sections as Record<string, unknown>)[key];

    lines.push(`## ${title}`);
    lines.push('');

    if (!content) {
      lines.push('*Раздел не заполнен*');
    } else if (typeof content === 'string') {
      lines.push(content);
    } else if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === 'string') {
          lines.push(`- ${item}`);
        } else if (typeof item === 'object' && item !== null) {
          lines.push(formatObjectAsMd(item as Record<string, unknown>));
        }
      }
    } else if (typeof content === 'object') {
      lines.push(formatObjectAsMd(content as Record<string, unknown>));
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Открытые вопросы
  if (doc.open_questions && (doc.open_questions as unknown[]).length > 0) {
    lines.push('## Открытые вопросы');
    lines.push('');
    for (const q of doc.open_questions as string[]) {
      lines.push(`- [ ] ${q}`);
    }
    lines.push('');
  }

  // Проигнорированные предупреждения
  if (doc.user_overrides && (doc.user_overrides as unknown[]).length > 0) {
    lines.push('## Проигнорированные предупреждения');
    lines.push('');
    lines.push('> Следующие предупреждения были проигнорированы пользователем:');
    lines.push('');
    for (const o of doc.user_overrides as string[]) {
      lines.push(`- ${o}`);
    }
    lines.push('');
  }

  // Полнота
  lines.push(`## Проверка полноты: ${doc.completeness_score}%`);
  lines.push('');

  return lines.join('\n');
}

// =============================================
// Экспорт в HTML (для печати в PDF)
// =============================================
export function exportToHTML(doc: BriefDocument): string {
  const markdown = exportToMarkdown(doc);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Техническое задание — Brief AI</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1a1a1a;
      line-height: 1.6;
    }
    h1 { color: #1F3864; border-bottom: 3px solid #2E75B6; padding-bottom: 10px; }
    h2 { color: #1F3864; margin-top: 30px; }
    h3 { color: #2E75B6; }
    blockquote {
      border-left: 4px solid #2E75B6;
      padding: 10px 20px;
      margin: 20px 0;
      background: #f8f9fa;
      color: #666;
    }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #1F3864; color: white; }
    tr:nth-child(even) { background: #f8f9fa; }
    hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
    ul { padding-left: 20px; }
    li { margin-bottom: 5px; }
    .warning { background: #FDF5E6; border: 1px solid #E8A020; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .score { font-size: 24px; color: #27AE60; font-weight: bold; }
    pre { background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto; }
    @media print {
      body { padding: 20px; }
      h1 { page-break-before: avoid; }
      h2 { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  ${markdownToHTML(markdown)}
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
    Документ создан с помощью Brief AI
  </footer>
</body>
</html>`;
}

// Простой Markdown → HTML конвертер
function markdownToHTML(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- \[ \] (.+)$/gm, '<li style="list-style: none;">&#9744; $1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hblou]|<li|<hr|<p)/gm, '<p>')
    .replace(/<p><\/p>/g, '');
}

function formatObjectAsMd(obj: Record<string, unknown>, indent: string = ''): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    const label = key.replace(/_/g, ' ');

    if (typeof value === 'string') {
      lines.push(`${indent}**${label}:** ${value}`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${indent}**${label}:** ${value}`);
    } else if (Array.isArray(value)) {
      lines.push(`${indent}**${label}:**`);
      for (const item of value) {
        if (typeof item === 'string') {
          lines.push(`${indent}  - ${item}`);
        } else if (typeof item === 'object' && item !== null) {
          lines.push(formatObjectAsMd(item as Record<string, unknown>, indent + '  '));
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${indent}### ${label}`);
      lines.push(formatObjectAsMd(value as Record<string, unknown>, indent + '  '));
    }
  }

  return lines.join('\n');
}
