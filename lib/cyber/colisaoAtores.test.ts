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

describe("atoresEmpurram — parado ninguém me arrasta (bug do tablet, out/2026)", () => {
  it("a regra", async () => {
    const { atoresEmpurram } = await import("./colisaoAtores");
    expect(atoresEmpurram({ andando: true, tablet: false, descansando: false })).toBe(true);
    expect(atoresEmpurram({ andando: false, tablet: false, descansando: false })).toBe(false);
    expect(atoresEmpurram({ andando: true, tablet: true, descansando: false })).toBe(false);
    expect(atoresEmpurram({ andando: true, tablet: false, descansando: true })).toBe(false);
  });

  it("simulação: uma IA atravessa o lugar do avatar parado no tablet — antes ele saía arrastado; agora fica e ela contorna", async () => {
    const { atoresEmpurram, colisoresDeCorpos, desviar, empurrao, ENTRE_CORPOS } = await import("./colisaoAtores");
    const { empurrarParaFora } = await import("./colisao");
    const rodar = (regraNova: boolean) => {
      let eu = { x: 0, z: 0.1 }, desvio = { x: 0, z: 0 }, minDist = Infinity;
      const dt = 1 / 60;
      for (let i = 0; i <= 240; i++) {                       // 4 s: o roteiro da IA vai de x=-4 a x=+4 passando por mim
        const rota = { x: -4 + (8 * i) / 240, z: 0 };
        desvio = desviar(desvio, empurrao(rota, [eu]), dt);  // a IA desvia de mim (como na FrotaIA)
        const ia = { x: rota.x + desvio.x, z: rota.z + desvio.z };
        const empurra = regraNova ? atoresEmpurram({ andando: false, tablet: true, descansando: false }) : true;
        if (empurra) eu = empurrarParaFora(eu, colisoresDeCorpos([{ ...ia, y: 0 }], 0));
        minDist = Math.min(minDist, Math.hypot(ia.x - eu.x, ia.z - eu.z));
      }
      return { deslocamento: Math.hypot(eu.x, eu.z - 0.1), minDist };
    };
    const antes = rodar(false), depois = rodar(true);
    expect(antes.deslocamento).toBeGreaterThan(0.3);          // o bug: arrastado pela IA
    expect(depois.deslocamento).toBe(0);                      // agora: não sai do lugar
    expect(depois.minDist).toBeGreaterThan(ENTRE_CORPOS * 0.5); // e a IA contorna (não atravessa o corpo)
  });
});
