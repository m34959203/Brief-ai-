// Brief AI — Wizard Component (v2)
// Полноценный UI с кастомными компонентами, автосохранением, SSE-ready

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { StepIndicator } from '@/components/ui/step-indicator';
import { AIMessage } from '@/components/ui/ai-message';
import { UserMessage } from '@/components/ui/user-message';
import { ContradictionCard } from '@/components/ui/contradiction-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { trackEvent } from '@/lib/analytics/tracker';
import { Send, Mic, FileText, Menu, X } from 'lucide-react';

interface Message {
  role: 'ai' | 'user';
  content: string;
  extractedData?: Record<string, unknown>;
  contradictions?: Array<{ description: string; severity: string }>;
}

interface WizardStep {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'completed' | 'skipped';
}

const STEPS_CONFIG: WizardStep[] = [
  { id: 'scope', title: 'Суть проекта', status: 'active' },
  { id: 'tasks', title: 'Задачи и результат', status: 'pending' },
  { id: 'users', title: 'Пользователи', status: 'pending' },
  { id: 'features', title: 'Функциональность', status: 'pending' },
  { id: 'nfr', title: 'Качество', status: 'pending' },
  { id: 'implementation', title: 'Реализация', status: 'pending' },
];

interface WizardProps {
  sessionId?: string;
  isDemo?: boolean;
}

