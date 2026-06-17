import { describe, expect, it } from "bun:test";
import { resolveDark } from "../src/lib/theme";

describe("resolveDark", () => {
  it("resolves explicit choices deterministically", () => {
    expect(resolveDark("light")).toBe(false);
    expect(resolveDark("dark")).toBe(true);
  });
  it("'system' returns a boolean (OS-driven)", () => {
    expect(typeof resolveDark("system")).toBe("boolean");
  });
});
