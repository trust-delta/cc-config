import type { ScanResult, DetectedFile } from "../types/config";
import type {
  EffectiveConfig,
  EffectiveScope,
  InstructionEntry,
  InstructionStackEntry,
  InstructionMapNode,
  InstructionMapFile,
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

/** ファイルの相対パスを生成する */
function getRelativePath(filePath: string, ownerDir: string): string {
  if (filePath.startsWith(ownerDir + "/")) {
    return filePath.slice(ownerDir.length + 1);
  }
  return filePath.split("/").pop() ?? filePath;
}

/** Instruction Map（系統樹）を構築する */
export function buildInstructionMap(
  globalFiles: DetectedFile[],
  projectFiles: DetectedFile[],
  projectDir: string,
  homeDir: string,
): InstructionMapNode[] {
  const nodes: InstructionMapNode[] = [];

  /* グローバルスコープ（~/.claude/） */
  const globalInstructions = globalFiles.filter(isInstructionFile);
  if (globalInstructions.length > 0) {
    const normalizedHome = homeDir.replace(/\/+$/, "");
    const globalClaudeDir = `${normalizedHome}/.claude`;
    const globalNode: InstructionMapNode = {
      name: "~/.claude",
      path: globalClaudeDir,
      scope: "global",
      files: globalInstructions.map((file) => ({
        file,
        type: file.category === "claude-md" ? "claude-md" : "rule",
        relativePath: getRelativePath(file.path, globalClaudeDir),
      })),
      children: [],
    };
    nodes.push(globalNode);
  }

  /* プロジェクトスコープ以下のファイルをディレクトリごとにグループ化 */
  const projectInstructions = projectFiles.filter(isInstructionFile);
  if (projectInstructions.length === 0) return nodes;

  const normalizedProject = projectDir.replace(/\/+$/, "");

  /* ファイルをオーナーディレクトリでグルーピング */
  const dirGroups = new Map<string, InstructionMapFile[]>();

  for (const file of projectInstructions) {
    const ownerDir = getOwnerDir(file.path, false);
    if (!dirGroups.has(ownerDir)) {
      dirGroups.set(ownerDir, []);
    }
    dirGroups.get(ownerDir)!.push({
      file,
      type: file.category === "claude-md" ? "claude-md" : "rule",
      relativePath: getRelativePath(file.path, ownerDir),
    });
  }

  /* ディレクトリパスでソートして木構造を構築 */
  const sortedDirs = Array.from(dirGroups.keys()).sort();

  /* ルートノード（プロジェクトルート） */
  const projectRootName = normalizedProject.split("/").pop() ?? normalizedProject;

  /** フラットなディレクトリリストから再帰的なツリーを構築する */
  function buildTree(
    parentPath: string,
    parentName: string,
    scope: EffectiveScope,
  ): InstructionMapNode {
    const node: InstructionMapNode = {
      name: parentName,
      path: parentPath,
      scope,
      files: dirGroups.get(parentPath) ?? [],
      children: [],
    };

    /* parentPath の直接的な子ディレクトリを探す */
    const childDirs = sortedDirs.filter((dir) => {
      if (dir === parentPath) return false;
      if (!dir.startsWith(parentPath + "/")) return false;
      /* parentPath と dir の間に他のグループ化されたディレクトリがないか確認 */
      const relativePart = dir.slice(parentPath.length + 1);
      const segments = relativePart.split("/");
      /* 中間ディレクトリがグループ化されていない場合は直接の子とみなす */
      for (let i = 0; i < segments.length - 1; i++) {
        const intermediatePath = parentPath + "/" + segments.slice(0, i + 1).join("/");
        if (dirGroups.has(intermediatePath)) return false;
      }
      return true;
    });

    for (const childDir of childDirs) {
      const childName = childDir.slice(parentPath.length + 1);
      const childScope = childDir === normalizedProject ? "project" : "subdirectory";
      node.children.push(buildTree(childDir, childName, childScope));
    }

    return node;
  }

  const projectScope: EffectiveScope = "project";
  const projectNode = buildTree(normalizedProject, projectRootName, projectScope);
  nodes.push(projectNode);

  return nodes;
}

/** ScanResult から EffectiveConfig を構築する */
export function buildEffectiveConfig(
  scanResult: ScanResult,
  settingsContents: Map<string, string>,
  instructionChainFiles?: DetectedFile[],
  projectDir?: string,
  allProjectInstructions?: DetectedFile[],
  homeDir?: string,
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

  /* instruction map を構築 */
  if (projectDir && homeDir && allProjectInstructions) {
    const globalFiles = files.filter((f) => f.scope === "global");
    config.instructionMap = buildInstructionMap(
      globalFiles,
      allProjectInstructions,
      projectDir,
      homeDir,
    );
  }

  return config;
}
