// Brief AI — Wizard Component
// Источник: ТЗ п.3.1 (US-1..US-8), п.4.1 (Time to First Question ≤ 3с)
// Дизайн-принципы: минимум свободного ввода, максимум выбора из предложенного

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics/tracker';

// =============================================
// ТИПЫ
// =============================================
interface WizardStep {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'completed' | 'skipped';
}

interface AIMessage {
  role: 'ai' | 'user';
  content: string;
  extractedData?: Record<string, unknown>;
  contradictions?: Array<{ description: string; severity: string }>;
  lowConfidenceWords?: string[];  // Для голосового режима (п.3.1 US-4)
}

interface WizardState {
  sessionId: string | null;
  currentStep: number;
  mode: 'text' | 'voice';
  messages: AIMessage[];
  isLoading: boolean;
  isStepComplete: boolean;
  overallProgress: number;        // 0-100%
  contradictions: Array<{ description: string; severity: string; id: string }>;
}

// =============================================
// КОНФИГ ШАГОВ (визуальный)
// =============================================
const STEPS: WizardStep[] = [
  { id: 'scope', title: 'Суть проекта', status: 'active' },
  { id: 'tasks', title: 'Задачи и результат', status: 'pending' },
  { id: 'users', title: 'Пользователи', status: 'pending' },
  { id: 'features', title: 'Функциональность', status: 'pending' },
  { id: 'nfr', title: 'Качество', status: 'pending' },
  { id: 'implementation', title: 'Реализация', status: 'pending' },
];

