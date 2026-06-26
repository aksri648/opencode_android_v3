import { useState, useEffect } from 'react';
import { useFileStore } from '@/store/fileStore';
import { FileTree } from './FileTree';
import { CodeViewer } from './CodeViewer';
import { DownloadButton } from './DownloadButton';

export function FilesView() {
  const { selectedFile } = useFileStore();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden">
          {selectedFile ? <CodeViewer /> : <FileTree />}
        </div>
        {!selectedFile && <DownloadButton />}
        {selectedFile && (
          <button
            onClick={() => useFileStore.getState().setSelectedFile(null)}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-foreground bg-secondary border-t border-border"
          >
            Back to files
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-border overflow-y-auto">
          <FileTree />
        </div>
        <div className="flex-1 overflow-hidden">
          <CodeViewer />
        </div>
      </div>
      <DownloadButton />
    </div>
  );
}
