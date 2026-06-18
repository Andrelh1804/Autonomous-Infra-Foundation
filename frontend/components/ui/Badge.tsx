import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'danger' | 'warning' | 'info';

const variants: Record<Variant, string> = {
  default: 'bg-secondary text-secondary-foreground',
  success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  danger: 'bg-red-500/10 text-red-500 border-red-500/20',
  warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  info: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

export default function Badge({ children, variant = 'default' }: {
  children: React.ReactNode;
  variant?: Variant;
}) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
      variants[variant]
    )}>
      {children}
    </span>
  );
}
