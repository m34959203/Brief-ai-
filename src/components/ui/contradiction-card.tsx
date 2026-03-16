'use client';

import { AlertTriangle } from 'lucide-react';

interface ContradictionCardProps {
  id: string;
  description: string;
  severity: string;
  onOverride: (id: string, description: string) => void;
}

export function ContradictionCard({ id, description, severity, onOverride }: ContradictionCardProps) {
  return (
    <div className={`rounded-xl p-4 border ${
      severity === 'critical'
        ? 'bg-error-50 border-error/30'
        : 'bg-warning-50 border-warning/30'
    }`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
          severity === 'critical' ? 'text-error' : 'text-warning'
        }`} />
        <div className="flex-1">
          <p className={`text-sm font-medium ${
            severity === 'critical' ? 'text-error-700' : 'text-warning-700'
          }`}>
            {description}
          </p>
          <button
            onClick={() => onOverride(id, description)}
            className={`mt-2 text-xs underline hover:no-underline transition ${
              severity === 'critical' ? 'text-error/70 hover:text-error' : 'text-warning/70 hover:text-warning-700'
            }`}
          >
            Продолжить, несмотря на предупреждение
          </button>
        </div>
      </div>
    </div>
  );
}
