import type { MergedSettingNode } from "../../types/effective";
import { SettingNode } from "./SettingNode";

interface SettingsTreeProps {
  settings: MergedSettingNode[];
  onFileClick: (sourceFile: string) => void;
}

/** マージ済み設定をツリー形式で表示するコンテナ */
export function SettingsTree({ settings, onFileClick }: SettingsTreeProps) {
  if (settings.length === 0) {
    return (
      <div className="text-xs text-slate-500 px-2 py-3 text-center">設定が見つかりませんでした</div>
    );
  }

  return (
    <div className="space-y-0.5">
      {settings.map((node) => (
        <SettingNode key={node.path} node={node} depth={0} onFileClick={onFileClick} />
      ))}
    </div>
  );
}
