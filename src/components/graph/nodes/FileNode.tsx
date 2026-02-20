import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type { FileNode as FileNodeType } from "../../../types/graph";
import { SCOPE_COLORS, LOCAL_OVERRIDE_BORDER } from "../../../constants/styles";

/** ファイルアイコンを返す（カテゴリに応じて変更） */
function getFileIcon(name: string): string {
  if (name.endsWith(".md")) return "📄";
  if (name.endsWith(".json")) return "⚙️";
  if (name.endsWith(".sh") || name.endsWith(".bash")) return "🔧";
  return "📁";
}

/** ファイルノード */
function FileNodeComponent({ data }: NodeProps<FileNodeType>) {
  const colors = SCOPE_COLORS[data.scope];
  const borderColor = data.isLocalOverride ? LOCAL_OVERRIDE_BORDER : colors.border;

  return (
    <div
      className="px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition-all
        hover:brightness-125 hover:scale-105 truncate max-w-[140px]"
      style={{
        backgroundColor: "#0f172a",
        border: `1px solid ${borderColor}`,
        color: "#e2e8f0",
      }}
      title={data.file.path}
    >
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-slate-400" />
      <span className="mr-1">{getFileIcon(data.file.name)}</span>
      <span>{data.file.name}</span>
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-slate-400" />
    </div>
  );
}

export const FileNode = memo(FileNodeComponent);
