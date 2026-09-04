"use client";

// grillme-demo (app/page.tsx:44-204) の mdComponents / loadMermaid /
// MermaidDiagram を無改造で切り出したもの。securityLevel: "strict" を含め
// 変更していない。

import { useEffect, useState } from "react";
import type { Components } from "react-markdown";

export const mdComponents: Components = {
  h1: (props) => <h1 className="mt-4 mb-2 text-base font-bold" {...props} />,
  h2: (props) => <h2 className="mt-4 mb-2 text-base font-bold" {...props} />,
  h3: (props) => <h3 className="mt-3 mb-1 text-sm font-bold" {...props} />,
  h4: (props) => <h4 className="mt-3 mb-1 text-sm font-semibold" {...props} />,
  p: (props) => <p className="my-2 leading-relaxed" {...props} />,
  ul: (props) => <ul className="my-2 ml-6 list-disc space-y-1" {...props} />,
  ol: (props) => <ol className="my-2 ml-6 list-decimal space-y-1" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  a: (props) => (
    <a
      className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? "");
    return isBlock ? (
      <code className={`${className ?? ""} font-mono text-xs`} {...props}>
        {children}
      </code>
    ) : (
      <code
        className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-zinc-800"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre
      className="my-2 overflow-x-auto rounded-md bg-zinc-100 p-3 text-xs leading-relaxed dark:bg-zinc-800"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="my-2 border-l-2 border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400"
      {...props}
    />
  ),
  hr: () => <hr className="my-3 border-zinc-200 dark:border-zinc-700" />,
  table: (props) => (
    <div className="my-2 overflow-x-auto">
      <table className="border-collapse text-xs" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border border-zinc-300 px-2 py-1 text-left font-semibold dark:border-zinc-700"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="border border-zinc-300 px-2 py-1 align-top dark:border-zinc-700"
      {...props}
    />
  ),
};

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

export function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "strict",
        fontFamily: "inherit",
      });
      return mod.default;
    });
  }
  return mermaidPromise;
}

export function MermaidDiagram({
  code,
  streaming,
}: {
  code: string;
  streaming: boolean;
}) {
  // Track the rendered output along with the code it was rendered FOR.
  // When `code` changes, the existing state is treated as stale and we
  // re-render — no need to manually clear state in an effect.
  const [render, setRender] = useState<{
    for: string;
    svg?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (streaming) return;
    let cancelled = false;
    loadMermaid()
      .then(async (mermaid) => {
        if (cancelled) return;
        try {
          const id = `mermaid-${Math.random().toString(36).slice(2)}`;
          const result = await mermaid.render(id, code);
          if (cancelled) return;
          setRender({ for: code, svg: result.svg });
        } catch (e) {
          if (cancelled) return;
          setRender({
            for: code,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setRender({
          for: code,
          error: e instanceof Error ? e.message : String(e),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [code, streaming]);

  const fresh = render?.for === code ? render : null;

  if (streaming || fresh?.error) {
    return (
      <pre className="my-2 overflow-x-auto rounded-md bg-zinc-100 p-3 text-xs leading-relaxed dark:bg-zinc-800">
        <code className="font-mono">{code}</code>
        {fresh?.error && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            Mermaid 描画失敗: {fresh.error}
          </div>
        )}
      </pre>
    );
  }

  if (!fresh?.svg) {
    return (
      <div className="my-2 rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-50 dark:text-zinc-600">
        図を描画中…
      </div>
    );
  }

  return (
    <div
      className="my-2 overflow-x-auto rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-50"
      dangerouslySetInnerHTML={{ __html: fresh.svg }}
    />
  );
}
