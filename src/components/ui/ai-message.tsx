'use client';

import { cn } from '@/lib/utils';
import { Bot } from 'lucide-react';

interface AIMessageProps {
  content: string;
  extractedData?: Record<string, unknown>;
  isLoading?: boolean;
}

export function AIMessage({ content, extractedData, isLoading }: AIMessageProps) {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className="max-w-2xl">
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
          {isLoading ? (
            <div className="flex space-x-2 py-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          ) : (
            <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
          )}
        </div>

        {extractedData && Object.keys(extractedData).length > 0 && (
          <div className="mt-2 p-3 bg-accent/5 rounded-xl border border-accent/20">
            <p className="text-xs font-medium text-accent mb-1.5">Извлечено для ТЗ:</p>
            <pre className="text-xs text-accent/80 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(extractedData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
