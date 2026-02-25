import { memo, useMemo } from "react";
import type { DetectedFile } from "../../types/config";
import type { InstructionStackEntry, EffectiveScope } from "../../types/effective";
import { EFFECTIVE_SCOPE_COLORS } from "../../constants/styles";
import { ScopeBadge } from "./ScopeBadge";

interface InstructionStackProps {
  /** スタックエントリ（低優先が先頭、下ほど高優先） */
  stack: InstructionStackEntry[];
  /** 選択中のディレクトリパス */
  selectedDir: string;
  /** ファイルクリック時のコールバック */
  onFileSelect: (file: DetectedFile) => void;
}

/** スコープの表示名 */
const SCOPE_DISPLAY_NAMES: Record<EffectiveScope, string> = {
  global: "User",
  project: "Project",
  local: "Local",
  subdirectory: "Subdir",
};

/** スコープの表示順序（低→高） */
const SCOPE_ORDER: readonly EffectiveScope[] = ["global", "project", "local", "subdirectory"];

/** スコープが変わる境界のインデックスを検出する */
function findScopeBoundaries(stack: InstructionStackEntry[]): Set<number> {
  const boundaries = new Set<number>();
  for (let i = 1; i < stack.length; i++) {
    if (stack[i].scope !== stack[i - 1].scope) {
      boundaries.add(i);
    }
  }
  return boundaries;
}

/** 指定位置までの累積スコープラベルを生成する（例: "User + Project"） */
function buildAccumulatedLabel(stack: InstructionStackEntry[], upToIndex: number): string {
  const seen = new Set<EffectiveScope>();
  for (let i = 0; i <= upToIndex; i++) {
    seen.add(stack[i].scope);
  }
  return SCOPE_ORDER.filter((s) => seen.has(s))
    .map((s) => SCOPE_DISPLAY_NAMES[s])
    .join(" + ");
}

/** ファイルパスから表示用の短縮パスを生成する */
function shortenPath(filePath: string, selectedDir: string): string {
  if (filePath.startsWith(selectedDir)) {
    const relative = filePath.slice(selectedDir.length);
    return `.${relative}`;
  }
  /* ホームディレクトリの短縮 */
  const homeMatch = filePath.match(/^(\/home\/[^/]+|\/Users\/[^/]+)/);
  if (homeMatch) {
    return `~${filePath.slice(homeMatch[1].length)}`;
  }
  return filePath;
}

/** Instruction Stack を縦に並べるコンポーネント */
function InstructionStackComponent({ stack, selectedDir, onFileSelect }: InstructionStackProps) {
  const scopeBoundaries = useMemo(() => findScopeBoundaries(stack), [stack]);
  const finalLabel = useMemo(
    () => (stack.length > 0 ? buildAccumulatedLabel(stack, stack.length - 1) : ""),
    [stack],
  );

  if (stack.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-slate-500 text-xs">No instruction files found</div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-0">
      {stack.map((entry, index) => {
        const colors = EFFECTIVE_SCOPE_COLORS[entry.scope];
        const isBoundary = scopeBoundaries.has(index);

        return (
          <div key={`${entry.file.path}-${entry.injectionOrder}`}>
            {/* スコープ境界セパレータ: 累積状態を表示 */}
            {isBoundary && (
              <div className="flex items-center gap-2 py-1.5 px-1">
                <div className="flex-1 border-t border-dashed border-slate-600" />
                <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">
                  {buildAccumulatedLabel(stack, index - 1)}
                </span>
                <div className="flex-1 border-t border-dashed border-slate-600" />
              </div>
            )}

            {/* 優先度コネクタ（最初の要素以外） */}
            {index > 0 && !isBoundary && (
              <div className="flex justify-center py-0.5">
                <span className="text-slate-600 text-xs leading-none">↓</span>
              </div>
            )}

            {/* カード */}
            <button
              onClick={() => onFileSelect(entry.file)}
              className="w-full text-left rounded-md bg-slate-800/50 hover:bg-slate-700/50
                transition-colors cursor-pointer group"
              style={{ borderLeft: `4px solid ${colors.border}` }}
            >
              <div className="px-3 py-2">
                {/* ヘッダー行: 注入順番号 + ScopeBadge */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[10px] font-mono font-bold px-1 py-0.5 rounded"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >
                    #{entry.injectionOrder}
                  </span>
                  <ScopeBadge scope={entry.scope} />
                </div>

                {/* ファイル名 */}
                <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                  {entry.file.name}
                </div>

                {/* パス（短縮表示） */}
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  {shortenPath(entry.file.path, selectedDir)}
                </div>
              </div>
            </button>
          </div>
        );
      })}

      {/* 最終累積状態 */}
      <div className="pt-2 px-1">
        <div className="flex items-center gap-2">
          <div className="flex-1 border-t border-slate-600" />
          <span className="text-[10px] text-slate-300 whitespace-nowrap font-semibold">
            {finalLabel} → Stacked
          </span>
          <div className="flex-1 border-t border-slate-600" />
        </div>
      </div>
    </div>
  );
}

export const InstructionStack = memo(InstructionStackComponent);
