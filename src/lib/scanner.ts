import { readDir, exists, readTextFile } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import type {
  ConfigCategory,
  ConfigScope,
  DetectedFile,
  DirEntry,
  ProjectTreeNode,
} from "../types/config";

/** ディレクトリが存在するかチェック */
async function dirExists(path: string): Promise<boolean> {
  try {
    return await exists(path);
  } catch {
    return false;
  }
}

/** ファイルが存在すれば DetectedFile として返す */
async function detectFile(
  path: string,
  scope: ConfigScope,
  category: ConfigCategory,
  isLocalOverride = false,
): Promise<DetectedFile | null> {
  try {
    const fileExists = await exists(path);
    if (!fileExists) return null;
    const name = path.split("/").pop() ?? path;
    return { path, name, scope, category, isLocalOverride, isDirectory: false };
  } catch {
    return null;
  }
}

/** ディレクトリ内のファイルを DetectedFile[] として返す */
async function detectFilesInDir(
  dirPath: string,
  scope: ConfigScope,
  category: ConfigCategory,
  filterFn?: (name: string) => boolean,
): Promise<DetectedFile[]> {
  const results: DetectedFile[] = [];
  try {
    if (!(await dirExists(dirPath))) return results;
    const entries = await readDir(dirPath);
    for (const entry of entries) {
      if (filterFn && !filterFn(entry.name)) continue;
      const fullPath = `${dirPath}/${entry.name}`;
      results.push({
        path: fullPath,
        name: entry.name,
        scope,
        category,
        isLocalOverride: false,
        isDirectory: entry.isDirectory ?? false,
      });
    }
  } catch {
    // ディレクトリ読取り失敗は無視
  }
  return results;
}

/** Skills ディレクトリをスキャン（サブディレクトリ内の SKILL.md を探す） */
async function detectSkills(basePath: string, scope: ConfigScope): Promise<DetectedFile[]> {
  const results: DetectedFile[] = [];
  try {
    if (!(await dirExists(basePath))) return results;
    const entries = await readDir(basePath);
    for (const entry of entries) {
      if (!entry.isDirectory) continue;
      const skillMdPath = `${basePath}/${entry.name}/SKILL.md`;
      const file = await detectFile(skillMdPath, scope, "skills");
      if (file) {
        file.name = `${entry.name}/SKILL.md`;
        results.push(file);
      }
    }
  } catch {
    // 読取り失敗は無視
  }
  return results;
}

/** グローバル設定（~/.claude/）をスキャン */
export async function scanGlobalConfig(): Promise<DetectedFile[]> {
  const home = await homeDir();
  const claudeDir = `${home}/.claude`;
  const files: DetectedFile[] = [];

  // CLAUDE.md
  const claudeMd = await detectFile(`${claudeDir}/CLAUDE.md`, "global", "claude-md");
  if (claudeMd) files.push(claudeMd);

  // Settings
  const settingsJson = await detectFile(`${claudeDir}/settings.json`, "global", "settings");
  if (settingsJson) files.push(settingsJson);
  const settingsLocal = await detectFile(
    `${claudeDir}/settings.local.json`,
    "global",
    "settings",
    true,
  );
  if (settingsLocal) files.push(settingsLocal);

  // Rules
  const rules = await detectFilesInDir(`${claudeDir}/rules`, "global", "rules", (n) =>
    n.endsWith(".md"),
  );
  files.push(...rules);

  // Skills
  const skills = await detectSkills(`${claudeDir}/skills`, "global");
  files.push(...skills);

  // Agents
  const agents = await detectFilesInDir(`${claudeDir}/agents`, "global", "agents", (n) =>
    n.endsWith(".md"),
  );
  files.push(...agents);

  // Templates
  const templates = await detectFilesInDir(`${claudeDir}/templates`, "global", "templates");
  files.push(...templates);

  // Plugins
  const plugins = await detectFilesInDir(`${claudeDir}/plugins`, "global", "plugins");
  files.push(...plugins);

  return files;
}

