"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download } from "lucide-react";
import { mdComponents, MermaidDiagram } from "@/app/components/Markdown";
import type { HandoverDraft } from "@/app/lib/draft";

const components: Components = {
  ...mdComponents,
  pre: ({ children, ...props }) => {
    const child = children as
      | { props?: { className?: string; children?: unknown } }
      | undefined;
    const className = child?.props?.className ?? "";
    if (/language-mermaid/.test(className)) {
      const code = String(child?.props?.children ?? "").trim();
      return <MermaidDiagram code={code} streaming={false} />;
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
};

export function HandoverDocPanel({
  draft,
  onDownload,
}: {
  draft: HandoverDraft | null;
  onDownload: () => void;
}) {
  if (!draft) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
        <p>まだ引継書のドラフトがありません。</p>
        <p>「③ 引継書」フェーズで生成すると、ここに表示されます。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          version {draft.version} ・{" "}
          {new Date(draft.generatedAt).toLocaleString("ja-JP")}
        </span>
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Download className="h-3 w-3" />
          Markdown
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {draft.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
