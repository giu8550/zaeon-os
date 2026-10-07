import { describe, expect, it } from "vitest";
import { DIST_REGIAO, estadoDaRegiao, type EstadoRegiao } from "./regioes";

const reg = { x: 0, z: 330, r: 150, y0: 130, y1: 305 };
const longe = (d: number) => ({ x: 0, y: 230, z: 330 - reg.r - d });   // câmera a `d` m da BORDA da região

describe("regiões por distância (só desenha/anima o que está perto)", () => {
  it("perto: tudo ligado; média distância: só a silhueta parada; longe demais: some", () => {
    expect(estadoDaRegiao(longe(-20), reg)).toEqual<EstadoRegiao>({ visivel: true, detalhe: true, anima: true });   // dentro
    expect(estadoDaRegiao(longe(DIST_REGIAO.detalhe - 5), reg)).toEqual({ visivel: true, detalhe: true, anima: true });
    expect(estadoDaRegiao(longe(DIST_REGIAO.anima + 20), reg)).toEqual({ visivel: true, detalhe: false, anima: false });
    expect(estadoDaRegiao(longe(DIST_REGIAO.visivel + 20), reg)).toEqual({ visivel: false, detalhe: false, anima: false });
  });
  it("o detalhe nunca aparece parado (anima ⊇ detalhe), e a ordem dos limites é coerente", () => {
    expect(DIST_REGIAO.detalhe).toBeLessThan(DIST_REGIAO.anima);
    expect(DIST_REGIAO.anima).toBeLessThan(DIST_REGIAO.visivel);
    for (let d = -50; d < 1300; d += 7) { const e = estadoDaRegiao(longe(d), reg); if (e.detalhe) expect(e.anima).toBe(true); if (e.anima) expect(e.visivel).toBe(true); }
  });
  it("folga: na fronteira não fica piscando (quem estava ligado só desliga um pouco depois)", () => {
    const naBorda = longe(DIST_REGIAO.detalhe + DIST_REGIAO.folga / 2);
    expect(estadoDaRegiao(naBorda, reg, { visivel: true, detalhe: true, anima: true }).detalhe).toBe(true);
    expect(estadoDaRegiao(naBorda, reg, { visivel: true, detalhe: false, anima: true }).detalhe).toBe(false);
    expect(estadoDaRegiao(longe(DIST_REGIAO.detalhe + DIST_REGIAO.folga + 1), reg, { visivel: true, detalhe: true, anima: true }).detalhe).toBe(false);
  });
  it("conta a altura: o campus a 230 m no céu está LONGE de quem está no chão embaixo dele", () => {
    expect(estadoDaRegiao({ x: 0, y: 1.6, z: 330 }, reg).detalhe).toBe(false);
    expect(estadoDaRegiao({ x: 0, y: 1.6, z: 330 }, reg).visivel).toBe(true);   // a silhueta continua lá em cima
    expect(estadoDaRegiao({ x: 0, y: 200, z: 330 }, reg).detalhe).toBe(true);   // subindo (dentro da faixa): perto
  });
});
