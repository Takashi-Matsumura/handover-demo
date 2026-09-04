import { isValidSlug } from "@/app/lib/handovers";
import { addOpenQuestion, listOpenQuestions } from "@/app/lib/open-questions";
import type { HandoverRole } from "@/app/lib/types";
import { STATUTORY_SECTIONS, type StatutorySectionId } from "@/app/lib/statutory-sections";

const VALID_SECTIONS = new Set(STATUTORY_SECTIONS.map((s) => s.id));

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
  const questions = await listOpenQuestions(slug);
  return Response.json({ questions });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: "invalid slug" }, { status: 400 });
  }
  let body: { question?: unknown; raisedBy?: unknown; section?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.question !== "string" || !body.question.trim()) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }
  const raisedBy: HandoverRole = isValidRole(body.raisedBy)
    ? body.raisedBy
    : "successor";
  const section: StatutorySectionId | null = VALID_SECTIONS.has(
    body.section as StatutorySectionId,
  )
    ? (body.section as StatutorySectionId)
    : null;

  try {
    const q = await addOpenQuestion(slug, {
      question: body.question.trim(),
      raisedBy,
      section,
    });
    return Response.json({ question: q }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
