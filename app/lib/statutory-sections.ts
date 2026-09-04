// 引継書の法定記載事項（地方自治法施行令124条・125条系の事務引継規程、
// 国の府省庁でも実質的な標準として通用する）を一元管理する。
//
// sectionCoverage() は「情報の砂漠」への直接の対抗手段：
// 引継書 Markdown を走査し、各節が「見出しあり かつ 本文が実質空でない」かを判定する。

export type StatutorySectionId =
  | "scope" // 1. 所掌する事務
  | "outline" // 2. 事業の概要
  | "status" // 3. 事務の執行状況
  | "documents" // 4. 管理する重要な文書・物件等の目録
  | "budget" // 5. 予算の執行状況
  | "pending" // 6. 処分未了事項（処理の順序・方法・意見を併記）
  | "planned" // 7. 将来企画事項（同上）
  | "other"; // 8. その他必要と認める事項

export type StatutorySection = {
  id: StatutorySectionId;
  no: number;
  title: string;
  /** 根拠。UI のツールチップとプロンプトの両方で使う */
  basis: string;
  /** 「処理の順序及び方法並びにこれに対する意見」の併記が必要か */
  requiresOpinion: boolean;
  hint: string;
};

export const STATUTORY_SECTIONS: StatutorySection[] = [
  {
    id: "scope",
    no: 1,
    title: "所掌する事務",
    basis: "事務引継規程 第4条第2項",
    requiresOpinion: false,
    hint: "この業務が組織のどの分掌に属し、何のためにあるか",
  },
  {
    id: "outline",
    no: 2,
    title: "事業の概要",
    basis: "事務引継規程 第4条第2項",
    requiresOpinion: false,
    hint: "根拠法令・目的・対象者",
  },
  {
    id: "status",
    no: 3,
    title: "事務の執行状況",
    basis: "事務引継規程 第4条第2項",
    requiresOpinion: false,
    hint: "係属中の案件を一覧化し、各々が今どの段階にあるか",
  },
  {
    id: "documents",
    no: 4,
    title: "管理する重要な文書・物件等の目録",
    basis: "事務引継規程 第4条第2項",
    requiresOpinion: false,
    hint: "保管場所・保管期限まで具体的に",
  },
  {
    id: "budget",
    no: 5,
    title: "予算の執行状況",
    basis: "事務引継規程 第4条第2項",
    requiresOpinion: false,
    hint: "「別紙のとおり」で済まさず、執行率・繰越・不用見込みを明記",
  },
  {
    id: "pending",
    no: 6,
    title: "処分未了事項",
    basis: "事務引継規程 第4条第2項（処理の順序・方法・意見の併記が必須）",
    requiresOpinion: true,
    hint: "各事案の現在の段階・処理の順序及び方法・前任者の意見・期限",
  },
  {
    id: "planned",
    no: 7,
    title: "将来企画事項",
    basis: "事務引継規程 第4条第2項（処理の順序・方法・意見の併記が必須）",
    requiresOpinion: true,
    hint: "今後着手が見込まれる事項とその見通し",
  },
  {
    id: "other",
    no: 8,
    title: "その他必要と認める事項",
    basis: "事務引継規程 第4条第2項",
    requiresOpinion: false,
    hint: "上記に当てはまらないが後任者に伝えるべきこと",
  },
];

const STUB_STOPWORDS = [
  "特になし",
  "なし",
  "別紙のとおり",
  "別紙参照",
  "未確認",
  "n/a",
  "na",
  "-",
  "ー",
  "・",
];

export type SectionCoverageState = "filled" | "stub" | "missing";

/** `## 1. 所掌する事務` のような見出しから本文だけを取り出す簡易パーサ。 */
function extractSectionBody(draft: string, no: number): string | null {
  const headingRe = new RegExp(`^##\\s*${no}\\.\\s.*$`, "m");
  const match = headingRe.exec(draft);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = draft.slice(start);
  const nextHeading = /^##\s*\d+\./m.exec(rest);
  const body = nextHeading ? rest.slice(0, nextHeading.index) : rest;
  return body.trim();
}

function isStub(body: string): boolean {
  const stripped = body
    .replace(/^[>#\-*|\s]+/gm, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (stripped.length === 0) return true;
  if (stripped.length > 20) return false;
  return STUB_STOPWORDS.some((w) => stripped === w.toLowerCase());
}

/** 引継書Markdownを走査し「見出しあり かつ 本文が実質空でない」かを判定する。 */
export function sectionCoverage(
  draft: string,
): Record<StatutorySectionId, SectionCoverageState> {
  const result = {} as Record<StatutorySectionId, SectionCoverageState>;
  for (const section of STATUTORY_SECTIONS) {
    const body = extractSectionBody(draft, section.no);
    if (body === null) {
      result[section.id] = "missing";
    } else if (isStub(body)) {
      result[section.id] = "stub";
    } else {
      result[section.id] = "filled";
    }
  }
  return result;
}

/** プロンプトに貼る「未充足の節はここ」という指示文を生成する。 */
export function formatCoverageForPrompt(draft: string): string {
  const coverage = sectionCoverage(draft);
  const unfilled = STATUTORY_SECTIONS.filter(
    (s) => coverage[s.id] !== "filled",
  );
  if (unfilled.length === 0) {
    return "## 引継書の法定記載事項\n\n全8節が充足しています。11節以降の実務補足の深化を優先してください。";
  }
  const lines = unfilled.map(
    (s) =>
      `- ${s.no}. ${s.title}（${coverage[s.id] === "missing" ? "未記載" : "内容が不十分"}）— ${s.hint}`,
  );
  return (
    `## 引継書の法定記載事項（未充足の節はここを重点的にgrillせよ）\n\n` +
    lines.join("\n")
  );
}
