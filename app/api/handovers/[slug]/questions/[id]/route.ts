import { isValidSlug } from "@/app/lib/handovers";
import { deleteOpenQuestion, updateOpenQuestion } from "@/app/lib/open-questions";
import type { HandoverRole } from "@/app/lib/types";

function isValidRole(v: unknown): v is HandoverRole {
  return v === "predecessor" || v === "successor";
}

function isValidStatus(v: unknown): v is "open" | "answered" | "deferred" {
  return v === "open" || v === "answered" || v === "deferred";
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 });
  }
  let body: { status?: unknown; answer?: unknown; answeredBy?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const patch: {
    status?: "open" | "answered" | "deferred";
    answer?: string;
    answeredBy?: HandoverRole;
  } = {};
  if (body.status !== undefined) {
    if (!isValidStatus(body.status)) {
      return Response.json({ error: "invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (body.answer !== undefined) {
    if (typeof body.answer !== "string") {
      return Response.json({ error: "invalid answer" }, { status: 400 });
    }
    patch.answer = body.answer;
  }
  if (body.answeredBy !== undefined) {
    if (!isValidRole(body.answeredBy)) {
      return Response.json({ error: "invalid answeredBy" }, { status: 400 });
    }
    patch.answeredBy = body.answeredBy;
  }
  const q = await updateOpenQuestion(slug, id, patch);
  if (!q) {
    return Response.json({ error: "question not found" }, { status: 404 });
  }
  return Response.json({ question: q });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 });
  }
  const ok = await deleteOpenQuestion(slug, id);
  if (!ok) {
    return Response.json({ error: "question not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
