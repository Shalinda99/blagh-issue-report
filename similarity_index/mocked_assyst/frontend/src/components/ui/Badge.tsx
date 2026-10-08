import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outline';
}

export function Badge({ children, className, variant = 'outline' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
        variant === 'default' && 'bg-brand-100 text-brand-800 border-brand-200',
        className,
      )}
    >
      {children}
    </span>
  );
}
