/**
 * Cyberespaço — o NASCIMENTO e o TOUR de quem chega (PURO, sem three).
 *
 * Quem NUNCA entrou no cyberespaço (o servidor sabe: User.cyberNasceuEm) NASCE num TUBO DE ENSAIO — os tubos ficam em
 * volta da Cidade Zaeon, na linha da muralha, entre as torres de cristal; o do novato é um dos perto da Recepção (o lar
 * do DROID, o agente de onboarding — lib/cyber/agentes): o líquido escoa, o vidro sobe e a pessoa sai. O Droid (um
 * ofanim) sai de um mini portal e ENSINA fazendo, como num RPG (out/2026 — docs/superpowers/specs/2026-10-11-tutorial-rpg
 * -design.md): fala numa CAIXA DE DIÁLOGO e em CUTSCENES (lib/cyber/cutscene) e ESPERA a pessoa cumprir cada instrução
 * (andar → correr → voo curto → voo longo até a capela → conhecer a Zaeon (o holograma sai do globo e conversa —
 * lib/cyber/conversaZaeon) → os telões PROBLEMA → SOLUÇÃO → a 1ª missão: o tablet). É de cada um: spawnado só no
 * cliente da própria pessoa (nada vai pela rede), numa INSTÂNCIA (a Zaeon é só dela) até o fim do tutorial.
 */
import type { P2 } from "./colisao";
import { CIDADE, DOCA_ANGULO, anguloDaTorre, mundo, naAberturaDaEscada, TORRES_MURALHA } from "./ceu";
import { LAR_LOCAL, POIS, marcoNav } from "./landmarks";
import { ESTACAO, MIRANTES_ESTACAO, noMirante } from "./terra";
import { deEscada } from "./nav";

/** a chave do "já nasci" (localStorage) — só a reserva quando o servidor não diz (prévia/sem sala) */
export const CHAVE_ONBOARDING = "zaeon:cyber:onboarding:v1";
/** o MODO TUTORIAL das Configurações (a engrenagem — components/sub/ConfigMenu): LIGADO, toda entrada no cyberespaço
 *  começa pelo tutorial (pra testar — vale até pro dono); DESLIGADO, volta o normal. Só neste navegador (localStorage) */
export const PREF_TUTORIAL = "zaeon_cyber_tutorial";
export function tutorialLigado(get: (k: string) => string | null): boolean {
  try { return get(PREF_TUTORIAL) === "1"; } catch { return false; }
}
/** nasce no tubo? Quem nunca entrou no cyberespaço (`visto` = o servidor já marcou o nascimento); o dono nasce na nave
 *  dele (a não ser forçado: `?nascer=1` ou o modo tutorial ligado) */
export function deveNascerNoTubo(o: { visto: boolean; forcar: boolean; fundador: boolean }): boolean {
  if (o.forcar) return true;
  return !o.visto && !o.fundador;
}

/** o pé da escada da Recepção (mundo) */
export function peDaRecepcao(): P2 {
  const poi = POIS.find((p) => p.id === "zaeon"), mn = poi ? marcoNav(poi) : null;
  if (!mn) return mundo(LAR_LOCAL);
  return deEscada(mn, mn.nav.bordaR + mn.nav.escada.comprimento + 2.5, 0);
}

/**
 * O BERÇÁRIO: os TUBOS DE ENSAIO em volta da Zaeon, na linha da muralha — no lugar dos antigos blocos de granizo, em
 * arcos entre as torres grandes de cristal (lib/cyber/ceu `TORRES_MURALHA`). Livres: o vão da escada do lounge e o
 * setor da doca da nave-QG. Cada tubo é virado pro centro da ilha (sai-se pra dentro).
 */
export const TUBO = { r: 0.95, alt: 2.7 } as const;
export const ANEL_TUBOS = { r: CIDADE.muralhaR, passo: 3.6, folgaTorre: 7, docaMeia: 0.13 } as const;
export type Tubo = { x: number; z: number; rumo: number; ang: number };
const difAng = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export const TUBOS: Tubo[] = (() => {
  const out: Tubo[] = [], R = ANEL_TUBOS.r, n = TORRES_MURALHA.n;
  for (let k = 0; k < n; k++) {
    const a0 = anguloDaTorre(k) + ANEL_TUBOS.folgaTorre / R, a1 = anguloDaTorre(k + 1) - ANEL_TUBOS.folgaTorre / R;
    const q = Math.floor(((a1 - a0) * R) / ANEL_TUBOS.passo);
    for (let i = 0; i <= q; i++) {
      const ang = a0 + ((a1 - a0) * i) / q, lx = Math.cos(ang) * R, lz = Math.sin(ang) * R;
      if (naAberturaDaEscada(lx, lz) || difAng(ang, DOCA_ANGULO) < ANEL_TUBOS.docaMeia) continue;
      const w = mundo({ x: lx, z: lz });
      out.push({ x: w.x, z: w.z, rumo: Math.atan2(-lx, -lz), ang });
    }
  }
  return out;
})();
/** os tubos onde os NOVATOS nascem: perto da Recepção, mas um pouco AO LADO dela (bem atrás, a ilha dela tampava a
 *  vista de quem sai do tubo) */
