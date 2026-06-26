import { Download } from 'lucide-react';
import { filesApi } from '@/api/files';
import { useState } from 'react';
import { toast } from '@/components/shared/Toast';

export function DownloadButton() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const blob = await filesApi.download();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workspace.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Download started', 'success');
    } catch {
      toast('Download failed', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-foreground bg-secondary border-t border-border hover:bg-accent transition-colors disabled:opacity-50"
    >
      <Download size={16} />
      <span>{downloading ? 'Downloading...' : 'Download Workspace'}</span>
    </button>
  );
}
