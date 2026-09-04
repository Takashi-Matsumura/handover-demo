// デモ環境の再現用シード投入エンドポイント。開発環境限定。
//   POST /api/seed              → seeds/ 配下すべてを投入
//   POST /api/seed { "reset": true } → 既存の同名 handovers/<id>/ を消してから投入

import { applyAllSeeds } from "@/app/lib/seed";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "seeding is disabled in production" },
      { status: 403 },
    );
  }
  let body: { reset?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine; defaults apply
  }
  const reset = body.reset === true;
  try {
    const slugs = await applyAllSeeds({ reset });
    return Response.json({ slugs });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
