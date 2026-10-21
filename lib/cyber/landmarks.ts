/**
 * Cyberespaço — PONTOS DE INTERESSE (estruturas megalíticas interagíveis). PURO, sem three.
 * Fonte única do level-design dos marcos (docs/HANDOFF_CYBERESPACO_LANDMARKS.md): adicionar uma instituição =
 * uma entrada aqui + um preset visual em components/cyber/Landmark.ts. O primeiro é a ZAEON, o marco-mãe:
 * flutua atrás da praça e a base do dono (fundador) fica no topo dela.
 *
 * Marca/jurídico: estruturas estilizadas e originais; o nome é só rótulo. Não clonar logo/arquitetura real
 * sem permissão — checklist antes de publicar o marco de uma instituição real.
 */
import { MIRANTES } from "./terra";
import type { NavPOI } from "./nav";
import { LOTES, tamanhoDoLote } from "./motos";
import { CIDADE, mundo } from "./ceu";
import { CHAO, naPracaLocal } from "./praca";

export type AcessoPOI = "publico" | "dono";
export type PresetPOI = "zaeon" | "generico" | "heliporto" | "estacionamento";
export type POI = {
  id: string;            // slug estável
  nome: string;          // rótulo flutuante
  org: string;           // descrição curta do painel
  preset: PresetPOI;
  x: number; z: number;  // posição no plano (FORA do anel de bases)
  /** a altura (mundo) do PISO em que o marco se apoia: a praça (lib/cyber/praca `CHAO`) ou o piso da Zaeon (a Recepção) */
  base?: number;
  footprintR: number;    // raio sólido (colisão no chão) — e o chão que as bases não podem ocupar
  /** `false` = chão plano andável (ex.: heliporto): ninguém colide, mas as bases continuam desviando */
  solido?: boolean;
  interactR: number;     // raio que acende o rótulo + habilita o clique
  altura: number;        // quão alto flutua (base da estrutura acima do chão)
  topo?: { y: number };  // plataforma do topo (altura LOCAL ao group), onde pousa a base do dono
  acesso: AcessoPOI;     // quem pode subir/entrar ("dono" = fundador, validado no SERVIDOR)
  link?: string;         // destino do painel
  /** escala uniforme do preset (o protótipo é 1×) */
  escala?: number;
  /** marco ANDÁVEL (escada + plataforma + muralhas/pilares sólidos) — ver lib/cyber/nav.ts */
  nav?: NavPOI;
};

/** onde fica a RECEPÇÃO no piso da Zaeon (local da ilha): na QUINA nordeste, perto da borda — é o mirante 0 dos 4
 *  MIRANTES DA TERRA, simétricos nas diagonais (lib/cyber/terra); a escada desce virada pro centro da ilha */
export const LAR_LOCAL = { x: MIRANTES[0]!.x, z: MIRANTES[0]!.z };

/**
 * A RECEPÇÃO — a antiga base do Andrei ("QG do Andrei", o marco andável que ficava no chão perto da praça): saiu do
 * chão (que não existe mais) e subiu pro piso da CIDADE ZAEON. Virou o LAR DA ZAEON, a anfitriã — a agente de
 * onboarding (lib/cyber/agentes): a mesa dela fica no centro do salão e quem nasce no hiperespaço sai de um tubo de
 * ensaio ao lado (lib/cyber/onboarding). Ninguém mais é "dono" dela (o topo continua sendo do fundador).
 * Parâmetros do protótipo (docs/prototypes/zaeon-landmark.html) × ESCALA, com a ESCADA virada pro centro da ilha e o
 * PORTÃO das muralhas alinhado a ela. Tudo é relativo à `base` (o piso da Zaeon).
 */
function zaeonPOI(): POI {
  return { ...marcoPiramide(LAR_LOCAL), id: "zaeon", nome: "Recepção", org: "O lar da Zaeon, a anfitriã do hiperespaço.", acesso: "dono" };
}
/** os outros 3 MIRANTES DA TERRA: a mesma pirâmide (escada, muralhas, cabaninha), abertos a todos */
function mirantePOI(i: number): POI {
  return { ...marcoPiramide(MIRANTES[i]!), id: `mirante-${i}`, nome: "Mirante da Terra", org: "Os observadores da Terra: telão, globo, árvores-jardim e droids.", acesso: "publico" };
}
/** a pirâmide andável (a da antiga base do Andrei) num ponto LOCAL da Zaeon, com a escada virada pro centro */
function marcoPiramide(local: { x: number; z: number }): Omit<POI, "id" | "nome" | "org" | "acesso"> {
  const S = 1.6, { x, z } = mundo(local);
  const altura = 7 * S + 1.5;                       // ápice da ilha (cone 7×S) fica 1,5 acima do piso
  const pisoY = altura + 0.15 * S;                  // topo do piso interno
  const bordaR = 6.4 * S;                           // borda do PISO (a ilha do protótipo é um cone com o ápice no piso)
  const chaoR = 9 * S + 0.4;                        // base do cone (1,5 m acima do piso): sólida no piso
  const dir = Math.atan2(-local.z, -local.x);   // a escada aponta pro centro da ilha
  return {
    // (o id "zaeon" da Recepção segue por compatibilidade: o preset visual, presença e testes)
    preset: "zaeon", x, z, base: CIDADE.pisoY, escala: S,
    footprintR: chaoR, interactR: chaoR + 6,
    altura, topo: { y: 6.6 },
    nav: {
      pisoY, bordaR, chaoR,
      muralhaR: 6.3 * S, muralhaN: 16, muralhaColR: 2.0, portaoMeia: 0.4,
      pilares: { n: 6, r: 3.4 * S, colR: 0.26 * S + 0.35 },
      escada: { dir, largura: 4.2, comprimento: pisoY / 0.55 },
    },
  };
}

