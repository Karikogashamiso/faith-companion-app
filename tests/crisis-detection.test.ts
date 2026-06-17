import { describe, expect, it } from "bun:test";
import { classifyCrisis } from "../src/lib/crisis-detection.server";

describe("classifyCrisis — safety triage", () => {
  it("flags explicit self-harm/suicide as crisis", () => {
    expect(classifyCrisis("I want to kill myself")).toBe("crisis");
    expect(classifyCrisis("I've been having suicidal thoughts")).toBe("crisis");
    expect(classifyCrisis("thinking about ending my life")).toBe("crisis");
  });

  it("catches INDIRECT / passive ideation (the previous blind spot)", () => {
    expect(classifyCrisis("I just want to disappear")).toBe("crisis");
    expect(classifyCrisis("I can't do this anymore")).toBe("crisis");
    expect(classifyCrisis("everyone would be better off without me")).toBe(
      "crisis",
    );
    expect(classifyCrisis("there's no reason to keep going")).toBe("crisis");
    expect(classifyCrisis("I don't want to wake up")).toBe("crisis");
  });

  it("routes high-stakes life questions to a pastoral handoff", () => {
    expect(classifyCrisis("Should I divorce my husband?")).toBe("pastoral");
    expect(classifyCrisis("I'm grieving the loss of my mother")).toBe(
      "pastoral",
    );
    expect(classifyCrisis("I think I'm losing my faith")).toBe("pastoral");
    expect(classifyCrisis("I just got laid off and I'm scared")).toBe(
      "pastoral",
    );
  });

  it("leaves ordinary study questions unflagged", () => {
    expect(classifyCrisis("What does the Bible say about hope?")).toBe("none");
    expect(classifyCrisis("Who wrote the book of Romans?")).toBe("none");
    expect(classifyCrisis("Explain the parable of the sower")).toBe("none");
  });

  it("prioritizes crisis over pastoral when both could match", () => {
    expect(classifyCrisis("After the divorce I want to die")).toBe("crisis");
  });
});
