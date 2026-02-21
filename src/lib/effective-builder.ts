import type { ScanResult, DetectedFile } from "../types/config";
import type { EffectiveConfig, InstructionEntry, ExtensionEntry } from "../types/effective";
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

  return mergeSettings(layers);
}

/** Extensions セクションを構築する */
function buildExtensions(files: DetectedFile[]): ExtensionEntry[] {
  return files.filter(isExtensionFile).map((file) => ({
    file,
    category: file.category as ExtensionCategory,
  }));
}

/** ScanResult から EffectiveConfig を構築する */
export function buildEffectiveConfig(
  scanResult: ScanResult,
  settingsContents: Map<string, string>,
): EffectiveConfig {
  const { files } = scanResult;

  return {
    instructions: buildInstructions(files),
    settings: buildSettings(files, settingsContents),
    extensions: buildExtensions(files),
  };
}
