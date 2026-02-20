import type { ConfigScope, ReferenceType } from "../types/config";

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

/** エッジ種別ごとの色 */
export const EDGE_COLORS: Record<ReferenceType, string> = {
  "at-import": "#a78bfa",
  "hook-script": "#f59e0b",
  plugin: "#ec4899",
  statusline: "#06b6d4",
};

/** エッジ種別ごとのラベル */
export const EDGE_LABELS: Record<ReferenceType, string> = {
  "at-import": "@import",
  "hook-script": "hook",
  plugin: "plugin",
  statusline: "statusLine",
};