/**
 * HELIPORTO — o pouso da nave na PRAÇA (a ilha flutuante das bases, lib/cyber/praca). Disco plano e andável; as bases
 * desviam dele. Destino do atalho "Heliporto".
 */
export const HELIPORTO = { ...naPracaLocal(24, 24), r: 5 };
function heliportoPOI(): POI {
  return {
    id: "heliporto", nome: "Heliporto", org: "Pouso da nave, perto da praça.",
    preset: "heliporto", x: HELIPORTO.x, z: HELIPORTO.z, base: CHAO,
    footprintR: HELIPORTO.r, interactR: HELIPORTO.r + 3, solido: false,
    altura: 0, acesso: "publico",
  };
}

/** ESTACIONAMENTO das motos voadoras da PRAÇA (lib/cyber/motos.ts; o da Zaeon é desenhado na ilha) — piso plano, as bases desviam; o desenho é do
 *  components/cyber/Estacionamento.ts (não é um "marco" com painel: clicar numa moto = montar) */
function estacionamentoPOI(): POI {
  return {
    id: "estacionamento", nome: "Estacionamento", org: "Motos voadoras — pra todo mundo.",
    preset: "estacionamento", x: LOTES[0]!.x, z: LOTES[0]!.z, base: CHAO,
    footprintR: tamanhoDoLote(LOTES[0]!).r, interactR: tamanhoDoLote(LOTES[0]!).r + 3, solido: false, altura: 0, acesso: "publico",
  };
}
export const POIS: POI[] = [zaeonPOI(), mirantePOI(1), heliportoPOI(), estacionamentoPOI()];   // (o mirante 3, na outra ponta, saiu — fps; o 2, cópia do 1, saiu também — out/2026)

/** os marcos apoiados na PRAÇA (o piso dela é o `CHAO`; os da Zaeon têm a `base` no piso dela) */
export const naPracaPOI = (p: POI) => p.base === undefined || p.base === CHAO;
export const colisoresDosPOIs = (pois: POI[] = POIS) => pois.filter((p) => p.solido !== false && naPracaPOI(p)).map((p) => ({ x: p.x, z: p.z, r: p.footprintR }));

/** Flag de render (BUILD): "1" liga, "0" desliga; sem valor → ligada em dev, desligada em produção. */
export function landmarksOn(env: { flag?: string; nodeEnv?: string } = { flag: process.env.NEXT_PUBLIC_CYBER_LANDMARKS, nodeEnv: process.env.NODE_ENV }): boolean {
  if (env.flag === "1" || env.flag === "true") return true;
  if (env.flag === "0" || env.flag === "false") return false;
  return env.nodeEnv !== "production";
}

/** O POI mais próximo dentro do próprio `interactR` (acende rótulo / habilita clique), ou null. */
export function poiPerto(p: { x: number; z: number }, pois: POI[] = POIS): POI | null {
  let melhor: { poi: POI; d: number } | null = null;
  for (const poi of pois) { const d = Math.hypot(p.x - poi.x, p.z - poi.z); if (d < poi.interactR && (!melhor || d < melhor.d)) melhor = { poi, d }; }
  return melhor?.poi ?? null;
}

/** Ponto na borda do POI (fora do colisor) mais perto de quem está chegando — destino do "aproximar". */
export function bordaDoPOI(poi: POI, de: { x: number; z: number }, folga = 1.5): { x: number; z: number } {
  const dx = de.x - poi.x, dz = de.z - poi.z, d = Math.hypot(dx, dz) || 1;
  const r = poi.footprintR + folga;
  return { x: poi.x + (dx / d) * r, z: poi.z + (dz / d) * r };
}

/** Uma base (centro + raio da plataforma) não pode encostar em nenhum POI. */
export function baseLivreDosPOIs(b: { x: number; z: number }, raioBase: number, pois: POI[] = POIS, folga = 2): boolean {
  return pois.filter(naPracaPOI).every((p) => {
    if (Math.hypot(b.x - p.x, b.z - p.z) <= p.footprintR + raioBase + folga) return false;
    if (!p.nav) return true;
    // a escada também ocupa chão: a base não pode encostar nela
    const { dir, largura, comprimento } = p.nav.escada, ax = Math.cos(dir), az = Math.sin(dir);
    const rx = b.x - p.x, rz = b.z - p.z, along = rx * ax + rz * az, lat = -rx * az + rz * ax;
    const u = along - p.nav.bordaR, uc = Math.max(0, Math.min(comprimento, u));
    return Math.hypot(u - uc, Math.max(0, Math.abs(lat) - largura / 2)) > raioBase + folga;
  });
}

/** O marco andável como `MarcoNav` (pra lib/cyber/nav). */
export const marcoNav = (p: POI) => (p.nav ? { x: p.x, z: p.z, nav: p.nav } : null);
