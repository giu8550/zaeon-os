import { R_SOM_CORACAO } from "./coracao";
import { describe, expect, it } from "vitest";
import { PREF_TUTORIAL, tutorialLigado, ANEL_TUBOS, NASCIMENTO, ROTEIRO, TUBO, TUBOS, TUBOS_DO_NOVATO, CENTRO_DA_CAPELA_LOCAL, FRENTE_DOS_TELOES_LOCAL, SALA_DO_SABER_LOCAL, FALAS_DO_RELICARIO, PALAVRA_FINAL, CHAVE_PROGRESSO, cumpriu, decidirTutorial, deveNascerNoTubo, lerProgresso, passoDe, retomadaDe, type CtxGuia, type IdPassoGuia, type ProgressoTutorial, estadoDoTubo, peDaRecepcao, tuboDe } from "./onboarding";
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
  const nada: CtxGuia = { nascendo: false, andou: 0, correu: 0, noAr: 0, turbo: 0, chegou: false, conversaFeita: false, tabletAberto: false, pesquisaSalva: false, inventario: 0, droidNoSaber: -1, entrega: null, naMoto: false, motoAndou: 0, portal: false };
  const pa = (id: IdPassoGuia) => ROTEIRO.find((p) => p.id === id)!;
  it("tubo → andar → correr → voo curto → voo longo até a capela → a Zaeon → os telões → a 1ª missão (o tablet) → o veredito → o inventário → o portal → a Sala do Saber → o Relicário → a palavra final", () => {
    expect(ROTEIRO.map((p) => p.id)).toEqual(["nascer", "andar", "correr", "voar", "voo-longo", "capela", "zaeon", "ir-teloes", "teloes", "missao", "estudo", "aviso", "inventario", "despedida", "portal-saber", "saber", "relicario", "palavra-final"]);
    for (const p of ROTEIRO.slice(1)) for (const f of p.falas) expect(f.length).toBeLessThanOrEqual(170);
    for (const p of ROTEIRO) if (p.alvo) expect(naIlhaPrincipal(p.alvo)).toBe(true);
    // até o Relicário o tutorial é 100% MOVIMENTO: sem motos, portais nem dash nas falas (as motos só entram como a RECOMPENSA)
    expect(ROTEIRO.slice(0, passoDe("relicario")).map((p) => p.falas.join(" ")).join(" ")).not.toMatch(/moto|portal|dash|\bC\b/i);
    expect(pa("capela").falas.join(" ")).not.toMatch(/desktop|estud/i);   // a capela agora é pra ver a Zaeon
    expect(pa("missao").falas[0]).toBe("Agora sua primeira missão é criar um estudo sobre qualquer tema que te interessa.");
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
  it("as cenas: o Droid se apresenta e passa a missão; a capela e os telões são cutscenes; as instruções mostram as teclas", () => {
    expect(pa("andar").cena).toBe("droid"); expect(pa("capela").cena).toBe("capela"); expect(pa("capela").cenaInteira).toBeFalsy();   // a câmera solta na instrução (pousar)
    expect(pa("teloes").cena).toBe("teloes"); expect(pa("teloes").cenaInteira).toBe(true);
    expect(pa("missao").cena).toBe("droid");
    expect(pa("aviso").alerta).toBe(true); expect(pa("aviso").cenaInteira).toBe(true);
    expect(pa("aviso").falas.join(" ")).toMatch(/não tem base de estudos.*Não dá pra vender nem publicar.*guardar ela no seu inventário e me entregar algo melhor depois/);
    expect(pa("andar").teclas).toEqual(["W", "A", "S", "D"]); expect(pa("correr").teclas).toEqual(["Shift"]); expect(pa("voar").teclas).toEqual(["Espaço"]);
  });
  it("a despedida: o Droid ensina o I, abre o PORTAL e leva a pessoa até a Sala do Saber — lá mostra o Relicário (entrega = RECOMPENSA) e dá a palavra final", () => {
    expect(pa("despedida").falas.join(" ")).toMatch(/Pressione I.*venha comigo/);
    expect(pa("portal-saber").cond.tipo).toBe("portal"); expect(pa("portal-saber").falas).toEqual([]);
    for (const id of ["saber", "relicario", "palavra-final"] as const) { expect(pa(id).cenaInteira).toBe(true); expect(pa(id).cond.tipo).toBe("ouvir"); }
    expect(pa("relicario").cena).toBe("relicario"); expect(pa("relicario").falas).toBe(FALAS_DO_RELICARIO);
    expect(FALAS_DO_RELICARIO.join(" ")).toMatch(/RECOMPENSA/); expect(FALAS_DO_RELICARIO.join(" ")).toMatch(/MOTOS/);
    expect(pa("palavra-final").alerta).toBe(true); expect(pa("palavra-final").falas).toBe(PALAVRA_FINAL);
    expect(PALAVRA_FINAL.join(" ")).toMatch(/mãos vazias.*bom o suficiente/);
    expect(Math.hypot(SALA_DO_SABER_LOCAL.x, SALA_DO_SABER_LOCAL.z)).toBeGreaterThan(CIDADE.bordaR);   // a biblioteca é uma sala de BORDA
  });
  it("sem a pessoa fazer nada, nenhum passo anda (o Droid espera) — a não ser o de só ouvir", () => {
    for (const p of ROTEIRO.slice(1)) if (p.cond.tipo !== "ouvir") expect(cumpriu(p.cond, nada)).toBe(false);
  });
  it("cada instrução se cumpre com a ação certa — e só com ela", () => {
    const c = (id: IdPassoGuia) => pa(id).cond;
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
    expect(cumpriu(c("portal-saber"), { ...nada, chegou: true, inventario: Infinity })).toBe(false); expect(cumpriu(c("portal-saber"), { ...nada, portal: true })).toBe(true);
    // (o Droid chegando na Sala do Saber por conta própria saiu do roteiro — a condição continua valendo)
    expect(cumpriu({ tipo: "saber", s: 3 }, { ...nada, droidNoSaber: 1 })).toBe(false); expect(cumpriu({ tipo: "saber", s: 3 }, { ...nada, droidNoSaber: 4 })).toBe(true);
  });
});

