import {
  deleteHandover,
  isValidSlug,
  updateHandoverMeta,
} from "@/app/lib/handovers";
import type { UpdateHandoverInput } from "@/app/lib/types";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 });
  }
  const ok = await deleteHandover(slug);
  if (!ok) {
    return Response.json({ error: "handover not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 });
  }
  let body: UpdateHandoverInput;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  try {
    const meta = await updateHandoverMeta(slug, body);
    return Response.json({ handover: meta });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "handover not found" ? 404 : 500;
    return Response.json({ error: msg }, { status });
  }
}
