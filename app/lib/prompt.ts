// system prompt の合成器。本アプリの心臓部。
//
// grillme-demo (app/api/chat/route.ts) の「世界が知っていること →
// このプロジェクトで話されたこと」という順序原則を9層に拡張する。
// 各層は "\n\n---\n\n" 区切り。dev では毎回ファイルを読み直し、
// SKILL.md 等の編集がホットリロードされる（grillme-demo と同じ運用）。
//
//   1. SKILL.md                        不変の規律
//   2. work-types/<workType>.md        業務類型別の掘り下げ軸
//   3. phases/<phase>.md               フェーズの目的・出力形式
//   4. roles/<role>.md                 今話している相手への態度
//   5. formats/questions-block.md      ※ phase === "reconcile" のときのみ
//   6. domain_knowledge.json           外部一次情報（世界が知っていること）
//   7. buildPreviousPhaseContext()     前フェーズの最終出力
//   8. draft + sectionCoverage + open_questions（open のみ）
//   9. HandoverMeta（組織・氏名・発令日・引継期限まで残りN日）

import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildPreviousPhaseContext, getHandoverMeta } from "@/app/lib/handovers";
import { readDomainKnowledge, formatDomainKnowledgeForPrompt } from "@/app/lib/domain-knowledge";
import { readDraft } from "@/app/lib/draft";
import { listOpenQuestions } from "@/app/lib/open-questions";
import { formatCoverageForPrompt } from "@/app/lib/statutory-sections";
import { WORK_TYPE_DEFS } from "@/app/lib/work-types";
import { ROLE_LABEL, type HandoverRole, type Message, type Phase, type WorkType } from "@/app/lib/types";

const SKILL_DIR = path.join(process.cwd(), ".claude/skills/handover-grill");

async function loadFile(relPath: string): Promise<string> {
  // In dev, always re-read so edits take effect without restarting.
  const full = path.join(SKILL_DIR, relPath);
  try {
    return await readFile(full, "utf-8");
  } catch {
    return "";
  }
}

let cache: Map<string, string> | null = null;

async function loadCached(relPath: string): Promise<string> {
  if (process.env.NODE_ENV === "development") return loadFile(relPath);
  if (!cache) cache = new Map();
  if (cache.has(relPath)) return cache.get(relPath) as string;
  const content = await loadFile(relPath);
  cache.set(relPath, content);
  return content;
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export async function buildSystemPrompt(input: {
  slug: string;
  phase: Phase;
  role: HandoverRole;
  workType: WorkType;
}): Promise<string> {
  const { slug, phase, role, workType } = input;
  const layers: string[] = [];

  // 1. SKILL.md
  const skill = await loadCached("SKILL.md");
  if (skill) layers.push(skill);

  // 2. work-types/<workType>.md + grillAxes
  const workTypeDoc = await loadCached(`work-types/${workType}.md`);
  const def = WORK_TYPE_DEFS[workType];
  const grillAxesText =
    `## grill 観点（${def.label}）\n\n` +
    def.grillAxes.map((a) => `- ${a}`).join("\n");
  layers.push([workTypeDoc, grillAxesText].filter(Boolean).join("\n\n"));

  // 3. phases/<phase>.md
  const phaseDoc = await loadCached(`phases/${phase}.md`);
  if (phaseDoc) layers.push(phaseDoc);

  // 4. roles/<role>.md
  const roleDoc = await loadCached(`roles/${role}.md`);
  if (roleDoc) layers.push(roleDoc);

  // 5. formats/questions-block.md (reconcile のみ)
  if (phase === "reconcile") {
    const formatDoc = await loadCached("formats/questions-block.md");
    if (formatDoc) layers.push(formatDoc);
  }

  // 6. domain_knowledge.json（世界が知っていること）
  try {
    const dk = await readDomainKnowledge(slug);
    if (dk) layers.push(formatDomainKnowledgeForPrompt(dk));
  } catch {
    // ignore — chat should still proceed even if domain knowledge fails to load
  }

  // 7. 前フェーズの最終出力
  try {
    const previous = await buildPreviousPhaseContext(slug, phase);
    if (previous) layers.push(previous);
  } catch {
    // ignore
  }

  // 8. draft + coverage + open questions
  try {
    const draft = await readDraft(slug);
    if (draft) {
      layers.push(
        `## 現在の引継書ドラフト（version ${draft.version}）\n\n${draft.content}`,
      );
      layers.push(formatCoverageForPrompt(draft.content));
    }
    const questions = await listOpenQuestions(slug);
    const open = questions.filter((q) => q.status === "open");
    if (open.length > 0) {
      const lines = open.map(
        (q) => `- [${q.section ?? "-"}] (${q.id}) ${q.question}`,
      );
      layers.push(
        `## 未解決の疑問（open のみ、${open.length}件）\n\n${lines.join("\n")}`,
      );
    }
  } catch {
    // ignore
  }

  // 9. HandoverMeta
  try {
    const meta = await getHandoverMeta(slug);
    if (meta) {
      const remaining = daysUntil(meta.effectiveDate);
      const metaLines = [
        meta.organization ? `組織: ${meta.organization}` : null,
        meta.predecessorName ? `前任者: ${meta.predecessorName}` : null,
        meta.successorName ? `後任者: ${meta.successorName}` : null,
        meta.effectiveDate ? `発令日: ${meta.effectiveDate}` : null,
        remaining !== null
          ? `発令日まで残り: ${remaining}日${remaining <= 3 ? "（逼迫。優先順位を提案せよ）" : ""}`
          : null,
        `現在話している相手: ${ROLE_LABEL[role]}`,
      ].filter((l): l is string => l !== null);
      if (metaLines.length > 0) {
        layers.push(`## この引継ぎ案件の実務情報\n\n${metaLines.join("\n")}`);
      }
    }
  } catch {
    // ignore
  }

  return layers.filter((l) => l.trim().length > 0).join("\n\n---\n\n");
}

// LLM へ送る直前に、user メッセージの content 先頭へ話者ラベルを合成する。
// role（"user"/"assistant"）は書き換えない — OpenAI互換APIは role を
// 3種しか受けないため、speaker は直交する追加次元として扱う。
export function decorateSpeakers(
  messages: Message[],
): { role: "user" | "assistant"; content: string }[] {
  return messages.map((m) => {
    if (m.role === "user" && m.speaker) {
      return {
        role: m.role,
        content: `【${ROLE_LABEL[m.speaker]}】${m.content}`,
      };
    }
    return { role: m.role, content: m.content };
  });
}
