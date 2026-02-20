import type { SettingsJson } from "../types/config";

/** settings.json をパースする */
export function parseSettingsJson(content: string): SettingsJson | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as SettingsJson;
  } catch {
    return null;
  }
}

/** CLAUDE.md 内の @参照を抽出する */
export function extractAtReferences(content: string): string[] {
  const references: string[] = [];
  // @path/to/file 形式の参照を検出（行頭の @ のみ対象）
  const atRefRegex = /^@(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = atRefRegex.exec(content)) !== null) {
    const ref = match[1].trim();
    if (ref.length > 0) {
      references.push(ref);
    }
  }
  return references;
}
