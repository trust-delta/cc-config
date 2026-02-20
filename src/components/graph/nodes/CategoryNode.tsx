import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { CategoryNode as CategoryNodeType } from "../../../types/graph";
import { SCOPE_COLORS } from "../../../constants/styles";

/** カテゴリノード（CLAUDE.md, Settings, Rules 等） */
function CategoryNodeComponent({ data }: NodeProps<CategoryNodeType>) {
  const colors = SCOPE_COLORS[data.scope];

  return (
    <div
      className="px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5"
      style={{
        backgroundColor: colors.categoryBg,
        borderLeft: `3px solid ${colors.border}`,
        color: colors.text,
      }}
    >
      <span>{data.label}</span>
      <span
        className="text-[10px] px-1 rounded-full"
        style={{ backgroundColor: colors.border + "30", color: colors.text }}
      >
        {data.fileCount}
      </span>
    </div>
  );
}

export const CategoryNode = memo(CategoryNodeComponent);
