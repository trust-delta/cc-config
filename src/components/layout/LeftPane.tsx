import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";

/** localStorage のキー */
const STORAGE_KEY = "cc-config-projects";

/** 保存されたプロジェクト一覧を取得 */
function loadProjects(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** プロジェクト一覧を保存 */
function saveProjects(projects: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

interface LeftPaneProps {
  selectedProject: string | null;
  onSelectProject: (path: string | null) => void;
}

/** プロジェクト選択サイドバー */
export function LeftPane({ selectedProject, onSelectProject }: LeftPaneProps) {
  const [projects, setProjects] = useState<string[]>(loadProjects);

  /** ディレクトリ選択ダイアログを開く */
  const handleAddProject = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setProjects((prev) => {
        if (prev.includes(selected)) return prev;
        const next = [...prev, selected];
        saveProjects(next);
        return next;
      });
      onSelectProject(selected);
    }
  }, [onSelectProject]);

  /** プロジェクトを削除 */
  const handleRemoveProject = useCallback(
    (path: string) => {
      setProjects((prev) => {
        const next = prev.filter((p) => p !== path);
        saveProjects(next);
        return next;
      });
      if (selectedProject === path) {
        onSelectProject(null);
      }
    },
    [selectedProject, onSelectProject],
  );

  /** プロジェクトパスから表示名を生成 */
  const displayName = (path: string) => path.split("/").pop() ?? path;

  return (
    <div className="h-full flex flex-col bg-slate-900 border-r border-slate-700 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-3 py-3 border-b border-slate-700">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Projects</h2>
      </div>

      {/* Global（常に表示） */}
      <div className="px-2 py-1">
        <button
          onClick={() => onSelectProject(null)}
          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
            selectedProject === null
              ? "bg-blue-900/50 text-blue-300"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
          }`}
        >
          🌐 Global only
        </button>
      </div>

      {/* プロジェクト一覧 */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-1">
        {projects.map((path) => (
          <div key={path} className="group flex items-center gap-1 mb-0.5">
            <button
              onClick={() => onSelectProject(path)}
              className={`flex-1 text-left px-2 py-1.5 rounded text-xs truncate transition-colors ${
                selectedProject === path
                  ? "bg-green-900/50 text-green-300"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
              }`}
              title={path}
            >
              📁 {displayName(path)}
            </button>
            <button
              onClick={() => handleRemoveProject(path)}
              className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400
                text-xs px-1 transition-opacity"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 追加ボタン */}
      <div className="px-3 py-2 border-t border-slate-700">
        <button
          onClick={handleAddProject}
          className="w-full px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300
            text-xs rounded border border-slate-600 transition-colors"
        >
          + Add Project
        </button>
      </div>
    </div>
  );
}
