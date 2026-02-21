import { useState, useCallback, useEffect } from "react";
import type { ScanResult, DetectedFile } from "../types/config";
import { scanGlobalConfig, scanProjectConfig, readFileContent } from "../lib/scanner";
import { resolveAllReferences } from "../lib/reference-resolver";

/** スキャン状態 */
interface ConfigScanState {
  /** スキャン結果 */
  result: ScanResult;
  /** settings.json ファイルの内容マップ（path → content） */
  settingsContents: Map<string, string>;
  /** ローディング中か */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** 選択中のプロジェクトパス */
  projectPath: string | null;
}

/** settings ファイルの内容を読み込む */
async function loadSettingsContents(files: DetectedFile[]): Promise<Map<string, string>> {
  const settingsFiles = files.filter((f) => f.category === "settings" && f.name.endsWith(".json"));
  const contents = new Map<string, string>();
  for (const file of settingsFiles) {
    const content = await readFileContent(file.path);
    if (content) {
      contents.set(file.path, content);
    }
  }
  return contents;
}

/** 設定ファイルのスキャン結果を管理するhook */
export function useConfigScan() {
  const [state, setState] = useState<ConfigScanState>({
    result: { files: [], references: [] },
    settingsContents: new Map(),
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
      const settingsContents = await loadSettingsContents(allFiles);
      setState({
        result: { files: allFiles, references },
        settingsContents,
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
