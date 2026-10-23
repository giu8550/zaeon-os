import { describe, it, expect } from "vitest";
import { blocoFonteColada, objetivoComFonte, pedidoParaTitulo, separarFonteColada, tituloDaFonte, MAX_FONTE } from "./fonteColada";

const ARTIGO = [
  "Efeitos da fotossíntese C4 na eficiência hídrica",
  "",
  "RESUMO",
  "",
  "Este artigo analisa a fotossíntese C4 e sua relação com a eficiência no uso da água em gramíneas tropicais. " .repeat(6),
  "",
  "1 INTRODUÇÃO",
  "",
  "A revisão sistemática da literatura mostra que plantas C4 concentram CO2 nas células da bainha. ".repeat(8),
  "",
  "REFERÊNCIAS",
  "SILVA, A. B. Fisiologia vegetal. São Paulo: Editora, 2020.",
].join("\n");

describe("separarFonteColada — o pedido curto vs o artigo colado", () => {
  it("pedido na 1ª linha", () => {
    const r = separarFonteColada(`Escreva um artigo novo com base neste aqui:\n${ARTIGO}`);
    expect(r.pedido).toBe("Escreva um artigo novo com base neste aqui:");
    expect(r.fonte?.startsWith("Efeitos da fotossíntese C4")).toBe(true);
  });
  it("pedido no fim (depois do texto)", () => {
    const r = separarFonteColada(`${ARTIGO}\n\nAgora reescreva isso como um TCC sobre gramíneas`);
    expect(r.pedido).toBe("Agora reescreva isso como um TCC sobre gramíneas");
    expect(r.fonte?.endsWith("Editora, 2020.")).toBe(true);
  });
  it("mesma linha, cortando no ':'", () => {
    const r = separarFonteColada(`Faça um artigo baseado nisto: ${ARTIGO.replace(/\n/g, " ")}`);
    expect(r.pedido).toBe("Faça um artigo baseado nisto:");
  });
  it("o título/RESUMO do artigo colado não viram pedido; só o texto colado = fonte sem pedido", () => {
    const r = separarFonteColada(ARTIGO);
    expect(r).toEqual({ pedido: "", fonte: ARTIGO.trim() });
  });
  it("mensagem curta (ou longa sem nada colado) não separa", () => {
    expect(separarFonteColada("escreva um artigo sobre fotossíntese")).toEqual({ pedido: "escreva um artigo sobre fotossíntese", fonte: null });
  });
});

describe("o que o turno usa", () => {
  const f = separarFonteColada(`Escreva um artigo com base neste aqui:\n${ARTIGO}`);
  it("objetivo = pedido + tema do texto (curto: vai pro roteador e pras buscas, nunca o texto inteiro)", () => {
    expect(objetivoComFonte(f)).toBe("Escreva um artigo com base neste aqui — tema do texto-fonte: Efeitos da fotossíntese C4 na eficiência hídrica");
    expect(objetivoComFonte(f).length).toBeLessThan(200);
    expect(objetivoComFonte({ pedido: "", fonte: ARTIGO })).toMatch(/^Escreva um artigo acadêmico com base no texto colado — tema/);
  });
  it("título do trabalho vem do tema do texto (não do 1º 'sobre' perdido no meio do artigo)", () => {
    expect(pedidoParaTitulo(f)).toBe("Escreva um artigo com base neste aqui sobre Efeitos da fotossíntese C4 na eficiência hídrica");
    expect(tituloDaFonte("# Título: Redes neurais\ncorpo")).toBe("Redes neurais");
  });
  it("o bloco leva o texto inteiro até o teto e manda usar como base, sem copiar", () => {
    const b = blocoFonteColada(f.fonte!);
    expect(b).toContain("SILVA, A. B. Fisiologia vegetal");
    expect(b).toContain("nunca copie trechos longos");
    expect(blocoFonteColada("x".repeat(MAX_FONTE + 10))).toContain("[… texto cortado");
  });
});
