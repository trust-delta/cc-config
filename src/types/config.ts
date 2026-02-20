/** 設定ファイルのスコープ */
export type ConfigScope = "global" | "project";

/** 設定ファイルのカテゴリ */
export type ConfigCategory =
  | "claude-md"
  | "settings"
  | "rules"
  | "skills"
  | "hooks"
  | "agents"
  | "templates"
  | "plugins";

/** カテゴリの表示ラベル */
export const CATEGORY_LABELS: Record<ConfigCategory, string> = {
  "claude-md": "CLAUDE.md",
  settings: "Settings",
  rules: "Rules",
  skills: "Skills",
  hooks: "Hooks",
  agents: "Agents",
  templates: "Templates",
  plugins: "Plugins",
};

/** 検出されたファイルの参照種別 */
export type ReferenceType = "at-import" | "hook-script" | "plugin" | "statusline";

/** ファイル間の参照情報 */
export interface FileReference {
  /** 参照元ファイルパス */
  sourceFile: string;
  /** 参照先ファイルパス */
  targetFile: string;
  /** 参照の種別 */
  type: ReferenceType;
  /** 参照元テキスト（例: "@rules/typescript.md"） */
  rawReference: string;
}

/** 検出された設定ファイル */
export interface DetectedFile {
  /** ファイルの絶対パス */
  path: string;
  /** ファイル名 */
  name: string;
  /** スコープ */
  scope: ConfigScope;
  /** カテゴリ */
  category: ConfigCategory;
  /** ファイルの内容（読込み済みの場合） */
  content?: string;
  /** local override かどうか（settings.local.json 等） */
  isLocalOverride: boolean;
  /** ディレクトリかどうか */
  isDirectory: boolean;
}

/** ディレクトリツリーのエントリ */
export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: DirEntry[];
}

/** hook設定の型 */
export interface HookEntry {
  type: "command";
  command: string;
}

/** settings.json の構造（必要なフィールドのみ） */
export interface SettingsJson {
  hooks?: Record<string, HookEntry[]>;
  enabledPlugins?: string[];
  statusLine?: string;
}

/** スキャン結果 */
export interface ScanResult {
  /** 検出されたファイル一覧 */
  files: DetectedFile[];
  /** ファイル間の参照一覧 */
  references: FileReference[];
}
