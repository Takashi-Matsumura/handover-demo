import { describe, expect, it } from "vitest";
import { parseQuestionsBlock, stripQuestionsBlock } from "@/app/lib/questions-format";

describe("parseQuestionsBlock", () => {
  it("parses a well-formed block", () => {
    const text =
      "回答本文です。\n\n```handover-questions\n" +
      '- [budget] 令和6年度の繰越明許費3件は、どの判断基準で「避け難い事故」としたか\n' +
      "- [pending] A社の交付決定取消は、いつまでに結論を出す必要があるか\n" +
      "```\n";
    const result = parseQuestionsBlock(text);
    expect(result).toHaveLength(2);
    expect(result[0].section).toBe("budget");
    expect(result[0].question).toContain("繰越明許費");
    expect(result[1].section).toBe("pending");
  });

  it("returns an empty array when no block is present", () => {
    expect(parseQuestionsBlock("ただの回答文です。")).toEqual([]);
  });

  it("falls back to null section for an unknown section id (does not throw)", () => {
    const text = "```handover-questions\n- [unknown-id] 何か質問\n```";
    const result = parseQuestionsBlock(text);
    expect(result).toHaveLength(1);
    expect(result[0].section).toBeNull();
  });

  it("silently discards malformed lines instead of throwing", () => {
    const text = "```handover-questions\nこれはただの文章です\n- [budget] 正しい行\n```";
    const result = parseQuestionsBlock(text);
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe("正しい行");
  });
});

describe("stripQuestionsBlock", () => {
  it("removes the fenced block from display text", () => {
    const text = "前任者に確認します。\n\n```handover-questions\n- [budget] 質問\n```";
    expect(stripQuestionsBlock(text)).toBe("前任者に確認します。");
  });

  it("is a no-op when there is no block", () => {
    expect(stripQuestionsBlock("普通の文章")).toBe("普通の文章");
  });
});
