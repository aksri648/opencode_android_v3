import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Terminal, FolderOpen, Settings } from 'lucide-react';
import { TerminalView } from './components/pages/Terminal/TerminalView';
import { FilesView } from './components/pages/Files/FilesView';
import { SettingsView } from './components/pages/Settings/SettingsView';
import { ToastContainer } from './components/shared/Toast';
import { useEffect } from 'react';
import { useSettingsStore } from './store/settingsStore';

function BottomNav() {
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 py-2 px-4 text-xs transition-colors ${
      isActive ? 'text-foreground' : 'text-muted-foreground'
    }`;

  return (
    <nav className="flex items-center justify-around border-t border-border bg-secondary safe-area-bottom">
      <NavLink to="/" end className={navClass}>
        <Terminal size={20} />
        <span>Terminal</span>
      </NavLink>
      <NavLink to="/files" className={navClass}>
        <FolderOpen size={20} />
        <span>Files</span>
      </NavLink>
      <NavLink to="/settings" className={navClass}>
        <Settings size={20} />
        <span>Settings</span>
      </NavLink>
    </nav>
  );
}

export default function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <BrowserRouter>
      <div className="flex flex-col h-full">
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<TerminalView />} />
            <Route path="/files" element={<FilesView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Routes>
        </main>
        <BottomNav />
        <ToastContainer />
      </div>
    </BrowserRouter>
  );
}
