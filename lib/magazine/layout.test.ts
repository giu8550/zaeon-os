import { describe, it, expect } from "vitest";
import {
  intervalosLivres, montarLayout, obstaculoCapitular, obstaculoArtefato, topoDaLinha,
  FRESTA_MINIMA, type Metricas, type Obstaculo, type Palavra, type Paragrafo,
} from "./layout";

const M: Metricas = { tamanho: 19, entrelinha: 30, espaco: 5 };
const LARGURA = 900;

/** Palavras de largura fixa: o teste é do POSICIONAMENTO, não da medição. */
function palavras(texto: string, larguraPorLetra = 10, chaves: string[] = []): Palavra[] {
  let gi = 0;
  return texto.split(" ").map((t) => {
    const gi0 = gi;
    const chars = t.split("").map((ch, k) => ({ ch, dx: k * larguraPorLetra, gi: gi0 + k }));
    gi += t.length + 1;
    return { texto: t, largura: t.length * larguraPorLetra, chave: chaves.includes(t) ? t : null, gi0, chars };
  });
}
const par = (texto: string, completo = true, chaves: string[] = []): Paragrafo =>
  ({ palavras: palavras(texto, 10, chaves), completo });

describe("intervalos livres", () => {
  it("sem obstáculo, a linha inteira é livre", () => {
    expect(intervalosLivres(0, 30, [], LARGURA)).toEqual([[0, LARGURA]]);
  });

  it("círculo abre dois intervalos quando está no meio", () => {
    const o: Obstaculo = { tipo: "circulo", cx: 450, cy: 100, r: 100 };
    const ivs = intervalosLivres(90, 30, [o], LARGURA);
    expect(ivs.length).toBe(2);
    expect(ivs[0][0]).toBe(0);
    expect(ivs[1][1]).toBe(LARGURA);
    // na altura do centro o corte é o diâmetro inteiro
    expect(ivs[1][0] - ivs[0][1]).toBeCloseTo(200, 0);
  });

  it("a mordida do círculo encolhe conforme a linha se afasta do centro", () => {
    const o: Obstaculo = { tipo: "circulo", cx: 450, cy: 100, r: 100 };
    const meio = intervalosLivres(90, 30, [o], LARGURA);
    const borda = intervalosLivres(170, 30, [o], LARGURA);
    const largMeio = meio[1][0] - meio[0][1];
    const largBorda = borda.length === 2 ? borda[1][0] - borda[0][1] : 0;
    expect(largBorda).toBeLessThan(largMeio);
  });

  it("linha que não cruza o círculo fica inteira", () => {
    const o: Obstaculo = { tipo: "circulo", cx: 450, cy: 100, r: 100 };
    expect(intervalosLivres(400, 30, [o], LARGURA)).toEqual([[0, LARGURA]]);
  });

  it("obstáculos que se sobrepõem viram um corte só", () => {
    const obs: Obstaculo[] = [
      { tipo: "retangulo", x: 100, y: 0, w: 200, h: 50 },
      { tipo: "retangulo", x: 250, y: 0, w: 200, h: 50 },
    ];
    expect(intervalosLivres(0, 30, obs, LARGURA)).toEqual([[0, 100], [450, LARGURA]]);
  });

  it("descarta fresta estreita demais (texto em 3 letras parece bug)", () => {
    const obs: Obstaculo[] = [{ tipo: "retangulo", x: 40, y: 0, w: 800, h: 50 }];
    const semFiltro = intervalosLivres(0, 30, obs, LARGURA, 0);
    const comFiltro = intervalosLivres(0, 30, obs, LARGURA, FRESTA_MINIMA(M.tamanho));
    expect(semFiltro.length).toBe(2);              // [0,40] e [840,900]
    expect(comFiltro.length).toBe(0);              // 40 e 60 < 76
  });

  it("retângulo respeita o pad nas bordas", () => {
    const obs: Obstaculo[] = [{ tipo: "retangulo", x: 300, y: 0, w: 100, h: 50, pad: 10 }];
    expect(intervalosLivres(0, 30, obs, LARGURA)).toEqual([[0, 290], [410, LARGURA]]);
  });
});

