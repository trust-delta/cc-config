import { describe, it, expect } from "vitest";
import type { DetectedFile } from "../types/config";
import type { SettingsLayer } from "./settings-merger";
import { mergeSettings, determineScope } from "./settings-merger";

describe("determineScope", () => {
  it("isLocalOverride=true のとき 'local' を返す", () => {
    const file: DetectedFile = {
      path: "/home/.claude/settings.local.json",
      name: "settings.local.json",
      scope: "global",
      category: "settings",
      isLocalOverride: true,
      isDirectory: false,
    };
    expect(determineScope(file)).toBe("local");
  });

  it("scope='global' かつ isLocalOverride=false のとき 'global' を返す", () => {
    const file: DetectedFile = {
      path: "/home/.claude/settings.json",
      name: "settings.json",
      scope: "global",
      category: "settings",
      isLocalOverride: false,
      isDirectory: false,
    };
    expect(determineScope(file)).toBe("global");
  });

  it("scope='project' かつ isLocalOverride=false のとき 'project' を返す", () => {
    const file: DetectedFile = {
      path: "/project/.claude/settings.json",
      name: "settings.json",
      scope: "project",
      category: "settings",
      isLocalOverride: false,
      isDirectory: false,
    };
    expect(determineScope(file)).toBe("project");
  });
});