// =============================================
// WIZARD COMPONENT
// =============================================
export default function Wizard() {
  const [state, setState] = useState<WizardState>({
    sessionId: null,
    currentStep: 1,
    mode: 'text',
    messages: [],
    isLoading: false,
    isStepComplete: false,
    overallProgress: 0,
    contradictions: [],
  });

  const [input, setInput] = useState('');
  const [steps, setSteps] = useState(STEPS);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionStartTime = useRef(Date.now());

  // Прелоад данных для Time to First Question ≤ 3с (п.4.1)
  useEffect(() => {
    initSession();
  }, []);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  // =============================================
  // ИНИЦИАЛИЗАЦИЯ СЕССИИ
  // =============================================
  async function initSession() {
    try {
      const res = await fetch('/api/wizard/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_type: 'dev' }),
      });
      const data = await res.json();

      setState(prev => ({
        ...prev,
        sessionId: data.session_id,
        messages: [{
          role: 'ai',
          content: 'Здравствуйте! Я помогу вам создать техническое задание. Расскажите, что вы хотите построить и какую проблему решить. Опишите в свободной форме — я задам уточняющие вопросы.',
        }],
      }));

      trackEvent('wizard_started', {
        brief_type: 'dev',
        mode: 'text',
      });
    } catch (err) {
      console.error('Failed to init session:', err);
    }
  }

  // =============================================
  // ОТПРАВКА ОТВЕТА
  // =============================================
  const sendAnswer = useCallback(async () => {
    if (!input.trim() || !state.sessionId || state.isLoading) return;

    const userMessage = input.trim();
    setInput('');

    setState(prev => ({
      ...prev,
      isLoading: true,
      messages: [...prev.messages, { role: 'user', content: userMessage }],
    }));

    try {
      const res = await fetch(
        `/api/wizard/sessions/${state.sessionId}/steps/${state.currentStep}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_answer: userMessage }),
        }
      );
      const data = await res.json();

      const aiMessage: AIMessage = {
        role: 'ai',
        content: data.ai_response,
        extractedData: data.extracted_data,
        contradictions: data.contradictions,
      };

      setState(prev => {
        const newState = {
          ...prev,
          isLoading: false,
          messages: [...prev.messages, aiMessage],
          isStepComplete: data.step_complete,
        };

        if (data.step_complete) {
          newState.currentStep = data.next_step || prev.currentStep;
          newState.overallProgress = Math.round(
            ((data.next_step ? data.next_step - 1 : 6) / 6) * 100
          );
        }

        if (data.contradictions?.length > 0) {
          newState.contradictions = [
            ...prev.contradictions,
            ...data.contradictions.map((c: { description: string; severity: string }, i: number) => ({
              ...c,
              id: `${prev.currentStep}-${i}`,
            })),
          ];
        }

        return newState;
      });

      // Обновляем статусы шагов
      if (data.step_complete) {
        setSteps(prev => prev.map((s, i) => ({
          ...s,
          status: i < (data.next_step ? data.next_step - 1 : 6)
            ? 'completed'
            : i === (data.next_step ? data.next_step - 1 : 6)
              ? 'active'
              : s.status
        })));

        trackEvent('ai_question_asked', {
          step: state.currentStep,
        });
      }

    } catch (err) {
      console.error('Send answer error:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        messages: [...prev.messages, {
          role: 'ai',
          content: 'Произошла ошибка. Попробуйте ещё раз.',
        }],
      }));
    }
  }, [input, state.sessionId, state.currentStep, state.isLoading]);

  // =============================================
  // OVERRIDE: «Продолжить несмотря на предупреждение» (п.3.4)
  // =============================================
  async function handleOverride(contradictionId: string, description: string) {
    if (!state.sessionId) return;

    await fetch(`/api/wizard/sessions/${state.sessionId}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warning_id: contradictionId,
        warning_description: description,
      }),
    });

    setState(prev => ({
      ...prev,
      contradictions: prev.contradictions.filter(c => c.id !== contradictionId),
    }));

    trackEvent('ai_override_used', { warning_type: contradictionId });
  }

  // =============================================
  // ПЕРЕКЛЮЧЕНИЕ ГОЛОС/ТЕКСТ (п.3.1 US-4)
  // =============================================
  function toggleMode() {
    const newMode = state.mode === 'text' ? 'voice' : 'text';
    setState(prev => ({ ...prev, mode: newMode }));

    if (newMode === 'voice') {
      trackEvent('voice_mode_activated', { step: state.currentStep });
    } else {
      trackEvent('voice_to_text_switch', {
        step: state.currentStep,
        reason: 'user_choice',
      });
    }
  }

  // =============================================
  // ОБРАБОТКА ЗАБРОСА WIZARD (п.3.8)
  // =============================================
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (state.currentStep < 6 && state.currentStep > 1) {
        trackEvent('wizard_abandoned', {
          last_step: state.currentStep,
          total_time_sec: Math.round((Date.now() - sessionStartTime.current) / 1000),
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.currentStep]);

  // Клавиша Enter для отправки (Shift+Enter — перенос строки)
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAnswer();
    }
  }

  // =============================================
  // RENDER
  // =============================================
  return (
    <div className="flex h-screen bg-gray-50">
      {/* === САЙДБАР: Прогресс шагов === */}
      <aside className="w-64 bg-white border-r p-6 hidden md:block">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Brief AI</h2>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step.status === 'completed' ? 'bg-green-100 text-green-700' :
                  step.status === 'active' ? 'bg-blue-600 text-white' :
                  'bg-gray-100 text-gray-400'}`}>
                {step.status === 'completed' ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${step.status === 'active' ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                {step.title}
              </span>
            </div>
          ))}
        </div>

        {/* Прогресс */}
        <div className="mt-8">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Прогресс</span>
            <span>{state.overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${state.overallProgress}%` }}
            />
          </div>
        </div>

        {/* Переключатель режима */}
        <button
          onClick={toggleMode}
          className="mt-6 w-full py-2 px-4 rounded-lg border text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          {state.mode === 'text' ? '🎤 Голосовой режим' : '⌨️ Текстовый режим'}
        </button>
      </aside>

      {/* === ОСНОВНАЯ ОБЛАСТЬ: Чат === */}
      <main className="flex-1 flex flex-col">
        {/* Заголовок шага */}
        <header className="bg-white border-b px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-900">
            Шаг {state.currentStep}: {steps[state.currentStep - 1]?.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {state.currentStep <= 2 ? 'AI ведёт себя как Product Owner' :
             'AI ведёт себя как бизнес-аналитик'}
          </p>
        </header>

        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {state.messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border shadow-sm text-gray-800'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Карточка извлечённых данных (для AI-сообщений) */}
                {msg.extractedData && Object.keys(msg.extractedData).length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-medium text-blue-700 mb-1">Извлечено для ТЗ:</p>
                    <pre className="text-xs text-blue-600 overflow-x-auto">
                      {JSON.stringify(msg.extractedData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Индикатор загрузки */}
          {state.isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border shadow-sm rounded-2xl px-4 py-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}

          {/* Предупреждения о противоречиях */}
          {state.contradictions.map(c => (
            <div key={c.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800">⚠ {c.description}</p>
              <button
                onClick={() => handleOverride(c.id, c.description)}
                className="mt-2 text-xs text-amber-600 underline hover:text-amber-800"
              >
                Продолжить, несмотря на предупреждение
              </button>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Поле ввода */}
        <div className="border-t bg-white px-6 py-4">
          <div className="max-w-3xl mx-auto flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введите ответ... (Enter — отправить, Shift+Enter — перенос)"
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              disabled={state.isLoading}
            />
            <button
              onClick={sendAnswer}
              disabled={!input.trim() || state.isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Отправить
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
