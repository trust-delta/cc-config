import type { DetectedFile } from "../../types/config";
import type { ExtensionEntry } from "../../types/effective";
import { FileEntry } from "./FileEntry";

interface ExtensionsListProps {
  extensions: ExtensionEntry[];
  onFileSelect: (file: DetectedFile) => void;
}

/** カテゴリの表示ラベル */
const CATEGORY_DISPLAY: Record<ExtensionEntry["category"], string> = {
  skills: "Skills",
  agents: "Agents",
  templates: "Templates",
  plugins: "Plugins",
};

/** カテゴリの表示順 */
const CATEGORY_ORDER: ExtensionEntry["category"][] = ["skills", "agents", "templates", "plugins"];

/** Extensions セクションのファイル一覧をカテゴリ別に表示するコンポーネント */
export function ExtensionsList({ extensions, onFileSelect }: ExtensionsListProps) {
  if (extensions.length === 0) {
    return (
      <div className="text-xs text-slate-500 px-2 py-3 text-center">
        Extensions ファイルが見つかりませんでした
      </div>
    );
  }

  return (
    <div>
      {CATEGORY_ORDER.map((category) => {
        const entries = extensions.filter((ext) => ext.category === category);
        if (entries.length === 0) return null;

        return (
          <div key={category}>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider px-2 py-1">
              {CATEGORY_DISPLAY[category]}
            </div>
            {entries.map((entry) => (
              <FileEntry
                key={entry.file.path}
                file={entry.file}
                scope="global"
                onClick={onFileSelect}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
