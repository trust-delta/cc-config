import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { ScopeGroupNode as ScopeGroupNodeType } from "../../../types/graph";
import { SCOPE_COLORS } from "../../../constants/styles";

/** スコープグループノード（Global / Project） */
function ScopeGroupNodeComponent({ data }: NodeProps<ScopeGroupNodeType>) {
  const colors = SCOPE_COLORS[data.scope];

  return (
    <div className="w-full h-full relative">
      <div
        className="absolute top-2 left-3 text-xs font-bold tracking-wider uppercase"
        style={{ color: colors.text }}
      >
        {data.label}
      </div>
    </div>
  );
}

export const ScopeGroupNode = memo(ScopeGroupNodeComponent);
