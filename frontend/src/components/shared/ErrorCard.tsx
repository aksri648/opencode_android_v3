import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorCardProps {
  title?: string;
  message: string;
  className?: string;
  onRetry?: () => void;
}

export function ErrorCard({
  title = 'Error',
  message,
  className,
  onRetry,
}: ErrorCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 p-6 rounded-lg border border-destructive/50 bg-destructive/10',
        className
      )}
    >
      <AlertCircle className="text-destructive" size={32} />
      <div className="text-center">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