export const TUBOS_DO_NOVATO: number[] = (() => {
  const a = Math.atan2(LAR_LOCAL.z, LAR_LOCAL.x) + 0.24;
  return TUBOS.map((t, i) => ({ i, d: difAng(t.ang, a) })).sort((p, q) => p.d - q.d).slice(0, 12).map((x) => x.i).sort((p, q) => p - q);
})();
/** qual tubo é o de quem nasce (pelo id: sempre o mesmo pra mesma pessoa), entre os perto da Recepção */
export function tuboDe(id: string): number {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TUBOS_DO_NOVATO[h % TUBOS_DO_NOVATO.length]!;
}
/** a cena do nascimento (s): o líquido escoa até `escoa`, o vidro sobe até `abre`, a pessoa sai em `sai` */
export const NASCIMENTO = { escoa: 2.2, abre: 3.3, sai: 3.9 } as const;
/** o estado do tubo no instante `t` (s desde o começo): o nível do líquido (1 cheio → 0) e o quanto o vidro subiu (0..1) */
export function estadoDoTubo(t: number): { liquido: number; vidro: number } {
  const c = (x: number) => Math.max(0, Math.min(1, x)), s = (x: number) => x * x * (3 - 2 * x);
  return { liquido: 1 - s(c(t / NASCIMENTO.escoa)), vidro: s(c((t - NASCIMENTO.escoa) / (NASCIMENTO.abre - NASCIMENTO.escoa))) };
}

/**
 * O que a pessoa tem que FAZER pro Droid seguir (ele espera até ela fazer — `cumpriu`). O tutorial de out/2026 é 100%
 * MOVIMENTO (sem motos, portais nem dash — pedido do dono): nascer (o tubo abriu), ANDAR `m` metros, CORRER `m` metros
 * (Shift andando), VOAR `m` metros acima do chão (Espaço), o VOO LONGO (`m` metros de turbo: Shift no ar), CHEGAR no
 * alvo, conversar com a Zaeon, OUVIR (o passo é só a cena — anda quando as falas acabam) e abrir o TABLET.
 */
export type CondGuia = { tipo: "nascer" } | { tipo: "andar"; m: number } | { tipo: "correr"; m: number } | { tipo: "voar"; m: number } | { tipo: "turbo"; m: number } | { tipo: "chegar" } | { tipo: "conversa" } | { tipo: "ouvir" } | { tipo: "tablet" } | { tipo: "fim" };
export type IdPassoGuia = "nascer" | "andar" | "correr" | "voar" | "voo-longo" | "capela" | "zaeon" | "ir-teloes" | "teloes" | "missao" | "fim";
/** a CUTSCENE do passo (lib/cyber/cutscene): enquanto o Droid fala, a câmera enquadra outra coisa — "droid" = ele (a
 *  apresentação e a missão), "teloes" = os telões PROBLEMA → SOLUÇÃO. A câmera solta na INSTRUÇÃO (a última fala),
 *  a não ser que `cenaInteira` (o passo todo é cena — a pessoa não precisa se mexer) */
export type CenaGuia = "droid" | "teloes";
/** um passo do tutorial: as FALAS do Droid (uma depois da outra; a última — a INSTRUÇÃO — fica na tela até a pessoa
 *  cumprir), o que ela tem que fazer, o alvo de "vem comigo até…" (o Droid vai na frente; o farol marca), a CENA e as
 *  TECLAS que a caixa de diálogo mostra em destaque */
export type PassoGuia = { id: IdPassoGuia; titulo: string; falas: string[]; cond: CondGuia; alvo: (P2 & { r: number }) | null; cena?: CenaGuia; cenaInteira?: boolean; teclas?: string[]; livre?: boolean };

/** onde o Droid leva no CENTRO da capela: ao lado do globo (a Zaeon sai dele), do lado de quem vem do leste */
export const CENTRO_DA_CAPELA_LOCAL = { x: 14, z: 3 };
/** onde a pessoa para pra ver os TELÕES (local): na frente da estação PROBLEMA → SOLUÇÃO do mirante 1, do lado do
 *  centro, entre os dois telões — dali se lê o da esquerda (problemas) e o da direita (soluções) */
export const FRENTE_DOS_TELOES_LOCAL: P2 = noMirante(MIRANTES_ESTACAO[0]!, ESTACAO.u + 22, ESTACAO.v);

