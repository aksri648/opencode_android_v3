import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import { useFileStore } from '@/store/fileStore';
import type { FileNode } from '@/types';

interface TreeNodeProps {
  node: FileNode;
  depth?: number;
}

export function TreeNode({ node, depth = 0 }: TreeNodeProps) {
  const { expandedFolders, toggleFolder, setSelectedFile, selectedFile } = useFileStore();
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedFile === node.path;

  const handleClick = () => {
    if (node.type === 'directory') {
      toggleFolder(node.path);
    } else {
      setSelectedFile(node.path);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-1.5 py-1.5 px-2 text-sm text-left hover:bg-accent transition-colors ${
          isSelected ? 'bg-accent text-foreground' : 'text-muted-foreground'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.type === 'directory' ? (
          <>
            {isExpanded ? (
              <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
            )}
            <Folder size={14} className="shrink-0 text-yellow-500" />
          </>
        ) : (
          <>
            <span className="w-[14px] shrink-0" />
            <File size={14} className="shrink-0 text-blue-400" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.type === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