describe("o PROGRESSO do tutorial (recarregar no meio NÃO recomeça tudo)", () => {
  const salvo = (v: unknown) => (k: string) => (k === CHAVE_PROGRESSO ? JSON.stringify(v) : null);
  it("lerProgresso: lixo, passo desconhecido ou storage bloqueado = nada; a pesquisa salva vem junto, saneada", () => {
    expect(lerProgresso(() => null)).toBeNull();
    expect(lerProgresso(() => "lixo{")).toBeNull();
    expect(lerProgresso(() => { throw new Error("storage bloqueado"); })).toBeNull();
    expect(lerProgresso(salvo("fim"))).toBeNull();
    expect(lerProgresso(salvo({ passo: "xyz" }))).toBeNull();
    expect(lerProgresso(salvo({ passo: 7 }))).toBeNull();
    expect(lerProgresso(salvo({ passo: "motos-fim" }))).toBeNull();   // só os passos do ROTEIRO (as motos não se retomam)
    expect(lerProgresso(() => JSON.stringify({ passo: "fim" }))).toEqual({ passo: "fim", pesquisa: null });
    expect(lerProgresso(salvo({ passo: "fim" }))).toEqual({ passo: "fim", pesquisa: null });
    expect(lerProgresso(salvo({ passo: "capela", pesquisa: "x" }))).toEqual({ passo: "capela", pesquisa: null });
    expect(lerProgresso(salvo({ passo: "aviso", pesquisa: { titulo: "Chocolate", palavras: "120", workId: "64f0c0ffee0000000000abcd" } }))).toEqual({ passo: "aviso", pesquisa: { titulo: "Chocolate", palavras: 120, workId: "64f0c0ffee0000000000abcd" } });
    expect(lerProgresso(salvo({ passo: "aviso", pesquisa: { titulo: "x".repeat(300), palavras: -4, workId: 5 } }))!.pesquisa).toEqual({ titulo: "x".repeat(200), palavras: 0, workId: null });
    expect(lerProgresso(salvo({ passo: "aviso", pesquisa: { palavras: 10 } }))!.pesquisa).toBeNull();   // sem título não é pesquisa
  });
  it("retomadaDe: cada passo volta pro começo da sua cena, no lugar certo", () => {
    const r = (passo: ProgressoTutorial["passo"], pesquisa: ProgressoTutorial["pesquisa"] = null) => retomadaDe({ passo, pesquisa });
    expect(retomadaDe(null)).toBeNull();
    expect(r("fim")).toBe("fim");
    expect(r("nascer")).toBe("inicio"); expect(r("andar")).toBe("inicio");   // mal saiu do tubo: recomeça
    for (const id of ["correr", "voar", "voo-longo", "capela"] as const) expect(r(id)).toEqual({ passo: id, onde: "tubo" });
    expect(r("zaeon")).toEqual({ passo: "zaeon", onde: "capela" }); expect(r("ir-teloes")).toEqual({ passo: "ir-teloes", onde: "capela" });
    expect(r("teloes")).toEqual({ passo: "teloes", onde: "teloes" });
    expect(r("missao")).toEqual({ passo: "missao", onde: "teloes" }); expect(r("estudo")).toEqual({ passo: "missao", onde: "teloes" });
    const pq = { titulo: "Chocolate", palavras: 120, workId: null };
    for (const id of ["aviso", "inventario", "despedida", "portal-saber"] as const) { expect(r(id, pq)).toEqual({ passo: "aviso", onde: "teloes" }); expect(r(id)).toEqual({ passo: "missao", onde: "teloes" }); }   // sem a pesquisa salva, a missão de novo
    for (const id of ["saber", "relicario", "palavra-final"] as const) expect(r(id)).toEqual({ passo: "saber", onde: "saber" });
  });
  it("decidirTutorial: ?nascer=1 sempre do começo; 'fim' não força de novo (até desligar e ligar o modo); progresso = nasce retomando; senão, a regra do tubo", () => {
    const base = { visto: true, forcarUrl: false, modoTutorial: false, fundador: false, progresso: null };
    expect(decidirTutorial({ ...base, forcarUrl: true, progresso: { passo: "saber" } })).toEqual({ nascer: true, retomar: null });
    expect(decidirTutorial({ ...base, modoTutorial: true, progresso: { passo: "fim" } })).toEqual({ nascer: false, retomar: null });
    expect(decidirTutorial({ ...base, progresso: { passo: "andar" } })).toEqual({ nascer: true, retomar: null });
    expect(decidirTutorial({ ...base, fundador: true, progresso: { passo: "capela" } })).toEqual({ nascer: true, retomar: { passo: "capela", onde: "tubo" } });
    expect(decidirTutorial({ ...base, progresso: { passo: "relicario", pesquisa: null } })).toEqual({ nascer: true, retomar: { passo: "saber", onde: "saber" } });
    // sem progresso: a regra do tubo (quem nunca entrou nasce; o dono não; o modo tutorial força)
    expect(decidirTutorial({ ...base, visto: false })).toEqual({ nascer: true, retomar: null });
    expect(decidirTutorial(base)).toEqual({ nascer: false, retomar: null });
    expect(decidirTutorial({ ...base, visto: false, fundador: true })).toEqual({ nascer: false, retomar: null });
    expect(decidirTutorial({ ...base, fundador: true, modoTutorial: true })).toEqual({ nascer: true, retomar: null });
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

describe("o ritmo das falas", () => {
  it("fala curta = o ritmo mínimo; fala longa = o tempo de ler; os passos de só ouvir esperam a pessoa ler a última", async () => {
    const { tempoDeLeitura, esperaDepoisDaUltima, RITMO_FALA, ROTEIRO } = await import("./onboarding");
    expect(tempoDeLeitura("Isso!")).toBe(RITMO_FALA.entre);
    const longa = ROTEIRO.find((p) => p.id === "aviso")!.falas[1]!;
    expect(tempoDeLeitura(longa)).toBeGreaterThan(6);
    expect(esperaDepoisDaUltima(ROTEIRO.find((p) => p.id === "aviso")!)).toBeGreaterThan(5);
    const desp = ROTEIRO.find((p) => p.id === "despedida")!; expect(esperaDepoisDaUltima(desp)).toBe(tempoDeLeitura(desp.falas[desp.falas.length - 1]!));
    expect(esperaDepoisDaUltima(ROTEIRO.find((p) => p.id === "andar")!)).toBe(RITMO_FALA.antesDeConferir);
  });
});

describe("a concorrência no tutorial (o tablet guardado enquanto a pesquisa roda)", () => {
  it("na espera da pesquisa ensina; quando a IA entrega chama de volta; aberto, fica quieto", async () => {
    const { lembreteDoTablet } = await import("./onboarding");
    expect(lembreteDoTablet({ fechado: false, etapaLab: "pesquisando", viuConcorrencia: false })).toBe("");
    expect(lembreteDoTablet({ fechado: true, etapaLab: "pesquisando", viuConcorrencia: false })).toBe("concorrencia");
    expect(lembreteDoTablet({ fechado: true, etapaLab: "gerar", viuConcorrencia: true })).toBe("entregou");
    expect(lembreteDoTablet({ fechado: true, etapaLab: "gerar", viuConcorrencia: false })).toBe("volte");
    expect(lembreteDoTablet({ fechado: true, etapaLab: "abrir", viuConcorrencia: true })).toBe("volte");
    expect(lembreteDoTablet({ fechado: true, etapaLab: "tema", viuConcorrencia: false })).toBe("volte");
  });
});

describe("a ENTREGA na Sala do Saber e o tutorial das MOTOS", () => {
  it("a entrega é UMA cena no Relicário; o veredito anda; recusado diz o que falta; aceito vira as motos (garagem → montar → pilotar → descer)", async () => {
    const { ROTEIRO_ENTREGA, ROTEIRO_MOTOS, passoDaRecusa, cumpriu } = await import("./onboarding");
    const nada0 = { nascendo: false, andou: 0, correu: 0, noAr: 0, turbo: 0, chegou: false, conversaFeita: false, tabletAberto: false, pesquisaSalva: false, inventario: 0, droidNoSaber: -1, entrega: null, naMoto: false, motoAndou: 0, portal: false } as const;
    expect(ROTEIRO_ENTREGA).toHaveLength(1);
    expect(ROTEIRO_ENTREGA[0]!.cena).toBe("relicario"); expect(ROTEIRO_ENTREGA[0]!.cenaInteira).toBe(true); expect(ROTEIRO_ENTREGA[0]!.cond.tipo).toBe("entrega");
    expect(cumpriu(ROTEIRO_ENTREGA[0]!.cond, nada0)).toBe(false);
    expect(cumpriu(ROTEIRO_ENTREGA[0]!.cond, { ...nada0, entrega: "recusada" })).toBe(true);
    const r = passoDaRecusa(["o RESUMO", "a CONCLUSÃO", "as REFERÊNCIAS", "as CITAÇÕES"]);
    expect(r.falas[1]).toMatch(/Falta o RESUMO; a CONCLUSÃO; as REFERÊNCIAS…/); for (const f of r.falas) expect(f.length).toBeLessThanOrEqual(170);
    expect(ROTEIRO_MOTOS.map((p) => p.id)).toEqual(["motos-aceite", "motos-ver", "moto", "pilotar", "descer", "motos-fim"]);
    const c = (id: string) => ROTEIRO_MOTOS.find((p) => p.id === id)!.cond;
    expect(cumpriu(c("moto"), { ...nada0, naMoto: true })).toBe(true);
    expect(cumpriu(c("pilotar"), { ...nada0, naMoto: true, motoAndou: 20 })).toBe(false); expect(cumpriu(c("pilotar"), { ...nada0, naMoto: true, motoAndou: 61 })).toBe(true);
    expect(cumpriu(c("descer"), { ...nada0, naMoto: true })).toBe(false); expect(cumpriu(c("descer"), nada0)).toBe(true);
  });
});
