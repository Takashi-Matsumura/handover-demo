"use client";

import { useState } from "react";
import type { OpenQuestion, QuestionStatus } from "@/app/lib/questions-format";
import { STATUTORY_SECTIONS } from "@/app/lib/statutory-sections";

const STATUS_LABEL: Record<QuestionStatus, string> = {
  open: "未回答",
  answered: "回答済み",
  deferred: "保留",
};

const STATUS_STYLE: Record<QuestionStatus, string> = {
  open: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
  answered:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  deferred: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const SECTION_TITLE: Record<string, string> = Object.fromEntries(
  STATUTORY_SECTIONS.map((s) => [s.id, `${s.no}. ${s.title}`]),
);

export function OpenQuestionsPanel({
  questions,
  onAskPredecessor,
  onUpdateStatus,
  onDelete,
}: {
  questions: OpenQuestion[];
  onAskPredecessor: (question: OpenQuestion) => void;
  onUpdateStatus: (id: string, status: QuestionStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<QuestionStatus | "all">("open");
  const filtered =
    filter === "all" ? questions : questions.filter((q) => q.status === filter);

  return (
    <div className="flex flex-col gap-2 p-3 text-xs">
      <div className="flex items-center gap-1">
        {(["open", "answered", "deferred", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              filter === f
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {f === "all" ? "すべて" : STATUS_LABEL[f]}
            {f !== "all" && (
              <span className="ml-1 tabular-nums">
                {questions.filter((q) => q.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-zinc-400 dark:text-zinc-500">
          該当する疑問はありません。
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((q) => (
            <div
              key={q.id}
              className="rounded-md border border-zinc-200 bg-white p-2.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {q.question}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[q.status]}`}
                >
                  {STATUS_LABEL[q.status]}
                </span>
              </div>
              {q.section && (
                <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                  関連: {SECTION_TITLE[q.section] ?? q.section}
                </p>
              )}
              {q.answer && (
                <p className="mt-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  回答: {q.answer}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {q.status === "open" && (
                  <button
                    onClick={() => onAskPredecessor(q)}
                    className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
                  >
                    前任者に投げる
                  </button>
                )}
                {q.status !== "deferred" && (
                  <button
                    onClick={() => onUpdateStatus(q.id, "deferred")}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    保留にする
                  </button>
                )}
                {q.status !== "open" && (
                  <button
                    onClick={() => onUpdateStatus(q.id, "open")}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    未回答に戻す
                  </button>
                )}
                <button
                  onClick={() => onDelete(q.id)}
                  className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
