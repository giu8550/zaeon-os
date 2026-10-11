import { R_SOM_CORACAO } from "./coracao";
import { describe, expect, it } from "vitest";
import { PREF_TUTORIAL, tutorialLigado, ANEL_TUBOS, NASCIMENTO, ROTEIRO, TUBO, TUBOS, TUBOS_DO_NOVATO, CENTRO_DA_CAPELA_LOCAL, FRENTE_DOS_TELOES_LOCAL, cumpriu, deveNascerNoTubo, passoDe, type CtxGuia, estadoDoTubo, peDaRecepcao, tuboDe } from "./onboarding";
import { CIDADE as C2, DOCA_ANGULO, TORRES_MURALHA, anguloDaTorre, naAberturaDaEscada } from "./ceu";
import { LAR_LOCAL } from "./landmarks";
import { AGENTES, DROID, noPisoDaZaeon, posDoGuia } from "./agentes";
import { CIDADE, colisoresDaCidade, mundo, naIlhaPrincipal } from "./ceu";
import { POIS, marcoNav } from "./landmarks";
import { alturaEm } from "./nav";
import { dentroDeAlgum } from "./colisao";
import { NOS } from "./buracos";
import { TELOES, TELOES_SOLUCAO, colisoresDoDistritoTerra } from "./terra";
import { PERSONAS } from "@/lib/ai/personas";

const recepcao = marcoNav(POIS.find((p) => p.id === "zaeon")!)!;

describe("quem chega NASCE num tubo de ensaio", () => {
  it("nasce: quem nunca viu o hiperespaço novo; o dono nasce na nave; `?nascer=1` força", () => {
    expect(deveNascerNoTubo({ visto: false, forcar: false, fundador: false })).toBe(true);
    expect(deveNascerNoTubo({ visto: true, forcar: false, fundador: false })).toBe(false);
    expect(deveNascerNoTubo({ visto: false, forcar: false, fundador: true })).toBe(false);
    expect(deveNascerNoTubo({ visto: true, forcar: true, fundador: true })).toBe(true);
  });
  it("os tubos ficam em VOLTA da Zaeon, na linha da muralha (no lugar dos blocos), entre as torres de cristal — sem encostar nelas nem uns nos outros", () => {
    expect(TUBOS.length).toBeGreaterThan(250);
    const loc = (t: { x: number; z: number }) => ({ x: t.x - C2.centro.x, z: t.z - C2.centro.z });
    for (const [i, t] of TUBOS.entries()) {
      const l = loc(t);
      expect(Math.hypot(l.x, l.z)).toBeCloseTo(ANEL_TUBOS.r, 6);
      expect(naIlhaPrincipal(t)).toBe(true); expect(dentroDeAlgum(t, colisoresDaCidade())).toBe(false);
      for (let k = 0; k < TORRES_MURALHA.n; k++) { const a = anguloDaTorre(k); expect(Math.hypot(l.x - Math.cos(a) * C2.muralhaR, l.z - Math.sin(a) * C2.muralhaR)).toBeGreaterThan(TORRES_MURALHA.rBase + TUBO.r + 1); }
      const prox = TUBOS[i + 1]; if (prox) expect(Math.hypot(prox.x - t.x, prox.z - t.z)).toBeGreaterThan(2 * TUBO.r + 0.9);
      expect(naAberturaDaEscada(l.x, l.z)).toBe(false);   // o vão da escada do lounge fica livre
      expect(Math.abs(Math.atan2(Math.sin(t.ang - DOCA_ANGULO), Math.cos(t.ang - DOCA_ANGULO)))).toBeGreaterThan(ANEL_TUBOS.docaMeia - 1e-9);   // e a doca da nave
      // sai-se pra DENTRO da ilha, num piso firme
      const fora = { x: t.x + Math.sin(t.rumo) * 2.6, z: t.z + Math.cos(t.rumo) * 2.6 };
      expect(Math.hypot(loc(fora).x, loc(fora).z)).toBeLessThan(ANEL_TUBOS.r - 2);
    }
  });
  it("o novato nasce num tubo PERTO da Recepção (o tour começa lá), longe da ilha dela", () => {
    expect(TUBOS_DO_NOVATO.length).toBeGreaterThanOrEqual(8);
    const lar = mundo(LAR_LOCAL);
    for (const i of TUBOS_DO_NOVATO) {
      const t = TUBOS[i]!; expect(Math.hypot(t.x - lar.x, t.z - lar.z)).toBeLessThan(100);
      expect(Math.hypot(t.x - recepcao.x, t.z - recepcao.z)).toBeGreaterThan(recepcao.nav.chaoR + TUBO.r + 2); expect(alturaEm(recepcao, t)).toBe(0);
    }
  });
  it("cada pessoa tem o SEU tubo (o mesmo sempre)", () => {
    for (const id of ["a".repeat(24), "b".repeat(24), "64f0c0ffee0000000000abcd"]) { const i = tuboDe(id); expect(i).toBe(tuboDe(id)); expect(TUBOS_DO_NOVATO).toContain(i); }
  });
  it("o vidro: o líquido escoa, DEPOIS o vidro sobe; a pessoa sai com tudo aberto", () => {
    expect(estadoDoTubo(0)).toEqual({ liquido: 1, vidro: 0 });
    expect(estadoDoTubo(NASCIMENTO.escoa)).toEqual({ liquido: 0, vidro: 0 });
    expect(estadoDoTubo(NASCIMENTO.sai)).toEqual({ liquido: 0, vidro: 1 });
    let l = 2, v = -1; for (let t = 0; t <= NASCIMENTO.sai; t += 0.1) { const e = estadoDoTubo(t); expect(e.liquido).toBeLessThanOrEqual(l); expect(e.vidro).toBeGreaterThanOrEqual(v); l = e.liquido; v = e.vidro; }
  });
});