describe("montagem do parágrafo", () => {
  it("quebra em linhas e cresce em múltiplos da entrelinha", () => {
    const r = montarLayout([par("um dois tres quatro cinco seis sete oito nove dez onze doze")], [], 300, M);
    expect(r.linhas).toBeGreaterThan(1);
    expect(r.glifos.length).toBeGreaterThan(0);
    // altura = linhas * entrelinha + respiro
    expect(r.altura).toBe(r.linhas * M.entrelinha + Math.round(M.entrelinha * 0.55));
  });

  it("nenhum glifo invade o círculo do artefato", () => {
    const art = obstaculoArtefato(450, 150, 120, M);
    const texto = Array.from({ length: 120 }, (_, i) => `palavra${i % 7}`).join(" ");
    const r = montarLayout([par(texto)], [art], LARGURA, M);
    const c = art as Extract<Obstaculo, { tipo: "circulo" }>;
    for (const g of r.glifos) {
      // a faixa vem do próprio motor: refazer a conta aqui já custou um falso alarme
      const topo = topoDaLinha(g.y, M);
      if (topo + M.entrelinha < c.cy - c.r || topo > c.cy + c.r) continue;
      const d = Math.abs(Math.max(topo, Math.min(c.cy, topo + M.entrelinha)) - c.cy);
      const meia = Math.sqrt(Math.max(0, c.r * c.r - d * d));
      const dentro = g.x > c.cx - meia && g.x < c.cx + meia;
      expect(dentro).toBe(false);
    }
  });

  it("a capitular empurra as 3 primeiras linhas", () => {
    const cap = obstaculoCapitular(60, M);
    const texto = Array.from({ length: 60 }, () => "palavra").join(" ");
    const r = montarLayout([par(texto)], [cap], LARGURA, M);
    const primeira = r.glifos.filter((g) => g.y < M.entrelinha);
    expect(primeira.every((g) => g.x >= 60)).toBe(true);
    // depois da 3ª linha o texto volta pra margem
    const quarta = r.glifos.filter((g) => g.y > M.entrelinha * 3 && g.y < M.entrelinha * 4);
    expect(Math.min(...quarta.map((g) => g.x))).toBeLessThan(60);
  });

  it("marca só as palavras que são conceito, ancorada na última letra", () => {
    const r = montarLayout([par("o cafe tem cafeina de sobra", true, ["cafeina"])], [], LARGURA, M);
    expect(r.marcas.length).toBe(1);
    expect(r.marcas[0].chave).toBe("cafeina");
    const p = palavras("o cafe tem cafeina de sobra").find((w) => w.texto === "cafeina")!;
    expect(r.marcas[0].gi).toBe(p.gi0 + "cafeina".length - 1);
  });
});

describe("estabilidade por prefixo (o que sustenta o streaming)", () => {
  const TEXTO = "a cafeina bloqueia os receptores de adenosina no cerebro e esconde o cansaco acumulado do dia inteiro sem repor nada";
  const todas = palavras(TEXTO);
  const art = obstaculoArtefato(450, 150, 120, M);

  /** Só os glifos das linhas JÁ FECHADAS (todas menos a última). */
  function linhasFechadas(res: ReturnType<typeof montarLayout>) {
    const ultima = Math.max(...res.glifos.map((g) => g.y));
    return res.glifos.filter((g) => g.y < ultima).map((g) => `${g.gi}@${g.x.toFixed(2)},${g.y}`);
  }

  it("acrescentar palavras não mexe nas linhas já fechadas", () => {
    let anterior: string[] = [];
    for (let n = 6; n <= todas.length; n++) {
      const res = montarLayout(
        [{ palavras: todas.slice(0, n), completo: false }],
        [art], LARGURA, M,
      );
      const fechadas = linhasFechadas(res);
      // tudo que já estava fechado no passo anterior continua idêntico
      expect(fechadas.slice(0, anterior.length)).toEqual(anterior);
      anterior = fechadas;
    }
  });

  it("parágrafo incompleto não justifica a última linha (senão ela dança)", () => {
    const parcial = montarLayout([{ palavras: todas.slice(0, 9), completo: false }], [], 400, M);
    const ultimaY = Math.max(...parcial.glifos.map((g) => g.y));
    const naUltima = parcial.glifos.filter((g) => g.y === ultimaY);
    // sem justificação, a última linha termina antes da margem direita
    expect(Math.max(...naUltima.map((g) => g.x))).toBeLessThan(400);
  });

  it("a altura só cresce, nunca encolhe, conforme o texto chega", () => {
    let anterior = 0;
    for (let n = 4; n <= todas.length; n += 4) {
      const res = montarLayout([{ palavras: todas.slice(0, n), completo: false }], [art], LARGURA, M);
      expect(res.altura).toBeGreaterThanOrEqual(anterior);
      anterior = res.altura;
    }
  });
});
