/**
 * Cyberespaço — MOCHILA A JATO (no lugar do pulo). PURO, sem three. Segurar ESPAÇO (ou VOAR no celular) sobe; soltar
 * cai com gravidade até pousar. O voo é LIMITADO: o teto fica pouco acima do alto das muralhas do QG do Andrei — dá
 * pra sobrevoar o QG e pousar no salão, mas não ir pro céu (pra isso existe a nave).
 *
 * No ar, a colisão no plano depende da altura: abaixo do piso do QG a ilha dele é sólida (desliza pra fora); entre o
 * piso e o alto das muralhas valem as muralhas (com o portão) e os pilares; acima, livre. As bases do chão só
 * bloqueiam quem voa baixo. O chão embaixo de quem voa é o do QG (escada/plataforma) ou o do mapa.
 */
import { alturaEm, colisoresDoAlto, naEscada, type MarcoNav } from "./nav";
import { empurrarParaFora, type Colisor, type P2 } from "./colisao";

export const JET = {
  sobe: 7,          // m/s subindo (segurando)
  aceleracao: 4,    // quão rápido chega na velocidade de subida
  // a QUEDA LIVRE com PESO (out/2026, o dono: "a queda livre tá mal feita — peso e velocidade conforme cai"): soltou, a
  // gravidade acelera de verdade até a velocidade terminal; empurrando pra frente, plana (cai devagar)
  gravidade: 22,    // m/s² caindo (soltou)
  quedaMax: 55,     // m/s — a velocidade TERMINAL (uns 2,5 s de queda)
  quedaPlaneio: 6,  // m/s — planando (empurrando pra frente sem subir)
  /** a BOLHA DE GRAVIDADE ZERO: um TOQUE curto no pulo com a mochila — flutua dentro dela por `dur` s (a gravidade vira
   *  `g`× a normal, o embalo fica) e ela estoura */
  zeroG: { toque: 0.45, dur: 4.5, g: 0.04, sobe: 2.4 },
  folgaTeto: 0.8,   // o teto fica isso acima do alto das muralhas do QG
  alturaBases: 4.6, // abaixo disso as bases do chão (trono + telas) são sólidas
  // IMPULSO no ar: W dispara os jatos PRA FRENTE (é assim que se atravessa o mapa de mochila)
  velFrente: 16,    // m/s com W (frente) no ar
  velLado: 8,       // m/s de lado/pra trás no ar
  inerciaAr: 2.2,   // quão rápido chega na velocidade (embalo)
  arrasto: 1.1,     // soltou: desacelera devagar (mantém um pouco do embalo)
  planeio: 0.45,    // empurrando pra frente sem subir: a gravidade pesa menos (plana)
};
/** a velocidade horizontal no ar (m/s, mundo): vai até `alvo` com embalo; sem comando, o arrasto freia devagar */
export function passoHorizontalJet(v: { x: number; z: number }, alvo: { x: number; z: number } | null, dt: number): { x: number; z: number } {
  if (!alvo) { const k = Math.exp(-JET.arrasto * dt); return { x: v.x * k, z: v.z * k }; }
  const k = Math.min(1, dt * JET.inerciaAr);
  return { x: v.x + (alvo.x - v.x) * k, z: v.z + (alvo.z - v.z) * k };
}


/** força do impacto ao pousar: 0 = pousinho suave … 1 = caindo na velocidade máxima (quedaMax) */
export const impactoDoPouso = (vy: number) => Math.max(0, Math.min(1, (-vy - 2) / 28));   // (cheio a partir de ~30 m/s: a queda livre de verdade)
/** som CONTÍNUO da mochila: segurando = empuxo cheio (mais agudo subindo); solto no ar = chiado baixinho; no chão = mudo */
export function somDoJato(noAr: boolean, segurando: boolean, vy: number): { volume: number; taxa: number } {
  if (!noAr) return { volume: 0, taxa: 0.85 };
  if (segurando) return { volume: 1, taxa: 0.94 + 0.14 * Math.max(0, Math.min(1, vy / JET.sobe)) };
  return { volume: 0.16, taxa: 0.78 };
}

