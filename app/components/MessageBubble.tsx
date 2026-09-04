"use client";

// grillme-demo (app/page.tsx:886-1026) の MessageBubble を切り出し、
// speaker バッジと色分けを追加したもの。assistant 発言の編集機能は維持
// （前任者がAIドラフトを手直しする操作は官公庁的に自然でデモ価値が高い）。

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil } from "lucide-react";
import { mdComponents, MermaidDiagram } from "@/app/components/Markdown";
import { ROLE_LABEL, type Message } from "@/app/lib/types";
import { stripQuestionsBlock } from "@/app/lib/questions-format";

const SPEAKER_STYLE: Record<string, string> = {
  predecessor:
    "bg-amber-50 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-800",
  successor:
    "bg-blue-50 text-blue-900 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:ring-blue-800",
};

export function MessageBubble({
  message,
  streaming,
  onEdit,
}: {
  message: Message;
  streaming: boolean;
  onEdit?: (newContent: string) => void;
}) {
  const isUser = message.role === "user";
  const hasReasoning = !isUser && message.reasoning && message.reasoning.length > 0;
  const displayContent = isUser ? message.content : stripQuestionsBlock(message.content);
  const hasContent = displayContent.length > 0;
  const canEdit = !!onEdit && !isUser && !streaming && hasContent;
  const hasQuestions = !isUser && /```handover-questions/.test(message.content);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editing) setDraft(message.content);
  }, [message.content, editing]);

  const components = useMemo<Components>(
    () => ({
      ...mdComponents,
      pre: ({ children, ...props }) => {
        const child = children as
          | { props?: { className?: string; children?: unknown } }
          | undefined;
        const className = child?.props?.className ?? "";
        if (/language-mermaid/.test(className)) {
          const code = String(child?.props?.children ?? "").trim();
          return <MermaidDiagram code={code} streaming={streaming} />;
        }
        return (
          <pre
            className="my-2 overflow-x-auto rounded-md bg-zinc-100 p-3 text-xs leading-relaxed dark:bg-zinc-800"
            {...props}
          >
            {children}
          </pre>
        );
      },
    }),
    [streaming],
  );

  function saveEdit() {
    if (!onEdit) return;
    onEdit(draft);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(message.content);
    setEditing(false);
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="flex max-w-[85%] flex-col">
        {isUser && message.speaker && (
          <span
            className={`mb-1 self-end rounded-full px-2 py-0.5 text-[10px] font-medium ${SPEAKER_STYLE[message.speaker]}`}
          >
            {ROLE_LABEL[message.speaker]}
          </span>
        )}
        {hasQuestions && (
          <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800">
            → 前任者への確認事項あり
          </span>
        )}
        <div
          className={`flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800"
          } ${editing ? "min-w-[28rem]" : ""}`}
        >
          {hasReasoning && (
            <details className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <summary className="cursor-pointer select-none font-medium">
                {hasContent ? "思考プロセス" : "考え中..."}
              </summary>
              <div className="mt-2 break-words italic">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                  {message.reasoning ?? ""}
                </ReactMarkdown>
              </div>
            </details>
          )}
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(24, Math.max(4, draft.split("\n").length + 1))}
                autoFocus
                className="w-full resize-y rounded-md border border-zinc-300 bg-white p-2 font-mono text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={cancelEdit}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  キャンセル
                </button>
                <button
                  onClick={saveEdit}
                  className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  保存
                </button>
              </div>
            </div>
          ) : hasContent ? (
            isUser ? (
              <div className="whitespace-pre-wrap break-words">{displayContent}</div>
            ) : (
              <div className="break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                  {displayContent}
                </ReactMarkdown>
              </div>
            )
          ) : (
            !hasReasoning && (
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400 [animation-delay:300ms]" />
              </span>
            )
          )}
        </div>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="mt-1 inline-flex items-center gap-1 self-start text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <Pencil className="h-3 w-3" />
            編集
          </button>
        )}
      </div>
    </div>
  );
}
