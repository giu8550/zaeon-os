import { describe, expect, it } from "vitest";
import { MINT_SOL, deSimplePrice, enderecoValido, fmtQuantidade, linkDeTroca, moedaAura, moedasDaCarteira, saldosDosTokens, solDoSaldo, totalEmDolar } from "./carteira";

const conta = (mint: string, ui: number) => ({ account: { data: { parsed: { info: { mint, tokenAmount: { uiAmount: ui } } } } } });
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", JUP = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", ESTRANHO = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

describe("a carteira no inventário", () => {
  it("lê o SOL (lamports) e soma as contas de token do mesmo mint (zeradas ficam de fora)", () => {
    expect(solDoSaldo({ result: { value: 12_400_000_000 } })).toBeCloseTo(12.4); expect(solDoSaldo(null)).toBeNull();
    const s = saldosDosTokens({ result: { value: [conta(USDC, 400), conta(USDC, 250), conta(JUP, 0)] } }, { result: { value: [conta(ESTRANHO, 3)] } });
    expect(s).toEqual([{ mint: USDC, quantidade: 650 }, { mint: ESTRANHO, quantidade: 3 }]);
  });
  it("as moedas com valor: estável vale US$ 1, o SOL pelo preço, desconhecido sem preço e no fim", () => {
    const p = deSimplePrice({ solana: { usd: 103.3, usd_24h_change: -3.2 }, "jupiter-exchange-solana": { usd: 0.31 }, quebrado: { usd: "x" } });
    expect(Object.keys(p)).toEqual(["solana", "jupiter-exchange-solana"]);
    const ms = moedasDaCarteira(12.4, [{ mint: USDC, quantidade: 650 }, { mint: ESTRANHO, quantidade: 3 }, { mint: JUP, quantidade: 820 }], p);
    expect(ms.map((m) => m.simbolo)).toEqual(["SOL", "USDC", "JUP", "9xQe…VFin"]);
    expect(ms[0]!.valor).toBeCloseTo(1280.92); expect(ms[1]!.valor).toBe(650); expect(ms.at(-1)!.valor).toBeNull(); expect(ms.at(-1)!.conhecido).toBe(false);
    expect(totalEmDolar(ms)).toBeCloseTo(1280.92 + 650 + 254.2);
  });
  it("a AURA é moeda da Zaeon (fora da rede, sem preço); troca na Jupiter pro USDC (do USDC, pro SOL)", () => {
    expect(moedaAura(1840)).toMatchObject({ simbolo: "AURA", rede: "zaeon", valor: null, mint: null });
    expect(linkDeTroca(JUP)).toBe(`https://jup.ag/swap/${JUP}-${USDC}`); expect(linkDeTroca(USDC)).toBe(`https://jup.ag/swap/${USDC}-${MINT_SOL}`);
  });
  it("tokens desconhecidos (spam de airdrop): só os primeiros aparecem, o resto é contado", async () => {
    const ms = moedasDaCarteira(1, Array.from({ length: 30 }, (_, i) => ({ mint: `${ESTRANHO.slice(0, 40)}${String(i).padStart(4, "A")}`, quantidade: 1 })), {});
    const r = (await import("./carteira")).limitarDesconhecidos(ms, 6);
    expect(r.moedas.filter((m) => !m.conhecido)).toHaveLength(6); expect(r.moedas[0]!.simbolo).toBe("SOL"); expect(r.ocultos).toBe(24);
  });
  it("endereço e formatação", () => {
    expect(enderecoValido("86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY")).toBe(true); expect(enderecoValido("0OIl-nope")).toBe(false); expect(enderecoValido(undefined)).toBe(false);
    expect(fmtQuantidade(12_500_000)).toBe("12,5 mi"); expect(fmtQuantidade(12.4)).toBe("12,4");
  });
});
