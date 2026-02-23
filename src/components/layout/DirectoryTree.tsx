import { memo, useState, useCallback } from "react";
import type { ProjectTreeNode } from "../../types/config";

interface DirectoryTreeProps {
  /** ツリーのルートノード */
  tree: ProjectTreeNode;
  /** 選択中のディレクトリパス */
  selectedDir: string | null;
  /** ディレクトリ選択時のコールバック */
  onSelectDir: (path: string) => void;
}

interface TreeNodeProps {
  /** ノードデータ */
  node: ProjectTreeNode;
  /** インデントの深さ */
  depth: number;
  /** 選択中のディレクトリパス */
  selectedDir: string | null;
  /** ディレクトリ選択時のコールバック */
  onSelectDir: (path: string) => void;
  /** デフォルトで展開するか */
  defaultOpen: boolean;
}

/** 個別のツリーノード */
function TreeNode({ node, depth, selectedDir, onSelectDir, defaultOpen }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedDir === node.path;

  /** 展開/折り畳みトグル */
  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasChildren) {
        setIsOpen((prev) => !prev);
      }
    },
    [hasChildren],
  );

  /** ディレクトリ選択 */
  const handleSelect = useCallback(() => {
    onSelectDir(node.path);
  }, [node.path, onSelectDir]);

  const indentPx = depth * 16;

  return (
    <div>
      <button
        onClick={handleSelect}
        className={`w-full text-left flex items-center gap-1 py-1 pr-2 text-xs transition-colors rounded-sm ${
          isSelected
            ? "bg-purple-900/30 text-purple-200"
            : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
        }`}
        style={{ paddingLeft: `${indentPx + 4}px` }}
        title={node.path}
      >
        {/* 展開/折り畳みアイコン */}
        <span
          onClick={handleToggle}
          className={`w-4 text-center flex-shrink-0 ${hasChildren ? "cursor-pointer" : ""}`}
        >
          {hasChildren ? (isOpen ? "▾" : "▸") : " "}
        </span>

        {/* ディレクトリ名 */}
        <span className="truncate">{node.name}</span>

        {/* instruction ファイル存在インジケータ */}
        {node.hasInstructions && (
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-purple-500 ml-auto" />
        )}
      </button>

      {/* 子ノード */}
      {isOpen &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedDir={selectedDir}
            onSelectDir={onSelectDir}
            defaultOpen={false}
          />
        ))}
    </div>
  );
}

/** プロジェクトディレクトリツリーコンポーネント */
function DirectoryTreeComponent({ tree, selectedDir, onSelectDir }: DirectoryTreeProps) {
  return (
    <div className="overflow-y-auto overscroll-contain">
      <TreeNode
        node={tree}
        depth={0}
        selectedDir={selectedDir}
        onSelectDir={onSelectDir}
        defaultOpen={true}
      />
    </div>
  );
}

export const DirectoryTree = memo(DirectoryTreeComponent);
