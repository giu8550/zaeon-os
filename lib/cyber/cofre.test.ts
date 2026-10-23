import { describe, expect, it } from "vitest";
import { CONFIG_COFRE_PADRAO, executar, horaDaRodada, memoDaOperacao, normalizarOrdens, promptDaRodada, reconciliar, sanitizarConfig, valorDoFundo } from "./cofre";

const precos = { solana: { usd: 100, var24h: -2 }, "jupiter-exchange-solana": { usd: 0.5, var24h: 3 }, bonk: { usd: 0.00002, var24h: 1 } };

describe("o cofre: o fundo privado que os agentes operam", () => {
  it("a configuração é da pessoa: sem teto da plataforma (até 100% por operação), moedas e mesa válidas", () => {
    const c = sanitizarConfig({ ligado: true, fracaoPorOperacao: 1, ordensPorRodada: 50, intervaloMin: -5, ativos: ["JUP", "XYZ", "JUP"], mesa: ["trader-sol", "fantasma"] });
    expect(c).toEqual({ ligado: true, fracaoPorOperacao: 1, ordensPorRodada: 10, intervaloMin: 0, ativos: ["JUP"], mesa: ["trader-sol"] });
    expect(sanitizarConfig(null)).toEqual(CONFIG_COFRE_PADRAO); expect(sanitizarConfig({ ativos: [] }).ativos).toBe("todas");
  });
  it("o livro: depósito e saque de fora entram no caixa (SOL); o valor e os pesos", () => {
    const r = reconciliar({ JUP: 100 }, 0, 2); expect(r).toEqual({ posicoes: { JUP: 100, SOL: 2 }, delta: 2 });
    expect(reconciliar({ SOL: 2 }, 2, 0.5).posicoes).toEqual({ SOL: 0.5 }); expect(reconciliar({ SOL: 1 }, 1, 0).posicoes).toEqual({});
    const v = valorDoFundo({ SOL: 2, JUP: 200 }, precos); expect(v.total).toBe(300); expect(v.linhas[0]).toMatchObject({ simbolo: "SOL", valor: 200 }); expect(v.linhas[1]!.peso).toBeCloseTo(1 / 3);
  });
  it("as ordens da IA: só moeda permitida com preço, nunca acima da fração que a pessoa deixou, no máximo N", () => {
    const c = sanitizarConfig({ fracaoPorOperacao: 0.2, ordensPorRodada: 2, ativos: ["JUP", "BONK"] });
    const r = normalizarOrdens({ resumo: "ok", ordens: [{ ativo: "jup", acao: "comprar", fracao: 0.9, motivo: "rompeu", agente: "trader-sol" }, { ativo: "WIF", acao: "comprar", fracao: 0.1 }, { ativo: "SOL", acao: "vender", fracao: 0.1 }, { ativo: "BONK", acao: "segurar", fracao: 0.1 }, { ativo: "BONK", acao: "comprar", fracao: 0.1, agente: "intruso" }, { ativo: "JUP", acao: "vender", fracao: 0.1 }] }, c, precos);
    expect(r.ordens).toEqual([{ ativo: "JUP", acao: "comprar", fracao: 0.2, motivo: "rompeu", agenteId: "trader-sol" }, { ativo: "BONK", acao: "comprar", fracao: 0.1, motivo: "", agenteId: c.mesa[0] }]);
    expect(normalizarOrdens(null, c, precos)).toEqual({ resumo: "", ordens: [] });
  });
  it("a execução aos preços de agora: compra usa o caixa, venda devolve; sem caixa/posição não executa", () => {
    const comp = executar({ SOL: 2 }, { ativo: "JUP", acao: "comprar", fracao: 0.25, motivo: "", agenteId: "trader-sol" }, precos)!;
    expect(comp.exec).toMatchObject({ tipo: "compra", ativo: "JUP", quantidade: 100, valorUsd: 50 }); expect(comp.posicoes).toEqual({ SOL: 1.5, JUP: 100 });
    const vend = executar(comp.posicoes, { ativo: "JUP", acao: "vender", fracao: 0.5, motivo: "", agenteId: "trader-risco" }, precos)!;
    expect(vend.posicoes.JUP).toBe(50); expect(vend.posicoes.SOL).toBeCloseTo(1.75);
    expect(executar({ JUP: 10 }, { ativo: "BONK", acao: "comprar", fracao: 1, motivo: "", agenteId: "x" }, precos)).toBeNull();   // (sem caixa)
    expect(executar({ SOL: 1 }, { ativo: "BONK", acao: "vender", fracao: 1, motivo: "", agenteId: "x" }, precos)).toBeNull();   // (sem posição)
  });
  it("o prompt leva as regras DA PESSOA e o fundo; o memo cabe numa transação; a hora da rodada", () => {
    const c = sanitizarConfig({ fracaoPorOperacao: 0.3, ativos: ["JUP"] }), p = promptDaRodada(c, { SOL: 2 }, precos, null);
    expect(p.system).toContain("30%"); expect(p.system).toContain("JUP"); expect(p.user).toContain("total US$ 200.00");
    expect(memoDaOperacao({ tipo: "compra", ativo: "JUP", quantidade: 100, preco: 0.5, agenteId: "trader-sol" })).toBe("ZAEON-COFRE v1|compra|JUP|100.00000|0.50000000|trader-sol");
    const lig = sanitizarConfig({ ligado: true, intervaloMin: 30 });
    expect(horaDaRodada(lig, null)).toBe(true); expect(horaDaRodada(lig, new Date(Date.now() - 10 * 60_000))).toBe(false); expect(horaDaRodada({ ...lig, ligado: false }, null)).toBe(false);
  });
});
