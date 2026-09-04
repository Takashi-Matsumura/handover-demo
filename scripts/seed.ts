// デモ環境のシード投入。
//
//   npm run seed              # seeds/ 配下すべてを投入（既存は上書きしない）
//   npm run seed -- --reset   # 既存の同名 handovers/<id>/ を消してから投入
//   npm run seed -- subsidy-grant --reset   # 特定の1件だけ

import { applyAllSeeds, applySeed, listSeedIds } from "../app/lib/seed";

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const target = args.find((a) => !a.startsWith("--"));

  if (target) {
    const slug = await applySeed(target, { reset });
    console.log(`seeded: ${slug}`);
    return;
  }

  const ids = await listSeedIds();
  if (ids.length === 0) {
    console.log("seeds/ にシードディレクトリが見つかりません。");
    return;
  }
  const slugs = await applyAllSeeds({ reset });
  console.log(`seeded ${slugs.length} handovers: ${slugs.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