/** プロジェクト設定（./.claude/）をスキャン */
export async function scanProjectConfig(projectDir: string): Promise<DetectedFile[]> {
  const claudeDir = `${projectDir}/.claude`;
  const files: DetectedFile[] = [];

  // CLAUDE.md（プロジェクトルート直下 + .claude/ 内）
  const rootClaudeMd = await detectFile(`${projectDir}/CLAUDE.md`, "project", "claude-md");
  if (rootClaudeMd) files.push(rootClaudeMd);
  const dotClaudeMd = await detectFile(`${claudeDir}/CLAUDE.md`, "project", "claude-md");
  if (dotClaudeMd) files.push(dotClaudeMd);

  // Settings
  const settingsJson = await detectFile(`${claudeDir}/settings.json`, "project", "settings");
  if (settingsJson) files.push(settingsJson);
  const settingsLocal = await detectFile(
    `${claudeDir}/settings.local.json`,
    "project",
    "settings",
    true,
  );
  if (settingsLocal) files.push(settingsLocal);

  // Rules
  const rules = await detectFilesInDir(`${claudeDir}/rules`, "project", "rules", (n) =>
    n.endsWith(".md"),
  );
  files.push(...rules);

  // Skills
  const skills = await detectSkills(`${claudeDir}/skills`, "project");
  files.push(...skills);

  return files;
}

/** ファイルの内容を読み込んで返す */
export async function readFileContent(path: string): Promise<string | null> {
  try {
    return await readTextFile(path);
  } catch {
    return null;
  }
}

/** スキャン時に無視するディレクトリ名 */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".output",
  ".vercel",
  ".turbo",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  ".svelte-kit",
]);

/** ディレクトリに instruction ファイル（CLAUDE.md / .claude/rules/*.md）が存在するか判定 */
async function hasInstructionFiles(dirPath: string): Promise<boolean> {
  /* CLAUDE.md, CLAUDE.local.md のチェック */
  const claudeMdExists = await exists(`${dirPath}/CLAUDE.md`).catch(() => false);
  if (claudeMdExists) return true;
  const claudeLocalMdExists = await exists(`${dirPath}/CLAUDE.local.md`).catch(() => false);
  if (claudeLocalMdExists) return true;

  /* .claude/CLAUDE.md のチェック */
  const dotClaudeMd = await exists(`${dirPath}/.claude/CLAUDE.md`).catch(() => false);
  if (dotClaudeMd) return true;

  /* .claude/rules/*.md のチェック */
  try {
    const rulesDir = `${dirPath}/.claude/rules`;
    if (await exists(rulesDir)) {
      const entries = await readDir(rulesDir);
      if (entries.some((e) => e.name.endsWith(".md"))) return true;
    }
  } catch {
    /* 読取り失敗は無視 */
  }
  return false;
}

/** プロジェクトディレクトリツリーを再帰的に構築する */
export async function scanProjectTree(projectDir: string, maxDepth = 5): Promise<ProjectTreeNode> {
  /** 再帰ヘルパー */
  async function buildNode(dirPath: string, depth: number): Promise<ProjectTreeNode> {
    const name = dirPath.split("/").pop() ?? dirPath;
    const node: ProjectTreeNode = {
      name,
      path: dirPath,
      hasInstructions: await hasInstructionFiles(dirPath),
      children: [],
    };

    if (depth >= maxDepth) return node;

    try {
      const entries = await readDir(dirPath);
      const childPromises: Promise<ProjectTreeNode>[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory) continue;
        /* 無視対象ディレクトリをスキップ */
        if (IGNORED_DIRS.has(entry.name)) continue;
        /* .claude 以外の隠しディレクトリをスキップ */
        if (entry.name.startsWith(".") && entry.name !== ".claude") continue;
        childPromises.push(buildNode(`${dirPath}/${entry.name}`, depth + 1));
      }
      node.children = await Promise.all(childPromises);
      /* 名前順にソート */
      node.children.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      /* 読取り失敗は無視 */
    }

    return node;
  }

  return buildNode(projectDir, 0);
}