/** o ROTEIRO do Droid (mundo) */
export const ROTEIRO: PassoGuia[] = (() => {
  const centro = mundo(CENTRO_DA_CAPELA_LOCAL), teloes = mundo(FRENTE_DOS_TELOES_LOCAL);
  return [
    { id: "nascer", titulo: "Despertar", falas: [], cond: { tipo: "nascer" }, alvo: null },
    { id: "andar", titulo: "Andar", cena: "droid", teclas: ["W", "A", "S", "D"], falas: ["Ah… você despertou. Bem-vindo ao hiperespaço, viajante.", "Eu sou o Droid, guardião desta cidadela — a Zaeon. Vou guiar os seus primeiros passos.", "Use W A S D para andar. Venha, caminhe um pouco comigo."], cond: { tipo: "andar", m: 6 }, alvo: null },
    { id: "correr", titulo: "Correr", teclas: ["Shift"], falas: ["Bom. Seus pés ainda lembram o caminho.", "Agora segure SHIFT enquanto anda para correr. Mais rápido!"], cond: { tipo: "correr", m: 20 }, alvo: null },
    { id: "voar", titulo: "Voo curto", teclas: ["Espaço"], falas: ["Você é mais rápido do que parece.", "Mas aqui ninguém fica preso ao chão. Aperte ESPAÇO: a mochila a jato te tira do solo."], cond: { tipo: "voar", m: 4 }, alvo: null },
    { id: "voo-longo", titulo: "Voo longo", teclas: ["Espaço", "Shift"], falas: ["Isso! Você está voando.", "Para ir longe, segure SHIFT no ar: o turbo te leva muito mais rápido. Siga-me até a capela, no coração da cidadela!"], cond: { tipo: "turbo", m: 50 }, alvo: { ...centro, r: 7 } },
    { id: "capela", titulo: "A capela", falas: ["Que voo! Agora pouse no centro da capela, ao lado do globo."], cond: { tipo: "chegar" }, alvo: { ...centro, r: 7 } },
    { id: "zaeon", titulo: "A Zaeon", falas: ["Olhe o globo… alguém quer te conhecer. ✦"], cond: { tipo: "conversa" }, alvo: null },
    { id: "ir-teloes", titulo: "Os telões", teclas: ["Espaço", "Shift"], falas: ["A Zaeon gostou de você.", "Agora venha comigo: quero te mostrar o que move esta cidade."], cond: { tipo: "chegar" }, alvo: { ...teloes, r: 9 } },
    { id: "teloes", titulo: "Problema → solução", cena: "teloes", cenaInteira: true, falas: ["Neste telão, os PROBLEMAS DA TERRA: o clima, as florestas, os oceanos, a água.", "E deste lado, as SOLUÇÕES — ideias e projetos de gente como você.", "Cada solução começou como um ESTUDO. É assim que se cria valor aqui."], cond: { tipo: "ouvir" }, alvo: null },
    { id: "missao", titulo: "A primeira missão", cena: "droid", cenaInteira: true, falas: ["Agora sua primeira missão é criar um estudo sobre qualquer tema que te interessa.", "Vou abrir o seu tablet. ✦"], cond: { tipo: "tablet" }, alvo: null },
  ];
})();
/** o índice de um passo */
export const passoDe = (id: IdPassoGuia) => ROTEIRO.findIndex((p) => p.id === id);

/** o que o engine mede desde que o Droid deu a instrução do passo */
export type CtxGuia = { nascendo: boolean; andou: number; correu: number; noAr: number; turbo: number; chegou: boolean; conversaFeita: boolean; tabletAberto: boolean };
/** a pessoa fez o que o Droid pediu? */
export function cumpriu(c: CondGuia, x: CtxGuia): boolean {
  switch (c.tipo) {
    case "nascer": return !x.nascendo;
    case "andar": return x.andou >= c.m;
    case "correr": return x.correu >= c.m;
    case "voar": return x.noAr >= c.m;
    case "turbo": return x.turbo >= c.m;
    case "chegar": return x.chegou;
    case "conversa": return x.conversaFeita;
    case "ouvir": return true;   // (o engine só confere depois que as falas acabam)
    case "tablet": return x.tabletAberto;
    case "fim": return false;   // o fim acaba sozinho (o Droid se despede)
  }
}
/** quanto o Droid espera entre uma fala e outra (s) — e depois da última, antes de começar a conferir */
export const RITMO_FALA = { entre: 3.4, antesDeConferir: 0.8, fimSome: 4.5 } as const;

/** o Droid/guia está no piso da Zaeon (sanidade) */
export const naZaeon = (p: P2) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z) <= CIDADE.andavelR;
