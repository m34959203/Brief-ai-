'use client';

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>{label}</span>
          <span>{Math.round(value)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
