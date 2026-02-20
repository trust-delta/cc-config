import type { DetectedFile, FileReference, SettingsJson } from "../types/config";
import { readFileContent } from "./scanner";
import { parseSettingsJson, extractAtReferences } from "./parser";

/** CLAUDE.md の @参照を解決 */
async function resolveAtReferences(
  claudeMdFile: DetectedFile,
  allFiles: DetectedFile[],
): Promise<FileReference[]> {
  const references: FileReference[] = [];
  const content = await readFileContent(claudeMdFile.path);
  if (!content) return references;

  const atRefs = extractAtReferences(content);
  for (const rawRef of atRefs) {
    // @参照先のファイルを allFiles から探す
    const targetFile = allFiles.find((f) => f.path.endsWith(rawRef));
    if (targetFile) {
      references.push({
        sourceFile: claudeMdFile.path,
        targetFile: targetFile.path,
        type: "at-import",
        rawReference: `@${rawRef}`,
      });
    }
  }
  return references;
}

/** settings.json の hooks 参照を解決 */
function resolveHookReferences(
  settingsFile: DetectedFile,
  settings: SettingsJson,
  allFiles: DetectedFile[],
): FileReference[] {
  const references: FileReference[] = [];

  if (settings.hooks) {
    for (const [, hookEntries] of Object.entries(settings.hooks)) {
      for (const entry of hookEntries) {
        if (entry.type === "command" && entry.command) {
          // コマンド内のファイルパスを検出（スクリプトファイルが allFiles にあるか）
          const targetFile = allFiles.find((f) =>
            entry.command.includes(f.name) || entry.command.includes(f.path),
          );
          if (targetFile) {
            references.push({
              sourceFile: settingsFile.path,
              targetFile: targetFile.path,
              type: "hook-script",
              rawReference: entry.command,
            });
          }
        }
      }
    }
  }

  return references;
}

/** settings.json の enabledPlugins 参照を解決 */
function resolvePluginReferences(
  settingsFile: DetectedFile,
  settings: SettingsJson,
  allFiles: DetectedFile[],
): FileReference[] {
  const references: FileReference[] = [];

  if (settings.enabledPlugins) {
    for (const pluginName of settings.enabledPlugins) {
      const targetFile = allFiles.find(
        (f) => f.category === "plugins" && f.name === pluginName,
      );
      if (targetFile) {
        references.push({
          sourceFile: settingsFile.path,
          targetFile: targetFile.path,
          type: "plugin",
          rawReference: pluginName,
        });
      }
    }
  }

  return references;
}

/** settings.json の statusLine 参照を解決 */
function resolveStatusLineReferences(
  settingsFile: DetectedFile,
  settings: SettingsJson,
  allFiles: DetectedFile[],
): FileReference[] {
  const references: FileReference[] = [];

  if (settings.statusLine) {
    const targetFile = allFiles.find((f) =>
      settings.statusLine!.includes(f.name) || settings.statusLine!.includes(f.path),
    );
    if (targetFile) {
      references.push({
        sourceFile: settingsFile.path,
        targetFile: targetFile.path,
        type: "statusline",
        rawReference: settings.statusLine,
      });
    }
  }

  return references;
}

/** 全ファイルの参照を解決する */
export async function resolveAllReferences(
  files: DetectedFile[],
): Promise<FileReference[]> {
  const allReferences: FileReference[] = [];

  for (const file of files) {
    // CLAUDE.md の @参照
    if (file.category === "claude-md") {
      const refs = await resolveAtReferences(file, files);
      allReferences.push(...refs);
    }

    // settings.json の各種参照
    if (file.category === "settings" && file.name.endsWith(".json")) {
      const content = await readFileContent(file.path);
      if (content) {
        const settings = parseSettingsJson(content);
        if (settings) {
          allReferences.push(...resolveHookReferences(file, settings, files));
          allReferences.push(...resolvePluginReferences(file, settings, files));
          allReferences.push(...resolveStatusLineReferences(file, settings, files));
        }
      }
    }
  }

  return allReferences;
}
