import type { DetectedFile } from "../types/config";
import type { EffectiveScope, MergedSettingNode, SettingOverride } from "../types/effective";

/** 設定レイヤー（1ファイル分の設定データ） */
export interface SettingsLayer {
  /** スコープ */
  scope: EffectiveScope;
  /** ソースファイルパス */
  sourceFile: string;
  /** 設定データ */
  data: Record<string, unknown>;
}

/** 値がプレーンオブジェクトかどうかを判定する */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** DetectedFile からスコープを判定する */
export function determineScope(file: DetectedFile): EffectiveScope {
  if (file.isLocalOverride) return "local";
  return file.scope;
}

/**
 * 中間マージ結果を保持する内部型
 * 各キーについて、最終的な値・ソース情報・上書き履歴を保持する
 */
interface MergedEntry {
  /** 現在の有効値 */
  value: unknown;
  /** 現在のソーススコープ */
  scope: EffectiveScope;
  /** 現在のソースファイルパス */
  sourceFile: string;
  /** 上書き履歴（低優先→高優先の順） */
  overrides: SettingOverride[];
  /** 累積型マージが適用されたか */
  isAdditive: boolean;
}

/** フラットなマージ結果から MergedSettingNode ツリーを構築する */
function buildNodeTree(merged: Map<string, MergedEntry>, parentPath: string): MergedSettingNode[] {
  const nodes: MergedSettingNode[] = [];

  for (const [fullPath, entry] of merged) {
    // 直接の子キーのみ処理する
    const key = extractDirectChildKey(fullPath, parentPath);
    if (key === null) continue;

    // 既に追加済みのキーはスキップ
    if (nodes.some((n) => n.key === key)) continue;

    const currentPath = parentPath ? `${parentPath}.${key}` : key;

    // 子キーを持つか確認
    const childPrefix = `${currentPath}.`;
    const childEntries = new Map<string, MergedEntry>();
    for (const [p, e] of merged) {
      if (p.startsWith(childPrefix)) {
        childEntries.set(p, e);
      }
    }

    if (childEntries.size > 0) {
      // ブランチノード（子を持つオブジェクト）
      const children = buildNodeTree(merged, currentPath);
      const node: MergedSettingNode = {
        key,
        path: currentPath,
        effectiveValue: entry.value,
        source: entry.scope,
        sourceFile: entry.sourceFile,
        children,
        isLeaf: false,
      };
      if (entry.overrides.length > 0) {
        node.overrides = entry.overrides;
      }
      nodes.push(node);
    } else {
      // リーフノード
      const node: MergedSettingNode = {
        key,
        path: currentPath,
        effectiveValue: entry.value,
        source: entry.scope,
        sourceFile: entry.sourceFile,
        isLeaf: true,
      };
      if (entry.isAdditive) {
        node.mergeStrategy = "additive";
      }
      if (entry.overrides.length > 0) {
        node.overrides = entry.overrides;
      }
      nodes.push(node);
    }
  }

  return nodes;
}

/** フルパスから直接の子キー名を取り出す */
function extractDirectChildKey(fullPath: string, parentPath: string): string | null {
  const prefix = parentPath ? `${parentPath}.` : "";
  if (!fullPath.startsWith(prefix)) return null;
  const remaining = fullPath.slice(prefix.length);
  // ドットを含まない = 直接の子
  if (!remaining.includes(".")) return remaining;
  return null;
}

/**
 * オブジェクトのキーをドット区切りパスでフラット化する
 * 例: { a: { b: 1 } } → [["a", { b: 1 }], ["a.b", 1]]
 */
function flattenObject(obj: Record<string, unknown>, prefix: string): Array<[string, unknown]> {
  const result: Array<[string, unknown]> = [];

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    result.push([path, value]);
    if (isPlainObject(value)) {
      result.push(...flattenObject(value, path));
    }
  }

  return result;
}

/** パスが additiveKeys の子配列パスかどうかを判定する */
function isAdditiveArrayPath(path: string, additiveKeys: Set<string>): boolean {
  for (const key of additiveKeys) {
    // パスが "hooks.XXX" の形式（= additiveKey の直接の子）であるかを判定
    const prefix = `${key}.`;
    if (path.startsWith(prefix) && !path.slice(prefix.length).includes(".")) {
      return true;
    }
  }
  return false;
}

/** 配列を重複排除して結合する */
function deduplicateArrayConcat(existing: unknown[], incoming: unknown[]): unknown[] {
  const result = [...existing];
  for (const item of incoming) {
    const serialized = JSON.stringify(item);
    const isDuplicate = result.some((r) => JSON.stringify(r) === serialized);
    if (!isDuplicate) {
      result.push(item);
    }
  }
  return result;
}

/** 複数レイヤーをマージして MergedSettingNode[] を返す */
export function mergeSettings(
  layers: SettingsLayer[],
  additiveKeys?: Set<string>,
): MergedSettingNode[] {
  if (layers.length === 0) return [];

  const effectiveAdditiveKeys = additiveKeys ?? new Set<string>();

  // 全レイヤーをフラット化してマージする（低優先→高優先の順に処理）
  const merged = new Map<string, MergedEntry>();

  for (const layer of layers) {
    const flattened = flattenObject(layer.data, "");

    for (const [path, value] of flattened) {
      const existing = merged.get(path);

      if (existing) {
        const isAdditive =
          Array.isArray(value) &&
          Array.isArray(existing.value) &&
          isAdditiveArrayPath(path, effectiveAdditiveKeys);

        if (isAdditive) {
          // 累積型マージ: 配列を結合し、重複排除する
          existing.overrides.push({
            scope: layer.scope,
            sourceFile: layer.sourceFile,
            value,
          });
          existing.value = deduplicateArrayConcat(existing.value as unknown[], value as unknown[]);
          existing.isAdditive = true;
        } else {
          // 通常の置換マージ
          existing.overrides.push({
            scope: existing.scope,
            sourceFile: existing.sourceFile,
            value: existing.value,
          });
          existing.value = value;
          existing.scope = layer.scope;
          existing.sourceFile = layer.sourceFile;
        }
      } else {
        // 新規キー
        merged.set(path, {
          value,
          scope: layer.scope,
          sourceFile: layer.sourceFile,
          overrides: [],
          isAdditive: false,
        });
      }
    }
  }

  // トップレベルのノードツリーを構築
  return buildNodeTree(merged, "");
}
