import { useHealth } from '@/hooks/useHealth';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { data: health } = useHealth();

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 border',
            health?.status === 'ok'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200',
          )}
        >
          <Activity className="w-3 h-3" />
          {health?.status === 'ok' ? 'API Online' : 'API Offline'}
        </span>
      </div>
    </header>
  );
}
