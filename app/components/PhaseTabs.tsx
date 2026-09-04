"use client";

import { PHASES, type Phase } from "@/app/lib/types";

export const PHASE_LABELS: Record<Phase, string> = {
  inventory: "① 棚卸し",
  reconcile: "② 突合せ",
  document: "③ 引継書",
};

export function PhaseTabs({
  phase,
  onChange,
  disabled,
}: {
  phase: Phase;
  onChange: (phase: Phase) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-zinc-100 p-1 dark:bg-zinc-800">
      {PHASES.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          disabled={disabled || p === phase}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            p === phase
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
              : "text-zinc-600 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          {PHASE_LABELS[p]}
        </button>
      ))}
    </div>
  );
}
