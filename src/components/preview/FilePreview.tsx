import { useState, useEffect } from "react";
import type { DetectedFile } from "../../types/config";
import { readFileContent } from "../../lib/scanner";
import { SCOPE_COLORS, LOCAL_OVERRIDE_BORDER } from "../../constants/styles";

interface FilePreviewProps {
  file: DetectedFile | null;
}

/** ファイル内容のプレビューパネル */
export function FilePreview({ file }: FilePreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) {
      setContent(null);
      return;
    }
    setLoading(true);
    readFileContent(file.path).then((c) => {
      setContent(c);
      setLoading(false);
    });
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
      <div
        className="px-3 py-2 border-b flex-shrink-0"
        style={{ borderColor: borderColor }}
      >
        <div className="text-xs font-semibold truncate" style={{ color: colors.text }}>
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
      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <div className="text-slate-500 text-xs">Loading...</div>
        ) : content ? (
          <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
            {content}
          </pre>
        ) : (
          <div className="text-slate-500 text-xs">ファイルの読み込みに失敗しました</div>
        )}
      </div>
    </div>
  );
}