describe("mergeSettings", () => {
  it("空のレイヤーでは空配列を返す", () => {
    const result = mergeSettings([]);
    expect(result).toEqual([]);
  });

  it("単一レイヤーのフラットキーがリーフノードになる", () => {
    const layer: SettingsLayer = {
      scope: "global",
      sourceFile: "/home/.claude/settings.json",
      data: { theme: "dark", fontSize: 14 },
    };
    const result = mergeSettings([layer]);

    expect(result).toHaveLength(2);

    const themeNode = result.find((n) => n.key === "theme");
    expect(themeNode).toBeDefined();
    expect(themeNode!.effectiveValue).toBe("dark");
    expect(themeNode!.source).toBe("global");
    expect(themeNode!.sourceFile).toBe("/home/.claude/settings.json");
    expect(themeNode!.isLeaf).toBe(true);
    expect(themeNode!.path).toBe("theme");
    expect(themeNode!.overrides).toBeUndefined();

    const fontNode = result.find((n) => n.key === "fontSize");
    expect(fontNode).toBeDefined();
    expect(fontNode!.effectiveValue).toBe(14);
    expect(fontNode!.isLeaf).toBe(true);
  });

  it("2レイヤーで上書きが発生する場合、effectiveValue は高優先の値になる", () => {
    const globalLayer: SettingsLayer = {
      scope: "global",
      sourceFile: "/home/.claude/settings.json",
      data: { theme: "dark" },
    };
    const projectLayer: SettingsLayer = {
      scope: "project",
      sourceFile: "/project/.claude/settings.json",
      data: { theme: "light" },
    };
    const result = mergeSettings([globalLayer, projectLayer]);

    expect(result).toHaveLength(1);
    const themeNode = result[0];
    expect(themeNode.effectiveValue).toBe("light");
    expect(themeNode.source).toBe("project");
    expect(themeNode.sourceFile).toBe("/project/.claude/settings.json");
    expect(themeNode.overrides).toHaveLength(1);
    expect(themeNode.overrides![0]).toEqual({
      scope: "global",
      sourceFile: "/home/.claude/settings.json",
      value: "dark",
    });
  });

  it("ネストされたオブジェクトが再帰的にマージされる", () => {
    const globalLayer: SettingsLayer = {
      scope: "global",
      sourceFile: "/home/.claude/settings.json",
      data: { editor: { tabSize: 2, wordWrap: true } },
    };
    const projectLayer: SettingsLayer = {
      scope: "project",
      sourceFile: "/project/.claude/settings.json",
      data: { editor: { tabSize: 4 } },
    };
    const result = mergeSettings([globalLayer, projectLayer]);

    // トップレベルに editor ノードがある
    const editorNode = result.find((n) => n.key === "editor");
    expect(editorNode).toBeDefined();
    expect(editorNode!.isLeaf).toBe(false);
    expect(editorNode!.children).toBeDefined();

    // tabSize は project に上書きされている
    const tabSizeNode = editorNode!.children!.find((n) => n.key === "tabSize");
    expect(tabSizeNode).toBeDefined();
    expect(tabSizeNode!.effectiveValue).toBe(4);
    expect(tabSizeNode!.source).toBe("project");
    expect(tabSizeNode!.path).toBe("editor.tabSize");
    expect(tabSizeNode!.overrides).toHaveLength(1);
    expect(tabSizeNode!.overrides![0].value).toBe(2);

    // wordWrap は global のまま
    const wordWrapNode = editorNode!.children!.find((n) => n.key === "wordWrap");
    expect(wordWrapNode).toBeDefined();
    expect(wordWrapNode!.effectiveValue).toBe(true);
    expect(wordWrapNode!.source).toBe("global");
    expect(wordWrapNode!.overrides).toBeUndefined();
  });

  it("配列は高優先レイヤーで完全に置き換えられる", () => {
    const globalLayer: SettingsLayer = {
      scope: "global",
      sourceFile: "/home/.claude/settings.json",
      data: { enabledPlugins: ["pluginA", "pluginB"] },
    };
    const projectLayer: SettingsLayer = {
      scope: "project",
      sourceFile: "/project/.claude/settings.json",
      data: { enabledPlugins: ["pluginC"] },
    };
    const result = mergeSettings([globalLayer, projectLayer]);

    const pluginsNode = result.find((n) => n.key === "enabledPlugins");
    expect(pluginsNode).toBeDefined();
    expect(pluginsNode!.effectiveValue).toEqual(["pluginC"]);
    expect(pluginsNode!.source).toBe("project");
    expect(pluginsNode!.isLeaf).toBe(true);
    expect(pluginsNode!.overrides).toHaveLength(1);
    expect(pluginsNode!.overrides![0].value).toEqual(["pluginA", "pluginB"]);
  });

  it("プリミティブ値は高優先レイヤーで上書きされる", () => {
    const globalLayer: SettingsLayer = {
      scope: "global",
      sourceFile: "/home/.claude/settings.json",
      data: { verbose: false },
    };
    const localLayer: SettingsLayer = {
      scope: "local",
      sourceFile: "/home/.claude/settings.local.json",
      data: { verbose: true },
    };
    const result = mergeSettings([globalLayer, localLayer]);

    const verboseNode = result.find((n) => n.key === "verbose");
    expect(verboseNode).toBeDefined();
    expect(verboseNode!.effectiveValue).toBe(true);
    expect(verboseNode!.source).toBe("local");
  });

  describe("additiveKeys による累積マージ", () => {
    it("hooks の配列が累積マージされる", () => {
      const globalLayer: SettingsLayer = {
        scope: "global",
        sourceFile: "/home/.claude/settings.json",
        data: {
          hooks: {
            PreToolUse: [{ matcher: "Bash", hooks: ["echo global"] }],
          },
        },
      };
      const projectLayer: SettingsLayer = {
        scope: "project",
        sourceFile: "/project/.claude/settings.json",
        data: {
          hooks: {
            PreToolUse: [{ matcher: "Edit", hooks: ["echo project"] }],
          },
        },
      };
      const result = mergeSettings([globalLayer, projectLayer], new Set(["hooks"]));

      const hooksNode = result.find((n) => n.key === "hooks");
      expect(hooksNode).toBeDefined();
      expect(hooksNode!.isLeaf).toBe(false);

      const preToolUseNode = hooksNode!.children!.find((n) => n.key === "PreToolUse");
      expect(preToolUseNode).toBeDefined();
      expect(preToolUseNode!.mergeStrategy).toBe("additive");
      expect(preToolUseNode!.effectiveValue).toEqual([
        { matcher: "Bash", hooks: ["echo global"] },
        { matcher: "Edit", hooks: ["echo project"] },
      ]);
      // overrides に各ソースの個別配列が記録される
      expect(preToolUseNode!.overrides).toHaveLength(1);
      expect(preToolUseNode!.overrides![0].scope).toBe("project");
      expect(preToolUseNode!.overrides![0].value).toEqual([
        { matcher: "Edit", hooks: ["echo project"] },
      ]);
    });

    it("同一エントリが重複排除される", () => {
      const globalLayer: SettingsLayer = {
        scope: "global",
        sourceFile: "/home/.claude/settings.json",
        data: {
          hooks: {
            PreToolUse: [
              { matcher: "Bash", hooks: ["echo shared"] },
              { matcher: "Edit", hooks: ["echo global-only"] },
            ],
          },
        },
      };
      const projectLayer: SettingsLayer = {
        scope: "project",
        sourceFile: "/project/.claude/settings.json",
        data: {
          hooks: {
            PreToolUse: [
              { matcher: "Bash", hooks: ["echo shared"] },
              { matcher: "Write", hooks: ["echo project-only"] },
            ],
          },
        },
      };
      const result = mergeSettings([globalLayer, projectLayer], new Set(["hooks"]));

      const hooksNode = result.find((n) => n.key === "hooks");
      const preToolUseNode = hooksNode!.children!.find((n) => n.key === "PreToolUse");
      expect(preToolUseNode!.effectiveValue).toEqual([
        { matcher: "Bash", hooks: ["echo shared"] },
        { matcher: "Edit", hooks: ["echo global-only"] },
        { matcher: "Write", hooks: ["echo project-only"] },
      ]);
    });

    it("additiveKeys に指定されていないキーは従来通り全置換される", () => {
      const globalLayer: SettingsLayer = {
        scope: "global",
        sourceFile: "/home/.claude/settings.json",
        data: {
          enabledPlugins: ["pluginA", "pluginB"],
          hooks: {
            PreToolUse: [{ matcher: "Bash", hooks: ["echo g"] }],
          },
        },
      };
      const projectLayer: SettingsLayer = {
        scope: "project",
        sourceFile: "/project/.claude/settings.json",
        data: {
          enabledPlugins: ["pluginC"],
          hooks: {
            PreToolUse: [{ matcher: "Edit", hooks: ["echo p"] }],
          },
        },
      };
      const result = mergeSettings([globalLayer, projectLayer], new Set(["hooks"]));

      // enabledPlugins は全置換
      const pluginsNode = result.find((n) => n.key === "enabledPlugins");
      expect(pluginsNode!.effectiveValue).toEqual(["pluginC"]);
      expect(pluginsNode!.mergeStrategy).toBeUndefined();

      // hooks.PreToolUse は累積
      const hooksNode = result.find((n) => n.key === "hooks");
      const preToolUseNode = hooksNode!.children!.find((n) => n.key === "PreToolUse");
      expect(preToolUseNode!.mergeStrategy).toBe("additive");
      expect(preToolUseNode!.effectiveValue).toEqual([
        { matcher: "Bash", hooks: ["echo g"] },
        { matcher: "Edit", hooks: ["echo p"] },
      ]);
    });
  });

  it("3レイヤー以上で overrides に全ソースが含まれる", () => {
    const layers: SettingsLayer[] = [
      {
        scope: "global",
        sourceFile: "/home/.claude/settings.json",
        data: { theme: "dark" },
      },
      {
        scope: "local",
        sourceFile: "/home/.claude/settings.local.json",
        data: { theme: "blue" },
      },
      {
        scope: "project",
        sourceFile: "/project/.claude/settings.json",
        data: { theme: "light" },
      },
    ];
    const result = mergeSettings(layers);

    const themeNode = result.find((n) => n.key === "theme");
    expect(themeNode).toBeDefined();
    expect(themeNode!.effectiveValue).toBe("light");
    expect(themeNode!.source).toBe("project");
    expect(themeNode!.overrides).toHaveLength(2);
    expect(themeNode!.overrides![0]).toEqual({
      scope: "global",
      sourceFile: "/home/.claude/settings.json",
      value: "dark",
    });
    expect(themeNode!.overrides![1]).toEqual({
      scope: "local",
      sourceFile: "/home/.claude/settings.local.json",
      value: "blue",
    });
  });
});
