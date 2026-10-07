import { describe, it, expect } from "vitest";
import { mascaraDeEdicao, colarComMascara, mapaDiferenca } from "./mascara";

const W = 64, H = 64, N = W * H;
const imagem = (cor: number) => new Uint8Array(N * 3).fill(cor);

describe("avatares · máscara de diferença", () => {
  it("mudança real (bloco 10×10) entra; ruído fino de 1px some na erosão", () => {
    const base = imagem(100);
    const ed = imagem(100);
    for (let y = 20; y < 30; y++) for (let x = 20; x < 30; x++) ed.fill(250, (y * W + x) * 3, (y * W + x) * 3 + 3);
    for (let x = 0; x < W; x++) ed.fill(200, (50 * W + x) * 3, (50 * W + x) * 3 + 3); // linha de 1px = ruído
    const { alfa, fracao } = mascaraDeEdicao(base, ed, W, H, 3, { dilatacao: 3, suavizacao: 1 });
    expect(fracao).toBeGreaterThan(0.01);
    expect(fracao).toBeLessThan(10 * 10 / N + 0.001);
    expect(alfa[25 * W + 25]).toBe(255); // centro do bloco
    expect(alfa[50 * W + 5]).toBe(0);    // a linha de ruído não passa
  });
  it("fora da máscara o pixel é o da base (troca de quadro não treme)", () => {
    const base = imagem(10), ed = imagem(200);
    const alfa = new Uint8Array(N); alfa[0] = 255;
    const out = colarComMascara(base, ed, alfa, N);
    expect(Array.from(out.slice(0, 3))).toEqual([200, 200, 200]);
    expect(Array.from(out.slice(3, 6))).toEqual([10, 10, 10]);
  });
  it("diferença satura em 255", () => {
    expect(mapaDiferenca(imagem(0), imagem(255), N)[0]).toBe(255);
  });
});
