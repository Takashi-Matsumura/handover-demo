// 法令・実務リサーチ Tool calling ループの SSE エンドポイント。
//
// 入力:
//   { "query": "補助金交付事務", "slug": "<optional>" }
// slug を渡した場合、最終ノートを handovers/<slug>/domain_knowledge.json
// に保存し、`/api/chat` 側で system prompt に注入される。

import { saveDomainKnowledge } from "@/app/lib/domain-knowledge";
import { isValidSlug } from "@/app/lib/handovers";
import { type ResearchEvent, runResearch } from "@/app/lib/research-loop";

export const dynamic = "force-dynamic";

const MAX_QUERY_CHARS = 500;

export async function POST(req: Request) {
  let body: { query?: unknown; slug?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.query !== "string" || !body.query.trim()) {
    return Response.json({ error: "query is required" }, { status: 400 });
  }
  if (body.query.length > MAX_QUERY_CHARS) {
    return Response.json(
      { error: `query too long (max ${MAX_QUERY_CHARS} chars)` },
      { status: 413 },
    );
  }
  const query = body.query.trim();
  const slug = isValidSlug(body.slug) ? body.slug : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ResearchEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      const sendRaw = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        const result = await runResearch(query, send);
        if (slug && result.answer) {
          try {
            await saveDomainKnowledge(slug, {
              query,
              content: result.answer,
              iterations: result.iterations,
              generatedAt: new Date().toISOString(),
            });
            sendRaw({ kind: "saved", slug });
          } catch (saveErr) {
            sendRaw({
              kind: "save_error",
              message:
                saveErr instanceof Error ? saveErr.message : String(saveErr),
            });
          }
        }
      } catch (e) {
        send({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        sendRaw({ kind: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
