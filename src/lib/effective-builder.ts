import type { ScanResult, DetectedFile } from "../types/config";
import type {
  EffectiveConfig,
  EffectiveScope,
  InstructionEntry,
  InstructionStackEntry,
  ExtensionEntry,
} from "../types/effective";
import type { SettingsLayer } from "./settings-merger";
import { determineScope, mergeSettings } from "./settings-merger";

/** 拡張カテゴリの型 */
type ExtensionCategory = "skills" | "agents" | "templates" | "plugins";

/** 拡張カテゴリの一覧 */
const EXTENSION_CATEGORIES: ReadonlySet<string> = new Set<ExtensionCategory>([
  "skills",
  "agents",
  "templates",
  "plugins",
]);

/** マージ優先度の定義（低→高） */
const SETTINGS_PRIORITY_ORDER: ReadonlyArray<{
  scope: "global" | "project";
  isLocal: boolean;
}> = [
  { scope: "global", isLocal: false },
  { scope: "global", isLocal: true },
  { scope: "project", isLocal: false },
  { scope: "project", isLocal: true },
];

/** ファイルが instructions カテゴリに属するかを判定する */
function isInstructionFile(file: DetectedFile): boolean {
  return file.category === "claude-md" || file.category === "rules";
}

/** ファイルが extensions カテゴリに属するかを判定する */
function isExtensionFile(file: DetectedFile): boolean {
  return EXTENSION_CATEGORIES.has(file.category);
}

/** Instructions セクションのソート順序を返す */
function instructionSortKey(entry: InstructionEntry): number {
  const scopeOrder = entry.scope === "global" ? 0 : 1;
  const typeOrder = entry.type === "claude-md" ? 0 : 1;
  return scopeOrder * 10 + typeOrder;
}

/** Instructions セクションを構築する */
function buildInstructions(files: DetectedFile[]): InstructionEntry[] {
  const entries: InstructionEntry[] = files.filter(isInstructionFile).map((file) => ({
    file,
    scope: determineScope(file),
    type: file.category === "claude-md" ? ("claude-md" as const) : ("rule" as const),
  }));

  // global → project、同スコープ内は claude-md → rules の順にソート
  entries.sort((a, b) => instructionSortKey(a) - instructionSortKey(b));

  return entries;
}

/** Settings セクションを構築する */
function buildSettings(
  files: DetectedFile[],
  settingsContents: Map<string, string>,
): ReturnType<typeof mergeSettings> {
  const settingsFiles = files.filter((f) => f.category === "settings");

  // 優先度順にレイヤーを構築
  const layers: SettingsLayer[] = [];
  for (const priority of SETTINGS_PRIORITY_ORDER) {
    const file = settingsFiles.find(
      (f) => f.scope === priority.scope && f.isLocalOverride === priority.isLocal,
    );
    if (!file) continue;

    const content = settingsContents.get(file.path);
    if (!content) continue;

    try {
      const parsed: unknown = JSON.parse(content);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        continue;
      }
      layers.push({
        scope: determineScope(file),
        sourceFile: file.path,
        data: parsed as Record<string, unknown>,
      });
    } catch {
      // パース失敗は無視
    }
  }

  // hooks は累積型マージ（全スコープの hooks が並列実行される）
  const additiveKeys = new Set(["hooks"]);
  return mergeSettings(layers, additiveKeys);
}

/** Extensions セクションを構築する */
function buildExtensions(files: DetectedFile[]): ExtensionEntry[] {
  return files.filter(isExtensionFile).map((file) => ({
    file,
    category: file.category as ExtensionCategory,
  }));
}

/** ファイルパスからスコープを判定する（instruction stack 用） */
function determineInstructionScope(file: DetectedFile, projectDir: string): EffectiveScope {
  /* CLAUDE.local.md は常に local */
  if (file.isLocalOverride || file.name === "CLAUDE.local.md") return "local";

  /* ~/.claude/ 配下は global */
  if (file.scope === "global") return "global";

  /* プロジェクトルート直下・.claude/ 内は project */
  const normalizedProject = projectDir.replace(/\/+$/, "");
  const fileDir = file.path.substring(0, file.path.lastIndexOf("/"));
  const normalizedFileDir = fileDir.replace(/\/+$/, "");

  if (
    normalizedFileDir === normalizedProject ||
    normalizedFileDir === `${normalizedProject}/.claude` ||
    normalizedFileDir === `${normalizedProject}/.claude/rules`
  ) {
    return "project";
  }

  /* それ以外はサブディレクトリ */
  return "subdirectory";
}

/** ファイルパスからオーナーディレクトリを取得する */
function getOwnerDir(filePath: string, isGlobal: boolean): string {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));

  /* グローバルスコープ: ~/.claude がルートなので剥がさない */
  if (isGlobal) {
    /* ~/.claude/rules/foo.md → ~/.claude */
    if (dir.endsWith("/rules") && dir.includes("/.claude/")) {
      return dir.replace(/\/rules$/, "");
    }
    /* ~/.claude/CLAUDE.md → ~/.claude */
    return dir;
  }

  /* プロジェクトスコープ: .claude を剥がしてプロジェクトルートを返す */
  /* .claude/rules/foo.md → 2つ上 */
  if (dir.endsWith("/rules") && dir.includes("/.claude/")) {
    return dir.replace(/\/.claude\/rules$/, "");
  }
  /* .claude/CLAUDE.md → 1つ上 */
  if (dir.endsWith("/.claude")) {
    return dir.replace(/\/.claude$/, "");
  }
  return dir;
}

/** instruction チェーンから InstructionStack を構築する（注入順＝低優先が先頭） */
export function buildInstructionStack(
  chainFiles: DetectedFile[],
  projectDir: string,
): InstructionStackEntry[] {
  return chainFiles.map((file, index) => ({
    file,
    scope: determineInstructionScope(file, projectDir),
    type: file.category === "claude-md" ? ("claude-md" as const) : ("rule" as const),
    injectionOrder: index + 1,
    ownerDir: getOwnerDir(file.path, file.scope === "global"),
  }));
}

/** ScanResult から EffectiveConfig を構築する */
export function buildEffectiveConfig(
  scanResult: ScanResult,
  settingsContents: Map<string, string>,
  instructionChainFiles?: DetectedFile[],
  projectDir?: string,
): EffectiveConfig {
  const { files } = scanResult;

  const config: EffectiveConfig = {
    instructions: buildInstructions(files),
    settings: buildSettings(files, settingsContents),
    extensions: buildExtensions(files),
  };

  /* instruction chain が渡された場合、スタックを構築 */
  if (instructionChainFiles && projectDir) {
    config.instructionStack = buildInstructionStack(instructionChainFiles, projectDir);
  }

  return config;
}
