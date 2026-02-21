import { memo, useCallback } from "react";
import type { DetectedFile } from "../../types/config";
import type { EffectiveScope } from "../../types/effective";
import { ScopeBadge } from "./ScopeBadge";

interface FileEntryProps {
  file: DetectedFile;
  scope: EffectiveScope;
  onClick: (file: DetectedFile) => void;
  label?: string;
}

/** ファイル名からアイコンを返す */
function getFileIcon(name: string, isDirectory: boolean): string {
  if (isDirectory) return "📁";
  if (name.endsWith(".md")) return "📄";
  if (name.endsWith(".json")) return "⚙️";
  return "📄";
}

/** クリック可能なファイルエントリを表示するコンポーネント */
function FileEntryComponent({ file, scope, onClick, label }: FileEntryProps) {
  const handleClick = useCallback(() => onClick(file), [onClick, file]);

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded
        text-xs font-mono cursor-pointer hover:bg-slate-800/50 transition-colors"
      title={file.path}
      onClick={handleClick}
    >
      <span>{getFileIcon(file.name, file.isDirectory)}</span>
      <span className="text-slate-200 truncate flex-1">{label ?? file.name}</span>
      <ScopeBadge scope={scope} />
    </button>
  );
}

export const FileEntry = memo(FileEntryComponent);
