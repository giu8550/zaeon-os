import { describe, it, expect } from "vitest";
import { LEVELS, LEVEL_META, isLevel } from "./levels";

describe("levels", () => {
  it("has exactly the 4 academic levels", () => {
    expect(LEVELS).toEqual(["grad", "msc", "phd", "postdoc"]);
  });
  it("has metadata for every level", () => {
    for (const l of LEVELS) {
      expect(LEVEL_META[l].id).toBe(l);
      expect(LEVEL_META[l].name.length).toBeGreaterThan(0);
      expect(LEVEL_META[l].programLabel.length).toBeGreaterThan(0);
    }
  });
  it("isLevel narrows valid/invalid strings", () => {
    expect(isLevel("phd")).toBe(true);
    expect(isLevel("bsc")).toBe(false);
  });
});
