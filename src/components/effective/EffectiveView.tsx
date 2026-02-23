import { useMemo, useCallback } from "react";
import type { ScanResult, DetectedFile } from "../../types/config";
import { buildEffectiveConfig } from "../../lib/effective-builder";
import { ConcernSection } from "./ConcernSection";
import { InstructionsList } from "./InstructionsList";
import { InstructionStack } from "./InstructionStack";
import { SettingsTree } from "./SettingsTree";
import { ExtensionsList } from "./ExtensionsList";

interface EffectiveViewProps {
  scanResult: ScanResult;
  settingsContents: Map<string, string>;
  onFileSelect: (file: DetectedFile) => void;
  /** instruction チェーンのファイル（低優先→高優先の順） */
  instructionChain?: DetectedFile[];
  /** プロジェクトルートパス */
  projectDir?: string | null;
  /** 選択中のディレクトリパス */
  selectedDir?: string | null;
}

/** 有効設定ビューのメインコンテナ（ConfigGraph の代替） */
export function EffectiveView({
  scanResult,
  settingsContents,
  onFileSelect,
  instructionChain,
  projectDir,
  selectedDir,
}: EffectiveViewProps) {
  const effectiveConfig = useMemo(
    () =>
      buildEffectiveConfig(scanResult, settingsContents, instructionChain, projectDir ?? undefined),
    [scanResult, settingsContents, instructionChain, projectDir],
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
        count={
          selectedDir && effectiveConfig.instructionStack
            ? effectiveConfig.instructionStack.length
            : effectiveConfig.instructions.length
        }
        defaultOpen={true}
      >
        {selectedDir && effectiveConfig.instructionStack ? (
          <InstructionStack
            stack={effectiveConfig.instructionStack}
            selectedDir={selectedDir}
            onFileSelect={onFileSelect}
          />
        ) : (
          <InstructionsList
            instructions={effectiveConfig.instructions}
            onFileSelect={onFileSelect}
          />
        )}
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
