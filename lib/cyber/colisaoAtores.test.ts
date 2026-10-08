import { describe, expect, it } from "vitest";
import { ENTRE_CORPOS, colisoresDeCorpos, desviar, empurrao } from "./colisaoAtores";
import { empurrarParaFora } from "./colisao";

describe("colisão entre avatares", () => {
  it("o meu avatar não entra no corpo de outro (no mesmo nível); noutro andar, passa", () => {
    const outros = [{ x: 0, z: 0, y: 450 }, { x: 5, z: 0, y: 538 }], cs = colisoresDeCorpos(outros, 450);
    expect(cs).toHaveLength(1);
    const q = empurrarParaFora({ x: 0.2, z: 0 }, cs); expect(Math.hypot(q.x, q.z)).toBeGreaterThanOrEqual(ENTRE_CORPOS - 1e-6);
  });
  it("quem anda em roteiro desvia de quem está no caminho e volta suave pro roteiro", () => {
    const e = empurrao({ x: 0.3, z: 0 }, [{ x: 0, z: 0 }]); expect(e.x).toBeCloseTo(ENTRE_CORPOS - 0.3, 6);
    expect(empurrao({ x: 3, z: 0 }, [{ x: 0, z: 0 }])).toEqual({ x: 0, z: 0 });
    let d = { x: 0, z: 0 }; for (let i = 0; i < 30; i++) d = desviar(d, e, 1 / 60); expect(d.x).toBeGreaterThan(e.x * 0.9);
    for (let i = 0; i < 300; i++) d = desviar(d, { x: 0, z: 0 }, 1 / 60); expect(Math.abs(d.x)).toBeLessThan(0.01);
  });
});
