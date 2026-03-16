'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, FileText, Clock, Copy, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Project {
  id: string;
  title: string | null;
  brief_type: string;
  status: 'draft' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
  completeness_score?: number;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'warning' | 'success' }> = {
  draft: { label: 'Черновик', variant: 'default' },
  in_progress: { label: 'В процессе', variant: 'warning' },
  completed: { label: 'Готово', variant: 'success' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const res = await fetch('/api/wizard/sessions');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      // В MVP список проектов будет через отдельный API
      setProjects([]);
    } catch {
      // Пусто — нет проектов или не авторизован
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    try {
      const res = await fetch('/api/wizard/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_type: 'dev' }),
      });
      const data = await res.json();
      router.push(`/wizard/${data.session_id}`);
    } catch (err) {
      console.error('Create project error:', err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">
            Brief AI
          </Link>
          <div className="flex gap-4 items-center">
            <button
              onClick={createProject}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 transition"
            >
              <Plus className="w-4 h-4" />
              Новый проект
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Мои проекты</h1>

        {projects.length === 0 ? (
          /* Пустое состояние */
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-primary/40" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">У вас пока нет проектов</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Создайте первое техническое задание с помощью AI. Это займёт около 15 минут.
            </p>
            <button
              onClick={createProject}
              className="bg-primary text-white px-8 py-3 rounded-xl text-lg font-medium hover:bg-primary-600 transition shadow-lg"
            >
              Создать первый проект
            </button>
          </div>
        ) : (
          /* Список проектов */
          <div className="grid gap-4">
            {projects.map(project => {
              const statusInfo = STATUS_LABELS[project.status];

              return (
                <div
                  key={project.id}
                  className="bg-white rounded-xl border p-5 hover:shadow-md transition group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {project.title || 'Без названия'}
                        </h3>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(project.updated_at).toLocaleDateString('ru')}
                        </span>
                        <span>Тип: {project.brief_type}</span>
                        {project.completeness_score !== undefined && (
                          <span>Полнота: {project.completeness_score}%</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                      {project.status !== 'completed' && (
                        <Link
                          href={`/wizard/${project.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-600 transition"
                        >
                          <ArrowRight className="w-3 h-3" /> Продолжить
                        </Link>
                      )}
                      {project.status === 'completed' && (
                        <Link
                          href={`/documents/${project.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-success text-white rounded-lg hover:bg-success-700 transition"
                        >
                          <FileText className="w-3 h-3" /> Просмотр
                        </Link>
                      )}
                      <button className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition text-gray-600">
                        <Copy className="w-3 h-3" /> Дублировать
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