/** o QG como marco andável + a altura do alto das muralhas (mundo) */
export type QGNoAr = MarcoNav & { topoMuralhas: number };

/** teto do voo (acima do chão de onde se decolou): pouco acima das muralhas do QG */
export const tetoDoJet = (qg: QGNoAr | null) => (qg ? qg.topoMuralhas : 18.6) + JET.folgaTeto;

/** um passo vertical: subindo acelera até `JET.sobe`; soltou, a gravidade puxa (até `quedaMax`); nunca passa do teto */
export function passoVertical(y: number, vy: number, subindo: boolean, dt: number, teto: number, planando = false, gravidade = 1): { y: number; vy: number } {
  if (subindo) vy += (JET.sobe - vy) * Math.min(1, dt * JET.aceleracao);
  else if (planando && vy < -JET.quedaPlaneio) vy = Math.min(-JET.quedaPlaneio, vy + JET.gravidade * 1.5 * dt);   // (abriu o planeio caindo: freia até a velocidade de planar)
  else vy = Math.max(vy - JET.gravidade * (planando ? JET.planeio : 1) * gravidade * dt, planando ? -JET.quedaPlaneio : -JET.quedaMax);
  y += vy * dt;
  if (y > teto) { y = teto; vy = Math.min(vy, 0); }
  return { y, vy };
}

const angDif = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

/**
 * Colisão no plano de quem voa: `prev → prop` à altura `y` (mundo, no chão do mapa); `yAnt` = a altura no quadro
 * anterior (quem vinha de cima do piso está POUSANDO no salão, não batendo na ilha).
 */
export function resolverNoAr(prev: P2, prop: P2, y: number, yAnt: number, qg: QGNoAr | null, colisoresChao: Colisor[]): P2 {
  let q = prop;
  if (y < JET.alturaBases) q = empurrarParaFora(q, colisoresChao);
  if (!qg) return q;
  const { pisoY, chaoR, bordaR, muralhaR, portaoMeia, escada } = qg.nav;
  const dx = q.x - qg.x, dz = q.z - qg.z, d = Math.hypot(dx, dz);
  const descendoNoSalao = yAnt >= pisoY - 0.05 && d <= bordaR;
  if (y < pisoY - 0.05 && !descendoNoSalao) {
    // abaixo do piso: a ilha é sólida (menos a faixa da escada, onde se pousa nos degraus)
    if (d < chaoR && !naEscada(qg, q)) { const k = d > 1e-4 ? chaoR / d : 1; q = { x: qg.x + (d > 1e-4 ? dx * k : chaoR), z: qg.z + (d > 1e-4 ? dz * k : 0) }; }
  } else if (y >= pisoY - 0.05 && y < qg.topoMuralhas) {
    // na altura das muralhas: o anel é sólido (menos o PORTÃO, alinhado à escada) e os pilares também
    const BANDA = 0.9, noPortao = angDif(Math.atan2(dz, dx), escada.dir) < portaoMeia;
    if (!noPortao && Math.abs(d - muralhaR) < BANDA) {
      const dPrev = Math.hypot(prev.x - qg.x, prev.z - qg.z), r = dPrev >= muralhaR ? muralhaR + BANDA : muralhaR - BANDA, k = d > 1e-4 ? r / d : 1;
      q = { x: qg.x + dx * k, z: qg.z + dz * k };
    }
    if (d <= bordaR + 0.6) q = empurrarParaFora(q, colisoresDoAlto(qg).filter((c) => Math.hypot(c.x - qg.x, c.z - qg.z) < muralhaR - 1));   // pilares
  }
  return q;
}

/** o chão embaixo de quem voa: escada/plataforma do QG ou o chão do mapa */
export const chaoNoAr = (p: P2, qg: QGNoAr | null): number => (qg ? alturaEm(qg, p) : 0);
