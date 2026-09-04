"use client";

import {
  sectionCoverage,
  STATUTORY_SECTIONS,
  type SectionCoverageState,
} from "@/app/lib/statutory-sections";

const STATE_ICON: Record<SectionCoverageState, string> = {
  filled: "●",
  stub: "▲",
  missing: "○",
};

const STATE_COLOR: Record<SectionCoverageState, string> = {
  filled: "text-emerald-600 dark:text-emerald-400",
  stub: "text-amber-600 dark:text-amber-400",
  missing: "text-zinc-400 dark:text-zinc-600",
};

export function StatutoryChecklist({
  draftContent,
  onSectionClick,
}: {
  draftContent: string | null;
  onSectionClick?: (sectionTitle: string, hint: string) => void;
}) {
  const coverage = draftContent
    ? sectionCoverage(draftContent)
    : null;

  return (
    <div className="flex flex-col gap-1 p-3 text-xs">
      <p className="mb-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        引継書の法定記載事項（事務引継規程 第4条第2項）
      </p>
      {STATUTORY_SECTIONS.map((s) => {
        const state: SectionCoverageState = coverage ? coverage[s.id] : "missing";
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSectionClick?.(s.title, s.hint)}
            title={`${s.basis}\n${s.hint}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <span className={`w-3 shrink-0 ${STATE_COLOR[state]}`}>
              {STATE_ICON[state]}
            </span>
            <span className="flex-1 text-zinc-700 dark:text-zinc-300">
              {s.no}. {s.title}
            </span>
            {s.requiresOpinion && (
              <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                意見併記
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
