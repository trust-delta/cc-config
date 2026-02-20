import type { Node, Edge } from "@xyflow/react";
import type { ConfigScope, ConfigCategory, DetectedFile, ReferenceType } from "./config";

/** ScopeGroupNode のデータ型 */
export interface ScopeGroupNodeData {
  label: string;
  scope: ConfigScope;
  [key: string]: unknown;
}

/** CategoryNode のデータ型 */
export interface CategoryNodeData {
  label: string;
  scope: ConfigScope;
  category: ConfigCategory;
  fileCount: number;
  [key: string]: unknown;
}

/** FileNode のデータ型 */
export interface FileNodeData {
  file: DetectedFile;
  scope: ConfigScope;
  isLocalOverride: boolean;
  [key: string]: unknown;
}

/** カスタムノード型の定義 */
export type ScopeGroupNode = Node<ScopeGroupNodeData, "scopeGroup">;
export type CategoryNode = Node<CategoryNodeData, "category">;
export type FileNode = Node<FileNodeData, "file">;

/** アプリで使うノード型の共用型 */
export type AppNode = ScopeGroupNode | CategoryNode | FileNode;

/** エッジのデータ型 */
export interface ReferenceEdgeData {
  referenceType: ReferenceType;
  rawReference: string;
  [key: string]: unknown;
}

/** アプリで使うエッジ型 */
export type AppEdge = Edge<ReferenceEdgeData>;
