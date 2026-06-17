import { describe, expect, it } from "bun:test";
import {
  canonicalizeBook,
  extractRefs,
  stripUnsanctionedRefs,
  type VerseRef,
} from "../src/lib/bible-refs.server";

describe("canonicalizeBook", () => {
  it("normalizes aliases and spacing to canonical names", () => {
    expect(canonicalizeBook("Psalm")).toBe("Psalms");
    expect(canonicalizeBook("ps")).toBe("Psalms");
    expect(canonicalizeBook("1 Cor")).toBe("1 Corinthians");
    expect(canonicalizeBook("song of songs")).toBe("Song of Solomon");
    expect(canonicalizeBook("Jn")).toBe("John");
  });
  it("returns null for unknown books", () => {
    expect(canonicalizeBook("Gospel of Thomas")).toBeNull();
  });
});

describe("extractRefs", () => {
  it("expands verse ranges", () => {
    const found = extractRefs("See Philippians 4:6-7 for comfort.");
    expect(found).toHaveLength(1);
    expect(found[0].refs).toEqual([
      { book: "Philippians", chapter: 4, verse: 6 },
      { book: "Philippians", chapter: 4, verse: 7 },
    ]);
  });
  it("handles single verses and en-dashes", () => {
    expect(extractRefs("Romans 8:28")[0].refs).toEqual([
      { book: "Romans", chapter: 8, verse: 28 },
    ]);
    expect(extractRefs("Romans 8:28–30")[0].refs).toHaveLength(3);
  });
});

describe("stripUnsanctionedRefs — the trust guardrail", () => {
  const allowed: VerseRef[] = [
    { book: "Philippians", chapter: 4, verse: 6 },
    { book: "Philippians", chapter: 4, verse: 7 },
  ];

  it("keeps references that are in the retrieved set", () => {
    const { clean, stripped } = stripUnsanctionedRefs(
      "Consider Philippians 4:6.",
      allowed,
    );
    expect(stripped).toHaveLength(0);
    expect(clean).toContain("Philippians 4:6");
  });

  it("strips a fabricated reference not in the set", () => {
    const { clean, stripped } = stripUnsanctionedRefs(
      "As John 3:16 says, God loves you.",
      allowed,
    );
    expect(stripped).toContain("John 3:16");
    expect(clean).not.toContain("John 3:16");
    expect(clean).toContain("[reference removed");
  });

  it("strips a range if ANY verse in it is outside the set", () => {
    const { stripped } = stripUnsanctionedRefs(
      "See Philippians 4:6-8 here.",
      allowed,
    );
    expect(stripped).toContain("Philippians 4:6-8");
  });

  it("strips invented references even when a valid one is present", () => {
    const { clean, stripped } = stripUnsanctionedRefs(
      "Philippians 4:6 and also Jeremiah 29:11 encourage us.",
      allowed,
    );
    expect(clean).toContain("Philippians 4:6");
    expect(clean).not.toContain("Jeremiah 29:11");
    expect(stripped).toContain("Jeremiah 29:11");
  });
});
