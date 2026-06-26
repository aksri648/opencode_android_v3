import { useEffect, useState } from 'react';
import { Search, FolderOpen } from 'lucide-react';
import { TreeNode } from './TreeNode';
import { useFileStore } from '@/store/fileStore';
import { filesApi } from '@/api/files';
import { LoadingState } from '@/components/shared/LoadingSpinner';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { EmptyState } from '@/components/shared/EmptyState';

export function FileTree() {
  const { tree, setTree } = useFileStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTree = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await filesApi.tree();
      setTree(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load file tree');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  const filterTree = (nodes: typeof tree, query: string): typeof tree => {
    if (!query) return nodes;
    return nodes
      .map((node) => {
        if (node.name.toLowerCase().includes(query.toLowerCase())) return node;
        if (node.type === 'directory' && node.children) {
          const filtered = filterTree(node.children, query);
          if (filtered.length > 0) return { ...node, children: filtered };
        }
        return null;
      })
      .filter(Boolean) as typeof tree;
  };

  const filteredTree = filterTree(tree, searchQuery);

  if (loading) return <LoadingState message="Loading files..." />;
  if (error) return <ErrorCard message={error} onRetry={fetchTree} />;
  if (tree.length === 0)
    return (
      <EmptyState
        icon={<FolderOpen size={40} />}
        title="No files"
        description="Workspace files will appear here"
      />
    );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredTree.map((node) => (
          <TreeNode key={node.path} node={node} />
        ))}
      </div>
    </div>
  );
}
