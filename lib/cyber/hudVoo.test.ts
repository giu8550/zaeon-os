import { describe, expect, it } from "vitest";
import { CIDADE, mundo, noPortalEntrada } from "./ceu";
import { HELIPORTO, POIS, baseLivreDosPOIs, colisoresDosPOIs, poiPerto } from "./landmarks";
import { BASE_PLATAFORMA_R, basesDosMembros, posicaoDaBase } from "./bases";
import { pilaresDoMarco } from "./voo";
import { destinosDeVoo, dicaDeVoo, distTexto, indicadorNaBorda, separarIndicadores, sobreOQue } from "./hudVoo";

const Z = POIS.find((p) => p.id === "zaeon")!;
const solidosZ = pilaresDoMarco({ x: Z.x, z: Z.z, chaoR: Z.nav!.chaoR, altura: Z.altura, escala: Z.escala ?? 1, cupula: true });
const hangar = mundo(CIDADE.hangar);

describe("HUD de voo — altímetro e dicas", () => {
  it("sobre a Cidade, a Zaeon ou o chão", () => {
    expect(sobreOQue({ ...hangar, y: CIDADE.pisoY }, solidosZ)).toBe("cidade");
    expect(sobreOQue({ x: Z.x, y: solidosZ[0]!.topo, z: Z.z }, solidosZ)).toBe("zaeon");
    expect(sobreOQue({ x: 0, y: 40, z: 0 }, solidosZ)).toBe("chao");
    expect(sobreOQue({ ...hangar, y: 50 }, solidosZ)).toBe("chao");   // embaixo da ilha
  });
  it("DESCER pousada na Cidade → manda sair pela borda; na Zaeon → pela lateral", () => {
    expect(dicaDeVoo({ s: { ...hangar, y: CIDADE.pisoY }, subir: false, descer: true, pousado: true, zaeon: solidosZ })).toMatch(/borda/);
    expect(dicaDeVoo({ s: { x: Z.x, y: solidosZ[0]!.topo, z: Z.z }, subir: false, descer: true, pousado: true, zaeon: solidosZ })).toMatch(/lateral da Zaeon/);
    expect(dicaDeVoo({ s: { ...hangar, y: CIDADE.pisoY }, subir: false, descer: false, pousado: true })).toBeNull();
  });
  it("SUBIR travada embaixo da ilha → manda sair pela lateral; no céu aberto, sem dica", () => {
    expect(dicaDeVoo({ s: { ...hangar, y: CIDADE.pisoY - CIDADE.ilhaAltura }, subir: true, descer: false, pousado: false })).toMatch(/lateral/);
    expect(dicaDeVoo({ s: { x: 0, y: 80, z: 0 }, subir: true, descer: false, pousado: false })).toBeNull();
  });
});

describe("HUD de voo — indicadores dos destinos", () => {
  it("praça, heliporto, cidade (hangar, no alto), Zaeon e minha base", () => {
    const d = destinosDeVoo({ zaeon: { x: Z.x, y: 20, z: Z.z }, minhaBase: { x: 9, z: 0 } });
    expect(d.map((x) => x.id)).toEqual(["praca", "heliporto", "cidade", "zaeon", "base"]);
    expect(d.find((x) => x.id === "cidade")!.y).toBe(CIDADE.pisoY);
    expect(destinosDeVoo().map((x) => x.id)).toEqual(["praca", "heliporto", "cidade"]);
  });
  it("na tela: no próprio alvo; fora: presa na borda, na direção dele", () => {
    const W = 1000, H = 600;
    expect(indicadorNaBorda({ x: 0, y: 0 }, false, W, H)).toEqual({ x: 500, y: 300, naBorda: false, ang: 0 });
    const dir = indicadorNaBorda({ x: 3, y: 0 }, false, W, H, 36);
    expect(dir.naBorda).toBe(true); expect(dir.x).toBeCloseTo(W - 36); expect(dir.y).toBeCloseTo(300);
    const cima = indicadorNaBorda({ x: 0, y: 5 }, false, W, H, 36);
    expect(cima.y).toBeCloseTo(36); expect(cima.x).toBeCloseTo(500);
    // atrás da câmera a projeção vem espelhada: alvo atrás-à-direita aparece à direita
    const atras = indicadorNaBorda({ x: -0.5, y: 0 }, true, W, H, 36);
    expect(atras.naBorda).toBe(true); expect(atras.x).toBeCloseTo(W - 36);
    // embaixo fica reservado aos botões de movimento
    const baixo = indicadorNaBorda({ x: 0, y: -5 }, false, W, H, 36, 160);
    expect(baixo.y).toBeCloseTo(H - 160); expect(baixo.naBorda).toBe(true);
    expect(indicadorNaBorda({ x: 0, y: -0.8 }, false, W, H, 36, 160).y).toBeCloseTo(H - 160);   // na tela mas atrás dos botões → moldura
  });
  it("rótulos empilhados na mesma borda se afastam (embaixo sobem; em cima descem)", () => {
    const emb = separarIndicadores([{ x: 200, y: 495 }, { x: 210, y: 495 }, { x: 180, y: 495 }], 745);
    expect(emb.map((p) => p.y)).toEqual([495, 471, 447]);
    const cima = separarIndicadores([{ x: 200, y: 40 }, { x: 210, y: 40 }], 745);
    expect(cima.map((p) => p.y)).toEqual([40, 64]);
    expect(separarIndicadores([{ x: 100, y: 495 }, { x: 400, y: 495 }], 745).map((p) => p.y)).toEqual([495, 495]);   // longe: não mexe
  });
  it("distância legível", () => { expect(distTexto(34.4)).toBe("34 m"); expect(distTexto(1234)).toBe("1,2 km"); });
});

describe("heliporto (pouso perto da praça)", () => {
  const heli = POIS.find((p) => p.id === "heliporto")!;
  it("plano e andável (não colide), perto da praça e longe da Zaeon, da escada e do portal", () => {
    expect(colisoresDosPOIs().some((c) => c.x === HELIPORTO.x && c.z === HELIPORTO.z)).toBe(false);
    const d = Math.hypot(HELIPORTO.x, HELIPORTO.z); expect(d).toBeGreaterThan(20); expect(d).toBeLessThan(45);
    expect(baseLivreDosPOIs(HELIPORTO, HELIPORTO.r, POIS.filter((p) => p.id !== "heliporto"))).toBe(true);   // fora da Zaeon/escada
    expect(noPortalEntrada(HELIPORTO)).toBe(false);
    expect(poiPerto(HELIPORTO)?.id).toBe("heliporto");
    expect(heli.acesso).toBe("publico");
  });
  it("o 1º anel (praça) fica livre e as bases das salas grandes desviam do heliporto", () => {
    for (let i = 0; i < 5; i++) expect(baseLivreDosPOIs(posicaoDaBase(i), BASE_PLATAFORMA_R)).toBe(true);
    const ids = Array.from({ length: 60 }, (_, i) => String(i).padStart(24, "0"));
    for (const b of basesDosMembros(ids).values()) expect(Math.hypot(b.x - HELIPORTO.x, b.z - HELIPORTO.z)).toBeGreaterThan(HELIPORTO.r + BASE_PLATAFORMA_R);
  });
});
