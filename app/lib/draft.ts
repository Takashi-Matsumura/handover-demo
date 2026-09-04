import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { handoverDir, isValidSessionId, isValidSlug } from "@/app/lib/handovers";
import type { Phase } from "@/app/lib/types";

// 引継書ドラフトの版管理。grillme-demo (app/lib/domain-knowledge.ts) の
// 「現行 + history + restore」パターンをそのまま転写した。
// チャット履歴とは独立した正本として持つ理由は、引継書が2名で往復して
// 育てる対象であり、「最後のassistant発言＝成果物」では表現できないため。

export type HandoverDraft = {
  content: string;
  version: number;
  generatedAt: string;
  generatedBy: Phase;
  updatedByRole?: "predecessor" | "successor";
};

export type ArchivedDraft = HandoverDraft & { id: string; archivedAt: string };

export type ArchivedDraftMeta = {
  id: string;
  version: number;
  generatedAt: string;
  archivedAt: string;
};

export function draftPath(slug: string): string {
  return path.join(handoverDir(slug), "draft.json");
}

export function draftHistoryPath(slug: string): string {
  return path.join(handoverDir(slug), "draft.history.json");
}

function makeArchiveId(timestamp: string): string {
  return `${timestamp.replace(/:/g, "-").slice(0, 19)}Z`;
}

async function readHistory(slug: string): Promise<ArchivedDraft[]> {
  try {
    const raw = await readFile(draftHistoryPath(slug), "utf-8");
    return JSON.parse(raw) as ArchivedDraft[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeHistory(
  slug: string,
  history: ArchivedDraft[],
): Promise<void> {
  if (history.length === 0) {
    await rm(draftHistoryPath(slug), { force: true });
    return;
  }
  await writeFile(
    draftHistoryPath(slug),
    `${JSON.stringify(history, null, 2)}\n`,
    "utf-8",
  );
}

export async function readDraft(slug: string): Promise<HandoverDraft | null> {
  if (!isValidSlug(slug)) return null;
  try {
    const raw = await readFile(draftPath(slug), "utf-8");
    return JSON.parse(raw) as HandoverDraft;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function saveDraft(
  slug: string,
  input: { content: string; generatedBy: Phase; updatedByRole?: "predecessor" | "successor" },
): Promise<HandoverDraft> {
  if (!isValidSlug(slug)) throw new Error("invalid slug");

  const existing = await readDraft(slug);
  if (existing) {
    const history = await readHistory(slug);
    const archived: ArchivedDraft = {
      ...existing,
      id: makeArchiveId(existing.generatedAt),
      archivedAt: new Date().toISOString(),
    };
    history.push(archived);
    await writeHistory(slug, history);
  }

  const draft: HandoverDraft = {
    content: input.content,
    version: (existing?.version ?? 0) + 1,
    generatedAt: new Date().toISOString(),
    generatedBy: input.generatedBy,
    updatedByRole: input.updatedByRole,
  };
  await writeFile(draftPath(slug), `${JSON.stringify(draft, null, 2)}\n`, "utf-8");
  return draft;
}

export async function deleteDraft(slug: string): Promise<void> {
  if (!isValidSlug(slug)) return;
  await rm(draftPath(slug), { force: true });
}

export async function listArchivedDrafts(
  slug: string,
): Promise<ArchivedDraftMeta[]> {
  if (!isValidSlug(slug)) return [];
  const history = await readHistory(slug);
  return history
    .map((h) => ({
      id: h.id,
      version: h.version,
      generatedAt: h.generatedAt,
      archivedAt: h.archivedAt,
    }))
    .sort((a, b) => b.id.localeCompare(a.id));
}

export async function getArchivedDraft(
  slug: string,
  id: string,
): Promise<ArchivedDraft | null> {
  if (!isValidSlug(slug) || !isValidSessionId(id)) return null;
  const history = await readHistory(slug);
  return history.find((h) => h.id === id) ?? null;
}

export async function deleteArchivedDraft(
  slug: string,
  id: string,
): Promise<boolean> {
  if (!isValidSlug(slug) || !isValidSessionId(id)) return false;
  const history = await readHistory(slug);
  const filtered = history.filter((h) => h.id !== id);
  if (filtered.length === history.length) return false;
  await writeHistory(slug, filtered);
  return true;
}

export async function restoreArchivedDraft(
  slug: string,
  id: string,
): Promise<HandoverDraft | null> {
  const archived = await getArchivedDraft(slug, id);
  if (!archived) return null;
  const { id: _id, archivedAt: _archivedAt, ...draft } = archived;
  void _id;
  void _archivedAt;
  const saved = await saveDraft(slug, {
    content: draft.content,
    generatedBy: draft.generatedBy,
    updatedByRole: draft.updatedByRole,
  });
  await deleteArchivedDraft(slug, id);
  return saved;
}
