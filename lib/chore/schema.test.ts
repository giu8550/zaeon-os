import { describe, it, expect } from "vitest";
import { validarContraSchema, podar, type SchemaMin } from "./schema";

const s: SchemaMin = { type: "object", required: ["classe"], properties: { classe: { type: "string", enum: ["a", "b"] }, nota: { type: "string", maxLength: 3 } } };
describe("validarContraSchema (mínimo)", () => {
  it("type, required, enum, maxLength", () => {
    expect(validarContraSchema({ classe: "a" }, s)).toEqual({ ok: true });
    expect(validarContraSchema({}, s).ok).toBe(false);
    expect(validarContraSchema({ classe: "z" }, s).ok).toBe(false);
    expect(validarContraSchema({ classe: "a", nota: "longa" }, s).ok).toBe(false);
    expect(validarContraSchema("x", s).ok).toBe(false);
    expect(validarContraSchema([1, 2], { type: "array", maxLength: 1 }).ok).toBe(false);
  });
  it("podar descarta campos extras da saída do modelo", () => {
    expect(podar({ classe: "a", destino: "outro" } as any, s)).toEqual({ classe: "a" });
  });
});
