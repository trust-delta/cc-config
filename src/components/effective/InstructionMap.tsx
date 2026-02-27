import { memo, useState, useCallback, useMemo } from "react";
import type { DetectedFile } from "../../types/config";
import type { InstructionMapNode, InstructionMapFile } from "../../types/effective";
import { EFFECTIVE_SCOPE_COLORS } from "../../constants/styles";
import { ScopeBadge } from "./ScopeBadge";

interface InstructionMapProps {
  /** Instruction Map のルートノード配列（global + project） */
  map: InstructionMapNode[];
  /** ファイルクリック時のコールバック */
  onFileSelect: (file: DetectedFile) => void;
}

interface MapNodeProps {
  /** ノードデータ */
  node: InstructionMapNode;
  /** インデントの深さ */
  depth: number;
  /** ファイルクリック時のコールバック */
  onFileSelect: (file: DetectedFile) => void;
  /** デフォルトで展開するか */
  defaultOpen: boolean;
}

/** ツリーの接続線を描画するためのインデントコネクタ */
function TreeConnector({ depth, isLast }: { depth: number; isLast: boolean }) {
  if (depth === 0) return null;
  return (
    <span className="text-slate-600 text-xs flex-shrink-0 select-none" style={{ width: "16px" }}>
      {isLast ? "└─" : "├─"}
    </span>
  );
}

/** 個別のファイルエントリ */
function MapFileEntry({
  file,
  depth,
  isLast,
  onFileSelect,
}: {
  file: InstructionMapFile;
  depth: number;
  isLast: boolean;
  onFileSelect: (file: DetectedFile) => void;
}) {
  const icon = file.type === "claude-md" ? "📄" : "📏";

  return (
    <button
      onClick={() => onFileSelect(file.file)}
      className="w-full text-left flex items-center gap-1 py-0.5 px-1 text-xs
        text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 rounded transition-colors group"
      style={{ paddingLeft: `${depth * 16 + 20}px` }}
      title={file.file.path}
    >
      <TreeConnector depth={1} isLast={isLast} />
      <span className="flex-shrink-0 text-[10px]">{icon}</span>
      <span className="truncate">{file.relativePath}</span>
    </button>
  );
}

/** Instruction Map のツリーノード */
function MapNode({ node, depth, onFileSelect, defaultOpen }: MapNodeProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasContent = node.files.length > 0 || node.children.length > 0;
  const colors = EFFECTIVE_SCOPE_COLORS[node.scope];

  /** 展開/折り畳みトグル */
  const handleToggle = useCallback(() => {
    if (hasContent) {
      setIsOpen((prev) => !prev);
    }
  }, [hasContent]);

  const totalFiles = useMemo(
    () => node.files.length + node.children.reduce((sum, child) => sum + countFiles(child), 0),
    [node.files, node.children],
  );

  return (
    <div>
      {/* ディレクトリヘッダー */}
      <button
        onClick={handleToggle}
        className="w-full text-left flex items-center gap-1.5 py-1 px-1 text-xs rounded
          hover:bg-slate-800/50 transition-colors group"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        title={node.path}
      >
        {/* 展開/折り畳みアイコン */}
        <span className="w-3 text-center flex-shrink-0 text-slate-500">
          {hasContent ? (isOpen ? "▾" : "▸") : " "}
        </span>

        {/* ディレクトリアイコン + 名前 */}
        <span className="font-semibold truncate" style={{ color: colors.text }}>
          {node.name}/
        </span>

        {/* スコープバッジ */}
        {node.files.length > 0 && <ScopeBadge scope={node.scope} />}

        {/* ファイル数 */}
        {!isOpen && totalFiles > 0 && (
          <span className="text-[10px] text-slate-600 ml-auto flex-shrink-0">
            {totalFiles} file{totalFiles > 1 ? "s" : ""}
          </span>
        )}
      </button>

      {/* 展開時: ファイル + 子ノード */}
      {isOpen && (
        <div>
          {/* このディレクトリ直下の instruction ファイル */}
          {node.files.map((file, index) => (
            <MapFileEntry
              key={file.file.path}
              file={file}
              depth={depth + 1}
              isLast={index === node.files.length - 1 && node.children.length === 0}
              onFileSelect={onFileSelect}
            />
          ))}

          {/* 子ディレクトリ */}
          {node.children.map((child) => (
            <MapNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              defaultOpen={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** ノード配下の全ファイル数を再帰的にカウントする */
function countFiles(node: InstructionMapNode): number {
  return node.files.length + node.children.reduce((sum, child) => sum + countFiles(child), 0);
}

/** Instruction Map（系統樹表示）コンポーネント */
function InstructionMapComponent({ map, onFileSelect }: InstructionMapProps) {
  if (map.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-slate-500 text-xs">No instruction files found</div>
    );
  }

  const totalFiles = map.reduce((sum, node) => sum + countFiles(node), 0);

  return (
    <div className="px-1 py-2">
      {/* ヘッダー情報 */}
      <div className="px-2 pb-2 mb-1 border-b border-slate-700/50">
        <span className="text-[10px] text-slate-500">
          {totalFiles} instruction file{totalFiles > 1 ? "s" : ""} across all scopes
        </span>
      </div>

      {/* ツリー本体 */}
      <div className="space-y-0.5">
        {map.map((node) => (
          <MapNode
            key={node.path}
            node={node}
            depth={0}
            onFileSelect={onFileSelect}
            defaultOpen={true}
          />
        ))}
      </div>
    </div>
  );
}

export const InstructionMap = memo(InstructionMapComponent);
