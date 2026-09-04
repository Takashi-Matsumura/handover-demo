import { listArchivedDrafts } from "@/app/lib/draft";
import { isValidSlug } from "@/app/lib/handovers";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 });
  }
  const archives = await listArchivedDrafts(slug);
  return Response.json({ archives });
}
