import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ArchivedSession,
  CreateHandoverInput,
  HandoverMeta,
  Message,
  Phase,
  PhaseConversation,
  SessionMeta,
  UpdateHandoverInput,
  WorkType,
} from "@/app/lib/types";

export type {
  ArchivedSession,
  HandoverMeta,
  Message,
  Phase,
  PhaseConversation,
  SessionMeta,
};
export { PHASES } from "@/app/lib/types";

// grillme-demo (app/lib/projects.ts) の直接の移植。
// slug 検証・履歴アーカイブ・buildPreviousPhaseContext はロジック無改造で、
// ディレクトリ名とフェーズ集合、メタの形だけを引継ぎ用に差し替えている。

function handoversDir(): string {
  return process.env.HANDOVER_DIR ?? path.join(process.cwd(), "handovers");
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,127}$/;

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === "string" && SLUG_RE.test(slug);
}

export function isValidPhase(phase: unknown): phase is Phase {
  return phase === "inventory" || phase === "reconcile" || phase === "document";
}

export function isValidWorkType(v: unknown): v is WorkType {
  return v === "budget-execution" || v === "law-enforcement";
}

export function handoverDir(slug: string): string {
  return path.join(handoversDir(), slug);
}

export function handoverMetaPath(slug: string): string {
  return path.join(handoverDir(slug), "handover.json");
}

export function phaseFilePath(slug: string, phase: Phase): string {
  return path.join(handoverDir(slug), `${phase}.json`);
}

export function phaseHistoryPath(slug: string, phase: Phase): string {
  return path.join(handoverDir(slug), `${phase}.history.json`);
}

const SESSION_ID_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z$/;

export function isValidSessionId(id: unknown): id is string {
  return typeof id === "string" && SESSION_ID_RE.test(id);
}