/** 指定ディレクトリの instruction ファイルを検出する */
export async function scanDirInstructions(
  dirPath: string,
  scope: ConfigScope = "project",
): Promise<DetectedFile[]> {
  const files: DetectedFile[] = [];

  /* CLAUDE.md（ディレクトリ直下） */
  const claudeMd = await detectFile(`${dirPath}/CLAUDE.md`, scope, "claude-md");
  if (claudeMd) files.push(claudeMd);

  /* .claude/CLAUDE.md */
  const dotClaudeMd = await detectFile(`${dirPath}/.claude/CLAUDE.md`, scope, "claude-md");
  if (dotClaudeMd) files.push(dotClaudeMd);

  /* CLAUDE.local.md */
  const localMd = await detectFile(`${dirPath}/CLAUDE.local.md`, scope, "claude-md", true);
  if (localMd) files.push(localMd);

  /* .claude/rules/*.md */
  const rules = await detectFilesInDir(`${dirPath}/.claude/rules`, scope, "rules", (n) =>
    n.endsWith(".md"),
  );
  files.push(...rules);

  return files;
}

/** targetDir に対する instruction 注入チェーンを構築する（低優先→高優先の順） */
export async function buildInstructionChain(
  targetDir: string,
  projectDir: string,
): Promise<DetectedFile[]> {
  const chain: DetectedFile[] = [];
  const home = await homeDir();
  const normalizedHome = home.replace(/\/+$/, "");
  const globalClaudeDir = `${normalizedHome}/.claude`;
  const normalizedProject = projectDir.replace(/\/+$/, "");
  const normalizedTarget = targetDir.replace(/\/+$/, "");

  /* 1. グローバル ~/.claude/ の instruction ファイル */
  const globalClaudeMd = await detectFile(`${globalClaudeDir}/CLAUDE.md`, "global", "claude-md");
  if (globalClaudeMd) chain.push(globalClaudeMd);

  /* 2. グローバル rules */
  const globalRules = await detectFilesInDir(`${globalClaudeDir}/rules`, "global", "rules", (n) =>
    n.endsWith(".md"),
  );
  chain.push(...globalRules);

  /* 3. ~ から projectDir までの中間ディレクトリの CLAUDE.md（上方向探索） */
  if (normalizedProject.startsWith(normalizedHome + "/")) {
    const relativePath = normalizedProject.slice(normalizedHome.length + 1);
    const segments = relativePath.split("/");
    let currentPath = normalizedHome;

    for (const segment of segments) {
      currentPath = `${currentPath}/${segment}`;
      if (currentPath === normalizedProject) break;
      const claudeMd = await detectFile(`${currentPath}/CLAUDE.md`, "global", "claude-md");
      if (claudeMd) chain.push(claudeMd);
    }
  }

  /* 4. プロジェクトルートの instruction ファイル */
  const projectInstructions = await scanDirInstructions(projectDir, "project");
  chain.push(...projectInstructions);

  /* 5. projectDir から targetDir までの中間ディレクトリ（下方向探索） */
  if (normalizedTarget !== normalizedProject) {
    const relativePath = normalizedTarget.slice(normalizedProject.length + 1);
    const segments = relativePath.split("/");
    let currentPath = normalizedProject;

    for (const segment of segments) {
      currentPath = `${currentPath}/${segment}`;
      const dirInstructions = await scanDirInstructions(currentPath, "project");
      chain.push(...dirInstructions);
    }
  }

  return chain;
}

/** ディレクトリの内容を再帰的に読み込む（最大2階層） */
export async function readDirTree(dirPath: string, depth = 0): Promise<DirEntry[]> {
  const maxDepth = 2;
  try {
    const entries = await readDir(dirPath);
    const result: DirEntry[] = [];
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;
      const isDir = entry.isDirectory ?? false;
      const node: DirEntry = { name: entry.name, path: fullPath, isDirectory: isDir };
      if (isDir && depth < maxDepth) {
        node.children = await readDirTree(fullPath, depth + 1);
      }
      result.push(node);
    }
    // ディレクトリ優先、名前順
    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return result;
  } catch {
    return [];
  }
}
