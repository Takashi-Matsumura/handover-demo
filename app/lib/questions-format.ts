// open-questions.ts から「クライアントでも安全に使える純粋関数・型」だけを
// 分離したモジュール。open-questions.ts 本体は node:fs に依存するため、
// "use client" コンポーネントから値としてインポートするとビルドが壊れる。
// MessageBubble.tsx / page.tsx はこちらを使うこと。

import type { HandoverRole } from "@/app/lib/types";
import type { StatutorySectionId } from "@/app/lib/statutory-sections";
import { STATUTORY_SECTIONS } from "@/app/lib/statutory-sections";

export type QuestionStatus = "open" | "answered" | "deferred";

export type OpenQuestion = {
  id: string;
  question: string;
  raisedBy: HandoverRole;
  section: StatutorySectionId | null;
  status: QuestionStatus;
  answer?: string;
  answeredBy?: HandoverRole;
  createdAt: string;
  updatedAt: string;
};

const VALID_SECTION_IDS = new Set(STATUTORY_SECTIONS.map((s) => s.id));

/**
 * ```handover-questions
 * - [budget] 令和6年度の繰越明許費3件は、どの判断基準で「避け難い事故」としたか
 * ```
 * の形式を防御的にパースする。research-loop.ts の parseToolCall と同じ姿勢：
 * フェンス除去 → 行走査 → 不正行は黙って捨てる。失敗時は空配列を返す。
 */
export function parseQuestionsBlock(
  text: string,
): { question: string; section: StatutorySectionId | null }[] {
  const blockRe = /```handover-questions\s*([\s\S]*?)```/;
  const match = blockRe.exec(text);
  if (!match) return [];
  const body = match[1];
  const lines = body.split("\n");
  const out: { question: string; section: StatutorySectionId | null }[] = [];
  const lineRe = /^\s*-\s*\[([a-z-]+)\]\s*(.+?)\s*$/;
  for (const line of lines) {
    const m = lineRe.exec(line);
    if (!m) continue;
    const [, rawSection, question] = m;
    if (!question) continue;
    const section = VALID_SECTION_IDS.has(rawSection as StatutorySectionId)
      ? (rawSection as StatutorySectionId)
      : null;
    out.push({ question, section });
  }
  return out;
}

/** チャットの応答本文から handover-questions ブロックを取り除いた表示用テキスト。 */
export function stripQuestionsBlock(text: string): string {
  return text.replace(/```handover-questions[\s\S]*?```/, "").trimEnd();
}
