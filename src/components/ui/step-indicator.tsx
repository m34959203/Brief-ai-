'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  stepNumber: number;
  title: string;
  status: 'pending' | 'active' | 'completed' | 'skipped';
}

export function StepIndicator({ stepNumber, title, status }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all',
          status === 'completed' && 'bg-success/10 text-success',
          status === 'active' && 'bg-primary text-white shadow-md shadow-primary/30',
          status === 'pending' && 'bg-gray-100 text-gray-400',
          status === 'skipped' && 'bg-gray-100 text-gray-300 line-through'
        )}
      >
        {status === 'completed' ? <Check className="w-4 h-4" /> : stepNumber}
      </div>
      <span
        className={cn(
          'text-sm transition-colors',
          status === 'active' && 'font-semibold text-gray-900',
          status === 'completed' && 'text-success font-medium',
          status === 'pending' && 'text-gray-400',
          status === 'skipped' && 'text-gray-300 line-through'
        )}
      >
        {title}
      </span>
    </div>
  );
}
