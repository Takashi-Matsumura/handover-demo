import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHandover } from "@/app/lib/handovers";
import { buildSystemPrompt, decorateSpeakers } from "@/app/lib/prompt";

// 層の合成順序・業務類型の分離・フェーズ限定の指示注入を固定する不変条件テスト。
// handoversDir() は process.env.HANDOVER_DIR を呼び出し時に読むので、
// 各テストで一時ディレクトリに差し替えれば実ファイルを汚さない。

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "handover-demo-test-"));
  process.env.HANDOVER_DIR = tmpDir;
});

afterEach(async () => {
  delete process.env.HANDOVER_DIR;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("buildSystemPrompt", () => {
  it("composes layers in order: SKILL -> work-type -> phase -> role", async () => {
    const meta = await createHandover({
      name: "補助金交付事務",
      workType: "budget-execution",
    });
    const prompt = await buildSystemPrompt({
      slug: meta.slug,
      phase: "inventory",
      role: "predecessor",
      workType: "budget-execution",
    });
    const skillIdx = prompt.indexOf("handover-grill");
    const workTypeIdx = prompt.indexOf("grill 観点（予算執行型）");
    const phaseIdx = prompt.indexOf("① 棚卸し");
    const roleIdx = prompt.indexOf("役割: 前任者と話す");
    expect(skillIdx).toBeGreaterThanOrEqual(0);
    expect(workTypeIdx).toBeGreaterThan(skillIdx);
    expect(phaseIdx).toBeGreaterThan(workTypeIdx);
    expect(roleIdx).toBeGreaterThan(phaseIdx);
  });

  it("excludes law-enforcement grill axes when workType is budget-execution", async () => {
    const meta = await createHandover({
      name: "補助金交付事務",
      workType: "budget-execution",
    });
    const prompt = await buildSystemPrompt({
      slug: meta.slug,
      phase: "inventory",
      role: "predecessor",
      workType: "budget-execution",
    });
    expect(prompt).not.toContain("grill 観点（法執行型）");
    expect(prompt).toContain("支出負担行為担当官");
  });

  it("excludes budget-execution grill axes when workType is law-enforcement", async () => {
    const meta = await createHandover({
      name: "建設業許可の審査・更新",
      workType: "law-enforcement",
    });
    const prompt = await buildSystemPrompt({
      slug: meta.slug,
      phase: "inventory",
      role: "predecessor",
      workType: "law-enforcement",
    });
    expect(prompt).not.toContain("grill 観点（予算執行型）");
    expect(prompt).toContain("標準処理期間");
  });

  it("injects handover-questions format only in the reconcile phase", async () => {
    const meta = await createHandover({
      name: "補助金交付事務",
      workType: "budget-execution",
    });
    const inventoryPrompt = await buildSystemPrompt({
      slug: meta.slug,
      phase: "inventory",
      role: "predecessor",
      workType: "budget-execution",
    });
    const reconcilePrompt = await buildSystemPrompt({
      slug: meta.slug,
      phase: "reconcile",
      role: "successor",
      workType: "budget-execution",
    });
    expect(inventoryPrompt).not.toContain("handover-questions ブロック");
    expect(reconcilePrompt).toContain("handover-questions ブロック");
  });

  it("includes days-remaining framing derived from effectiveDate", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    // Build the date string from local components (not toISOString, which is
    // UTC and can drift a day off local "today" depending on timezone/time).
    const yyyy = future.getFullYear();
    const mm = String(future.getMonth() + 1).padStart(2, "0");
    const dd = String(future.getDate()).padStart(2, "0");
    const effectiveDate = `${yyyy}-${mm}-${dd}`;
    const meta = await createHandover({
      name: "補助金交付事務",
      workType: "budget-execution",
      organization: "〇〇省〇〇局補助金課",
      predecessorName: "田中",
      successorName: "佐藤",
      effectiveDate,
    });
    const prompt = await buildSystemPrompt({
      slug: meta.slug,
      phase: "inventory",
      role: "predecessor",
      workType: "budget-execution",
    });
    expect(prompt).toContain("〇〇省〇〇局補助金課");
    expect(prompt).toContain("発令日まで残り: 5日");
  });
});

describe("decorateSpeakers", () => {
  it("prefixes a speaker label onto user content without changing role", () => {
    const decorated = decorateSpeakers([
      { role: "user", content: "こんにちは", speaker: "predecessor" },
      { role: "assistant", content: "こんにちは、田中さん" },
    ]);
    expect(decorated[0].role).toBe("user");
    expect(decorated[0].content).toBe("【前任者】こんにちは");
    expect(decorated[1].content).toBe("こんにちは、田中さん");
  });

  it("leaves user content untouched when no speaker is set", () => {
    const decorated = decorateSpeakers([{ role: "user", content: "質問です" }]);
    expect(decorated[0].content).toBe("質問です");
  });
});
