import { describe, expect, it } from "vitest";
import { amostrar, deBitcoin, deGlobal, deMedo, deMercados, deSolana, fmtGrande, fmtPreco, fmtVar, montarPainel, painelTemDados } from "./mercado";

const moeda = (id: string, symbol: string, preco: number, extra: Record<string, unknown> = {}) => ({ id, symbol, name: id, current_price: preco, market_cap: preco * 1e9, total_volume: 1e8, market_cap_rank: 1, price_change_percentage_24h_in_currency: -3.9, price_change_percentage_7d_in_currency: 1.2, sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => preco + i) }, ...extra });

describe("o mercado ao vivo dos telões", () => {
  it("normaliza as moedas (sem preço fica de fora; a série vira no máximo 56 pontos)", () => {
    const ms = deMercados([moeda("bitcoin", "btc", 81263), { id: "x", symbol: "x", current_price: null }]);
    expect(ms).toHaveLength(1); expect(ms[0]!.simbolo).toBe("BTC"); expect(ms[0]!.serie).toHaveLength(56); expect(ms[0]!.var24h).toBeCloseTo(-3.9);
    expect(deMercados(null)).toEqual([]); expect(amostrar([1, 2, 3])).toEqual([1, 2, 3]);
  });
  it("o painel: sem stablecoins no telão das moedas; a Solana separada dos tokens dela", () => {
    const p = montarPainel({ moedas: [moeda("bitcoin", "btc", 1), moeda("tether", "usdt", 1), moeda("solana", "sol", 103)], solana: [moeda("solana", "sol", 103), moeda("jupiter-exchange-solana", "jup", 0.31)], global: null, medo: null, taxasBtc: null, alturaBtc: null, amostrasSol: null, epocaSol: null }, 5);
    expect(p.moedas.map((m) => m.simbolo)).toEqual(["BTC", "SOL"]); expect(p.solana?.preco).toBe(103); expect(p.tokensSolana.map((m) => m.simbolo)).toEqual(["JUP"]);
    expect(painelTemDados(p)).toBe(true); expect(p.atualizadoEm).toBe(5);
  });
  it("as métricas: global, medo e ganância, Bitcoin e a rede da Solana (TPS sem os votos)", () => {
    expect(deGlobal({ data: { total_market_cap: { usd: 2.7e12 }, total_volume: { usd: 8e10 }, market_cap_percentage: { btc: 59.5, eth: 10.6 }, market_cap_change_percentage_24h_usd: -6.4, active_cryptocurrencies: 22442 } })).toMatchObject({ domBtc: 59.5, moedasAtivas: 22442 });
    expect(deMedo({ data: [{ value: "68", value_classification: "Greed" }] })).toEqual({ valor: 68, rotulo: "GANÂNCIA" });
    expect(deBitcoin({ fastestFee: 3, halfHourFee: 1, hourFee: 1 }, 972664)).toMatchObject({ altura: 972664, taxaRapida: 3 });
    const s = deSolana({ result: [{ numNonVoteTransactions: 99000, numTransactions: 400000, samplePeriodSecs: 60 }, { numNonVoteTransactions: 93000, samplePeriodSecs: 60 }] }, { result: { epoch: 1065, slotIndex: 125104, slotsInEpoch: 432000, absoluteSlot: 460205104, transactionCount: 5.6e11 } })!;
    expect(s.tps).toBeCloseTo(1600); expect(s.progressoEpoca).toBeCloseTo(0.2896, 3); expect(deSolana(null, null)).toBeNull();
  });
  it("a formatação do terminal", () => {
    expect(fmtPreco(81263)).toBe("$81,263"); expect(fmtPreco(1.234)).toBe("$1.23"); expect(fmtPreco(0.0000213)).toBe("$0.00002130");
    expect(fmtGrande(2.74e12)).toBe("$2.74T"); expect(fmtGrande(8.1e10)).toBe("$81.0B"); expect(fmtVar(-3.94)).toBe("▼ -3.94%"); expect(fmtVar(null)).toBe("—");
  });
});
