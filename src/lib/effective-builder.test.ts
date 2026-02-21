import { describe, it, expect } from "vitest";
import type { ScanResult, DetectedFile } from "../types/config";
import { buildEffectiveConfig } from "./effective-builder";

/** テスト用ヘルパー: DetectedFile を簡易作成する */
function makeFile(
  overrides: Partial<DetectedFile> & Pick<DetectedFile, "path" | "name" | "scope" | "category">,
): DetectedFile {
  return {
    isLocalOverride: false,
    isDirectory: false,
    ...overrides,
  };
}

describe("buildEffectiveConfig", () => {
  it("空の ScanResult から空の EffectiveConfig を返す", () => {
    const scanResult: ScanResult = { files: [], references: [] };
    const result = buildEffectiveConfig(scanResult, new Map());

    expect(result.instructions).toEqual([]);
    expect(result.settings).toEqual([]);
    expect(result.extensions).toEqual([]);
  });

  describe("Instructions セクション", () => {
    it("claude-md と rules ファイルを正しく分類する", () => {
      const scanResult: ScanResult = {
        files: [
          makeFile({
            path: "/home/.claude/CLAUDE.md",
            name: "CLAUDE.md",
            scope: "global",
            category: "claude-md",
          }),
          makeFile({
            path: "/home/.claude/rules/typescript.md",
            name: "typescript.md",
            scope: "global",
            category: "rules",
          }),
        ],
        references: [],
      };
      const result = buildEffectiveConfig(scanResult, new Map());

      expect(result.instructions).toHaveLength(2);
      expect(result.instructions[0].type).toBe("claude-md");
      expect(result.instructions[0].scope).toBe("global");
      expect(result.instructions[1].type).toBe("rule");
      expect(result.instructions[1].scope).toBe("global");
    });

    it("global が project より前にソートされる", () => {
      const scanResult: ScanResult = {
        files: [
          makeFile({
            path: "/project/CLAUDE.md",
            name: "CLAUDE.md",
            scope: "project",
            category: "claude-md",
          }),
          makeFile({
            path: "/home/.claude/CLAUDE.md",
            name: "CLAUDE.md",
            scope: "global",
            category: "claude-md",
          }),
        ],
        references: [],
      };
      const result = buildEffectiveConfig(scanResult, new Map());

      expect(result.instructions).toHaveLength(2);
      expect(result.instructions[0].scope).toBe("global");
      expect(result.instructions[1].scope).toBe("project");
    });

    it("同スコープ内で claude-md が rules より前にソートされる", () => {
      const scanResult: ScanResult = {
        files: [
          makeFile({
            path: "/home/.claude/rules/typescript.md",
            name: "typescript.md",
            scope: "global",
            category: "rules",
          }),
          makeFile({
            path: "/home/.claude/CLAUDE.md",
            name: "CLAUDE.md",
            scope: "global",
            category: "claude-md",
          }),
        ],
        references: [],
      };
      const result = buildEffectiveConfig(scanResult, new Map());

      expect(result.instructions[0].type).toBe("claude-md");
      expect(result.instructions[1].type).toBe("rule");
    });
  });

  describe("Settings セクション", () => {
    it("settings ファイルを正しくマージして返す", () => {
      const globalSettings = makeFile({
        path: "/home/.claude/settings.json",
        name: "settings.json",
        scope: "global",
        category: "settings",
      });
      const projectSettings = makeFile({
        path: "/project/.claude/settings.json",
        name: "settings.json",
        scope: "project",
        category: "settings",
      });
      const scanResult: ScanResult = {
        files: [globalSettings, projectSettings],
        references: [],
      };
      const contents = new Map([
        ["/home/.claude/settings.json", '{"theme": "dark"}'],
        ["/project/.claude/settings.json", '{"theme": "light"}'],
      ]);
      const result = buildEffectiveConfig(scanResult, contents);

      expect(result.settings).toHaveLength(1);
      expect(result.settings[0].key).toBe("theme");
      expect(result.settings[0].effectiveValue).toBe("light");
      expect(result.settings[0].source).toBe("project");
    });

    it("不正なJSONの settings ファイルは無視される", () => {
      const scanResult: ScanResult = {
        files: [
          makeFile({
            path: "/home/.claude/settings.json",
            name: "settings.json",
            scope: "global",
            category: "settings",
          }),
        ],
        references: [],
      };
      const contents = new Map([["/home/.claude/settings.json", "invalid json"]]);
      const result = buildEffectiveConfig(scanResult, contents);

      expect(result.settings).toEqual([]);
    });

    it("hooks を含む settings が additive マージされる", () => {
      const globalSettings = makeFile({
        path: "/home/.claude/settings.json",
        name: "settings.json",
        scope: "global",
        category: "settings",
      });
      const projectSettings = makeFile({
        path: "/project/.claude/settings.json",
        name: "settings.json",
        scope: "project",
        category: "settings",
      });
      const scanResult: ScanResult = {
        files: [globalSettings, projectSettings],
        references: [],
      };
      const contents = new Map([
        [
          "/home/.claude/settings.json",
          JSON.stringify({
            hooks: {
              PreToolUse: [{ matcher: "Bash", hooks: ["echo global"] }],
            },
          }),
        ],
        [
          "/project/.claude/settings.json",
          JSON.stringify({
            hooks: {
              PreToolUse: [{ matcher: "Edit", hooks: ["echo project"] }],
            },
          }),
        ],
      ]);
      const result = buildEffectiveConfig(scanResult, contents);

      const hooksNode = result.settings.find((n) => n.key === "hooks");
      expect(hooksNode).toBeDefined();
      expect(hooksNode!.isLeaf).toBe(false);

      const preToolUseNode = hooksNode!.children!.find((n) => n.key === "PreToolUse");
      expect(preToolUseNode).toBeDefined();
      expect(preToolUseNode!.mergeStrategy).toBe("additive");
      expect(preToolUseNode!.effectiveValue).toEqual([
        { matcher: "Bash", hooks: ["echo global"] },
        { matcher: "Edit", hooks: ["echo project"] },
      ]);
    });

    it("content が存在しない settings ファイルは無視される", () => {
      const scanResult: ScanResult = {
        files: [
          makeFile({
            path: "/home/.claude/settings.json",
            name: "settings.json",
            scope: "global",
            category: "settings",
          }),
        ],
        references: [],
      };
      const result = buildEffectiveConfig(scanResult, new Map());

      expect(result.settings).toEqual([]);
    });
  });

  describe("Extensions セクション", () => {
    it("skills, agents, templates, plugins を正しく分類する", () => {
      const scanResult: ScanResult = {
        files: [
          makeFile({
            path: "/home/.claude/skills/my-skill/SKILL.md",
            name: "my-skill/SKILL.md",
            scope: "global",
            category: "skills",
          }),
          makeFile({
            path: "/home/.claude/agents/reviewer.md",
            name: "reviewer.md",
            scope: "global",
            category: "agents",
          }),
          makeFile({
            path: "/home/.claude/templates/default",
            name: "default",
            scope: "global",
            category: "templates",
            isDirectory: true,
          }),
          makeFile({
            path: "/home/.claude/plugins/my-plugin",
            name: "my-plugin",
            scope: "global",
            category: "plugins",
            isDirectory: true,
          }),
        ],
        references: [],
      };
      const result = buildEffectiveConfig(scanResult, new Map());

      expect(result.extensions).toHaveLength(4);
      expect(result.extensions[0].category).toBe("skills");
      expect(result.extensions[1].category).toBe("agents");
      expect(result.extensions[2].category).toBe("templates");
      expect(result.extensions[3].category).toBe("plugins");
    });

    it("settings や claude-md ファイルは extensions に含まれない", () => {
      const scanResult: ScanResult = {
        files: [
          makeFile({
            path: "/home/.claude/settings.json",
            name: "settings.json",
            scope: "global",
            category: "settings",
          }),
          makeFile({
            path: "/home/.claude/CLAUDE.md",
            name: "CLAUDE.md",
            scope: "global",
            category: "claude-md",
          }),
        ],
        references: [],
      };
      const result = buildEffectiveConfig(scanResult, new Map());

      expect(result.extensions).toEqual([]);
    });
  });
});
