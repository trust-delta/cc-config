import { memo } from "react";
import type { EffectiveScope } from "../../types/effective";
import { EFFECTIVE_SCOPE_COLORS } from "../../constants/styles";

interface ScopeBadgeProps {
  scope: EffectiveScope;
  className?: string;
}

/** スコープの省略ラベルを返す */
const SCOPE_LABELS: Record<EffectiveScope, string> = {
  global: "G",
  project: "P",
  local: "L",
};

/** スコープを色付きバッジで表示するコンポーネント */
function ScopeBadgeComponent({ scope, className = "" }: ScopeBadgeProps) {
  const colors = EFFECTIVE_SCOPE_COLORS[scope];

  return (
    <span
      className={`inline-flex items-center justify-center text-[10px] px-1.5 py-0.5 rounded font-bold leading-none ${className}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {SCOPE_LABELS[scope]}
    </span>
  );
}

export const ScopeBadge = memo(ScopeBadgeComponent);