describe("o TUTORIAL do Droid: ensina FAZENDO (espera a pessoa cumprir cada instrução)", () => {
  const nada: CtxGuia = { nascendo: false, andou: 0, correu: 0, noAr: 0, turbo: 0, chegou: false, conversaFeita: false, tabletAberto: false, pesquisaSalva: false, inventario: 0 };
  it("tubo → andar → correr → voo curto → voo longo até a capela → a Zaeon → os telões → a 1ª missão (o tablet) — sem motos, portais nem dash", () => {
    expect(ROTEIRO.map((p) => p.id)).toEqual(["nascer", "andar", "correr", "voar", "voo-longo", "capela", "zaeon", "ir-teloes", "teloes", "missao", "estudo", "aviso", "inventario"]);
    for (const p of ROTEIRO.slice(1)) for (const f of p.falas) expect(f.length).toBeLessThanOrEqual(170);
    for (const p of ROTEIRO) if (p.alvo) expect(naIlhaPrincipal(p.alvo)).toBe(true);
    expect(ROTEIRO.map((p) => p.falas.join(" ")).join(" ")).not.toMatch(/moto|portal|dash|\bC\b/i);
    expect(ROTEIRO.find((p) => p.id === "capela")!.falas.join(" ")).not.toMatch(/desktop|estud/i);   // a capela agora é pra ver a Zaeon
    expect(ROTEIRO.find((p) => p.id === "missao")!.falas[0]).toBe("Agora sua primeira missão é criar um estudo sobre qualquer tema que te interessa.");
    const c = mundo(CENTRO_DA_CAPELA_LOCAL); expect(dentroDeAlgum(c, colisoresDaCidade())).toBe(false);
    expect(Math.hypot(CENTRO_DA_CAPELA_LOCAL.x, CENTRO_DA_CAPELA_LOCAL.z)).toBeLessThan(R_SOM_CORACAO);   // perto do globo: ouve o coração
    const pe = peDaRecepcao(); expect(alturaEm(recepcao, pe)).toBe(0); expect(dentroDeAlgum(pe, colisoresDaCidade())).toBe(false);
  });
  it("a frente dos telões é chão livre na ilha, entre os dois telões e do lado do centro", () => {
    const f = mundo(FRENTE_DOS_TELOES_LOCAL);
    expect(naIlhaPrincipal(f)).toBe(true);
    expect(dentroDeAlgum(f, [...colisoresDaCidade(), ...colisoresDoDistritoTerra(mundo)])).toBe(false);
    const [p, s] = [TELOES[0]!, TELOES_SOLUCAO[0]!];
    expect(Math.abs(Math.hypot(FRENTE_DOS_TELOES_LOCAL.x - p.x, FRENTE_DOS_TELOES_LOCAL.z - p.z) - Math.hypot(FRENTE_DOS_TELOES_LOCAL.x - s.x, FRENTE_DOS_TELOES_LOCAL.z - s.z))).toBeLessThan(1);
    expect(Math.hypot(FRENTE_DOS_TELOES_LOCAL.x, FRENTE_DOS_TELOES_LOCAL.z)).toBeLessThan(Math.hypot(p.x, p.z));
  });
  it("as cenas: o Droid se apresenta e passa a missão; os telões são cena inteira; as instruções mostram as teclas", () => {
    const pa = (id: string) => ROTEIRO.find((p) => p.id === id)!;
    expect(pa("andar").cena).toBe("droid"); expect(pa("teloes").cena).toBe("teloes"); expect(pa("teloes").cenaInteira).toBe(true);
    expect(pa("missao").cena).toBe("droid");
    expect(pa("aviso").alerta).toBe(true); expect(pa("aviso").cenaInteira).toBe(true);
    expect(pa("aviso").falas.join(" ")).toMatch(/não tem base de estudos.*Não dá pra vender nem publicar.*guardar ela no seu inventário e me entregar algo melhor depois/);
    expect(pa("andar").teclas).toEqual(["W", "A", "S", "D"]); expect(pa("correr").teclas).toEqual(["Shift"]); expect(pa("voar").teclas).toEqual(["Espaço"]);
  });
  it("sem a pessoa fazer nada, nenhum passo anda (o Droid espera) — a não ser o de só ouvir", () => {
    for (const p of ROTEIRO.slice(1)) if (p.cond.tipo !== "ouvir") expect(cumpriu(p.cond, nada)).toBe(false);
  });
  it("cada instrução se cumpre com a ação certa — e só com ela", () => {
    const c = (id: string) => ROTEIRO.find((p) => p.id === id)!.cond;
    expect(cumpriu(c("nascer"), { ...nada, nascendo: true })).toBe(false); expect(cumpriu(c("nascer"), nada)).toBe(true);
    expect(cumpriu(c("andar"), { ...nada, andou: 2 })).toBe(false); expect(cumpriu(c("andar"), { ...nada, andou: 7 })).toBe(true);
    expect(cumpriu(c("correr"), { ...nada, andou: 99 })).toBe(false); expect(cumpriu(c("correr"), { ...nada, correu: 21 })).toBe(true);
    expect(cumpriu(c("voar"), { ...nada, correu: 99, noAr: 1 })).toBe(false); expect(cumpriu(c("voar"), { ...nada, noAr: 5 })).toBe(true);
    expect(cumpriu(c("voo-longo"), { ...nada, noAr: 30, chegou: true })).toBe(false); expect(cumpriu(c("voo-longo"), { ...nada, turbo: 51 })).toBe(true);
    expect(cumpriu(c("capela"), { ...nada, turbo: 99 })).toBe(false); expect(cumpriu(c("capela"), { ...nada, chegou: true })).toBe(true);
    expect(cumpriu(c("zaeon"), { ...nada, chegou: true })).toBe(false); expect(cumpriu(c("zaeon"), { ...nada, conversaFeita: true })).toBe(true);
    expect(cumpriu(c("ir-teloes"), { ...nada, conversaFeita: true })).toBe(false); expect(cumpriu(c("ir-teloes"), { ...nada, chegou: true })).toBe(true);
    expect(cumpriu(c("missao"), { ...nada, chegou: true })).toBe(false); expect(cumpriu(c("missao"), { ...nada, tabletAberto: true })).toBe(true);
    expect(cumpriu(c("estudo"), { ...nada, tabletAberto: true })).toBe(false); expect(cumpriu(c("estudo"), { ...nada, pesquisaSalva: true })).toBe(true);
    expect(cumpriu(c("inventario"), { ...nada, inventario: 3 })).toBe(false); expect(cumpriu(c("inventario"), { ...nada, inventario: Infinity })).toBe(true);
  });
});

