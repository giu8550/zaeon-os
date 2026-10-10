/**
 * Cyberespaço — a REDE DE BURACOS NEGROS (o "metrô" do hiperespaço sem chão). PURO, sem three.
 *
 *  - Cada lugar flutuante tem o seu buraco negro (um anel no piso com o buraco pairando em cima): a CIDADE ZAEON (o nó
 *    central), a PRAÇA das bases, a UNILAB, a UFC, a Unifor, a UECE e a Solana House. Entrou num deles → o TÚNEL abre
 *    e a pessoa escolhe pra onde vai; aparece na `chegada` do destino. Aberto a todos.
 *  - O PAR DO DONO: o buraco negro GRANDE (em cima do palco do lounge, lib/cyber/ceu `BURACO_NEGRO`, com a boca no anel
 *    da cabine do DJ, lá no alto da torre) e o buraco negro de DENTRO DA NAVE dele (na sala de reuniões). Um leva ao
 *    outro — e é a ÚNICA entrada da cabine do DJ. Só o dono atravessa (o servidor confere, POST /acesso {alvo:"dj"}).
 */
import type { P2 } from "./colisao";
import { CIDADE, TORRE_DJ, daSala, mundo, naSala } from "./ceu";
import { PLATAFORMAS, IDS_PLATAFORMAS, type IdPlataforma } from "./plataformas";
import { PORTAL_PRACA, PRACA } from "./praca";
import { COMODOS } from "./naveQG";

export type IdNo = "zaeon" | "praca" | IdPlataforma;
/** um nó da rede: o anel (mundo), a altura do piso dele, onde se aparece ao chegar e o buraco negro (visual) */
export type NoTunel = {
  id: IdNo; nome: string; desc: string;
  anel: { x: number; z: number; r: number };
  /** a altura (mundo) do piso do nó (a Zaeon flutua ±0,25 m em volta disto) */
  y: number;
  chegada: P2 & { rumo: number };
  /** o buraco negro pairando sobre o anel: altura ACIMA do piso e raio do horizonte */
  bh: { h: number; r: number };
};

const DESC: Record<IdNo, string> = {
  zaeon: "O coração do hiperespaço: capela, lounge, motos e a Recepção.",
  praca: "A ilha das bases de estudo — a sua fica aqui.",
  univ: "Universidade da Integração Internacional da Lusofonia Afro-Brasileira.",
  ufc: "Universidade Federal do Ceará — uma cidade universitária inteira.",
  unifor: "Universidade de Fortaleza — o campus sofisticado.",
  uece: "Universidade Estadual do Ceará — compacta, em volta do pátio.",
  solana: "A casa da Superteam Brasil, com rooftop.",
};

export { PORTAL_PRACA };

export const NOS: Record<IdNo, NoTunel> = {
  zaeon: (() => {
    const a = mundo(CIDADE.portalTunel), c = mundo(CIDADE.chegada);
    return { id: "zaeon", nome: "Cidade Zaeon", desc: DESC.zaeon, anel: { ...a, r: CIDADE.portalTunel.r }, y: CIDADE.pisoY, chegada: { ...c, rumo: Math.atan2(-CIDADE.chegada.x, -CIDADE.chegada.z) }, bh: { h: 7.5, r: 2.2 } } satisfies NoTunel;
  })(),
  praca: { id: "praca", nome: "Praça das bases", desc: DESC.praca, anel: PORTAL_PRACA, y: PRACA.y, chegada: { x: 20, z: -18, rumo: Math.atan2(-20, 18) }, bh: { h: 6, r: 1.8 } },
  ...(Object.fromEntries(IDS_PLATAFORMAS.map((id) => {
    const P = PLATAFORMAS[id];
    return [id, { id, nome: P.nome, desc: DESC[id], anel: P.portal, y: P.y, chegada: P.chegada, bh: { h: 5.5, r: 1.6 } } satisfies NoTunel];
  })) as Record<IdPlataforma, NoTunel>),
};
/** a ordem dos destinos no túnel */
export const IDS_NOS: IdNo[] = (["zaeon", "praca", "univ", "ufc", "unifor", "uece", "solana"] as IdNo[]).filter((id) => id === "zaeon" || id === "praca" || IDS_PLATAFORMAS.includes(id));

/** pisou no anel de qual nó? `y` = a altura dos pés (o anel só vale no piso dele) */
export function noDoAnel(p: P2, y: number): IdNo | null {
  for (const id of IDS_NOS) { const n = NOS[id]; if (Math.abs(y - n.y) < 3 && Math.hypot(p.x - n.anel.x, p.z - n.anel.z) < n.anel.r) return id; }
  return null;
}
/** os destinos a partir de um nó (todos os outros) */
export const destinosDe = (origem: IdNo | null) => IDS_NOS.filter((id) => id !== origem).map((id) => ({ id, nome: NOS[id].nome, desc: NOS[id].desc }));

// ───────────── o PAR DO DONO: cabine do DJ ↔ nave ─────────────
/** a boca do buraco negro grande NA CABINE do DJ (referencial da sala do lounge, lá em cima da torre) — atrás da
 *  mesa, longe do anel de descer e do lugar do DJ */
export const BOCA_DJ = { x: -2.4, z: TORRE_DJ.z - 2.2, r: 0.75 } as const;
/** onde se aparece na cabine ao chegar da nave (referencial da sala): o topo do elevador, de frente pra pista */
export const CHEGADA_DJ = { x: 0, z: TORRE_DJ.elevador.chegaEmCima } as const;
/** a boca no mundo (o visual e os testes) */
export const bocaDJMundo = (): P2 => mundo(daSala(CIDADE.salas.lounge, BOCA_DJ.x, BOCA_DJ.z));
export const chegadaDJMundo = (): P2 => mundo(daSala(CIDADE.salas.lounge, CHEGADA_DJ.x, CHEGADA_DJ.z));
/** pisou na boca da cabine do DJ (mundo)? — a altura (lá em cima da torre) o engine confere */
export function naBocaDJ(p: P2): boolean {
  const q = naSala(CIDADE.salas.lounge, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);
  return Math.hypot(q.x - BOCA_DJ.x, q.z - BOCA_DJ.z) < BOCA_DJ.r;
}

/** o buraco negro de DENTRO DA NAVE (planta local, no convés de baixo): no meio da sala de reuniões */
export const BURACO_NAVE = (() => {
  const c = COMODOS.find((x) => x.id === "reunioes")!;
  return { x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2, r: 1.0, h: 1.9, rBh: 0.62 };
})();
/** onde se aparece na nave ao chegar da cabine do DJ: do lado do buraco, rumo à porta do hall */
export const CHEGADA_NAVE = { x: BURACO_NAVE.x + 2, z: BURACO_NAVE.z } as const;
/** a bordo (convés de baixo, fora da escada), pisou no buraco negro da nave? */
export const naBocaNave = (b: { x: number; z: number; nivel: number; esc?: number }) => b.nivel === 0 && b.esc === undefined && Math.hypot(b.x - BURACO_NAVE.x, b.z - BURACO_NAVE.z) < BURACO_NAVE.r;
