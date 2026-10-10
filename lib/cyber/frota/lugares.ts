/**
 * Frota de IAs — os LUGARES onde elas ficam (PURO): os pontos de estudo de cada ambiente e os da pista da festa.
 *  - nas SALAS da Zaeon (biblioteca, jardim, lounge): os ASSENTOS de lib/cyber/descanso (sofá, pufe, puff) e, nas de
 *    estudo, pontos no CHÃO (senta de perna cruzada com o tablet) — fora dos colisores, dos assentos e do corredor da porta;
 *  - nas UNIVERSIDADES flutuantes (UNILAB e os campi): pontos no CHÃO do disco (só onde dá pra ficar de pé);
 *  - a PISTA do lounge (a festa).
 * Tudo no MUNDO; `y` é absoluto (as salas da Zaeon: o piso da ilha + a altura das salas — o engine soma a boia da ilha).
 */
import { CIDADE, MOVEIS, PISTA, alturaNaCidade, colisoresDaCidade, daSala, mundo, naSala, rotDaSala, type NomeSala } from "../ceu";
import { DECK, PATIO } from "../templo";
import { lugaresDoLounge } from "../descanso";
import { PLATAFORMAS, andarNaPlataforma, type IdPlataforma } from "../plataformas";
import { acasoDe, embaralhar } from "./aleatorio";
import type { AmbienteEstudo } from "./agenda";
import { lugaresDaCidadela } from "../cidadela";

/** `cabine` = a cadeira de uma CABINE DE ESTUDO da cidadela (lib/cyber/cidadela) */
export type TipoSpot = "sofa" | "pufe" | "puff" | "piso" | "pista" | "cabine";
export type Spot = {
  id: string; ambiente: AmbienteEstudo | "pista"; tipo: TipoSpot;
  x: number; z: number; y: number; rumo: number;
  /** é da Zaeon (a ilha flutua: o engine soma a boia)? */
  zaeon: boolean;
  /** sofá: o outro assento (deitar exige o sofá todo) e a pose deitada */
  par?: string; deita?: { x: number; z: number; rumo: number };
};

/** a altura (mundo) do piso num ponto de uma sala — o lounge tem o pátio e o DECK da festa */
const ySala = (w: { x: number; z: number }) => CIDADE.pisoY + alturaNaCidade(w);
const SALAS: Partial<Record<AmbienteEstudo, NomeSala>> = { biblioteca: "biblioteca", jardim: "jardim", lounge: "lounge" };

/** os ASSENTOS de uma sala (sofá: 1 spot por assento, com o par e a pose deitada; puff e pufe) */
function assentos(sala: NomeSala, amb: AmbienteEstudo): Spot[] {
  const out: Spot[] = [];
  for (const l of lugaresDoLounge().filter((x) => x.id.startsWith(`${sala}-`))) {
    l.assentos.forEach((a, k) => out.push({
      id: `${l.id}#${k}`, ambiente: amb, tipo: l.tipo, x: a.x, z: a.z, y: ySala(a), rumo: l.rumo, zaeon: true,
      ...(l.tipo === "sofa" ? { par: `${l.id}#${1 - k}`, deita: { ...l.deita!, rumo: l.rumoDeitado } } : {}),
    }));
  }
  return out;
}
/** pontos no CHÃO de uma sala: grade, longe dos colisores, dos assentos, da pista/palco e do corredor da porta */
function chaoDaSala(sala: NomeSala, amb: AmbienteEstudo): Spot[] {
  const s = CIDADE.salas[sala], cs = colisoresDaCidade(), ocupados = lugaresDoLounge().flatMap((l) => l.assentos), out: Spot[] = [];
  const pista = sala === "lounge" ? PISTA : null, passo = 2.6, R = s.r - 5;
  for (let lx = -R; lx <= R; lx += passo) for (let lz = -R; lz <= R; lz += passo) {
    if (Math.hypot(lx, lz) > R) continue;
    if (Math.abs(lx) < 4.5 && lz > s.r - 16) continue;   // o corredor da porta (de quem chega)
    if (pista && Math.abs(lx - pista.x) < pista.larg / 2 + 2 && Math.abs(lz - pista.z) < pista.prof / 2 + 2) continue;
    if (sala === "lounge" && (lz < -32 || (lx > 52 && lz > -28 && lz < -10))) continue;   // o palco, a torre e as caixas; a saída pro templo
    if (sala === "lounge" && lz > DECK.zFrente - 2.5 && noPatioOcupado(lx, lz)) continue;   // a rampa, a calçada central e os postes do pátio
    const w = mundo(daSala(s, lx, lz));
    if (cs.some((c) => Math.hypot(w.x - c.x, w.z - c.z) < c.r + 1.1)) continue;
    if (ocupados.some((o) => Math.hypot(w.x - o.x, w.z - o.z) < 1.6)) continue;
    // de frente pro meio da sala (ou pro lado, um pouco variado)
    const r = acasoDe("piso", sala, Math.round(lx * 10), Math.round(lz * 10)), rumo = rotDaSala(s) + Math.atan2(-lx, -lz) + (r() - 0.5) * 1.2;
    out.push({ id: `${sala}-piso-${out.length}`, ambiente: amb, tipo: "piso", x: w.x, z: w.z, y: ySala(w), rumo, zaeon: true });
  }
  return out;
}
/** pontos no CHÃO de uma universidade flutuante (grade no disco; só onde o andar deixa ficar) */
function chaoDaPlataforma(id: IdPlataforma): Spot[] {
  const P = PLATAFORMAS[id], passo = Math.max(3, P.r / 9), R = P.r * 0.82, out: Spot[] = [];
  for (let dx = -R; dx <= R; dx += passo) for (let dz = -R; dz <= R; dz += passo) {
    if (Math.hypot(dx, dz) > R) continue;
    const p = { x: P.centro.x + dx, z: P.centro.z + dz }, q = andarNaPlataforma(id, 0, p);
    if (q.fora || Math.hypot(q.x - p.x, q.z - p.z) > 0.05) continue;   // dentro de algo (prédio, mesa) ou fora do disco
    if (Math.hypot(p.x - P.portal.x, p.z - P.portal.z) < P.portal.r + 6 || Math.hypot(p.x - P.chegada.x, p.z - P.chegada.z) < 5) continue;
    const r = acasoDe("piso", id, Math.round(dx), Math.round(dz));
    out.push({ id: `${id}-piso-${out.length}`, ambiente: id as AmbienteEstudo, tipo: "piso", x: p.x, z: p.z, y: P.y, rumo: r() * Math.PI * 2, zaeon: false });
  }
  return embaralhar(acasoDe("plataforma", id), out).slice(0, 160);
}
/** o que NÃO é lugar no pátio do lounge (referencial da sala): a rampa, a calçada central (com os postes) */
function noPatioOcupado(lx: number, lz: number): boolean {
  const { zFrente, rampa } = DECK;
  if (Math.abs(lx) <= rampa.meia + 1 && lz <= zFrente + rampa.len + 1) return true;
  return Math.abs(lx) <= PATIO.calcadaMeia + 2.2;
}
/** a PISTA do lounge (a festa): a área de dança do deck e, desde que as motos saíram (out/2026), o PÁTIO inteiro em
 *  volta da calçada — muito mais gente na festa; todo mundo virado pro palco (a mandala em cima do DJ) */
