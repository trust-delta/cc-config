import { useMemo, useCallback, useState } from "react";
import type { ScanResult, DetectedFile } from "../../types/config";
import { buildEffectiveConfig } from "../../lib/effective-builder";
import { ConcernSection } from "./ConcernSection";
import { InstructionsList } from "./InstructionsList";
import { InstructionStack } from "./InstructionStack";
import { InstructionMap } from "./InstructionMap";
import { SettingsTree } from "./SettingsTree";
import { ExtensionsList } from "./ExtensionsList";

/** Instructions セクション内の表示モード */
type InstructionViewMode = "stack" | "map";

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
  /** プロジェクト配下の全 instruction ファイル */
  allProjectInstructions?: DetectedFile[];
  /** ホームディレクトリパス */
  homeDir?: string | null;
}

/** 有効設定ビューのメインコンテナ（ConfigGraph の代替） */
export function EffectiveView({
  scanResult,
  settingsContents,
  onFileSelect,
  instructionChain,
  projectDir,
  selectedDir,
  allProjectInstructions,
  homeDir,
}: EffectiveViewProps) {
  const [instructionViewMode, setInstructionViewMode] = useState<InstructionViewMode>("stack");

  const effectiveConfig = useMemo(
    () =>
      buildEffectiveConfig(
        scanResult,
        settingsContents,
        instructionChain,
        projectDir ?? undefined,
        allProjectInstructions,
        homeDir ?? undefined,
      ),
    [scanResult, settingsContents, instructionChain, projectDir, allProjectInstructions, homeDir],
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
        headerExtra={
          selectedDir ? (
            <div className="flex items-center gap-0.5 ml-2 bg-slate-800 rounded-md p-0.5">
              <button
                onClick={() => setInstructionViewMode("stack")}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  instructionViewMode === "stack"
                    ? "bg-slate-600 text-slate-200"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Stack
              </button>
              <button
                onClick={() => setInstructionViewMode("map")}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  instructionViewMode === "map"
                    ? "bg-slate-600 text-slate-200"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Map
              </button>
            </div>
          ) : undefined
        }
      >
        {instructionViewMode === "map" && effectiveConfig.instructionMap ? (
          <InstructionMap map={effectiveConfig.instructionMap} onFileSelect={onFileSelect} />
        ) : selectedDir && effectiveConfig.instructionStack ? (
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
