import { useState, useEffect } from 'react';
import { Save, Wifi } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { healthApi } from '@/api/health';
import { clearUrlCache } from '@/api/client';
import { toast } from '@/components/shared/Toast';

export function SettingsView() {
  const { backendUrl, connectionStatus, setBackendUrl, setConnectionStatus, saveSettings } =
    useSettingsStore();
  const [urlInput, setUrlInput] = useState(backendUrl);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setUrlInput(backendUrl);
  }, [backendUrl]);

  const handleSave = async () => {
    setBackendUrl(urlInput.trim());
    await useSettingsStore.getState().saveSettings();
    clearUrlCache();
    toast('Settings saved', 'success');
  };

  const handleTestConnection = async () => {
    const url = urlInput.trim();
    if (!url) {
      toast('Enter a backend URL first', 'error');
      return;
    }

    setTesting(true);
    setConnectionStatus('checking');
    clearUrlCache();

    try {
      setBackendUrl(url);
      await saveSettings();

      await healthApi.check();
      setConnectionStatus('connected');
      toast('Connected successfully', 'success');
    } catch {
      setConnectionStatus('offline');
      toast('Connection failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-6">
      <h1 className="text-lg font-semibold text-foreground">Settings</h1>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Backend URL</label>
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://server.com"
          className="w-full px-3 py-2.5 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Save size={16} />
          Save
        </button>
        <button
          onClick={handleTestConnection}
          disabled={testing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        >
          {testing ? (
            <span className="animate-spin">⟳</span>
          ) : (
            <Wifi size={16} />
          )}
          Test Connection
        </button>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary">
        {connectionStatus === 'connected' ? (
          <>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-sm text-foreground">Connected</span>
          </>
        ) : connectionStatus === 'checking' ? (
          <>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-sm text-foreground">Checking...</span>
          </>
        ) : (
          <>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-sm text-foreground">Offline</span>
          </>
        )}
      </div>
    </div>
  );
}
