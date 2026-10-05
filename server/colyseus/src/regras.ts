/**
 * Regras PURAS da sala do Colyseus (espelham o que o app já faz no POST /pos — lib/lounge3d/sala.ts):
 *  - a pose que chega do cliente é saneada (só números finitos, com teto; lixo → ignorada);
 *  - REGALIAS (topo da Zaeon, céu, nave voando/parada) só valem pra quem o TOKEN diz que é fundador;
 *  - a voz (signaling WebRTC) só vai pra alguém que está NA MESMA sala, com teto de tamanho.
 */
export const MAX_JOGADORES = 5;
const COORD = 600;   // metade do chão (1200 m) — a universidade fica a ~330 m da praça

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;

export type Pose = {
  x: number; z: number; facing: number; moving: boolean; sit: boolean;
  topo: boolean; ceu: boolean;
  /** pilotando: altura + rumo (só fundador) */ voo: { y: number; yaw: number } | null;
  /** nave pousada fora do hangar (só fundador) */ naveParada: { x: number; y: number; z: number; yaw: number } | null;
  /** mochila a jato: altura no mundo (qualquer um) */ jet: number | null;
  /** em pé num lugar alto (dorso da nave) */ alt: number | null;
};

/** saneia a pose do cliente; `fundador` vem do TOKEN (servidor), nunca do cliente */
export function sanitizarPose(raw: unknown, fundador: boolean): Pose | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const x = num(r.x, -COORD, COORD), z = num(r.z, -COORD, COORD), facing = num(r.facing, -10, 10);
  if (x === null || z === null || facing === null) return null;
  let voo: Pose["voo"] = null, naveParada: Pose["naveParada"] = null;
  if (fundador && r.voo && typeof r.voo === "object") {
    const v = r.voo as Record<string, unknown>, y = num(v.y, 0, 400), yaw = num(v.yaw, -10, 10);
    if (y !== null && yaw !== null) voo = { y, yaw };
  }
  if (fundador && r.naveParada && typeof r.naveParada === "object") {
    const v = r.naveParada as Record<string, unknown>;
    const nx = num(v.x, -COORD, COORD), ny = num(v.y, 0, 400), nz = num(v.z, -COORD, COORD), yaw = num(v.yaw, -10, 10);
    if (nx !== null && ny !== null && nz !== null && yaw !== null) naveParada = { x: nx, y: ny, z: nz, yaw };
  }
  return {
    x, z, facing, moving: r.moving === true, sit: r.sit === true,
    topo: fundador && r.topo === true, ceu: fundador && r.ceu === true,
    voo, naveParada, jet: num(r.jet, 0, 400), alt: num(r.alt, 0, 400),
  };
}

/** mensagem de signaling WebRTC (offer/answer/ICE) — só repassa se o destino estiver na sala e couber no teto */
export function sanitizarRtc(raw: unknown, presentes: Set<string>): { to: string; data: unknown } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.to !== "string" || !presentes.has(r.to)) return null;
  let tam = 0;
  try { tam = JSON.stringify(r.data ?? null).length; } catch { return null; }
  if (tam > 16_000) return null;   // SDP com folga; nada de usar o relay como transporte de dados
  return { to: r.to, data: r.data ?? null };
}