function pista(): Spot[] {
  const s = CIDADE.salas.lounge, p = PISTA, out: Spot[] = [], rumo = rotDaSala(s) + Math.PI, R = s.r - 5;
  const poe = (lx: number, lz: number) => { const w = mundo(daSala(s, lx, lz)); out.push({ id: `pista-${out.length}`, ambiente: "pista", tipo: "pista", x: w.x, z: w.z, y: ySala(w), rumo, zaeon: true }); };
  for (let lx = -p.larg / 2 + 1.5; lx <= p.larg / 2 - 1.5; lx += 1.7) for (let lz = -p.prof / 2 + 1.5; lz <= p.prof / 2 - 1.5; lz += 1.7) poe(p.x + lx, p.z + lz);
  const cs = colisoresDaCidade();
  for (let lx = -R; lx <= R; lx += 2.1) for (let lz = DECK.zFrente + 2; lz <= R; lz += 2.1) {
    if (Math.hypot(lx, lz) > R || noPatioOcupado(lx, lz)) continue;
    if (Math.abs(lx) < 4.5 && lz > s.r - 16) continue;   // o corredor da porta
    const w = mundo(daSala(s, lx, lz)); if (cs.some((c) => Math.hypot(w.x - c.x, w.z - c.z) < c.r + 1.1)) continue;
    poe(lx, lz);
  }
  return out;
}

const cache = new Map<string, Spot[]>();
/** os spots de um ambiente (cacheados): estudo nas salas = assentos + chão; o lounge (estudar no sofá) = só assentos;
 *  as universidades = chão; "pista" = a pista da festa */
export function spotsDe(amb: AmbienteEstudo | "pista"): Spot[] {
  let s = cache.get(amb);
  if (s) return s;
  if (amb === "pista") s = pista();
  else if (amb === "cidadela") s = lugaresDaCidadela();   // (cada membro da hierarquia tem o SEU — lib/cyber/frota/hierarquia)
  else if (amb === "lounge") s = [...assentos("lounge", "lounge"), ...chaoDaSala("lounge", "lounge").slice(0, 220)];   // os sofás primeiro; lotou, o chão perto deles (o pátio também) — quantos, o plano limita (painel admin `loungeChao`, padrão 60)
  else if (SALAS[amb]) s = [...assentos(SALAS[amb]!, amb), ...chaoDaSala(SALAS[amb]!, amb)];
  else s = chaoDaPlataforma(amb as IdPlataforma);
  cache.set(amb, s); return s;
}
/** a sala de um ponto do mundo (local da ilha), ou null */
export const salaDoPonto = (p: { x: number; z: number }): NomeSala | null => {
  for (const nome of Object.keys(CIDADE.salas) as NomeSala[]) { const s = CIDADE.salas[nome], q = naSala(s, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z); if (Math.hypot(q.x, q.z) <= s.r) return nome; }
  return null;
};
