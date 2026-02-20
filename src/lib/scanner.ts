import { readDir, exists, readTextFile } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import type { ConfigCategory, ConfigScope, DetectedFile, DirEntry } from "../types/config";

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
