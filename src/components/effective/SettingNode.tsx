import { memo, useState, useCallback } from "react";
import type { MergedSettingNode } from "../../types/effective";
import { ScopeBadge } from "./ScopeBadge";
import { OverrideIndicator } from "./OverrideIndicator";

interface SettingNodeProps {
  node: MergedSettingNode;
  depth: number;
  onFileClick: (sourceFile: string) => void;
}

/** unknown型の値を表示用にフォーマットする */
function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") return "{…}";
  return String(value);
}

/** 設定ツリーの個別ノードを再帰的に表示するコンポーネント */
function SettingNodeComponent({ node, depth, onFileClick }: SettingNodeProps) {
  const defaultExpanded = depth < 2;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpand = useCallback(() => setIsExpanded((prev) => !prev), []);
  const handleBadgeClick = useCallback(
    () => onFileClick(node.sourceFile),
    [onFileClick, node.sourceFile],
  );

  const indentPx = depth * 16;

  if (node.isLeaf) {
    return (
      <div
        className="flex items-center gap-1.5 py-0.5 min-h-[24px]"
        style={{ paddingLeft: `${indentPx}px` }}
      >
        <span className="text-slate-400 text-xs shrink-0">{node.key}:</span>
        <span className="text-slate-200 text-xs font-mono truncate">
          {formatValue(node.effectiveValue)}
        </span>
        <button
          type="button"
          className="shrink-0 cursor-pointer"
          onClick={handleBadgeClick}
          title={node.sourceFile}
        >
          <ScopeBadge scope={node.source} />
        </button>
        {node.overrides && (
          <OverrideIndicator overrides={node.overrides} currentScope={node.source} />
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 py-0.5 w-full text-left hover:bg-slate-800/30 transition-colors"
        style={{ paddingLeft: `${indentPx}px` }}
        onClick={toggleExpand}
      >
        <span className="text-[10px] text-slate-500">{isExpanded ? "▼" : "▶"}</span>
        <span className="text-slate-300 text-xs font-semibold">{node.key}</span>
      </button>

      {isExpanded &&
        node.children?.map((child) => (
          <SettingNode key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} />
        ))}
    </div>
  );
}

export const SettingNode = memo(SettingNodeComponent);
