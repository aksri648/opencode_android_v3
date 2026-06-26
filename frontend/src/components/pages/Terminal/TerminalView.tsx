import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { TerminalToolbar } from './TerminalToolbar';
import { TerminalDropdown } from './TerminalDropdown';
import { useTerminalStore } from '@/store/terminalStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { terminalApi } from '@/api/terminal';
import type { TerminalMessage } from '@/types';

export function TerminalView() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [terminalName, setTerminalName] = useState('Terminal 1');

  const {
    terminals,
    activeTerminalId,
    addTerminal,
    updateTerminalStatus,
    setActiveTerminal,
  } = useTerminalStore();
  const { workspace } = useWorkspaceStore();
  const { backendUrl } = useSettingsStore();

  const connectWebSocket = useCallback(
    (terminalId: string) => {
      if (wsRef.current) {
        wsRef.current.close();
      }

      const wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        updateTerminalStatus(terminalId, 'connected');
        // Send create terminal message
        const msg: TerminalMessage = { type: 'create', terminalId };
        ws.send(JSON.stringify(msg));
      };

      ws.onmessage = (event) => {
        try {
          const msg: TerminalMessage = JSON.parse(event.data);
          if (msg.type === 'output' && msg.terminalId === terminalId && msg.data) {
            xtermRef.current?.write(msg.data);
          }
          if (msg.type === 'created' && msg.terminalId) {
            updateTerminalStatus(terminalId, 'connected');
          }
        } catch {
          // Binary data or malformed
          xtermRef.current?.write(event.data);
        }
      };

      ws.onclose = () => {
        updateTerminalStatus(terminalId, 'disconnected');
        // Auto reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          if (activeTerminalId === terminalId) {
            connectWebSocket(terminalId);
          }
        }, 3000);
      };

      ws.onerror = () => {
        updateTerminalStatus(terminalId, 'error');
      };
    },
    [backendUrl, activeTerminalId, updateTerminalStatus]
  );

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
      theme: {
        background: '#0a0a0a',
        foreground: '#fafafa',
        cursor: '#fafafa',
        selectionBackground: '#333',
      },
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    fitAddon.fit();

    // Handle keyboard input
    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && activeTerminalId) {
        const msg: TerminalMessage = {
          type: 'input',
          terminalId: activeTerminalId,
          data,
        };
        wsRef.current.send(JSON.stringify(msg));
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const msg: TerminalMessage = {
          type: 'resize',
          cols: term.cols,
          rows: term.rows,
        };
        wsRef.current.send(JSON.stringify(msg));
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
  }, []);

  // Connect when active terminal changes
  useEffect(() => {
    if (activeTerminalId) {
      const terminal = terminals.find((t) => t.id === activeTerminalId);
      if (terminal) {
        setTerminalName(terminal.name);
        connectWebSocket(activeTerminalId);
      }
    }
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [activeTerminalId]);

  // Create initial terminal if none exists
  useEffect(() => {
    if (terminals.length === 0) {
      handleNewTerminal();
    }
  }, []);

  const handleNewTerminal = async () => {
    try {
      const terminal = await terminalApi.create();
      addTerminal(terminal);
      setTerminalName(terminal.name);
    } catch {
      // Fallback: create local terminal
      const id = crypto.randomUUID();
      const name = `Terminal ${terminals.length + 1}`;
      addTerminal({ id, name, workspaceId: workspace?.id || '', status: 'disconnected' });
      setTerminalName(name);
    }
  };

  const handleSelectTerminal = (id: string) => {
    setActiveTerminal(id);
    setIsDropdownOpen(false);
    xtermRef.current?.clear();
  };

  const handleReconnect = () => {
    if (activeTerminalId) {
      xtermRef.current?.clear();
      connectWebSocket(activeTerminalId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <TerminalToolbar
        terminalName={terminalName}
        onDropdownToggle={() => setIsDropdownOpen(!isDropdownOpen)}
        onReconnect={handleReconnect}
      />
      {isDropdownOpen && (
        <TerminalDropdown
          terminals={terminals}
          activeTerminalId={activeTerminalId}
          onSelect={handleSelectTerminal}
          onNewTerminal={handleNewTerminal}
          onClose={() => setIsDropdownOpen(false)}
        />
      )}
      <div ref={terminalRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
