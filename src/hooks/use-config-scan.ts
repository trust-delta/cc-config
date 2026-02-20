import { useState, useCallback, useEffect } from "react";
import type { ScanResult, DetectedFile } from "../types/config";
import { scanGlobalConfig, scanProjectConfig } from "../lib/scanner";
import { resolveAllReferences } from "../lib/reference-resolver";

/** スキャン状態 */
interface ConfigScanState {
  /** スキャン結果 */
  result: ScanResult;
  /** ローディング中か */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** 選択中のプロジェクトパス */
  projectPath: string | null;
}

/** 設定ファイルのスキャン結果を管理するhook */
export function useConfigScan() {
  const [state, setState] = useState<ConfigScanState>({
    result: { files: [], references: [] },
    loading: true,
    error: null,
    projectPath: null,
  });

  /** スキャンを実行 */
  const scan = useCallback(async (projectPath: string | null) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const globalFiles = await scanGlobalConfig();
      let projectFiles: DetectedFile[] = [];
      if (projectPath) {
        projectFiles = await scanProjectConfig(projectPath);
      }
      const allFiles = [...globalFiles, ...projectFiles];
      const references = await resolveAllReferences(allFiles);
      setState({
        result: { files: allFiles, references },
        loading: false,
        error: null,
        projectPath,
      });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }));
    }
  }, []);

  /** プロジェクトパスを変更してリスキャン */
  const setProjectPath = useCallback(
    (path: string | null) => {
      scan(path);
    },
    [scan],
  );

  // 初回マウント時にグローバル設定をスキャン
  useEffect(() => {
    scan(null);
  }, [scan]);

  return {
    ...state,
    setProjectPath,
    rescan: () => scan(state.projectPath),
  };
}
