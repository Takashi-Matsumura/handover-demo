// 外部知識ソースの「検証済み URL」と「信頼ホスト」を一元管理する。
// grillme-demo (app/lib/trusted-urls.ts) の型・関数は無改造、
// レジストリの中身のみ官公庁（国の府省庁）向けに全面差替。
//
// 設計意図:
//   ローカル LLM (gemma) は fetch_page に渡す URL を平気で捏造する。
//   システムプロンプトに「ここから選べ」と検証済み URL を明示し、
//   fetch_page 側でも信頼ホスト以外を弾く二段ガードで防ぐ。
//
// 追加・運用フロー:
//   1. 候補 URL を curl で HTTP 200 確認:
//      curl -sL -o /dev/null -w "%{http_code}\n" <URL>
//   2. 本ファイルの TRUSTED_URLS に追記。ホストが TRUSTED_HOSTS 外なら
//      ホストも追加 (信頼できる公的機関のみ)。
//   3. `npm run check:urls` で全 URL の生存確認。

export type TrustedUrl = {
  url: string;
  description: string;
  themeKeywords: string[];
};

export const TRUSTED_URLS: TrustedUrl[] = [
  {
    url: "https://laws.e-gov.go.jp/",
    description: "e-Gov 法令検索トップ（条文は egov_search/egov_article で取れる）",
    themeKeywords: [],
  },
  {
    url: "https://www.e-gov.go.jp/",
    description: "e-Gov ポータル",
    themeKeywords: [],
  },
  {
    url: "https://www.cao.go.jp/",
    description: "内閣府トップ（府省横断の政策情報）",
    themeKeywords: [],
  },
  {
    url: "https://www.mof.go.jp/policy/budget/index.html",
    description: "財務省 予算のハブ（予算執行・繰越・補助金等）",
    themeKeywords: ["予算", "執行", "会計", "繰越", "補助金"],
  },
  {
    url: "https://www.mof.go.jp/policy/budget/budger_workflow/index.html",
    description: "財務省 予算の成立過程・概算要求から会計年度まで",
    themeKeywords: ["予算", "概算要求", "会計年度"],
  },
  {
    url: "https://www.jbaudit.go.jp/",
    description: "会計検査院トップ",
    themeKeywords: ["会計検査", "検査院", "不当事項"],
  },
  {
    url: "https://www.jbaudit.go.jp/report/index.html",
    description: "会計検査院 検査報告",
    themeKeywords: ["会計検査", "検査報告"],
  },
  {
    url: "https://www.mlit.go.jp/totikensangyo/const/index.html",
    description: "国土交通省 建設業行政のハブ（許可・建設業法）",
    themeKeywords: ["建設業", "許可", "建設業法"],
  },
  {
    url: "https://www.mlit.go.jp/totikensangyo/const/1_6_bt_000181.html",
    description: "国土交通省 建設業許可の更新・大臣許可の手続き",
    themeKeywords: ["建設業許可", "更新", "大臣許可"],
  },
  {
    url: "https://www.mlit.go.jp/tec/index.html",
    description: "国土交通省 公共工事の入札契約・施工管理",
    themeKeywords: ["公共工事", "施工管理", "契約", "入札"],
  },
  {
    url: "https://www.soumu.go.jp/main_sosiki/gyoukan/kanri/tetsuzukihou/gaiyou.html",
    description: "総務省 行政手続法の概要（審査基準・標準処理期間・理由の提示）",
    themeKeywords: ["行政手続法", "審査基準", "標準処理期間", "理由の提示"],
  },
  {
    url: "https://www.soumu.go.jp/main_sosiki/hyouka/index.html",
    description: "総務省 行政評価局（行政評価・行政相談）",
    themeKeywords: ["行政評価", "行政手続"],
  },
];

// fetch_page で許可するホスト。これ以外は実行前に拒否する。
export const TRUSTED_HOSTS: ReadonlySet<string> = new Set([
  "laws.e-gov.go.jp",
  "www.e-gov.go.jp",
  "www.cao.go.jp",
  "www.mof.go.jp",
  "www.jbaudit.go.jp",
  "www.mlit.go.jp",
  "www.soumu.go.jp",
]);

export function isHostTrusted(url: string): boolean {
  try {
    return TRUSTED_HOSTS.has(new URL(url).host);
  } catch {
    return false;
  }
}

export function selectRelevantUrls(query: string): TrustedUrl[] {
  return TRUSTED_URLS.filter(
    (u) =>
      u.themeKeywords.length === 0 ||
      u.themeKeywords.some((kw) => query.includes(kw)),
  );
}

export function formatTrustedUrlsForPrompt(urls: TrustedUrl[]): string {
  return urls.map((u) => `  - ${u.description}: ${u.url}`).join("\n");
}
