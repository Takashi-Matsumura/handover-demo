# handover-demo — 業務引継ぎグリル

ローカル LLM (llama.cpp) との grill と、前任者・後任者2名の議論によって、
組織内の業務引継ぎを支援するデモアプリ。Next.js + React で実装。

引継ぎ資料は「過去の起案のコピーが脈絡なく綴じられた**情報のゴミの山**」か
「A4一枚に業務名と電話番号だけの**情報の砂漠**」に二極化しがちで、手順は書けても
「なぜその判断をしたか」という**判断の勘所**が引き継がれない。本アプリはこの課題を、
前任者への容赦ない grill・後任者の疑問の構造化・定型フォーマットに沿った引継書生成の
3フェーズで解こうとするもの。

サンプル業務・引継書フォーマットは行政実務（事務引継規程等）を参考にしているが、
仕組み自体は特定の業種・組織に限定されない。

土台は Matt Pocock 氏の `grill-me` スキルを業務分析に転用した `ops-grill`
（[grillme-demo](../grillme-demo)）で、ローカルLLM向けの自前 tool calling・
ファイルベース永続化・SSEストリーミングのパターンをそのまま踏襲している。

---

## 起動方法

### 前提

- Node.js 20+, npm
- `llama-server` (llama.cpp) を `http://localhost:8080` で起動

### セットアップ

```sh
npm install
npm run dev    # http://localhost:3000
```

デモ用のサンプル業務データを投入する（任意、強く推奨）:

```sh
npm run seed             # seeds/ 配下すべてを投入
npm run seed -- --reset  # 既存データをリセットしてから投入
```

環境変数 (任意、`.env.example` 参照):

| 変数 | 既定値 | 用途 |
|---|---|---|
| `LLAMA_BASE_URL` | `http://localhost:8080` | llama-server エンドポイント |
| `LLAMA_MODEL` | `gemma` | モデル名 |
| `LLAMA_IDLE_TIMEOUT_MS` | `120000` | LLM 無音タイムアウト (ms) |
| `HANDOVER_DIR` | `./handovers/` | 引継ぎ案件データの保存先 |

開発・運用用コマンド:

```sh
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm test               # vitest unit tests
npm run check:urls     # 信頼 URL レジストリの生存確認 (HTTP 200)
npm run test:research  # tool calling ループの単独動作確認
```

---

## 使い方 — 3フェーズ

| フェーズ | 誰と | 何をするか |
|---|---|---|
| ① 棚卸し | 前任者 | AIが前任者に質問攻めし、業務の全体像と判断の勘所を言語化する |
| ② 突合せ | 前任者・後任者 | 後任者の疑問をAIが検出して構造化し、前任者へ回してもらう |
| ③ 引継書生成 | どちらでも | 法定記載事項8節＋実務補足＋未解決論点チェックリストを生成 |

役割（前任者／後任者）は画面上部のトグルで切り替える。1台のPCで2名がデモする想定で、
役割は URL クエリ `?role=predecessor` / `?role=successor` にも反映されるため、
別タブでブックマークして使うこともできる。

### サンプル業務（行政実務を題材にした3種、`npm run seed` で投入）

| 業務 | 類型 | デモの見せ場 |
|---|---|---|
| **補助金交付事務**（主軸） | 予算執行型 | 5節「予算の執行状況」が「別紙のとおり」の一行のみ、6節が空 — 「情報のゴミの山」 |
| 公共工事の契約・施工管理 | 予算執行型 | 6節はあるが「処理の順序及び方法並びにこれに対する意見」の併記が欠落 |
| 建設業許可の審査・更新 | 法執行型 | A4一枚相当。大半の節が空 — 「情報の砂漠」 |

### 法令・実務リサーチ

grill に入る前に「📚 法令・実務リサーチ」から法令・府省庁の一次情報を自律収集できる。
e-Gov 法令検索 API と信頼URLレジストリ（`app/lib/trusted-urls.ts`）による二段ガードで、
LLMが URL を捏造しても実行前に弾く構成。

---

## アーキテクチャ概観

```
app/
├─ page.tsx                 UI（役割トグル・フェーズタブ・チャット・右ペイン）
├─ components/               MessageBubble / HandoverDocPanel / StatutoryChecklist /
│                            OpenQuestionsPanel / LegalResearchModal ...
├─ lib/
│  ├─ handovers.ts           引継ぎ案件・フェーズ会話の永続化（ファイルベース）
│  ├─ draft.ts                引継書ドラフトの版管理
│  ├─ open-questions.ts       疑問キューの永続化（サーバ専用）
│  ├─ questions-format.ts     疑問ブロックのパース（クライアント安全）
│  ├─ statutory-sections.ts   法定記載事項8節の定義とカバレッジ判定
│  ├─ work-types.ts           業務類型（予算執行型／法執行型）の grill 観点
│  ├─ prompt.ts               system prompt の9層合成（本アプリの心臓部）
│  ├─ research-loop.ts        Tool calling 本体（e-Gov + fetch_page）
│  ├─ egov.ts / fetch-page.ts / trusted-urls.ts
│  └─ llm.ts                  llama-server クライアント
└─ api/
   ├─ chat/                   system prompt 合成 → llama-server への SSE プロキシ
   ├─ handovers/[slug]/...    案件・フェーズ会話・ドラフト・疑問・ドメイン知識のCRUD
   ├─ research/                Tool calling ループの SSE
   └─ seed/                    デモデータ投入（開発限定）
```

`.claude/skills/handover-grill/` に規律本体（SKILL.md）と、フェーズ・役割・業務類型
ごとの断片（`phases/` `roles/` `work-types/` `formats/`）を置き、`app/lib/prompt.ts`
が9層に組み立てて system prompt を合成する。開発時はファイルを都度読み直すため、
プロンプトの編集は再起動なしで反映される。

引継書の法定記載事項（1〜8節）は事務引継規程 第4条第2項に準拠。
処分未了事項・将来企画事項には「処理の順序及び方法並びにこれに対する意見」の
併記が必須という点まで踏襲している。

データ保存場所 (`handovers/<slug>/`、`.gitignore` 対象):

| ファイル | 内容 |
|---|---|
| `handover.json` | 案件メタ（業務類型・組織・前任者/後任者・発令日） |
| `inventory.json` / `reconcile.json` / `document.json` | 各フェーズの現在の会話 |
| `draft.json` / `draft.history.json` | 引継書ドラフトの現行版・履歴 |
| `open_questions.json` | 突合せフェーズの疑問キュー |
| `domain_knowledge.json` / `.history.json` | リサーチで集めた法令・実務ノート |

デモの再現性は `seeds/`（コミット対象）＋ `npm run seed` で担保する。

---

## 参考: 土台となった grillme-demo / ops-grill

- ローカルLLM向け自前 tool calling ループ、ファイルベース永続化、SSEプロキシの
  パターンは [grillme-demo](../grillme-demo) から移植・拡張した。
- ops-grill の「業務と作業を分離する」第一原理は、本アプリでは
  「**手順と判断を分離する**」に翻訳している（詳細は `.claude/skills/handover-grill/SKILL.md`）。

---

## License

[MIT](./LICENSE)
