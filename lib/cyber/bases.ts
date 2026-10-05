/**
 * Cyberespaço — LEVEL DESIGN das bases de estudo (HANDOFF lounge cósmico §2 e §5.4). PURO, sem three.
 * Uma base por pessoa, privada, FIXA e canônica: a posição só depende da ORDEM do membro na sala
 * (`members[]` do CollabDoc só cresce), então é a mesma pra todo mundo, em toda sessão, e a base
 * continua no mapa mesmo quando a pessoa sai. Bases ficam num anel em volta da praça: próximas, mas espaçadas.
 */
import { POIS, baseLivreDosPOIs, marcoNav, type POI } from "./landmarks";
import { CIDADE, mundo } from "./ceu";

export const BASE_COLLIDER_R = 2.4;   // raio sólido (plano XZ): o trono do computador (asas até ±2,4 m)
export const BASE_INTERACT_R = 3.4;   // raio de ativação do estudo + clique no monitor
export const BASE_PLATAFORMA_R = 3.4; // plataforma visível
export const PRACA_R = 9;             // raio do anel de bases em torno da praça (origem)
export const BASES_POR_ANEL = 5;      // = LIMITE_SALA
const ESPACO_ENTRE_ANEIS = 9;
/** Direção da base canônica do protótipo (6, -3). */
const ANG0 = Math.atan2(-3, 6);

/**
 * `nivel`: bases fora do chão — "ceu" = na ZAEON (a ilha no céu; base do dono/fundador) e "qg" = no salão do QG do
 * Andrei Bacelar (o marco andável). Sem `nivel` = no anel do chão em volta da praça.
 */
export type NivelBase = "ceu" | "qg";
export type LayoutBase = { x: number; z: number; rot: number; nivel?: NivelBase };

/** bases do dono na Zaeon (céu): locais (relativos ao centro da ilha), viradas pro centro; livres da cidadela e do hangar */
export const BASES_CEU_LOCAIS: { x: number; z: number }[] = [{ x: 0, z: 24 }, { x: 0, z: -24 }, { x: -24, z: -6 }];

/** `rot` tal que o +z local da base aponte de (x,z) para o alvo */
const virarPara = (de: { x: number; z: number }, para: { x: number; z: number }) => Math.atan2(para.x - de.x, para.z - de.z);

/** bases no céu (Zaeon), uma por fundador, na ordem */
export function baseNoCeu(i: number): LayoutBase {
  const l = BASES_CEU_LOCAIS[Math.min(i, BASES_CEU_LOCAIS.length - 1)]!, w = mundo(l);
  return { ...w, rot: virarPara(w, CIDADE.centro), nivel: "ceu" };
}
/** a base do QG: no CENTRO do salão do marco andável, virada pro portão (escada) */
export function baseNoQG(pois: POI[] = POIS): LayoutBase | null {
  const poi = pois.find((p) => p.nav && p.acesso === "dono"), mn = poi ? marcoNav(poi) : null;
  if (!mn) return null;
  const d = mn.nav.escada.dir;
  return { x: mn.x, z: mn.z, rot: Math.atan2(Math.cos(d), Math.sin(d)), nivel: "qg" };
}

/** `rot` deixa o +z local apontando pra praça (o monitor fica nas costas de quem entra). */
export function posicaoDaBase(indice: number): LayoutBase {
  const i = Math.max(0, Math.floor(indice));
  const anel = Math.floor(i / BASES_POR_ANEL), k = i % BASES_POR_ANEL;
  const r = PRACA_R + anel * ESPACO_ENTRE_ANEIS;
  const ang = ANG0 + k * ((2 * Math.PI) / BASES_POR_ANEL) + anel * (Math.PI / BASES_POR_ANEL);
  const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
  return { x, z, rot: Math.atan2(-x, -z) };
}

/**
 * userId → layout, pela ordem dos membros (sem repetidos). Slots do anel que cairiam DENTRO de um ponto de
 * interesse (ex.: a Zaeon em z=-34, a partir do 14º membro) são pulados — a ordem continua determinística.
 */
export function basesDosMembros(ids: string[], pois: POI[] = POIS, especiais: { ceu?: string[]; qg?: string | null } = {}): Map<string, LayoutBase> {
  const m = new Map<string, LayoutBase>();
  // especiais: fundadores na Zaeon (céu) e o dono do QG no centro do salão — fora do anel
  (especiais.ceu ?? []).forEach((id, i) => { if (ids.includes(id) && !m.has(id)) m.set(id, baseNoCeu(i)); });
  const qg = especiais.qg ? baseNoQG(pois) : null;
  if (qg && especiais.qg && ids.includes(especiais.qg) && !m.has(especiais.qg)) m.set(especiais.qg, qg);
  let slot = 0;
  for (const id of ids) {
    if (m.has(id)) continue;
    let lay = posicaoDaBase(slot++);
    while (!baseLivreDosPOIs(lay, BASE_PLATAFORMA_R, pois)) lay = posicaoDaBase(slot++);
    m.set(id, lay);
  }
  return m;
}

/** Onde a pessoa nasce no cyberespaço: no caminho entre a praça e a própria base; fora do chão, na frente da base. */
export function spawnDaBase(b: LayoutBase | undefined): { x: number; z: number } {
  if (b?.nivel) return localParaMundo(b, 0, 2.6);
  return b ? { x: b.x * 0.45, z: b.z * 0.45 } : { x: 0, z: 0 };
}

/** Pontos locais da base (mesa/tela/cadeira) → mundo. */
export function localParaMundo(b: LayoutBase, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
}

/** Pose canônica de alguém SENTADO na própria base (seed do avatar remoto antes da 1ª posição chegar). */
export function poseNoAssento(b: LayoutBase): { x: number; z: number; facing: number } {
  const s = localParaMundo(b, 0, -0.15);
  return { x: s.x, z: s.z, facing: b.rot + Math.PI };
}
