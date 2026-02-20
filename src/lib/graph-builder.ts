import type { ConfigCategory, ConfigScope, DetectedFile, ScanResult } from "../types/config";
import { CATEGORY_LABELS } from "../types/config";
import type { AppNode, AppEdge } from "../types/graph";
import { SCOPE_COLORS, EDGE_COLORS } from "../constants/styles";

/** レイアウト定数 */
const LAYOUT = {
  /** スコープグループの横幅 */
  scopeWidth: 900,
  /** スコープグループ間の縦間隔 */
  scopeGapY: 40,
  /** スコープグループの左パディング */
  scopePadX: 20,
  /** スコープグループの上パディング */
  scopePadY: 50,
  /** カテゴリノードの横幅 */
  categoryWidth: 140,
  /** カテゴリノード間の横間隔 */
  categoryGapX: 16,
  /** カテゴリノードの高さ */
  categoryHeight: 36,
  /** ファイルノードの横幅 */
  fileWidth: 140,
  /** ファイルノードの高さ */
  fileHeight: 32,
  /** ファイルノード間の縦間隔 */
  fileGapY: 8,
  /** カテゴリ → ファイルの縦オフセット */
  fileOffsetY: 48,
} as const;

/** カテゴリの表示順 */
const CATEGORY_ORDER: ConfigCategory[] = [
  "claude-md",
  "settings",
  "rules",
  "skills",
  "hooks",
  "agents",
  "templates",
  "plugins",
];

/** スコープ内のファイルをカテゴリでグループ化 */
function groupByCategory(files: DetectedFile[]): Map<ConfigCategory, DetectedFile[]> {
  const groups = new Map<ConfigCategory, DetectedFile[]>();
  for (const file of files) {
    const existing = groups.get(file.category) ?? [];
    existing.push(file);
    groups.set(file.category, existing);
  }
  return groups;
}

/** スコープグループの高さを計算 */
function calcScopeHeight(categoryGroups: Map<ConfigCategory, DetectedFile[]>): number {
  let maxFiles = 0;
  for (const files of categoryGroups.values()) {
    maxFiles = Math.max(maxFiles, files.length);
  }
  return (
    LAYOUT.scopePadY +
    LAYOUT.categoryHeight +
    LAYOUT.fileOffsetY +
    maxFiles * (LAYOUT.fileHeight + LAYOUT.fileGapY) +
    20
  );
}

/** 1つのスコープのノード群を生成 */
function buildScopeNodes(
  scope: ConfigScope,
  files: DetectedFile[],
  offsetY: number,
): { nodes: AppNode[]; height: number } {
  const nodes: AppNode[] = [];
  const categoryGroups = groupByCategory(files);
  const scopeHeight = calcScopeHeight(categoryGroups);

  const label = scope === "global" ? "Global (~/.claude/)" : "Project (./.claude/)";
  const colors = SCOPE_COLORS[scope];

  // ScopeGroupNode
  const activeCategories = CATEGORY_ORDER.filter((c) => categoryGroups.has(c));
  const scopeWidth = Math.max(
    LAYOUT.scopeWidth,
    activeCategories.length * (LAYOUT.categoryWidth + LAYOUT.categoryGapX) + LAYOUT.scopePadX * 2,
  );

  nodes.push({
    id: `scope-${scope}`,
    type: "scopeGroup",
    position: { x: 0, y: offsetY },
    data: { label, scope },
    style: {
      width: scopeWidth,
      height: scopeHeight,
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 2,
      borderRadius: 12,
      borderStyle: "solid",
    },
  });

  // CategoryNode + FileNode
  let catX = LAYOUT.scopePadX;
  for (const category of activeCategories) {
    const catFiles = categoryGroups.get(category) ?? [];
    const catId = `cat-${scope}-${category}`;

    nodes.push({
      id: catId,
      type: "category",
      position: { x: catX, y: LAYOUT.scopePadY },
      parentId: `scope-${scope}`,
      extent: "parent" as const,
      data: {
        label: CATEGORY_LABELS[category],
        scope,
        category,
        fileCount: catFiles.length,
      },
    });

    // FileNodes under this category
    for (let i = 0; i < catFiles.length; i++) {
      const file = catFiles[i];
      const fileId = `file-${file.path}`;
      nodes.push({
        id: fileId,
        type: "file",
        position: {
          x: catX,
          y: LAYOUT.scopePadY + LAYOUT.fileOffsetY + i * (LAYOUT.fileHeight + LAYOUT.fileGapY),
        },
        parentId: `scope-${scope}`,
        extent: "parent" as const,
        data: {
          file,
          scope,
          isLocalOverride: file.isLocalOverride,
        },
      });
    }

    catX += LAYOUT.categoryWidth + LAYOUT.categoryGapX;
  }

  return { nodes, height: scopeHeight };
}

/** ScanResult からノードとエッジを構築 */
export function buildGraph(scanResult: ScanResult): { nodes: AppNode[]; edges: AppEdge[] } {
  const globalFiles = scanResult.files.filter((f) => f.scope === "global");
  const projectFiles = scanResult.files.filter((f) => f.scope === "project");

  const allNodes: AppNode[] = [];
  let currentY = 0;

  // Global scope
  if (globalFiles.length > 0) {
    const { nodes, height } = buildScopeNodes("global", globalFiles, currentY);
    allNodes.push(...nodes);
    currentY += height + LAYOUT.scopeGapY;
  }

  // Project scope
  if (projectFiles.length > 0) {
    const { nodes } = buildScopeNodes("project", projectFiles, currentY);
    allNodes.push(...nodes);
  }

  // Edges
  const edges: AppEdge[] = scanResult.references.map((ref, i) => ({
    id: `edge-${i}`,
    source: `file-${ref.sourceFile}`,
    target: `file-${ref.targetFile}`,
    type: "default",
    animated: true,
    style: { stroke: EDGE_COLORS[ref.type], strokeWidth: 2 },
    data: {
      referenceType: ref.type,
      rawReference: ref.rawReference,
    },
  }));

  return { nodes: allNodes, edges };
}
