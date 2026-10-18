import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { POSES_VRM, POSE_FEMININA, POSE_FEMININA_A_VONTADE, respiracao } from "./posesVrm";
import { CORPOS_VRM } from "./estiloAvatar";

describe("poses e corpos VRM dos personagens", () => {
  it("a pose feminina é simétrica nos braços e baixa os dois (sem a pose T)", () => {
    const o = POSE_FEMININA.ossos;
    expect(o.leftUpperArm![2]).toBeLessThan(-0.8); expect(o.rightUpperArm![2]).toBeGreaterThan(0.8);
    expect(o.leftUpperArm![2]).toBeCloseTo(-o.rightUpperArm![2]);
    expect(o.leftLowerArm![1]).toBeCloseTo(-o.rightLowerArm![1]);
    expect(o.leftLowerLeg![0]).toBeGreaterThan(0);   // um joelho dobrado (contrapposto)
  });
  it("a pose à vontade das jogadoras: os dois braços soltos e IGUAIS (espelhados), um joelho dobrado, a cabeça inclinada", () => {
    const o = POSE_FEMININA_A_VONTADE.ossos;
    expect(o.leftUpperArm![2]).toBeLessThan(-1); expect(o.rightUpperArm![2]).toBeCloseTo(-o.leftUpperArm![2]);
    expect(o.rightUpperArm![1]).toBeCloseTo(-o.leftUpperArm![1]); expect(o.rightLowerArm![1]).toBeCloseTo(-o.leftLowerArm![1]);
    expect(o.leftLowerLeg![0]).toBeGreaterThan(0.3); expect(o.head![2]).toBeGreaterThan(0);
  });
  it("a respiração oscila dentro da amplitude", () => {
    const amp = POSE_FEMININA.respira!.amp, vals = Array.from({ length: 50 }, (_, i) => respiracao(POSE_FEMININA, i * 0.37));
    expect(Math.max(...vals)).toBeLessThanOrEqual(amp + 1e-9); expect(Math.min(...vals)).toBeGreaterThanOrEqual(-amp - 1e-9);
    expect(respiracao({ ossos: {} }, 3)).toBe(0);
  });
  it("cada corpo de personagem aponta pra um VRM que existe e pra uma pose que existe", () => {
    for (const [id, c] of Object.entries(CORPOS_VRM)) {
      expect(existsSync(join(process.cwd(), "public", c.url)), id).toBe(true);
      if (c.pose) expect(POSES_VRM[c.pose]).toBeDefined();
    }
  });
});
