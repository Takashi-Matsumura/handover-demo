// 官公庁 業務引継ぎ支援アプリの中核型定義。
// grillme-demo (app/lib/types.ts) の Phase/Message/ProjectMeta 系を踏襲しつつ、
// 「前任者・後任者 2 名の協働」「業務類型（予算執行型／法執行型）」を追加した。

// ---- フェーズ ----
// ① 棚卸し（前任者を grill）／② 突合せ（2名で議論）／③ 引継書生成
export type Phase = "inventory" | "reconcile" | "document";
export const PHASES: Phase[] = ["inventory", "reconcile", "document"];

// ---- 役割 ----
export type HandoverRole = "predecessor" | "successor";
export const ROLES: HandoverRole[] = ["predecessor", "successor"];
export const ROLE_LABEL: Record<HandoverRole, string> = {
  predecessor: "前任者",
  successor: "後任者",
};

// ---- 業務類型 ----
export type WorkType = "budget-execution" | "law-enforcement";
export const WORK_TYPES: WorkType[] = ["budget-execution", "law-enforcement"];

// ---- メッセージ ----
// role は OpenAI 互換 API の wire 形式に一致させ続ける（"user"/"assistant" のみ）。
// speaker は「誰の発言か / 誰に向けた発言か」を表す直交する追加次元で、
// LLM へ送る直前に app/lib/prompt.ts の decorateSpeakers() が
// content 先頭へ話者ラベルとして合成する。
export type Message = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  /** user: 誰が発言したか。assistant: 誰に向けた発言か。未指定は「両者向け」 */
  speaker?: HandoverRole;
  /** assistant が相手役への申し送りを含むターンのマーク（突合せフェーズ） */
  relayTo?: HandoverRole;
};

// ---- プロジェクト（引継ぎ案件）メタ ----
export type HandoverMeta = {
  slug: string;
  name: string; // 業務名（例: 補助金交付事務）
  workType: WorkType;
  organization?: string; // 例: 〇〇省〇〇局〇〇課
  predecessorName?: string; // 例: 田中
  successorName?: string; // 例: 佐藤
  /** 発令日。引継期限（発令日まで／やむを得ない場合7日以内）の表示に使う */
  effectiveDate?: string; // YYYY-MM-DD
  seeded?: boolean; // シード投入されたデモデータか
  createdAt: string;
  updatedAt: string;
};

export type CreateHandoverInput = {
  name: string;
  workType: WorkType;
  organization?: string;
  predecessorName?: string;
  successorName?: string;
  effectiveDate?: string;
};

export type UpdateHandoverInput = Partial<CreateHandoverInput>;

// ---- フェーズ会話（grillme-demo と同一構造） ----
export type PhaseConversation = {
  messages: Message[];
  createdAt?: string;
  updatedAt: string;
};

export type SessionMeta = {
  id: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ArchivedSession = {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};
