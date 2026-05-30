import { describe, it, expect } from "vitest";
import { generateCode, validateCodeFormat, CHARSET } from "./invite-codes";

describe("generateCode", () => {
  it("returns a string matching XXXX-XXXX format", () => {
    const code = generateCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("never contains ambiguous chars 0 O 1 I", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateCode();
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it("generates unique codes across 1000 runs", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateCode));
    expect(codes.size).toBe(1000);
  });
});

describe("validateCodeFormat", () => {
  it("accepts valid codes", () => {
    expect(validateCodeFormat("ZA3K-X9QM")).toBe(true);
    expect(validateCodeFormat("ABCD-2345")).toBe(true);
  });

  it("rejects lowercase", () => {
    expect(validateCodeFormat("za3k-x9qm")).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(validateCodeFormat("ZA3-X9QM")).toBe(false);
    expect(validateCodeFormat("ZA3KX-X9QM")).toBe(false);
  });

  it("rejects missing dash", () => {
    expect(validateCodeFormat("ZA3KX9QM")).toBe(false);
  });

  it("rejects ambiguous chars", () => {
    expect(validateCodeFormat("ZA3K-X9Q0")).toBe(false);
    expect(validateCodeFormat("ZA3K-X9QO")).toBe(false);
  });
});

describe("CHARSET", () => {
  it("has 32 characters", () => {
    expect(CHARSET.length).toBe(32);
  });

  it("excludes 0 O 1 I", () => {
    expect(CHARSET).not.toContain("0");
    expect(CHARSET).not.toContain("O");
    expect(CHARSET).not.toContain("1");
    expect(CHARSET).not.toContain("I");
  });
});
