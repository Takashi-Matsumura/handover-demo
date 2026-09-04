import { deleteDraft, readDraft, saveDraft } from "@/app/lib/draft";
import { isValidPhase, isValidSlug } from "@/app/lib/handovers";
import type { HandoverRole, Phase } from "@/app/lib/types";

function isValidRole(v: unknown): v is HandoverRole {
  return v === "predecessor" || v === "successor";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 });
  }
  const draft = await readDraft(slug);
  return Response.json({ draft });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 });
  }
  let body: { content?: unknown; generatedBy?: unknown; updatedByRole?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.content !== "string" || !body.content.trim()) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }
  const generatedBy: Phase = isValidPhase(body.generatedBy)
    ? body.generatedBy
    : "document";
  const updatedByRole = isValidRole(body.updatedByRole)
    ? body.updatedByRole
    : undefined;
  try {
    const draft = await saveDraft(slug, {
      content: body.content,
      generatedBy,
      updatedByRole,
    });
    return Response.json({ draft });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 });
  }
  await deleteDraft(slug);
  return Response.json({ ok: true });
}
