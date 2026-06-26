import { Plus } from 'lucide-react';
import type { Terminal } from '@/types';

interface TerminalDropdownProps {
  terminals: Terminal[];
  activeTerminalId: string | null;
  onSelect: (id: string) => void;
  onNewTerminal: () => void;
  onClose: () => void;
}

export function TerminalDropdown({
  terminals,
  activeTerminalId,
  onSelect,
  onNewTerminal,
  onClose,
}: TerminalDropdownProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 right-0 z-50 mx-2 mt-1 bg-secondary border border-border rounded-lg shadow-lg overflow-hidden">
        {terminals.map((terminal) => (
          <button
            key={terminal.id}
            onClick={() => onSelect(terminal.id)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
              terminal.id === activeTerminalId
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <span className="truncate">{terminal.name}</span>
            {terminal.id === activeTerminalId && (
              <span className="ml-auto text-xs text-muted-foreground">
                {terminal.status === 'connected' ? '●' : '○'}
              </span>
            )}
          </button>
        ))}
        <div className="border-t border-border">
          <button
            onClick={() => {
              onNewTerminal();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Plus size={14} />
            <span>New Terminal</span>
          </button>
        </div>
      </div>
    </>
  );
}
