import { useState, useCallback } from "react";
import type { DetectedFile } from "../../types/config";
import { useConfigScan } from "../../hooks/use-config-scan";
import { LeftPane } from "./LeftPane";
import { RightPane } from "./RightPane";
import { ConfigGraph } from "../graph/ConfigGraph";

/** 3ペインレイアウト */
export function AppLayout() {
  const { result, loading, error, projectPath, setProjectPath } = useConfigScan();
  const [selectedFile, setSelectedFile] = useState<DetectedFile | null>(null);

  const handleFileSelect = useCallback((file: DetectedFile) => {
    setSelectedFile(file);
  }, []);

  return (
    <div className="h-screen w-screen grid grid-cols-[240px_1fr_320px] bg-slate-950 text-slate-200">
      {/* 左ペイン: プロジェクト選択 */}
      <LeftPane selectedProject={projectPath} onSelectProject={setProjectPath} />

      {/* 中央ペイン: ノードグラフ */}
      <div className="relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-slate-500 text-sm">Scanning...</div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-red-400 text-sm">Error: {error}</div>
          </div>
        ) : result.files.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-slate-500 text-sm">設定ファイルが見つかりませんでした</div>
          </div>
        ) : (
          <ConfigGraph scanResult={result} onFileSelect={handleFileSelect} />
        )}
      </div>

      {/* 右ペイン: ファイルプレビュー */}
      <RightPane selectedFile={selectedFile} />
    </div>
  );
}