function makeSessionId(timestamp?: string): string {
  const iso = timestamp ?? new Date().toISOString();
  return `${iso.replace(/:/g, "-").slice(0, 19)}Z`;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureHandoversDir(): Promise<void> {
  await mkdir(handoversDir(), { recursive: true });
}

async function readJsonFile<T>(p: string): Promise<T | null> {
  try {
    const raw = await readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function writeJsonFile(p: string, data: unknown): Promise<void> {
  await writeFile(p, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function todayPrefix(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function asciifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

async function generateUniqueSlug(name: string): Promise<string> {
  const prefix = todayPrefix();
  await ensureHandoversDir();
  const ascii = asciifyName(name);
  const base = ascii ? `${prefix}-${ascii}` : prefix;

  if (!(await pathExists(handoverDir(base)))) return base;
  let n = 2;
  while (await pathExists(handoverDir(`${base}-${n}`))) n++;
  return `${base}-${n}`;
}

export async function listHandovers(): Promise<HandoverMeta[]> {
  await ensureHandoversDir();
  let entries: string[];
  try {
    entries = await readdir(handoversDir());
  } catch {
    return [];
  }
  const metas: HandoverMeta[] = [];
  for (const entry of entries) {
    if (!isValidSlug(entry)) continue;
    const meta = await readJsonFile<HandoverMeta>(handoverMetaPath(entry));
    if (meta) metas.push(meta);
  }
  metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return metas;
}

export async function createHandover(
  input: CreateHandoverInput,
): Promise<HandoverMeta> {
  if (typeof input.name !== "string" || !input.name.trim()) {
    throw new Error("name is required");
  }
  if (!isValidWorkType(input.workType)) {
    throw new Error("workType is required");
  }
  const trimmed = input.name.trim().slice(0, 100);
  const slug = await generateUniqueSlug(trimmed);
  await mkdir(handoverDir(slug), { recursive: true });
  const now = new Date().toISOString();
  const meta: HandoverMeta = {
    slug,
    name: trimmed,
    workType: input.workType,
    organization: input.organization?.trim() || undefined,
    predecessorName: input.predecessorName?.trim() || undefined,
    successorName: input.successorName?.trim() || undefined,
    effectiveDate: input.effectiveDate || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await writeJsonFile(handoverMetaPath(slug), meta);
  return meta;
}

export async function deleteHandover(slug: string): Promise<boolean> {
  if (!isValidSlug(slug)) return false;
  if (!(await pathExists(handoverDir(slug)))) return false;
  await rm(handoverDir(slug), { recursive: true, force: true });
  return true;
}

export async function updateHandoverMeta(
  slug: string,
  input: UpdateHandoverInput,
): Promise<HandoverMeta> {
  if (!isValidSlug(slug)) throw new Error("invalid slug");
  const meta = await readJsonFile<HandoverMeta>(handoverMetaPath(slug));
  if (!meta) throw new Error("handover not found");

  if (input.name !== undefined) {
    const trimmed = input.name.trim().slice(0, 100);
    if (!trimmed) throw new Error("name is required");
    meta.name = trimmed;
  }
  if (input.workType !== undefined) {
    if (!isValidWorkType(input.workType)) throw new Error("invalid workType");
    meta.workType = input.workType;
  }
  if (input.organization !== undefined) {
    meta.organization = input.organization.trim() || undefined;
  }
  if (input.predecessorName !== undefined) {
    meta.predecessorName = input.predecessorName.trim() || undefined;
  }
  if (input.successorName !== undefined) {
    meta.successorName = input.successorName.trim() || undefined;
  }
  if (input.effectiveDate !== undefined) {
    meta.effectiveDate = input.effectiveDate || undefined;
  }
  meta.updatedAt = new Date().toISOString();
  await writeJsonFile(handoverMetaPath(slug), meta);
  return meta;
}

export async function getHandoverMeta(
  slug: string,
): Promise<HandoverMeta | null> {
  if (!isValidSlug(slug)) return null;
  return readJsonFile<HandoverMeta>(handoverMetaPath(slug));
}

async function touchHandover(slug: string): Promise<void> {
  const meta = await readJsonFile<HandoverMeta>(handoverMetaPath(slug));
  if (!meta) return;
  meta.updatedAt = new Date().toISOString();
  await writeJsonFile(handoverMetaPath(slug), meta);
}

export async function getPhaseConversation(
  slug: string,
  phase: Phase,
): Promise<PhaseConversation> {
  const conv = await readJsonFile<PhaseConversation>(phaseFilePath(slug, phase));
  return conv ?? { messages: [], updatedAt: "" };
}

export async function savePhaseConversation(
  slug: string,
  phase: Phase,
  messages: Message[],
): Promise<PhaseConversation> {
  if (!(await pathExists(handoverDir(slug)))) {
    throw new Error("handover not found");
  }
  const existing = await readJsonFile<PhaseConversation>(
    phaseFilePath(slug, phase),
  );
  const now = new Date().toISOString();
  const conv: PhaseConversation = {
    messages,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await writeJsonFile(phaseFilePath(slug, phase), conv);
  await touchHandover(slug);
  return conv;
}

async function loadPhaseHistory(
  slug: string,
  phase: Phase,
): Promise<ArchivedSession[] | null> {
  return readJsonFile<ArchivedSession[]>(phaseHistoryPath(slug, phase));
}

export async function listSessionHistory(
  slug: string,
  phase: Phase,
): Promise<SessionMeta[]> {
  if (!isValidSlug(slug) || !isValidPhase(phase)) return [];
  const history = await loadPhaseHistory(slug, phase);
  if (!history) return [];
  return history
    .map((h) => ({
      id: h.id,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
      messageCount: h.messages.length,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getArchivedSession(
  slug: string,
  phase: Phase,
  sessionId: string,
): Promise<ArchivedSession | null> {
  if (
    !isValidSlug(slug) ||
    !isValidPhase(phase) ||
    !isValidSessionId(sessionId)
  ) {
    return null;
  }
  const history = await loadPhaseHistory(slug, phase);
  return history?.find((h) => h.id === sessionId) ?? null;
}

export async function archiveAndStartNewSession(
  slug: string,
  phase: Phase,
): Promise<{ archivedId: string | null }> {
  if (!isValidSlug(slug) || !isValidPhase(phase)) {
    throw new Error("invalid slug or phase");
  }
  const current = await readJsonFile<PhaseConversation>(
    phaseFilePath(slug, phase),
  );
  if (!current || current.messages.length === 0) {
    await rm(phaseFilePath(slug, phase), { force: true });
    await touchHandover(slug);
    return { archivedId: null };
  }
  const id = makeSessionId(current.createdAt ?? current.updatedAt);
  const history = (await loadPhaseHistory(slug, phase)) ?? [];
  history.push({
    id,
    messages: current.messages,
    createdAt: current.createdAt ?? current.updatedAt,
    updatedAt: current.updatedAt,
  });
  await writeJsonFile(phaseHistoryPath(slug, phase), history);
  await rm(phaseFilePath(slug, phase), { force: true });
  await touchHandover(slug);
  return { archivedId: id };
}

export async function deleteArchivedSession(
  slug: string,
  phase: Phase,
  sessionId: string,
): Promise<boolean> {
  if (
    !isValidSlug(slug) ||
    !isValidPhase(phase) ||
    !isValidSessionId(sessionId)
  ) {
    return false;
  }
  const history = await loadPhaseHistory(slug, phase);
  if (!history) return false;
  const filtered = history.filter((h) => h.id !== sessionId);
  if (filtered.length === history.length) return false;
  if (filtered.length === 0) {
    await rm(phaseHistoryPath(slug, phase), { force: true });
  } else {
    await writeJsonFile(phaseHistoryPath(slug, phase), filtered);
  }
  await touchHandover(slug);
  return true;
}

export async function clearPhaseConversation(
  slug: string,
  phase: Phase,
): Promise<void> {
  await rm(phaseFilePath(slug, phase), { force: true });
  await touchHandover(slug);
}

const PHASE_PREDECESSORS: Record<Phase, Phase[]> = {
  inventory: [],
  reconcile: ["inventory"],
  document: ["inventory", "reconcile"],
};

const PHASE_LABEL: Record<Phase, string> = {
  inventory: "① 棚卸し（前任者への grill）",
  reconcile: "② 突合せ（前任者・後任者の議論）",
  document: "③ 引継書生成",
};

function lastAssistantContent(messages: Message[]): string | null {
  const last = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.content.trim().length > 0);
  return last ? last.content : null;
}

async function findLatestAssistantOutput(
  slug: string,
  phase: Phase,
): Promise<string | null> {
  // Prefer the current session if it has an assistant message.
  const current = await getPhaseConversation(slug, phase);
  const fromCurrent = lastAssistantContent(current.messages);
  if (fromCurrent) return fromCurrent;
  // Otherwise fall back to the most recent archived session that has one.
  const history = await loadPhaseHistory(slug, phase);
  if (!history) return null;
  const sorted = [...history].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  for (const arch of sorted) {
    const fromArch = lastAssistantContent(arch.messages);
    if (fromArch) return fromArch;
  }
  return null;
}

export async function buildPreviousPhaseContext(
  slug: string,
  phase: Phase,
): Promise<string | null> {
  const predecessors = PHASE_PREDECESSORS[phase];
  if (predecessors.length === 0) return null;

  const sections: string[] = [];
  for (const prev of predecessors) {
    const output = await findLatestAssistantOutput(slug, prev);
    if (!output) continue;
    sections.push(`### ${PHASE_LABEL[prev]} の最終出力\n\n${output}`);
  }
  if (sections.length === 0) return null;
  return `## このプロジェクトの過去フェーズ出力\n\n${sections.join("\n\n")}`;
}
