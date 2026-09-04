import { createHandover, listHandovers } from "@/app/lib/handovers";
import type { CreateHandoverInput } from "@/app/lib/types";

export async function GET() {
  const handovers = await listHandovers();
  return Response.json({ handovers });
}

export async function POST(req: Request) {
  let body: Partial<CreateHandoverInput>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  if (body.workType !== "budget-execution" && body.workType !== "law-enforcement") {
    return Response.json({ error: "workType is required" }, { status: 400 });
  }

  try {
    const meta = await createHandover(body as CreateHandoverInput);
    return Response.json({ handover: meta }, { status: 201 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
