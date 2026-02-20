import { useState, useEffect, useCallback } from "react";
import type { DetectedFile, DirEntry } from "../../types/config";
import { readFileContent, readDirTree } from "../../lib/scanner";
import { SCOPE_COLORS, LOCAL_OVERRIDE_BORDER } from "../../constants/styles";

interface FilePreviewProps {
  file: DetectedFile | null;
}

/** 折り畳み可能なディレクトリツリーの1行 */
function TreeItem({ entry, depth }: { entry: DirEntry; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);

  /** ファイルクリック時に内容をインライン表示 */
  const handleFileClick = useCallback(async () => {
    if (entry.isDirectory) {
      setExpanded((prev) => !prev);
      return;
    }
    if (showContent) {
      setShowContent(false);
      return;
    }
    const content = await readFileContent(entry.path);
    setFileContent(content);
    setShowContent(true);
  }, [entry, showContent]);

  const indent = depth * 16;
  const icon = entry.isDirectory ? (expanded ? "📂" : "📁") : "📄";
  const chevron = entry.isDirectory ? (expanded ? "▼" : "▶") : " ";

  return (
    <>
      <button
        onClick={handleFileClick}
        className="w-full flex items-center gap-1 px-2 py-1 text-left text-[11px] font-mono
          hover:bg-slate-800 rounded transition-colors group"
        style={{ paddingLeft: `${indent + 8}px` }}
        title={entry.path}
      >
        <span className="text-slate-500 text-[9px] w-3 shrink-0">{chevron}</span>
        <span className="shrink-0">{icon}</span>
        <span className="text-slate-300 truncate">{entry.name}</span>
      </button>

      {/* ディレクトリの子要素 */}
      {entry.isDirectory && expanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <TreeItem key={child.path} entry={child} depth={depth + 1} />
          ))}
          {entry.children.length === 0 && (
            <div
              className="text-[10px] text-slate-600 italic py-0.5"
              style={{ paddingLeft: `${indent + 32}px` }}
            >
              (empty)
            </div>
          )}
        </div>
      )}

      {/* ファイル内容のインライン表示 */}
      {!entry.isDirectory && showContent && (
        <div
          className="border-l border-slate-700 mx-2 mb-1"
          style={{ marginLeft: `${indent + 20}px` }}
        >
          <pre
            className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap break-words
            leading-relaxed p-2 bg-slate-900/50 rounded-r max-h-48 overflow-auto"
          >
            {fileContent ?? "(読み込めませんでした)"}
          </pre>
        </div>
      )}
    </>
  );
}

/** ディレクトリツリー表示 */
function DirectoryPreview({ path }: { path: string }) {
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    readDirTree(path).then((result) => {
      if (!cancelled) {
        setEntries(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (loading) {
    return <div className="text-slate-500 text-xs p-3">Loading...</div>;
  }

  if (entries.length === 0) {
    return <div className="text-slate-500 text-xs p-3">(空のディレクトリ)</div>;
  }

  return (
    <div className="py-1">
      {entries.map((entry) => (
        <TreeItem key={entry.path} entry={entry} depth={0} />
      ))}
    </div>
  );
}

/** ファイル内容のプレビューパネル */
export function FilePreview({ file }: FilePreviewProps) {
  const [prevFile, setPrevFile] = useState<DetectedFile | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // file が変わったらリセット（レンダー中に setState で同期リセット）
  if (file !== prevFile) {
    setPrevFile(file);
    setContent(null);
    setLoading(!!(file && !file.isDirectory));
  }

  useEffect(() => {
    if (!file || file.isDirectory) {
      return;
    }
    let cancelled = false;
    readFileContent(file.path).then((c) => {
      if (!cancelled) {
        setContent(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        ノードをクリックしてファイルをプレビュー
      </div>
    );
  }

  const colors = SCOPE_COLORS[file.scope];
  const borderColor = file.isLocalOverride ? LOCAL_OVERRIDE_BORDER : colors.border;

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="px-3 py-2 border-b flex-shrink-0" style={{ borderColor: borderColor }}>
        <div className="text-xs font-semibold truncate" style={{ color: colors.text }}>
          {file.isDirectory ? "📁 " : ""}
          {file.name}
        </div>
        <div className="text-[10px] text-slate-500 truncate mt-0.5" title={file.path}>
          {file.path}
        </div>
        <div className="flex gap-2 mt-1">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ backgroundColor: colors.background, color: colors.text }}
          >
            {file.scope}
          </span>
          {file.isDirectory && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
              directory
            </span>
          )}
          {file.isLocalOverride && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "#f9731620", color: LOCAL_OVERRIDE_BORDER }}
            >
              local override
            </span>
          )}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-auto overscroll-contain">
        {file.isDirectory ? (
          <DirectoryPreview path={file.path} />
        ) : loading ? (
          <div className="text-slate-500 text-xs p-3">Loading...</div>
        ) : content ? (
          <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap break-words leading-relaxed p-3">
            {content}
          </pre>
        ) : (
          <div className="text-slate-500 text-xs p-3">ファイルの読み込みに失敗しました</div>
        )}
      </div>
    </div>
  );
}
