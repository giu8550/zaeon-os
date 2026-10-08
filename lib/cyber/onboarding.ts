/**
 * Cyberespaço — o NASCIMENTO e o TOUR de quem chega (PURO, sem three).
 *
 * Quem NUNCA entrou no cyberespaço (o servidor sabe: User.cyberNasceuEm) NASCE num TUBO DE ENSAIO — os tubos ficam em
 * volta da Cidade Zaeon, na linha da muralha, entre as torres de cristal; o do novato é um dos perto da Recepção (o lar
 * da Zaeon, a anfitriã — lib/cyber/agentes): o líquido escoa, o vidro sobe e a pessoa sai. A
 * Zaeon vem buscar e GUIA, andando do lado: a casa dela → a capela (os desktops da Sala de Estudos) → as motos → o
 * buraco negro (o metrô pros outros lugares). Cada passo termina quando a pessoa chega no alvo (ou toca "Próximo").
 * Hoje o roteiro é fixo; no overhaul a fala vem do cérebro dela.
 */
import type { P2 } from "./colisao";
import { CIDADE, DOCA_ANGULO, anguloDaTorre, computadoresLocais, mundo, naAberturaDaEscada, TORRES_MURALHA } from "./ceu";
import { LAR_LOCAL, POIS, marcoNav } from "./landmarks";
import { LOTES } from "./motos";
import { NOS } from "./buracos";
import { deEscada } from "./nav";

/** a chave do "já nasci" (localStorage) — só a reserva quando o servidor não diz (prévia/sem sala) */
export const CHAVE_ONBOARDING = "zaeon:cyber:onboarding:v1";
/** nasce no tubo? Quem nunca entrou no cyberespaço (`visto` = o servidor já marcou o nascimento); o dono nasce na nave
 *  dele (a não ser forçado: `?nascer=1`) */
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
/** os tubos onde os NOVATOS nascem: os mais perto da Recepção (o tour começa lá) */
export const TUBOS_DO_NOVATO: number[] = (() => {
  const a = Math.atan2(LAR_LOCAL.z, LAR_LOCAL.x);
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

export type IdPassoGuia = "nascer" | "lar" | "capela" | "motos" | "buraco" | "fim";
export type PassoGuia = { id: IdPassoGuia; titulo: string; fala: string; alvo: (P2 & { r: number }) | null };

/** o ROTEIRO da Zaeon (cada `alvo` em mundo: chegou dentro do raio → próximo passo) */
export const ROTEIRO: PassoGuia[] = (() => {
  const pe = peDaRecepcao(), d0 = mundo(computadoresLocais()[0]!), lote = LOTES.find((l) => l.id === "zaeon")!, bn = NOS.zaeon.anel;
  return [
    { id: "nascer", titulo: "Bem-vindo ao hiperespaço", fala: "Oi! Eu sou a Zaeon, a anfitriã daqui. Você acabou de nascer no hiperespaço — calma, o vidro já vai abrir.", alvo: null },
    { id: "lar", titulo: "A Recepção", fala: "Esta é a minha casa, a Recepção. Sempre que se perder, volte aqui e fale comigo. Vem comigo até a escada.", alvo: { ...pe, r: 6 } },
    { id: "capela", titulo: "A Capela", fala: "Na capela, os desktops em volta do globo abrem a sua Sala de Estudos. Chegue perto de um e aperte F.", alvo: { ...d0, r: 6 } },
    { id: "motos", titulo: "As motos voadoras", fala: "As motos são de todo mundo. F monta; W acelera, A e D fazem a curva, Shift dá o boost. Quando alguém leva uma, o robô fabrica outra.", alvo: { x: lote.x, z: lote.z, r: 14 } },
    { id: "buraco", titulo: "O buraco negro", fala: "Este é o metrô do hiperespaço. Entre no buraco negro e escolha pra onde ir: UNILAB, UFC, Unifor, UECE, a Solana House ou a Praça, onde fica a sua base.", alvo: { x: bn.x, z: bn.z, r: 8 } },
    { id: "fim", titulo: "Tudo seu", fala: "Pronto! Agora o hiperespaço é seu. Quando quiser rever o caminho, volte à Recepção e fale comigo. Bons estudos ✦", alvo: null },
  ];
})();

/** chegou no alvo do passo `i`? → o próximo passo; senão o mesmo */
export function avancarGuia(i: number, p: P2): number {
  const a = ROTEIRO[i]?.alvo; if (!a) return i;
  return Math.hypot(p.x - a.x, p.z - a.z) <= a.r ? Math.min(ROTEIRO.length - 1, i + 1) : i;
}
/** a agente está no piso da Zaeon (sanidade) */
export const naZaeon = (p: P2) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z) <= CIDADE.andavelR;
