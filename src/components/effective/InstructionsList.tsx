import type { DetectedFile } from "../../types/config";
import type { InstructionEntry } from "../../types/effective";
import { FileEntry } from "./FileEntry";

interface InstructionsListProps {
  instructions: InstructionEntry[];
  onFileSelect: (file: DetectedFile) => void;
}

/** Instructions セクションのファイル一覧を表示するコンポーネント */
export function InstructionsList({ instructions, onFileSelect }: InstructionsListProps) {
  if (instructions.length === 0) {
    return (
      <div className="text-xs text-slate-500 px-2 py-3 text-center">
        Instructions ファイルが見つかりませんでした
      </div>
    );
  }

  const claudeMdEntries = instructions.filter((entry) => entry.type === "claude-md");
  const ruleEntries = instructions.filter((entry) => entry.type === "rule");

  return (
    <div>
      {claudeMdEntries.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider px-2 py-1">
            CLAUDE.md
          </div>
          {claudeMdEntries.map((entry) => (
            <FileEntry
              key={entry.file.path}
              file={entry.file}
              scope={entry.scope}
              onClick={onFileSelect}
            />
          ))}
        </div>
      )}

      {ruleEntries.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider px-2 py-1">Rules</div>
          {ruleEntries.map((entry) => (
            <FileEntry
              key={entry.file.path}
              file={entry.file}
              scope={entry.scope}
              onClick={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
