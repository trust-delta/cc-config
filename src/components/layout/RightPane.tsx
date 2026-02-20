import type { DetectedFile } from "../../types/config";
import { FilePreview } from "../preview/FilePreview";

interface RightPaneProps {
  selectedFile: DetectedFile | null;
}

/** ファイルプレビューパネル（右ペイン） */
export function RightPane({ selectedFile }: RightPaneProps) {
  return (
    <div className="h-full bg-slate-900 border-l border-slate-700">
      <FilePreview file={selectedFile} />
    </div>
  );
}
