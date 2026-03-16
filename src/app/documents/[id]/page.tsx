'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Download, FileText, AlertTriangle, CheckCircle, Edit3, Save } from 'lucide-react';
import { ProgressBar } from '@/components/ui/progress-bar';
import { trackEvent } from '@/lib/analytics/tracker';

interface DocumentData {
  document_id: string;
  sections: Record<string, unknown>;
  open_questions: string[];
  completeness_score: number;
  user_overrides: string[];
}

const SECTION_TITLES: Record<string, string> = {
  problem: 'Проблема',
  goal: 'Цель проекта',
  tasks: 'Основные задачи',
  functional_requirements: 'Функциональные требования',
  non_functional_requirements: 'Нефункциональные требования',
  effects: 'Эффекты проекта',
  implementation: 'Требования к реализации',
};

const SECTION_ORDER = ['problem', 'goal', 'tasks', 'functional_requirements', 'non_functional_requirements', 'effects', 'implementation'];

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(SECTION_ORDER));
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  async function loadDocument() {
    try {
      // Если documentId — это sessionId, генерируем документ
      const res = await fetch(`/api/wizard/sessions/${documentId}/generate`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setDoc(data);
      }
    } catch (err) {
      console.error('Load document error:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function saveSection(sectionKey: string) {
    if (!doc) return;

    try {
      const res = await fetch(`/api/documents/${doc.document_id}/sections/${sectionKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });

      if (res.ok) {
        const data = await res.json();
        setDoc(prev => prev ? { ...prev, sections: data.sections } : null);
        trackEvent('document_edited', { section: sectionKey });
      }
    } catch (err) {
      console.error('Save section error:', err);
    }

    setEditingSection(null);
  }

  async function exportDoc(format: 'md' | 'pdf') {
    if (!doc) return;

    if (format === 'pdf') {
      window.open(`/api/documents/${doc.document_id}/export/pdf`, '_blank');
    } else {
      const res = await fetch(`/api/documents/${doc.document_id}/export/md`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brief-${doc.document_id}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Генерация документа...</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Документ не найден</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">Техническое задание</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Полнота: {doc.completeness_score}%
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportDoc('md')}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <Download className="w-4 h-4" />
              Markdown
            </button>
            <button
              onClick={() => exportDoc('pdf')}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-600 transition"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {/* Полнота */}
        <div className="bg-white rounded-xl p-6 border">
          <ProgressBar value={doc.completeness_score} label="Полнота документа" />
        </div>

        {/* Открытые вопросы */}
        {doc.open_questions.length > 0 && (
          <div className="bg-warning-50 rounded-xl p-5 border border-warning/30">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <h3 className="font-semibold text-warning-700">Открытые вопросы ({doc.open_questions.length})</h3>
            </div>
            <ul className="space-y-1.5">
              {doc.open_questions.map((q, i) => (
                <li key={i} className="text-sm text-warning-700 flex items-start gap-2">
                  <span className="text-warning mt-0.5">&#9744;</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Разделы ТЗ */}
        {SECTION_ORDER.map((key, index) => {
          const content = doc.sections[key];
          const title = SECTION_TITLES[key];
          const isExpanded = expandedSections.has(key);
          const isEditing = editingSection === key;

          return (
            <div key={key} className="bg-white rounded-xl border overflow-hidden">
              <button
                onClick={() => toggleSection(key)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400">{index + 1}.</span>
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                  {content ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <span className="text-xs text-gray-400">не заполнен</span>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>

              {isExpanded && (
                <div className="px-6 pb-5 border-t">
                  {isEditing ? (
                    <div className="mt-4">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full h-40 rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => saveSection(key)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm"
                        >
                          <Save className="w-3 h-3" /> Сохранить
                        </button>
                        <button
                          onClick={() => setEditingSection(null)}
                          className="px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 relative group">
                      <button
                        onClick={() => {
                          setEditingSection(key);
                          setEditContent(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
                        }}
                        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-100 transition"
                      >
                        <Edit3 className="w-4 h-4 text-gray-400" />
                      </button>
                      {content ? (
                        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {typeof content === 'string'
                            ? content
                            : JSON.stringify(content, null, 2)
                          }
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Данных нет</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Проигнорированные предупреждения */}
        {doc.user_overrides.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-5 border">
            <h3 className="font-semibold text-gray-600 mb-3">Проигнорированные предупреждения</h3>
            <ul className="space-y-1.5">
              {doc.user_overrides.map((o, i) => (
                <li key={i} className="text-sm text-gray-500">&#8226; {o}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
