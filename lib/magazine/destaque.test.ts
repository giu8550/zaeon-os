import { describe, it, expect } from "vitest";
import { posicionarDestaques, FRACAO_FAIXA, FOLGA_DESTAQUE } from "./destaque";
import type { DestaqueMedido } from "./destaque";

const med = (largura: number, altura = 60): DestaqueMedido =>
  ({ latex: "x", html: "<i>x</i>", largura, altura });

const COLUNA = 800;
const ENTRELINHA = 30;

describe("posicionarDestaques · lateral ou faixa", () => {
  it("estreito vira figura lateral e alterna o lado", () => {
    const p = posicionarDestaques([med(200), med(200), med(200)], COLUNA, ENTRELINHA);
    expect(p[0].x).toBe(COLUNA - 200); // direita
    expect(p[1].x).toBe(0);            // esquerda
    expect(p[2].x).toBe(COLUNA - 200); // direita de novo
    for (const c of p) expect(c.w).toBe(200);
  });

  it("largo demais vira faixa de coluna inteira", () => {
    const largo = Math.ceil(COLUNA * FRACAO_FAIXA) + 1;
    const [c] = posicionarDestaques([med(largo)], COLUNA, ENTRELINHA);
    expect(c.x).toBe(0);
    expect(c.w).toBe(COLUNA);
  });

  it("a faixa não consome a vez do lado — o lateral seguinte ainda começa pela direita", () => {
    // Era a armadilha do índice: alternar por `i` fazia uma faixa no meio inverter
    // todos os laterais depois dela sem motivo nenhum.
    const p = posicionarDestaques([med(COLUNA), med(120)], COLUNA, ENTRELINHA);
    expect(p[0].w).toBe(COLUNA);
    expect(p[1].x).toBe(COLUNA - 120);
  });

  it("no telefone quase toda fórmula vira faixa — é o que salva a coluna", () => {
    const telefone = 340;
    const [c] = posicionarDestaques([med(180)], telefone, ENTRELINHA);
    expect(c.w).toBe(telefone);
    expect(c.x).toBe(0);
  });

  it("desce na página conforme a ordem, sem dois na mesma faixa", () => {
    const p = posicionarDestaques([med(120), med(120), med(120)], COLUNA, ENTRELINHA);
    expect(p[0].y).toBeLessThan(p[1].y);
    expect(p[1].y).toBeLessThan(p[2].y);
    expect(p[1].y - p[0].y).toBeGreaterThan(p[0].h);
  });

  it("a altura medida é a que vai virar buraco (a folga entra no obstáculo, não aqui)", () => {
    const [c] = posicionarDestaques([med(120, 97)], COLUNA, ENTRELINHA);
    expect(c.h).toBe(97);
    expect(FOLGA_DESTAQUE).toBeGreaterThan(0);
  });
});
