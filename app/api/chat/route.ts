import { getHandoverMeta, isValidPhase, isValidSlug } from "@/app/lib/handovers";
import { buildSystemPrompt, decorateSpeakers } from "@/app/lib/prompt";
import { validateMessages } from "@/app/lib/validation";
import type { HandoverRole, Message } from "@/app/lib/types";

const LLAMA_BASE_URL = process.env.LLAMA_BASE_URL ?? "http://localhost:8080";
const MODEL_NAME = process.env.LLAMA_MODEL ?? "gemma";

function isValidRole(v: unknown): v is HandoverRole {
  return v === "predecessor" || v === "successor";
}

export async function POST(req: Request) {
  let body: {
    messages?: unknown;
    slug?: unknown;
    phase?: unknown;
    role?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const result = validateMessages(body.messages);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  const messages = result.messages as Message[];

  if (!isValidSlug(body.slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 });
  }
  if (!isValidPhase(body.phase)) {
    return Response.json({ error: "invalid phase" }, { status: 400 });
  }
  if (!isValidRole(body.role)) {
    return Response.json({ error: "invalid role" }, { status: 400 });
  }

  const meta = await getHandoverMeta(body.slug);
  if (!meta) {
    return Response.json({ error: "handover not found" }, { status: 404 });
  }

  let systemPrompt: string;
  try {
    systemPrompt = await buildSystemPrompt({
      slug: body.slug,
      phase: body.phase,
      role: body.role,
      workType: meta.workType,
    });
  } catch (e) {
    return Response.json(
      { error: `system prompt の構築に失敗しました: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  const decorated = decorateSpeakers(messages);

  let upstream: Response;
  try {
    upstream = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_NAME,
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...decorated],
      }),
    });
  } catch (e) {
    return Response.json(
      {
        error: `llama.cpp に接続できませんでした (${LLAMA_BASE_URL})。サーバが起動しているか確認してください。`,
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return Response.json(
      { error: `llama.cpp returned ${upstream.status}`, detail: text },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
