import { useMemo, useCallback } from "react";
import type { ScanResult, DetectedFile } from "../../types/config";
import { buildEffectiveConfig } from "../../lib/effective-builder";
import { ConcernSection } from "./ConcernSection";
import { InstructionsList } from "./InstructionsList";
import { SettingsTree } from "./SettingsTree";
import { ExtensionsList } from "./ExtensionsList";

interface EffectiveViewProps {
  scanResult: ScanResult;
  settingsContents: Map<string, string>;
  onFileSelect: (file: DetectedFile) => void;
}

/** 有効設定ビューのメインコンテナ（ConfigGraph の代替） */
export function EffectiveView({ scanResult, settingsContents, onFileSelect }: EffectiveViewProps) {
  const effectiveConfig = useMemo(
    () => buildEffectiveConfig(scanResult, settingsContents),
    [scanResult, settingsContents],
  );

  /** settings 内のソースファイルクリック時にそのファイルを DetectedFile として選択する */
  const handleSettingsFileClick = useCallback(
    (sourceFile: string) => {
      const file = scanResult.files.find((f) => f.path === sourceFile);
      if (file) {
        onFileSelect(file);
      }
    },
    [scanResult.files, onFileSelect],
  );

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="px-3 py-3 border-b border-slate-700">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Effective Configuration
        </h2>
      </div>

      <ConcernSection
        title="Instructions"
        count={effectiveConfig.instructions.length}
        defaultOpen={true}
      >
        <InstructionsList instructions={effectiveConfig.instructions} onFileSelect={onFileSelect} />
      </ConcernSection>

      <ConcernSection title="Settings" count={effectiveConfig.settings.length} defaultOpen={true}>
        <SettingsTree settings={effectiveConfig.settings} onFileClick={handleSettingsFileClick} />
      </ConcernSection>

      <ConcernSection
        title="Extensions"
        count={effectiveConfig.extensions.length}
        defaultOpen={false}
      >
        <ExtensionsList extensions={effectiveConfig.extensions} onFileSelect={onFileSelect} />
      </ConcernSection>
    </div>
  );
}
