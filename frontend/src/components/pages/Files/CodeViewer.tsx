import { useState, useEffect } from 'react';
import { useFileStore } from '@/store/fileStore';
import { filesApi } from '@/api/files';
import { LoadingState } from '@/components/shared/LoadingSpinner';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { FileCode } from 'lucide-react';

export function CodeViewer() {
  const { selectedFile, fileContent, setFileContent, setSelectedFile } = useFileStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) return;

    const fetchContent = async () => {
      try {
        setLoading(true);
        setError(null);
        const content = await filesApi.content(selectedFile);
        setFileContent(content);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [selectedFile]);

  if (!selectedFile) {
    return (
      <EmptyState
        icon={<FileCode size={40} />}
        title="No file selected"
        description="Select a file from the explorer to view its contents"
      />
    );
  }

  if (loading) return <LoadingState message="Loading file..." />;
  if (error) return <ErrorCard message={error} />;

  const fileName = selectedFile.split('/').pop() || selectedFile;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary border-b border-border">
        <span className="text-sm font-medium text-foreground truncate">{fileName}</span>
        <button
          onClick={() => setSelectedFile(null)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-4 text-sm text-foreground font-mono bg-[#0a0a0a]">
        <code>{fileContent}</code>
      </pre>
    </div>
  );
}
