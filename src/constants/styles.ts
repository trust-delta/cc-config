import type { ConfigScope } from "../types/config";
import type { EffectiveScope } from "../types/effective";

/** スコープ別の色設定 */
export interface ScopeColors {
  background: string;
  border: string;
  text: string;
  categoryBg: string;
}

/** スコープ別の色マップ */
export const SCOPE_COLORS: Record<ConfigScope, ScopeColors> = {
  global: {
    background: "#1e3a5f",
    border: "#3b82f6",
    text: "#93c5fd",
    categoryBg: "#1e3a5f80",
  },
  project: {
    background: "#1a3d2e",
    border: "#22c55e",
    text: "#86efac",
    categoryBg: "#1a3d2e80",
  },
};

/** Local override のボーダー色 */
export const LOCAL_OVERRIDE_BORDER = "#f97316";

/** 有効設定スコープ別の色マップ */
export const EFFECTIVE_SCOPE_COLORS: Record<
  EffectiveScope,
  { bg: string; text: string; border: string }
> = {
  global: { bg: "#1e3a5f", text: "#93c5fd", border: "#3b82f6" },
  project: { bg: "#1a3d2e", text: "#86efac", border: "#22c55e" },
  local: { bg: "#3d2e1a", text: "#fdba74", border: "#f97316" },
  subdirectory: { bg: "#3d1a3d", text: "#e9b5f7", border: "#a855f7" },
};
