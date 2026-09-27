import { describe, it, expect } from "vitest";
import {
  agendarChegada, chegadaInstantanea,
  DURACAO_CHEGADA, DURACAO_LETRA, PASSO_MAXIMO, RESPIRO_FINAL,
} from "./chegada";

const novo = (n: number) => new Float64Array(n).fill(-1);
const pendentes = (a: Float64Array) => [...a].filter((t) => t < 0).length;

describe("agendarChegada · a materialização das letras", () => {
  it("dá hora a todas as letras e devolve quando o texto estará inteiro", () => {
    const nasc = novo(800);
    const fim = agendarChegada(nasc, 1000);
    expect(pendentes(nasc)).toBe(0);
    expect(fim).toBeGreaterThan(DURACAO_LETRA);
  });

  it("resposta curta e resposta longa levam ~o mesmo tempo", () => {
    // O bug era este: com piso de 2ms por letra, 3200 grafemas viravam 6,4s.
    const curta = agendarChegada(novo(320), 0);
    const longa = agendarChegada(novo(3200), 0);
    expect(Math.abs(curta - longa)).toBeLessThan(1200);
    expect(longa).toBeLessThan(DURACAO_CHEGADA + DURACAO_LETRA + RESPIRO_FINAL + 200);
  });

  it("resposta muito curta não arrasta: respeita o teto por letra", () => {
    const n = 40;
    expect(agendarChegada(novo(n), 0)).toBeCloseTo((n - 1) * PASSO_MAXIMO + DURACAO_LETRA + RESPIRO_FINAL, 5);
  });

  it("nasce em ordem, e a primeira nasce AGORA", () => {
    const nasc = novo(50);
    agendarChegada(nasc, 500);
    expect(nasc[0]).toBe(500);
    for (let i = 1; i < nasc.length; i++) expect(nasc[i]).toBeGreaterThanOrEqual(nasc[i - 1]);
  });

  it("REAGENDA quando nenhuma letra está por nascer (recálculo no meio da animação)", () => {
    // A molécula monta no 3Dmol → o container muda de largura → o efeito reexecuta.
    // Sem isto, o cleanup do React mata o timer e `assentado` nunca vira true: o canvas
    // fica pra sempre no lugar do DOM e o texto nunca vira selecionável.
    const nasc = novo(800);
    agendarChegada(nasc, 0);
    const ultima = Math.max(...nasc);
    const fim = agendarChegada(nasc, 900);       // segunda passada, nada por nascer
    expect(fim).toBeGreaterThan(0);
    expect(900 + fim).toBeCloseTo(ultima + DURACAO_LETRA + RESPIRO_FINAL, 5);
  });

  it("recálculo TARDIO (tudo já pousado) assenta quase na hora, não no futuro", () => {
    const nasc = novo(300);
    agendarChegada(nasc, 0);
    const fim = agendarChegada(nasc, 60_000);
    expect(fim).toBe(DURACAO_LETRA + RESPIRO_FINAL);
  });

  it("não remarca quem já tem hora (stream: só as letras novas entram escalonadas)", () => {
    const nasc = novo(10);
    agendarChegada(nasc, 100);
    const antes = [...nasc];
    const cresceu = new Float64Array(20).fill(-1);
    cresceu.set(nasc);
    agendarChegada(cresceu, 5000);
    expect([...cresceu.subarray(0, 10)]).toEqual(antes);
    expect(pendentes(cresceu)).toBe(0);
    expect(cresceu[10]).toBe(5000);
  });

  it("vetor vazio não explode", () => {
    expect(agendarChegada(novo(0), 42)).toBe(DURACAO_LETRA + RESPIRO_FINAL);
  });
});

describe("chegadaInstantanea · histórico e reduced-motion", () => {
  it("acende tudo em 0, sem tocar em quem já tinha hora", () => {
    const nasc = new Float64Array([-1, 700, -1]);
    chegadaInstantanea(nasc);
    expect([...nasc]).toEqual([0, 700, 0]);
  });
});
