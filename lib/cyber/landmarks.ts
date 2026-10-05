/**
 * Cyberespaço — PONTOS DE INTERESSE (estruturas megalíticas interagíveis). PURO, sem three.
 * Fonte única do level-design dos marcos (docs/HANDOFF_CYBERESPACO_LANDMARKS.md): adicionar uma instituição =
 * uma entrada aqui + um preset visual em components/cyber/Landmark.ts. O primeiro é a ZAEON, o marco-mãe:
 * flutua atrás da praça e a base do dono (fundador) fica no topo dela.
 *
 * Marca/jurídico: estruturas estilizadas e originais; o nome é só rótulo. Não clonar logo/arquitetura real
 * sem permissão — checklist antes de publicar o marco de uma instituição real.
 */
import type { NavPOI } from "./nav";
import { ESTACIONAMENTO, LOTES } from "./motos";

export type AcessoPOI = "publico" | "dono";
export type PresetPOI = "zaeon" | "generico" | "heliporto" | "estacionamento";
export type POI = {
  id: string;            // slug estável
  nome: string;          // rótulo flutuante
  org: string;           // descrição curta do painel
  preset: PresetPOI;
  x: number; z: number;  // posição no plano (FORA do anel de bases)
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

/**
 * QG DO ANDREI (antiga "Zaeon" do chão). Parâmetros do protótipo (docs/prototypes/zaeon-landmark.html) × ESCALA: maior e mais alto que o
 * protótipo, à esquerda-atrás da praça (longe do eixo do buraco negro, que fica no centro da tela), com a ESCADA
 * virada pra praça e o PORTÃO das muralhas alinhado a ela.
 */
function zaeonPOI(): POI {
  const S = 1.6, x = -30, z = -48;
  const altura = 7 * S + 1.5;                       // ápice da ilha (cone 7×S) fica 1,5 acima do chão
  const pisoY = altura + 0.15 * S;                  // topo do piso interno
  const bordaR = 6.4 * S;                           // borda do PISO (a ilha do protótipo é um cone com o ápice no piso)
  const chaoR = 9 * S + 0.4;                        // base do cone (1,5 m acima do chão): sólida no chão
  const dir = Math.atan2(-z, -x);                   // a escada aponta pra praça (origem)
  return {
    // o marco ANDÁVEL agora é o QG do Andrei Bacelar (a base dele fica no centro do salão). "Zaeon" passou a ser a
    // ilha no céu (lib/cyber/ceu.ts), onde fica a base do dono. O id "zaeon" segue por compatibilidade (presença/testes).
    id: "zaeon", nome: "QG do Andrei", org: "Base do Andrei Bacelar.",
    preset: "zaeon", x, z, escala: S,
    footprintR: chaoR, interactR: chaoR + 6,
    altura, topo: { y: 6.6 }, acesso: "dono",
    nav: {
      pisoY, bordaR, chaoR,
      muralhaR: 6.3 * S, muralhaN: 16, muralhaColR: 2.0, portaoMeia: 0.4,
      pilares: { n: 6, r: 3.4 * S, colR: 0.26 * S + 0.35 },
      escada: { dir, largura: 4.2, comprimento: pisoY / 0.55 },
    },
  };
}

/**
 * HELIPORTO — o pouso da nave perto da praça (é onde se desce pra interagir com os outros). Disco no chão, plano e
 * andável; as bases desviam dele. Destino do atalho "⬇ Chão". Longe da Zaeon, da escada e do portal do buraco negro.
 */
export const HELIPORTO = { x: 24, z: 24, r: 5 };
function heliportoPOI(): POI {
  return {
    id: "heliporto", nome: "Heliporto", org: "Pouso da nave, perto da praça.",
    preset: "heliporto", x: HELIPORTO.x, z: HELIPORTO.z,
    footprintR: HELIPORTO.r, interactR: HELIPORTO.r + 3, solido: false,
    altura: 0, acesso: "publico",
  };
}

/** ESTACIONAMENTO das motos voadoras do CHÃO (lib/cyber/motos.ts; o da Zaeon é desenhado na ilha) — chão plano, as bases desviam; o desenho é do
 *  components/cyber/Estacionamento.ts (não é um "marco" com painel: clicar numa moto = montar) */
function estacionamentoPOI(): POI {
  return {
    id: "estacionamento", nome: "Estacionamento", org: "Motos voadoras — pra todo mundo.",
    preset: "estacionamento", x: LOTES[0]!.x, z: LOTES[0]!.z,
    footprintR: ESTACIONAMENTO.r, interactR: ESTACIONAMENTO.r + 3, solido: false, altura: 0, acesso: "publico",
  };
}
export const POIS: POI[] = [zaeonPOI(), heliportoPOI(), estacionamentoPOI()];

export const colisoresDosPOIs = (pois: POI[] = POIS) => pois.filter((p) => p.solido !== false).map((p) => ({ x: p.x, z: p.z, r: p.footprintR }));

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
  return pois.every((p) => {
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
