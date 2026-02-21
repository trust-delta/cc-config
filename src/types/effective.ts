import type { DetectedFile } from "./config";

/** 有効設定のスコープ */
export type EffectiveScope = "global" | "project" | "local";

/** マージ済み設定のツリーノード */
export interface MergedSettingNode {
  /** 設定キー名 */
  key: string;
  /** ドット区切りのフルパス */
  path: string;
  /** マージ後の有効値 */
  effectiveValue: unknown;
  /** 有効値のソース */
  source: EffectiveScope;
  /** ソースファイルパス */
  sourceFile: string;
  /** マージ戦略（"additive" = 累積型、未指定 = "replace"） */
  mergeStrategy?: "replace" | "additive";
  /** 上書き情報（低優先→高優先の順） */
  overrides?: SettingOverride[];
  /** 子ノード（オブジェクト型の場合） */
  children?: MergedSettingNode[];
  /** リーフノードか */
  isLeaf: boolean;
}

/** 上書き情報 */
export interface SettingOverride {
  /** スコープ */
  scope: EffectiveScope;
  /** ソースファイルパス */
  sourceFile: string;
  /** 上書き前の値 */
  value: unknown;
}

/** Instructions セクションのエントリ */
export interface InstructionEntry {
  /** 検出されたファイル */
  file: DetectedFile;
  /** スコープ */
  scope: EffectiveScope;
  /** 種別 */
  type: "claude-md" | "rule";
}

/** Extensions セクションのエントリ */
export interface ExtensionEntry {
  /** 検出されたファイル */
  file: DetectedFile;
  /** カテゴリ */
  category: "skills" | "agents" | "templates" | "plugins";
}

/** 有効設定の全体構造 */
export interface EffectiveConfig {
  /** Instructions セクション（CLAUDE.md + rules） */
  instructions: InstructionEntry[];
  /** Settings セクション（マージ済み設定ツリー） */
  settings: MergedSettingNode[];
  /** Extensions セクション（skills, agents等） */
  extensions: ExtensionEntry[];
}
