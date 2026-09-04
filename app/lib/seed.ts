// デモ環境の再現性を担保するシード投入ロジック。
// seeds/<id>/ 配下の handover.json（必須）・domain_knowledge.json・
// inventory.json・draft.md（いずれも任意）を読み、handovers/<id>/ へ
// 書き込む。id をそのまま slug として使う（seed id は SLUG_RE を満たす前提）。

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { handoverDir, handoverMetaPath, isValidSlug, phaseFilePath } from "@/app/lib/handovers";
import { domainKnowledgePath, type DomainKnowledge } from "@/app/lib/domain-knowledge";
import { draftPath, type HandoverDraft } from "@/app/lib/draft";
import type { HandoverMeta, Message, WorkType } from "@/app/lib/types";

const SEEDS_DIR = path.join(process.cwd(), "seeds");

type SeedHandover = {
  name: string;
  workType: WorkType;
  organization?: string;
  predecessorName?: string;
  successorName?: string;
  /** 発令日 = シード投入日からのオフセット日数。毎回意味のある残日数になる。 */
  effectiveDateOffsetDays?: number;
};

type SeedDomainKnowledge = {
  query: string;
  content: string;
  iterations: number;
};

type SeedInventory = {
  messages: Message[];
};

export async function listSeedIds(): Promise<string[]> {
  try {
    const entries = await readdir(SEEDS_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(p, "utf-8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function readTextIfExists(p: string): Promise<string | null> {
  try {
    return await readFile(p, "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function applySeed(
  id: string,
  opts: { reset?: boolean } = {},
): Promise<string> {
  if (!isValidSlug(id)) throw new Error(`invalid seed id (must be a valid slug): ${id}`);
  const seedDir = path.join(SEEDS_DIR, id);
  const seedMeta = await readJsonIfExists<SeedHandover>(
    path.join(seedDir, "handover.json"),
  );
  if (!seedMeta) throw new Error(`seeds/${id}/handover.json not found`);

  const slug = id;
  const dir = handoverDir(slug);
  if (opts.reset) {
    await rm(dir, { recursive: true, force: true });
  }
  await mkdir(dir, { recursive: true });

  const now = new Date();
  const nowIso = now.toISOString();

  const meta: HandoverMeta = {
    slug,
    name: seedMeta.name,
    workType: seedMeta.workType,
    organization: seedMeta.organization,
    predecessorName: seedMeta.predecessorName,
    successorName: seedMeta.successorName,
    effectiveDate:
      seedMeta.effectiveDateOffsetDays !== undefined
        ? addDays(now, seedMeta.effectiveDateOffsetDays)
        : undefined,
    seeded: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await writeFile(handoverMetaPath(slug), `${JSON.stringify(meta, null, 2)}\n`, "utf-8");

  const seedDk = await readJsonIfExists<SeedDomainKnowledge>(
    path.join(seedDir, "domain_knowledge.json"),
  );
  if (seedDk) {
    const dk: DomainKnowledge = { ...seedDk, generatedAt: nowIso };
    await writeFile(
      domainKnowledgePath(slug),
      `${JSON.stringify(dk, null, 2)}\n`,
      "utf-8",
    );
  }

  const seedInv = await readJsonIfExists<SeedInventory>(
    path.join(seedDir, "inventory.json"),
  );
  if (seedInv) {
    const conv = { messages: seedInv.messages, createdAt: nowIso, updatedAt: nowIso };
    await writeFile(
      phaseFilePath(slug, "inventory"),
      `${JSON.stringify(conv, null, 2)}\n`,
      "utf-8",
    );
  }

  const draftContent = await readTextIfExists(path.join(seedDir, "draft.md"));
  if (draftContent !== null) {
    const draft: HandoverDraft = {
      content: draftContent,
      version: 1,
      generatedAt: nowIso,
      generatedBy: "document",
    };
    await writeFile(draftPath(slug), `${JSON.stringify(draft, null, 2)}\n`, "utf-8");
  }

  return slug;
}

export async function applyAllSeeds(
  opts: { reset?: boolean } = {},
): Promise<string[]> {
  const ids = await listSeedIds();
  const slugs: string[] = [];
  for (const id of ids) {
    slugs.push(await applySeed(id, opts));
  }
  return slugs;
}
