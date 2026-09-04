import { restoreArchivedDraft } from "@/app/lib/draft";
import { isValidSessionId, isValidSlug } from "@/app/lib/handovers";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 });
  }
  if (!isValidSessionId(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const draft = await restoreArchivedDraft(slug, id);
  if (!draft) {
    return Response.json({ error: "archive not found" }, { status: 404 });
  }
  return Response.json({ draft });
}
