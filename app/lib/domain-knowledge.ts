import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { handoverDir, isValidSessionId, isValidSlug } from "@/app/lib/handovers";

// プロジェクトごとに保持する「外部から収集したドメイン知識」。
// grillme-demo (app/lib/domain-knowledge.ts) を無改造で移植（import 元のみ差替）。
// /api/research の出力を保存し、/api/chat の system prompt に注入することで、
// ローカル LLM 単独では辿り着けない法令・実務情報を grill に持ち込む。

export type DomainKnowledge = {
  query: string;
  content: string;
  iterations: number;
  generatedAt: string;
};

export type ArchivedDomainKnowledge = DomainKnowledge & {
  id: string;
  archivedAt: string;
};

export type DomainKnowledgeArchiveMeta = {
  id: string;
  query: string;
  iterations: number;
  generatedAt: string;
  archivedAt: string;
};

export function domainKnowledgePath(slug: string): string {
  return path.join(handoverDir(slug), "domain_knowledge.json");
}

export function domainKnowledgeHistoryPath(slug: string): string {
  return path.join(handoverDir(slug), "domain_knowledge.history.json");
}

function makeArchiveId(timestamp: string): string {
  return `${timestamp.replace(/:/g, "-").slice(0, 19)}Z`;
}

async function readHistory(
  slug: string,
): Promise<ArchivedDomainKnowledge[]> {
  try {
    const raw = await readFile(domainKnowledgeHistoryPath(slug), "utf-8");
    return JSON.parse(raw) as ArchivedDomainKnowledge[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeHistory(
  slug: string,
  history: ArchivedDomainKnowledge[],
): Promise<void> {
  if (history.length === 0) {
    await rm(domainKnowledgeHistoryPath(slug), { force: true });
    return;
  }
  await writeFile(
    domainKnowledgeHistoryPath(slug),
    `${JSON.stringify(history, null, 2)}\n`,
    "utf-8",
  );
}

export async function saveDomainKnowledge(
  slug: string,
  dk: DomainKnowledge,
): Promise<void> {
  if (!isValidSlug(slug)) throw new Error("invalid slug");

  const existing = await readDomainKnowledge(slug);
  if (existing) {
    const history = await readHistory(slug);
    const archived: ArchivedDomainKnowledge = {
      ...existing,
      id: makeArchiveId(existing.generatedAt),
      archivedAt: new Date().toISOString(),
    };
    history.push(archived);
    await writeHistory(slug, history);
  }

  await writeFile(
    domainKnowledgePath(slug),
    `${JSON.stringify(dk, null, 2)}\n`,
    "utf-8",
  );
}

export async function readDomainKnowledge(
  slug: string,
): Promise<DomainKnowledge | null> {
  if (!isValidSlug(slug)) return null;
  try {
    const raw = await readFile(domainKnowledgePath(slug), "utf-8");
    return JSON.parse(raw) as DomainKnowledge;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function deleteDomainKnowledge(slug: string): Promise<void> {
  if (!isValidSlug(slug)) return;
  await rm(domainKnowledgePath(slug), { force: true });
}

export async function listArchivedDomainKnowledge(
  slug: string,
): Promise<DomainKnowledgeArchiveMeta[]> {
  if (!isValidSlug(slug)) return [];
  const history = await readHistory(slug);
  return history
    .map((h) => ({
      id: h.id,
      query: h.query,
      iterations: h.iterations,
      generatedAt: h.generatedAt,
      archivedAt: h.archivedAt,
    }))
    .sort((a, b) => b.id.localeCompare(a.id));
}

export async function getArchivedDomainKnowledge(
  slug: string,
  id: string,
): Promise<ArchivedDomainKnowledge | null> {
  if (!isValidSlug(slug) || !isValidSessionId(id)) return null;
  const history = await readHistory(slug);
  return history.find((h) => h.id === id) ?? null;
}

export async function deleteArchivedDomainKnowledge(
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

export async function restoreArchivedDomainKnowledge(
  slug: string,
  id: string,
): Promise<DomainKnowledge | null> {
  const archived = await getArchivedDomainKnowledge(slug, id);
  if (!archived) return null;
  const { id: _id, archivedAt: _archivedAt, ...dk } = archived;
  void _id;
  void _archivedAt;
  await saveDomainKnowledge(slug, dk);
  await deleteArchivedDomainKnowledge(slug, id);
  return dk;
}

// system prompt に貼り付ける形に整形する。
export function formatDomainKnowledgeForPrompt(dk: DomainKnowledge): string {
  return (
    `## 外部から収集したドメイン知識（クエリ: ${dk.query}）\n\n` +
    `${dk.content}\n\n` +
    `（${dk.generatedAt} に外部一次情報から自動収集）`
  );
}
