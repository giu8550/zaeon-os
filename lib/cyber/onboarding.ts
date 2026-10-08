/**
 * Cyberespaço — o NASCIMENTO e o TOUR de quem chega (PURO, sem three).
 *
 * Quem NUNCA entrou no cyberespaço (o servidor sabe: User.cyberNasceuEm) NASCE num TUBO DE ENSAIO — os tubos ficam em
 * volta da Cidade Zaeon, na linha da muralha, entre as torres de cristal; o do novato é um dos perto da Recepção (o lar
 * do DROID, o agente de onboarding — lib/cyber/agentes): o líquido escoa, o vidro sobe e a pessoa sai. O Droid (um
 * ofanim) sai de um mini portal e ENSINA fazendo: fala no balão (e no chat) e ESPERA a pessoa cumprir cada instrução
 * (andar → voar → o centro da capela → conhecer a Zaeon (o holograma dela sai do globo e conversa —
 * lib/cyber/conversaZaeon) → montar numa moto → pilotar → descer → os portais (aqui ela fica LIVRE pra explorar) → na
 * Praça, a sua máquina de estudos → despedida). É de cada um: spawnado só no cliente da própria pessoa (nada vai pela
 * rede). E até cruzar o 1º portal a pessoa está numa INSTÂNCIA: a Zaeon é só dela (não vê ninguém, ninguém vê ela
 * andando) — dali em diante, o mundo com as pessoas reais.
 */
import type { P2 } from "./colisao";
import { CIDADE, DOCA_ANGULO, anguloDaTorre, mundo, naAberturaDaEscada, TORRES_MURALHA } from "./ceu";
import { LAR_LOCAL, POIS, marcoNav } from "./landmarks";
import { LOTES } from "./motos";
import { NOS } from "./buracos";
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
 * O que a pessoa tem que FAZER pro Droid seguir (ele espera até ela fazer — `cumpriu`): nascer (o tubo abriu), andar
 * `m` metros, voar `m` metros acima do chão, CHEGAR no alvo do passo, conversar com a Zaeon, montar numa moto, pilotar
 * `m` metros (ou já ter descido depois de rodar um pouco), descer, CRUZAR um portal (buraco negro), estar na PRAÇA e
 * chegar perto da PRÓPRIA base (a máquina de estudos).
 */
export type CondGuia = { tipo: "nascer" } | { tipo: "andar"; m: number } | { tipo: "voar"; m: number } | { tipo: "chegar" } | { tipo: "conversa" } | { tipo: "montar" } | { tipo: "pilotar"; m: number } | { tipo: "descer" } | { tipo: "portal" } | { tipo: "praca" } | { tipo: "base" } | { tipo: "fim" };
export type IdPassoGuia = "nascer" | "andar" | "voar" | "capela" | "zaeon" | "moto" | "pilotar" | "descer" | "portal" | "explorar" | "base" | "fim";
/** um passo do tutorial: as FALAS do Droid (balão + chat, uma depois da outra; a última fica até a pessoa cumprir), o
 *  que ela tem que fazer e, se for "ir até", o alvo (o Droid vai na frente; o farol marca). `livre` = o Droid some e a
 *  pessoa explora sozinha (o tutorial só espera ela chegar na praça) */
export type PassoGuia = { id: IdPassoGuia; titulo: string; falas: string[]; cond: CondGuia; alvo: (P2 & { r: number }) | null; livre?: boolean };

/** onde o Droid leva no CENTRO da capela: ao lado do globo (a Zaeon sai dele), do lado de quem vem do leste */
export const CENTRO_DA_CAPELA_LOCAL = { x: 14, z: 3 };
/** a partir de qual passo o mundo é COMPARTILHADO (antes, a Zaeon do tutorial é só da pessoa — a "instância") */
export const PASSO_FIM_DA_INSTANCIA: IdPassoGuia = "explorar";

