import { describe, it, expect } from "vitest";
import { buildValidationError } from "./validate";

describe("buildValidationError", () => {
  it("returns null for a valid code shape", () => {
    expect(buildValidationError("ZA3K-X9QM")).toBeNull();
  });

  it("returns error for empty code", () => {
    expect(buildValidationError("")).toMatch(/código/i);
  });

  it("returns error for code with wrong format", () => {
    expect(buildValidationError("badformat")).toMatch(/formato/i);
  });

  it("normalises lowercase to uppercase before validating", () => {
    expect(buildValidationError("abcd-ef23")).toBeNull();
  });
});
