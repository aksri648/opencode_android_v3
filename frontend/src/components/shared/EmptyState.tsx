import { AlertTriangle } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      {icon || <AlertTriangle className="text-muted-foreground" size={40} />}
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-[280px]">{description}</p>
      )}
      {action}
    </div>
  );
}
