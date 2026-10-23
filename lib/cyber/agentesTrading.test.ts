import { describe, expect, it } from "vitest";
import { AGENTES_TRADING, contextoDoMercado, falaDeReserva, normalizarResposta, promptDoAgente } from "./agentesTrading";
import { ESTACOES_TI } from "./temploCosmico";
import { CORPOS_VRM } from "./estiloAvatar";
import { montarPainel } from "./mercado";

const moeda = (id: string, symbol: string, preco: number) => ({ id, symbol, name: id, current_price: preco, market_cap: preco * 1e9, total_volume: 1e8, market_cap_rank: 1, price_change_percentage_24h_in_currency: -3.9, price_change_percentage_7d_in_currency: 1.2 });
const painel = montarPainel({ moedas: [moeda("bitcoin", "btc", 81263), moeda("ethereum", "eth", 2393)], solana: [moeda("solana", "sol", 104.02), moeda("jupiter-exchange-solana", "jup", 0.31)], global: { data: { total_market_cap: { usd: 2.7e12 }, total_volume: { usd: 8e10 }, market_cap_percentage: { btc: 59.5, eth: 10.6 }, market_cap_change_percentage_24h_usd: -6.4 } }, medo: { data: [{ value: "60", value_classification: "Greed" }] }, taxasBtc: null, alturaBtc: null, amostrasSol: null, epocaSol: null }, 1_800_000_000_000);

describe("os agentes de trading da mesa de operações", () => {
  it("um agente por terminal, ids únicos, 4 por mesa, skins comuns que existem", () => {
    expect(AGENTES_TRADING).toHaveLength(ESTACOES_TI.length);
    expect(new Set(AGENTES_TRADING.map((a) => a.id)).size).toBe(AGENTES_TRADING.length);
    AGENTES_TRADING.forEach((a, k) => { expect(a.mesa).toBe(ESTACOES_TI[k]!.telao); expect(CORPOS_VRM[a.skin]).toBeTruthy(); expect(a.id.startsWith("trader-")).toBe(true); });
  });
  it("o prompt leva o papel, o mercado ao vivo (só os números do painel) e a conversa", () => {
    const a = AGENTES_TRADING[0]!, p = promptDoAgente(a, painel, "Compraria SOL?", [{ de: "eu", texto: "oi" }, { de: "agente", texto: "olá" }]);
    expect(p.system).toContain(a.papel); expect(p.system).toContain("JSON");
    expect(p.user).toContain("SOL: $104.02"); expect(p.user).toContain("Medo e ganância: 60"); expect(p.user).toContain("Pessoa: oi"); expect(p.user).toContain("Compraria SOL?");
    expect(contextoDoMercado(null, ["SOL"])).toContain("sem dados");
  });
  it("os indicadores da série de 7 dias (RSI, média, máxima, mínima)", async () => {
    const { indicadores } = await import("./agentesTrading");
    expect(indicadores([1, 2, 3])).toBeNull();
    const sobe = indicadores(Array.from({ length: 20 }, (_, i) => 100 + i))!; expect(sobe.rsi).toBe(100); expect(sobe.posicao).toBe(1); expect(sobe.max).toBe(119);
    const z = indicadores(Array.from({ length: 20 }, (_, i) => 100 + (i % 2 ? 1 : -1)))!; expect(z.rsi).toBeGreaterThan(40); expect(z.rsi).toBeLessThan(60);
  });
  it("a resposta: a fala e o sinal validados; lixo cai; a reserva usa o painel", () => {
    expect(normalizarResposta({ fala: " Leitura de alta. ", sinal: { ativo: "sol", acao: "comprar", confianca: 1.7, horizonte: "dias" } })).toEqual({ fala: "Leitura de alta.", sinal: { ativo: "SOL", acao: "comprar", confianca: 1, horizonte: "dias" } });
    expect(normalizarResposta({ fala: "ok", sinal: { ativo: "SOL", acao: "all-in" } })!.sinal).toBeNull();
    expect(normalizarResposta({ sinal: null })).toBeNull(); expect(normalizarResposta(null)).toBeNull();
    expect(falaDeReserva(AGENTES_TRADING[0]!, painel).fala).toContain("SOL a $104.02");
  });
});
