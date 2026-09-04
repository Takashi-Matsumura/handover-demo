import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  archiveAndStartNewSession,
  buildPreviousPhaseContext,
  createHandover,
  deleteHandover,
  getPhaseConversation,
  isValidPhase,
  isValidSlug,
  listSessionHistory,
  savePhaseConversation,
} from "@/app/lib/handovers";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "handover-demo-test-"));
  process.env.HANDOVER_DIR = tmpDir;
});

afterEach(async () => {
  delete process.env.HANDOVER_DIR;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("isValidSlug / isValidPhase", () => {
  it("rejects path-traversal-shaped slugs", () => {
    expect(isValidSlug("../../etc")).toBe(false);
    expect(isValidSlug("ok-slug")).toBe(true);
  });

  it("only accepts the 3 defined phases", () => {
    expect(isValidPhase("inventory")).toBe(true);
    expect(isValidPhase("reconcile")).toBe(true);
    expect(isValidPhase("document")).toBe(true);
    expect(isValidPhase("b-pre")).toBe(false);
  });
});

describe("phase conversation round trip", () => {
  it("creates, saves, and reads back a conversation", async () => {
    const meta = await createHandover({
      name: "補助金交付事務",
      workType: "budget-execution",
    });
    const saved = await savePhaseConversation(meta.slug, "inventory", [
      { role: "user", content: "準備を手伝ってください", speaker: "predecessor" },
    ]);
    expect(saved.messages).toHaveLength(1);
    const read = await getPhaseConversation(meta.slug, "inventory");
    expect(read.messages[0].content).toBe("準備を手伝ってください");
  });

  it("archives and clears the current session", async () => {
    const meta = await createHandover({
      name: "補助金交付事務",
      workType: "budget-execution",
    });
    await savePhaseConversation(meta.slug, "inventory", [
      { role: "user", content: "1問目" },
    ]);
    const { archivedId } = await archiveAndStartNewSession(meta.slug, "inventory");
    expect(archivedId).not.toBeNull();
    const history = await listSessionHistory(meta.slug, "inventory");
    expect(history).toHaveLength(1);
    const current = await getPhaseConversation(meta.slug, "inventory");
    expect(current.messages).toHaveLength(0);
  });

  it("carries the inventory phase's last assistant output into reconcile's context", async () => {
    const meta = await createHandover({
      name: "補助金交付事務",
      workType: "budget-execution",
    });
    await savePhaseConversation(meta.slug, "inventory", [
      { role: "user", content: "質問" },
      { role: "assistant", content: "棚卸しの最終出力です" },
    ]);
    const context = await buildPreviousPhaseContext(meta.slug, "reconcile");
    expect(context).toContain("棚卸しの最終出力です");
  });

  it("returns null previous-phase context for inventory (no predecessor phase)", async () => {
    const meta = await createHandover({
      name: "補助金交付事務",
      workType: "budget-execution",
    });
    const context = await buildPreviousPhaseContext(meta.slug, "inventory");
    expect(context).toBeNull();
  });
});

describe("deleteHandover", () => {
  it("removes the handover directory and returns false for a second delete", async () => {
    const meta = await createHandover({
      name: "補助金交付事務",
      workType: "budget-execution",
    });
    expect(await deleteHandover(meta.slug)).toBe(true);
    expect(await deleteHandover(meta.slug)).toBe(false);
  });
});
