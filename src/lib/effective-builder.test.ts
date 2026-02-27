import { describe, it, expect } from "vitest";
import type { ScanResult, DetectedFile } from "../types/config";
import {
  buildEffectiveConfig,
  buildInstructionStack,
  buildInstructionMap,
} from "./effective-builder";

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

describe("buildInstructionStack", () => {
  const projectDir = "/project";

  it("空チェーンで空配列を返す", () => {
    const result = buildInstructionStack([], projectDir);
    expect(result).toEqual([]);
  });

  it("global のみのチェーンで scope='global', injectionOrder=1", () => {
    const files: DetectedFile[] = [
      makeFile({
        path: "/home/.claude/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "global",
        category: "claude-md",
      }),
    ];
    const result = buildInstructionStack(files, projectDir);

    expect(result).toHaveLength(1);
    expect(result[0].scope).toBe("global");
    expect(result[0].injectionOrder).toBe(1);
    expect(result[0].type).toBe("claude-md");
    expect(result[0].ownerDir).toBe("/home/.claude");
  });

  it("global+project+subdirectory の完全チェーンが注入順で返る", () => {
    const files: DetectedFile[] = [
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
      makeFile({
        path: "/project/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
      makeFile({
        path: "/project/.claude/rules/dev.md",
        name: "dev.md",
        scope: "project",
        category: "rules",
      }),
      makeFile({
        path: "/project/src/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
    ];
    const result = buildInstructionStack(files, projectDir);

    expect(result).toHaveLength(5);
    /* 注入順: 低優先が先頭、高優先が末尾 */
    expect(result[0].injectionOrder).toBe(1);
    expect(result[0].scope).toBe("global");
    expect(result[1].injectionOrder).toBe(2);
    expect(result[1].scope).toBe("global");
    expect(result[2].injectionOrder).toBe(3);
    expect(result[2].scope).toBe("project");
    expect(result[3].injectionOrder).toBe(4);
    expect(result[3].scope).toBe("project");
    expect(result[4].injectionOrder).toBe(5);
    expect(result[4].scope).toBe("subdirectory");
  });

  it("CLAUDE.local.md の scope が 'local' になる", () => {
    const files: DetectedFile[] = [
      makeFile({
        path: "/project/CLAUDE.local.md",
        name: "CLAUDE.local.md",
        scope: "project",
        category: "claude-md",
        isLocalOverride: true,
      }),
    ];
    const result = buildInstructionStack(files, projectDir);

    expect(result).toHaveLength(1);
    expect(result[0].scope).toBe("local");
  });

  it("サブディレクトリの CLAUDE.md が scope='subdirectory' になる", () => {
    const files: DetectedFile[] = [
      makeFile({
        path: "/project/src/components/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
    ];
    const result = buildInstructionStack(files, projectDir);

    expect(result).toHaveLength(1);
    expect(result[0].scope).toBe("subdirectory");
    expect(result[0].ownerDir).toBe("/project/src/components");
  });

  it("ownerDir が project の .claude/rules パスから正しく導出される", () => {
    const files: DetectedFile[] = [
      makeFile({
        path: "/project/.claude/rules/typescript.md",
        name: "typescript.md",
        scope: "project",
        category: "rules",
      }),
    ];
    const result = buildInstructionStack(files, projectDir);

    expect(result[0].ownerDir).toBe("/project");
  });

  it("ownerDir が global の .claude/rules パスから ~/.claude を返す", () => {
    const files: DetectedFile[] = [
      makeFile({
        path: "/home/.claude/rules/typescript.md",
        name: "typescript.md",
        scope: "global",
        category: "rules",
      }),
    ];
    const result = buildInstructionStack(files, projectDir);

    expect(result[0].ownerDir).toBe("/home/.claude");
  });
});

describe("buildInstructionMap", () => {
  const projectDir = "/project";
  const homeDir = "/home/user";

  it("空ファイルで空配列を返す", () => {
    const result = buildInstructionMap([], [], projectDir, homeDir);
    expect(result).toEqual([]);
  });

  it("グローバル instruction ファイルのみで global ノードを返す", () => {
    const globalFiles: DetectedFile[] = [
      makeFile({
        path: "/home/user/.claude/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "global",
        category: "claude-md",
      }),
      makeFile({
        path: "/home/user/.claude/rules/general.md",
        name: "general.md",
        scope: "global",
        category: "rules",
      }),
    ];
    const result = buildInstructionMap(globalFiles, [], projectDir, homeDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("~/.claude");
    expect(result[0].scope).toBe("global");
    expect(result[0].files).toHaveLength(2);
    expect(result[0].files[0].type).toBe("claude-md");
    expect(result[0].files[1].type).toBe("rule");
  });

  it("プロジェクトルートの instruction ファイルで project ノードを返す", () => {
    const projectFiles: DetectedFile[] = [
      makeFile({
        path: "/project/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
      makeFile({
        path: "/project/.claude/rules/dev.md",
        name: "dev.md",
        scope: "project",
        category: "rules",
      }),
    ];
    const result = buildInstructionMap([], projectFiles, projectDir, homeDir);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("project");
    expect(result[0].scope).toBe("project");
    expect(result[0].files).toHaveLength(2);
  });

  it("サブディレクトリの instruction ファイルがネストされたツリーとして構築される", () => {
    const projectFiles: DetectedFile[] = [
      makeFile({
        path: "/project/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
      makeFile({
        path: "/project/src/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
      makeFile({
        path: "/project/packages/api/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
    ];
    const result = buildInstructionMap([], projectFiles, projectDir, homeDir);

    expect(result).toHaveLength(1);
    const projectNode = result[0];
    expect(projectNode.files).toHaveLength(1);
    expect(projectNode.children).toHaveLength(2);

    const srcNode = projectNode.children.find((c) => c.name === "src");
    expect(srcNode).toBeDefined();
    expect(srcNode!.scope).toBe("subdirectory");
    expect(srcNode!.files).toHaveLength(1);

    const apiNode = projectNode.children.find((c) => c.name === "packages/api");
    expect(apiNode).toBeDefined();
    expect(apiNode!.scope).toBe("subdirectory");
    expect(apiNode!.files).toHaveLength(1);
  });

  it("global と project の両方がある場合に2つのルートノードを返す", () => {
    const globalFiles: DetectedFile[] = [
      makeFile({
        path: "/home/user/.claude/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "global",
        category: "claude-md",
      }),
    ];
    const projectFiles: DetectedFile[] = [
      makeFile({
        path: "/project/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
    ];
    const result = buildInstructionMap(globalFiles, projectFiles, projectDir, homeDir);

    expect(result).toHaveLength(2);
    expect(result[0].scope).toBe("global");
    expect(result[1].scope).toBe("project");
  });

  it("中間ディレクトリに instruction がある場合に正しく階層化される", () => {
    const projectFiles: DetectedFile[] = [
      makeFile({
        path: "/project/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
      makeFile({
        path: "/project/packages/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
      makeFile({
        path: "/project/packages/api/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
    ];
    const result = buildInstructionMap([], projectFiles, projectDir, homeDir);

    expect(result).toHaveLength(1);
    const projectNode = result[0];
    expect(projectNode.children).toHaveLength(1);

    const packagesNode = projectNode.children[0];
    expect(packagesNode.name).toBe("packages");
    expect(packagesNode.files).toHaveLength(1);
    expect(packagesNode.children).toHaveLength(1);

    const apiNode = packagesNode.children[0];
    expect(apiNode.name).toBe("api");
    expect(apiNode.files).toHaveLength(1);
  });

  it("ファイルの relativePath が正しく生成される", () => {
    const projectFiles: DetectedFile[] = [
      makeFile({
        path: "/project/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
      makeFile({
        path: "/project/.claude/CLAUDE.md",
        name: "CLAUDE.md",
        scope: "project",
        category: "claude-md",
      }),
      makeFile({
        path: "/project/.claude/rules/typescript.md",
        name: "typescript.md",
        scope: "project",
        category: "rules",
      }),
    ];
    const result = buildInstructionMap([], projectFiles, projectDir, homeDir);

    const projectNode = result[0];
    const fileNames = projectNode.files.map((f) => f.relativePath);
    expect(fileNames).toContain("CLAUDE.md");
    expect(fileNames).toContain(".claude/CLAUDE.md");
    expect(fileNames).toContain(".claude/rules/typescript.md");
  });
});
