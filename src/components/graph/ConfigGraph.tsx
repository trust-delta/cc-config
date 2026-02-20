import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
} from "@xyflow/react";
import type { ScanResult, DetectedFile } from "../../types/config";
import type { AppNode, AppEdge } from "../../types/graph";
import { buildGraph } from "../../lib/graph-builder";
import { ScopeGroupNode } from "./nodes/ScopeGroupNode";
import { CategoryNode } from "./nodes/CategoryNode";
import { FileNode } from "./nodes/FileNode";

/** カスタムノード型の登録 */
const nodeTypes = {
  scopeGroup: ScopeGroupNode,
  category: CategoryNode,
  file: FileNode,
};

interface ConfigGraphProps {
  scanResult: ScanResult;
  onFileSelect: (file: DetectedFile) => void;
}

/** 設定ノードグラフのメインコンポーネント */
export function ConfigGraph({ scanResult, onFileSelect }: ConfigGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(scanResult),
    [scanResult],
  );

  const [nodes, , onNodesChange] = useNodesState<AppNode>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState<AppEdge>(initialEdges);

  /** ノードクリック時にファイルを選択 */
  const onNodeClick: NodeMouseHandler<AppNode> = useCallback(
    (_, node) => {
      if (node.type === "file") {
        const fileData = node.data as { file: DetectedFile };
        onFileSelect(fileData.file);
      }
    },
    [onFileSelect],
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#334155" gap={20} />
        <Controls
          className="!bg-slate-800 !border-slate-600 !rounded-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300"
        />
        <MiniMap
          className="!bg-slate-900 !border-slate-700"
          nodeColor={(n) => {
            if (n.type === "scopeGroup") return "transparent";
            if (n.type === "category") return "#475569";
            return "#64748b";
          }}
        />
      </ReactFlow>
    </div>
  );
}
