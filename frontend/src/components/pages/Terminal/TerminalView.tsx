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

// Exponential backoff for reconnection
const MAX_RECONNECT_DELAY = 30000;
const BASE_RECONNECT_DELAY = 2000;

export function TerminalView() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sshReadyRef = useRef<boolean>(false);
  const inputQueueRef = useRef<string[]>([]);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectAttemptRef = useRef<number>(0);
  const intentionalCloseRef = useRef<boolean>(false);
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
      // Cancel any pending reconnection
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }

      // Close existing connection cleanly
      if (wsRef.current) {
        intentionalCloseRef.current = true;
        wsRef.current.close();
        wsRef.current = null;
      }

      sshReadyRef.current = false;
      inputQueueRef.current = [];
      intentionalCloseRef.current = false;

      const wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Reset reconnect counter on successful connection
        reconnectAttemptRef.current = 0;
        updateTerminalStatus(terminalId, 'connecting');
        // Send create terminal message
        const msg: TerminalMessage = { type: 'create', terminalId };
        ws.send(JSON.stringify(msg));
      };

      ws.onmessage = (event) => {
        try {
          const msg: TerminalMessage = JSON.parse(event.data);
          
          if (msg.type === 'output' && msg.data) {
            xtermRef.current?.write(msg.data);
          }
          
          if (msg.type === 'created') {
            console.log(`[Terminal] SSH ready for terminal ${msg.terminalId}`);
            sshReadyRef.current = true;
            reconnectAttemptRef.current = 0; // Reset on successful SSH
            updateTerminalStatus(terminalId, 'connected');
            
            // Send any queued input
            while (inputQueueRef.current.length > 0) {
              const queuedData = inputQueueRef.current.shift()!;
              const inputMsg: TerminalMessage = {
                type: 'input',
                terminalId: msg.terminalId || terminalId,
                data: queuedData,
              };
              ws.send(JSON.stringify(inputMsg));
            }
          }
          
          if (msg.type === 'error') {
            console.error(`[Terminal] Error from backend:`, msg.data);
            if (msg.data === 'SSH session disconnected') {
              // SSH dropped server-side — the WS is still open, but the
              // shell is gone. Show a message and schedule reconnect.
              sshReadyRef.current = false;
              updateTerminalStatus(terminalId, 'disconnected');
              xtermRef.current?.write(`\r\n\x1b[33mSSH session disconnected. Reconnecting...\x1b[0m\r\n`);
              scheduleReconnect(terminalId);
            } else {
              xtermRef.current?.write(`\r\n\x1b[31mError: ${msg.data}\x1b[0m\r\n`);
            }
          }
        } catch {
          // Binary data or malformed
          xtermRef.current?.write(event.data);
        }
      };

      ws.onclose = () => {
        sshReadyRef.current = false;
        updateTerminalStatus(terminalId, 'disconnected');

        // Only auto-reconnect if this wasn't an intentional close
        // (e.g., switching terminals or unmounting)
        if (!intentionalCloseRef.current) {
          xtermRef.current?.write(`\r\n\x1b[33mConnection lost. Reconnecting...\x1b[0m\r\n`);
          scheduleReconnect(terminalId);
        }
      };

      ws.onerror = () => {
        sshReadyRef.current = false;
        updateTerminalStatus(terminalId, 'error');
      };
    },
    [backendUrl, updateTerminalStatus]
  );

  const scheduleReconnect = useCallback(
    (terminalId: string) => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Exponential backoff: 2s, 4s, 8s, 16s, 30s (capped)
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(2, attempt),
        MAX_RECONNECT_DELAY
      );
      reconnectAttemptRef.current = attempt + 1;

      console.log(`[Terminal] Scheduling reconnect attempt ${attempt + 1} in ${delay}ms`);

      reconnectTimeoutRef.current = setTimeout(() => {
        // Check if terminal is still active before reconnecting
        const currentActive = useTerminalStore.getState().activeTerminalId;
        if (currentActive === terminalId) {
          connectWebSocket(terminalId);
        }
      }, delay);
    },
    [connectWebSocket]
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

    // Handle keyboard input — read activeTerminalId from store directly
    // to avoid stale closure issues
    term.onData((data) => {
      const ws = wsRef.current;
      const currentTerminalId = useTerminalStore.getState().activeTerminalId;
      if (ws?.readyState === WebSocket.OPEN && currentTerminalId) {
        const msg: TerminalMessage = {
          type: 'input',
          terminalId: currentTerminalId,
          data,
        };
        
        if (sshReadyRef.current) {
          ws.send(JSON.stringify(msg));
        } else {
          // Queue input until SSH is ready
          inputQueueRef.current.push(data);
          console.log(`[Terminal] Queued input (SSH not ready)`);
        }
      }
    });

    // Handle resize — debounced
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        fitAddon.fit();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const msg: TerminalMessage = {
            type: 'resize',
            cols: term.cols,
            rows: term.rows,
          };
          wsRef.current.send(JSON.stringify(msg));
        }
      }, 100);
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      clearTimeout(resizeTimeout);
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
        // Reset reconnection attempts when switching terminals
        reconnectAttemptRef.current = 0;
        connectWebSocket(activeTerminalId);
      }
    }
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
    };
  }, [activeTerminalId, connectWebSocket]);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

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
      reconnectAttemptRef.current = 0;
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