/** o ROTEIRO do Droid (mundo) */
export const ROTEIRO: PassoGuia[] = (() => {
  const centro = mundo(CENTRO_DA_CAPELA_LOCAL), lote = LOTES.find((l) => l.id === "zaeon")!, bn = NOS.zaeon.anel;
  return [
    { id: "nascer", titulo: "Nascendo", falas: [], cond: { tipo: "nascer" }, alvo: null },
    { id: "andar", titulo: "Andar", falas: ["Oi! Eu sou o Droid, o seu guia no hiperespaço ✦", "Use W A S D (ou o joystick) pra andar. Vem, anda um pouco comigo!"], cond: { tipo: "andar", m: 6 }, alvo: null },
    { id: "voar", titulo: "Voar", falas: ["Isso! Você tem uma mochila a jato.", "Segure ESPAÇO pra subir. Solte pra descer planando."], cond: { tipo: "voar", m: 4 }, alvo: null },
    { id: "capela", titulo: "A capela", falas: ["Voando bem! 🚀", "Agora vem comigo até o centro da capela. Tem alguém querendo te conhecer…"], cond: { tipo: "chegar" }, alvo: { ...centro, r: 7 } },
    { id: "zaeon", titulo: "A Zaeon", falas: ["Olha o globo… ✦"], cond: { tipo: "conversa" }, alvo: null },
    { id: "moto", titulo: "As motos", falas: ["Vamos pegar uma moto! Me segue até o estacionamento.", "Chegue perto de uma e aperte F."], cond: { tipo: "montar" }, alvo: { x: lote.x, z: lote.z, r: 14 } },
    { id: "pilotar", titulo: "Pilotar", falas: ["W acelera, A e D fazem a curva e Shift dá o boost.", "Dá uma volta!"], cond: { tipo: "pilotar", m: 60 }, alvo: null },
    { id: "descer", titulo: "Descer", falas: ["Mandou bem!", "Pra parar: P pousa a moto e F desce dela."], cond: { tipo: "descer" }, alvo: null },
    { id: "portal", titulo: "Os portais", falas: ["Agora o mais legal: os buracos negros são os portais do hiperespaço. Me segue!", "A partir daqui você está livre pra explorar — as universidades, a Solana House… Quando quiser, vá pra Praça: lá está a sua máquina de estudos."], cond: { tipo: "portal" }, alvo: { x: bn.x, z: bn.z, r: 8 } },
    { id: "explorar", titulo: "Livre · vá à Praça", falas: [], cond: { tipo: "praca" }, alvo: null, livre: true },
    { id: "base", titulo: "A sua máquina de estudos", falas: ["Bem-vindo à Praça! Esta é a sua máquina de estudos ✦", "Pare perto dela e aperte F: ela abre a sua Sala de Estudos."], cond: { tipo: "base" }, alvo: null },
    { id: "fim", titulo: "Tudo seu", falas: ["É isso! Agora o hiperespaço é seu ✦", "Se quiser rever o caminho, me chame na Recepção, na Zaeon. Bons estudos!"], cond: { tipo: "fim" }, alvo: null },
  ];
})();
/** o índice de um passo */
export const passoDe = (id: IdPassoGuia) => ROTEIRO.findIndex((p) => p.id === id);

/** o que o engine mede desde que o Droid deu a instrução do passo */
export type CtxGuia = { nascendo: boolean; andou: number; noAr: number; chegou: boolean; conversaFeita: boolean; naMoto: boolean; motoAndou: number; cruzouPortal: boolean; naPraca: boolean; pertoDaBase: boolean };
/** a pessoa fez o que o Droid pediu? */
export function cumpriu(c: CondGuia, x: CtxGuia): boolean {
  switch (c.tipo) {
    case "nascer": return !x.nascendo;
    case "andar": return x.andou >= c.m;
    case "voar": return x.noAr >= c.m;
    case "chegar": return x.chegou;
    case "conversa": return x.conversaFeita;
    case "montar": return x.naMoto;
    case "pilotar": return x.motoAndou >= c.m || (!x.naMoto && x.motoAndou >= 10);
    case "descer": return !x.naMoto;
    case "portal": return x.cruzouPortal;
    case "praca": return x.naPraca;
    case "base": return x.pertoDaBase;
    case "fim": return false;   // o fim acaba sozinho (o Droid se despede e some no portal)
  }
}
/** quanto o Droid espera entre uma fala e outra (s) — e depois da última, antes de começar a conferir */
export const RITMO_FALA = { entre: 3.4, antesDeConferir: 0.8, fimSome: 4.5 } as const;

/** o Droid/guia está no piso da Zaeon (sanidade) */
export const naZaeon = (p: P2) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z) <= CIDADE.andavelR;
