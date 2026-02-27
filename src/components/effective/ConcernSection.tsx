import { useState, useCallback } from "react";
import type { ReactNode } from "react";

interface ConcernSectionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
  /** ヘッダー右側に追加する要素（タブ切替等） */
  headerExtra?: ReactNode;
}

/** 折りたたみ可能なセクションコンテナ */
export function ConcernSection({
  title,
  count,
  defaultOpen = true,
  children,
  headerExtra,
}: ConcernSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <div className="border-b border-slate-700/50">
      <div className="flex items-center">
        <button
          type="button"
          className="flex items-center gap-2 flex-1 px-3 py-2 text-left hover:bg-slate-800/30 transition-colors"
          onClick={toggle}
        >
          <span className="text-[10px] text-slate-500">{isOpen ? "▼" : "▶"}</span>
          <span className="text-sm font-semibold text-slate-300">{title}</span>
          <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 rounded-full leading-relaxed">
            {count}
          </span>
        </button>
        {headerExtra && <div className="pr-3">{headerExtra}</div>}
      </div>

      {isOpen && <div className="px-1 pb-2">{children}</div>}
    </div>
  );
}
