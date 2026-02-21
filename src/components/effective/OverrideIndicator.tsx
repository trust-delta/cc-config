import { useState, useCallback } from "react";
import type { SettingOverride, EffectiveScope } from "../../types/effective";
import { ScopeBadge } from "./ScopeBadge";

interface OverrideIndicatorProps {
  overrides: SettingOverride[];
  currentScope: EffectiveScope;
}

/** 値を表示用に切り詰める */
function truncateValue(value: unknown, maxLength: number): string {
  const str = JSON.stringify(value);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

/** ファイルパスからベース名を取得する */
function basename(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? filePath;
}

/** 設定が上書きされていることを示すインジケーター */
export function OverrideIndicator({ overrides, currentScope }: OverrideIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  if (!overrides || overrides.length <= 1) {
    return null;
  }

  // currentScope 以外のオーバーライドをフィルタリング
  const otherOverrides = overrides.filter((o) => o.scope !== currentScope);
  if (otherOverrides.length === 0) {
    return null;
  }

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="inline-flex items-center text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded font-bold leading-none border border-amber-400/30 cursor-help ml-1">
        OVERRIDE
      </span>

      {isHovered && (
        <div className="absolute left-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded p-2 shadow-lg z-50 min-w-48">
          <div className="text-[10px] text-slate-400 mb-1 font-semibold">上書き履歴</div>
          {overrides.map((override, index) => (
            <div key={index} className="flex items-center gap-1.5 py-0.5 text-[10px]">
              <ScopeBadge scope={override.scope} />
              <span className="text-slate-200 font-mono truncate max-w-[120px]">
                {truncateValue(override.value, 20)}
              </span>
              <span className="text-slate-500 truncate">{basename(override.sourceFile)}</span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
