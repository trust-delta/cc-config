import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph-builder";
import type { ScanResult } from "../types/config";

describe("buildGraph", () => {
  it("空のScanResultから空のグラフを生成する", () => {
    const scanResult: ScanResult = { files: [], references: [] };
    const { nodes, edges } = buildGraph(scanResult);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  it("グローバルファイルからスコープグループ・カテゴリ・ファイルノードを生成する", () => {
    const scanResult: ScanResult = {
      files: [
        {
          path: "/home/user/.claude/CLAUDE.md",
          name: "CLAUDE.md",
          scope: "global",
          category: "claude-md",
          isLocalOverride: false,
          isDirectory: false,
        },
      ],
      references: [],
    };
    const { nodes, edges } = buildGraph(scanResult);

    // スコープグループ + カテゴリ + ファイルの3ノード
    expect(nodes).toHaveLength(3);
    expect(nodes[0].type).toBe("scopeGroup");
    expect(nodes[1].type).toBe("category");
    expect(nodes[2].type).toBe("file");
    expect(edges).toEqual([]);
  });

  it("参照からエッジを生成する", () => {
    const scanResult: ScanResult = {
      files: [
        {
          path: "/home/user/.claude/CLAUDE.md",
          name: "CLAUDE.md",
          scope: "global",
          category: "claude-md",
          isLocalOverride: false,
          isDirectory: false,
        },
        {
          path: "/home/user/.claude/rules/typescript.md",
          name: "typescript.md",
          scope: "global",
          category: "rules",
          isLocalOverride: false,
          isDirectory: false,
        },
      ],
      references: [
        {
          sourceFile: "/home/user/.claude/CLAUDE.md",
          targetFile: "/home/user/.claude/rules/typescript.md",
          type: "at-import",
          rawReference: "@rules/typescript.md",
        },
      ],
    };
    const { edges } = buildGraph(scanResult);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("file-/home/user/.claude/CLAUDE.md");
    expect(edges[0].target).toBe("file-/home/user/.claude/rules/typescript.md");
  });
});