export default function Wizard({ sessionId: initialSessionId, isDemo }: WizardProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [currentStep, setCurrentStep] = useState(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [steps, setSteps] = useState(STEPS_CONFIG);
  const [progress, setProgress] = useState(0);
  const [contradictions, setContradictions] = useState<Array<{ id: string; description: string; severity: string }>>([]);
  const [showSidebar, setShowSidebar] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionStartTime = useRef(Date.now());

  // Инициализация сессии
  useEffect(() => {
    if (!sessionId) {
      initSession();
    } else {
      loadSession(sessionId);
    }
  }, []);

  // Автоскролл
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Автосохранение в localStorage
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      localStorage.setItem(`wizard:${sessionId}`, JSON.stringify({
        messages, currentStep, steps, progress,
      }));
    }
  }, [messages, currentStep, sessionId]);

  async function initSession() {
    try {
      const res = await fetch('/api/wizard/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_type: 'dev' }),
      });
      const data = await res.json();

      setSessionId(data.session_id);

      if (isDemo) {
        localStorage.setItem('brief_demo_session', data.session_id);
      }

      setMessages([{
        role: 'ai',
        content: 'Здравствуйте! Я помогу вам создать техническое задание. Расскажите, что вы хотите построить и какую проблему решить. Опишите в свободной форме — я задам уточняющие вопросы.',
      }]);

      trackEvent('wizard_started', { brief_type: 'dev', mode: 'text' });
    } catch (err) {
      console.error('Init session error:', err);
    }
  }

  async function loadSession(sid: string) {
    // Пробуем localStorage
    const cached = localStorage.getItem(`wizard:${sid}`);
    if (cached) {
      const data = JSON.parse(cached);
      setMessages(data.messages);
      setCurrentStep(data.currentStep);
      setSteps(data.steps);
      setProgress(data.progress);
      return;
    }

    // Загружаем с сервера
    try {
      const res = await fetch(`/api/wizard/sessions/${sid}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentStep(data.current_step);
        setProgress(((data.current_step - 1) / 6) * 100);
        setMessages([{
          role: 'ai',
          content: 'Продолжим с того места, где остановились. Расскажите подробнее.',
        }]);
      }
    } catch (err) {
      console.error('Load session error:', err);
    }
  }

  const sendAnswer = useCallback(async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    // Демо: блокируем переход к шагу 2 без auth
    if (isDemo && currentStep >= 2) {
      router.push('/register');
      return;
    }

    const userMessage = input.trim();
    setInput('');

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/wizard/sessions/${sessionId}/steps/${currentStep}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_answer: userMessage }),
        }
      );
      const data = await res.json();

      const aiMsg: Message = {
        role: 'ai',
        content: data.ai_response,
        extractedData: data.extracted_data,
        contradictions: data.contradictions,
      };

      setMessages(prev => [...prev, aiMsg]);

      if (data.step_complete) {
        const nextStep = data.next_step || currentStep;
        setCurrentStep(nextStep);
        setProgress(((nextStep - 1) / 6) * 100);

        setSteps(prev => prev.map((s, i) => ({
          ...s,
          status: i < nextStep - 1 ? 'completed' : i === nextStep - 1 ? 'active' : s.status,
        })));

        trackEvent('wizard_step_completed', { step_number: currentStep, mode: 'text' });

        // Если все шаги пройдены → генерация документа
        if (!data.next_step && currentStep === 6) {
          await generateDocument();
        }
      }

      if (data.contradictions?.length > 0) {
        setContradictions(prev => [
          ...prev,
          ...data.contradictions.map((c: { description: string; severity: string }, i: number) => ({
            ...c,
            id: `${currentStep}-${i}-${Date.now()}`,
          })),
        ]);
      }
    } catch (err) {
      console.error('Send error:', err);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: 'Произошла ошибка. Попробуйте ещё раз.',
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, sessionId, currentStep, isLoading, isDemo, router]);

  async function generateDocument() {
    if (!sessionId) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/wizard/sessions/${sessionId}/generate`, {
        method: 'POST',
      });
      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'ai',
        content: `Техническое задание готово! Полнота: ${data.completeness_score}%. Нажмите "Открыть ТЗ" для просмотра.`,
      }]);

      setProgress(100);
      setSteps(prev => prev.map(s => ({ ...s, status: 'completed' as const })));

      trackEvent('document_generated', {
        completeness_score: data.completeness_score,
      });
    } catch (err) {
      console.error('Generate error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOverride(contradictionId: string, description: string) {
    if (!sessionId) return;

    await fetch(`/api/wizard/sessions/${sessionId}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warning_id: contradictionId,
        warning_description: description,
      }),
    });

    setContradictions(prev => prev.filter(c => c.id !== contradictionId));
    trackEvent('ai_override_used', { warning_type: contradictionId });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAnswer();
    }
  }

  // Трекинг закрытия
  useEffect(() => {
    const handleUnload = () => {
      if (currentStep > 1 && currentStep < 6) {
        trackEvent('wizard_abandoned', {
          last_step: currentStep,
          total_time_sec: Math.round((Date.now() - sessionStartTime.current) / 1000),
        });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [currentStep]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Мобильная кнопка меню */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="md:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-md"
      >
        {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Сайдбар */}
      <aside className={`
        w-72 bg-white border-r flex flex-col
        fixed md:relative inset-y-0 left-0 z-40
        transform transition-transform duration-300
        ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-primary mb-1">Brief AI</h2>
          <p className="text-xs text-gray-400">AI-ассистент для ТЗ</p>
        </div>

        <div className="px-6 space-y-2 flex-1">
          {steps.map((step, i) => (
            <StepIndicator
              key={step.id}
              stepNumber={i + 1}
              title={step.title}
              status={step.status}
            />
          ))}
        </div>

        <div className="p-6 space-y-4 border-t">
          <ProgressBar value={progress} label="Прогресс" />

          <button
            disabled
            className="w-full py-2.5 px-4 rounded-lg border border-gray-200 text-sm text-gray-400 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Mic className="w-4 h-4" />
            Голосовой режим (скоро)
          </button>

          {progress === 100 && sessionId && (
            <button
              onClick={() => router.push(`/documents/${sessionId}`)}
              className="w-full py-2.5 px-4 rounded-lg bg-success text-white text-sm font-medium hover:bg-success-700 transition flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Открыть ТЗ
            </button>
          )}
        </div>
      </aside>

      {/* Оверлей для мобильного */}
      {showSidebar && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-30"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Основная область */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Заголовок шага */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="ml-10 md:ml-0">
            <h1 className="text-lg font-semibold text-gray-900">
              Шаг {currentStep}: {steps[currentStep - 1]?.title}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {currentStep <= 2 ? 'AI ведёт себя как Product Owner' : 'AI ведёт себя как бизнес-аналитик'}
            </p>
          </div>
          {isDemo && (
            <span className="text-xs bg-warning/10 text-warning-700 px-3 py-1 rounded-full font-medium">
              Демо-режим
            </span>
          )}
        </header>

        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            msg.role === 'ai'
              ? <AIMessage key={i} content={msg.content} extractedData={msg.extractedData} />
              : <UserMessage key={i} content={msg.content} />
          ))}

          {isLoading && <AIMessage content="" isLoading />}

          {contradictions.map(c => (
            <ContradictionCard
              key={c.id}
              id={c.id}
              description={c.description}
              severity={c.severity}
              onOverride={handleOverride}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Поле ввода */}
        <div className="border-t bg-white px-4 md:px-6 py-4">
          <div className="max-w-3xl mx-auto flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isDemo && currentStep >= 2
                ? 'Зарегистрируйтесь для продолжения...'
                : 'Введите ответ... (Enter — отправить, Shift+Enter — перенос)'
              }
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent min-h-[48px] max-h-32"
              rows={2}
              disabled={isLoading || (isDemo && currentStep >= 2)}
            />
            <button
              onClick={sendAnswer}
              disabled={!input.trim() || isLoading}
              className="px-5 py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span className="hidden md:inline">Отправить</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
