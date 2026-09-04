import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { handoverDir, isValidSlug } from "@/app/lib/handovers";
import type { HandoverRole } from "@/app/lib/types";
import type { StatutorySectionId } from "@/app/lib/statutory-sections";

// 突合せフェーズで AI が生成する「前任者への確認事項」の永続化（サーバ専用）。
// クライアントコンポーネントから使う純粋関数・型は questions-format.ts へ
// 分離してある（本ファイルは node:fs に依存するため import types のみ許可）。

export type { OpenQuestion, QuestionStatus } from "@/app/lib/questions-format";
export { parseQuestionsBlock, stripQuestionsBlock } from "@/app/lib/questions-format";

import type { OpenQuestion } from "@/app/lib/questions-format";

function openQuestionsPath(slug: string): string {
  return path.join(handoverDir(slug), "open_questions.json");
}

async function readAll(slug: string): Promise<OpenQuestion[]> {
  try {
    const raw = await readFile(openQuestionsPath(slug), "utf-8");
    return JSON.parse(raw) as OpenQuestion[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll(slug: string, questions: OpenQuestion[]): Promise<void> {
  await writeFile(
    openQuestionsPath(slug),
    `${JSON.stringify(questions, null, 2)}\n`,
    "utf-8",
  );
}

export async function listOpenQuestions(slug: string): Promise<OpenQuestion[]> {
  if (!isValidSlug(slug)) return [];
  const all = await readAll(slug);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

let counter = 0;
function makeQuestionId(): string {
  const iso = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
  counter = (counter + 1) % 1000;
  return `${iso}Z-${String(counter).padStart(3, "0")}`;
}

export async function addOpenQuestion(
  slug: string,
  input: { question: string; raisedBy: HandoverRole; section: StatutorySectionId | null },
): Promise<OpenQuestion> {
  if (!isValidSlug(slug)) throw new Error("invalid slug");
  const now = new Date().toISOString();
  const q: OpenQuestion = {
    id: makeQuestionId(),
    question: input.question,
    raisedBy: input.raisedBy,
    section: input.section,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  const all = await readAll(slug);
  all.push(q);
  await writeAll(slug, all);
  return q;
}

export async function updateOpenQuestion(
  slug: string,
  id: string,
  patch: Partial<Pick<OpenQuestion, "status" | "answer" | "answeredBy">>,
): Promise<OpenQuestion | null> {
  if (!isValidSlug(slug)) return null;
  const all = await readAll(slug);
  const idx = all.findIndex((q) => q.id === id);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeAll(slug, all);
  return all[idx];
}

export async function deleteOpenQuestion(
  slug: string,
  id: string,
): Promise<boolean> {
  if (!isValidSlug(slug)) return false;
  const all = await readAll(slug);
  const filtered = all.filter((q) => q.id !== id);
  if (filtered.length === all.length) return false;
  await writeAll(slug, filtered);
  return true;
}