describe("os AGENTES que moram no hiperespaço", () => {
  it("o DROID (o agente de onboarding): cérebro = a persona da anfitriã; mora na Recepção, no piso da Zaeon; tem personalidade, tarefas e funções", () => {
    expect(AGENTES).toContain(DROID);
    expect(DROID.nome).toBe("Droid"); expect(PERSONAS[DROID.persona]).toBeDefined();
    expect(POIS.some((p) => p.id === DROID.lar.poi)).toBe(true);
    expect(noPisoDaZaeon(DROID.lar)).toBe(true);
    expect(DROID.personalidade.length).toBeGreaterThan(40);
    expect(DROID.tarefas.length).toBeGreaterThanOrEqual(3); expect(DROID.funcoes).toContain("guiar");
    expect(new Set(AGENTES.map((a) => a.id)).size).toBe(AGENTES.length);
    expect(CIDADE.pisoY).toBeGreaterThan(0);
  });
  it("guiando: anda à DIREITA e um pouco à FRENTE de quem ela leva (o rosto dela aparece pra câmera)", () => {
    const p = { x: 10, z: 10 }, g = posDoGuia(p, 0);   // olhando pra +z: a direita é −x
    expect(g.x).toBeLessThan(p.x); expect(g.z).toBeGreaterThan(p.z);
    const g2 = posDoGuia(p, Math.PI / 2);   // olhando pra +x: a direita é +z
    expect(g2.z).toBeGreaterThan(p.z); expect(g2.x).toBeGreaterThan(p.x);
  });
});

describe("modo tutorial (Configurações)", () => {
  it("ligado ('1') força o tutorial; qualquer outro valor, storage vazio ou bloqueado = normal", () => {
    expect(tutorialLigado((k) => (k === PREF_TUTORIAL ? "1" : null))).toBe(true);
    expect(tutorialLigado(() => "0")).toBe(false);
    expect(tutorialLigado(() => null)).toBe(false);
    expect(tutorialLigado(() => { throw new Error("storage bloqueado"); })).toBe(false);
    // ligado vale até pro dono e pra quem já nasceu
    expect(deveNascerNoTubo({ visto: true, fundador: true, forcar: tutorialLigado(() => "1") })).toBe(true);
    expect(deveNascerNoTubo({ visto: true, fundador: true, forcar: tutorialLigado(() => "0") })).toBe(false);
  });
});
