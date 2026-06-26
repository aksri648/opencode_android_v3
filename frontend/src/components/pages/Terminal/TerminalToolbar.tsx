import { ChevronDown, RefreshCw } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface TerminalToolbarProps {
  terminalName: string;
  onDropdownToggle: () => void;
  onReconnect: () => void;
}

export function TerminalToolbar({ terminalName, onDropdownToggle, onReconnect }: TerminalToolbarProps) {
  const { workspace } = useWorkspaceStore();

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-secondary border-b border-border">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
          {workspace?.name || 'Workspace'}
        </span>
      </div>
      <button
        onClick={onDropdownToggle}
        className="flex items-center gap-1 px-2 py-1 text-sm text-foreground hover:bg-accent rounded transition-colors"
      >
        <span className="truncate max-w-[100px]">{terminalName}</span>
        <ChevronDown size={14} />
      </button>
      <button
        onClick={onReconnect}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
      >
        <RefreshCw size={14} />
      </button>
    </div>
  );
}
