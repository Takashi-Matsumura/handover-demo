import { describe, expect, it } from "vitest";
import {
  formatCoverageForPrompt,
  sectionCoverage,
  STATUTORY_SECTIONS,
} from "@/app/lib/statutory-sections";

describe("sectionCoverage", () => {
  it("has 8 sections matching the statutory list", () => {
    expect(STATUTORY_SECTIONS).toHaveLength(8);
  });

  it("treats a missing heading as missing", () => {
    const coverage = sectionCoverage("# 事務引継書\n\n## 1. 所掌する事務\n本文です。\n");
    expect(coverage.outline).toBe("missing");
  });

  it("treats a stub value (別紙のとおり) as stub, not filled", () => {
    const draft = "## 5. 予算の執行状況\n別紙のとおり\n\n## 6. 処分未了事項\n";
    const coverage = sectionCoverage(draft);
    expect(coverage.budget).toBe("stub");
    // heading present but body empty -> stub, not "missing" (missing means no heading at all)
    expect(coverage.pending).toBe("stub");
    expect(coverage.outline).toBe("missing");
  });

  it("treats real prose as filled", () => {
    const draft =
      "## 1. 所掌する事務\n" +
      "補助金交付事務は、〇〇法に基づき民間事業者への支援金交付の審査・決定を行う業務である。\n";
    const coverage = sectionCoverage(draft);
    expect(coverage.scope).toBe("filled");
  });

  it("formatCoverageForPrompt lists only unfilled sections", () => {
    const draft = "## 1. 所掌する事務\n十分な説明文がここに入っています。\n";
    const text = formatCoverageForPrompt(draft);
    expect(text).toContain("2. 事業の概要");
    expect(text).not.toContain("1. 所掌する事務（");
  });

  it("formatCoverageForPrompt reports full coverage when all sections are filled", () => {
    const draft = STATUTORY_SECTIONS.map(
      (s) => `## ${s.no}. ${s.title}\nここに十分な長さの本文を書いています。\n`,
    ).join("\n");
    const text = formatCoverageForPrompt(draft);
    expect(text).toContain("全8節が充足しています");
  });
});
