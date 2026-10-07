/**
 * Cyberespaço — a CIDADE ZAEON no céu (QG do dono), acima do buraco negro. PURO, sem three.
 * Conceito das cidades flutuantes (estilo Avatar): uma ilha monumental + ilhotas em volta. Não há caminho físico
 * até lá: o BURACO NEGRO é o PORTAL (clicar nele ou pisar no anel embaixo dele) e um portal de volta na cidade leva
 * de novo à praça. Entrar é AÇÃO PRIVILEGIADA (validada no servidor): o QG é do dono.
 *
 * Coordenadas: `centro` no plano (x,z) do mundo; tudo que é "local" é relativo ao centro (sem giro).
 */
import { empurrarParaFora, type Colisor, type P2 } from "./colisao";

/** buraco negro (CenaCosmica): centro e raio do horizonte */
export const BURACO_NEGRO = { x: 0, y: 16, z: -110, r: 6 };

/** a ZAEON MEGA (out. 2026): a cidadela virou uma MEGA PLATAFORMA — 3× mais larga que antes, bem mais ALTA (450 m) e
 *  longe da UNILAB e da Solana (o mapa cresceu junto). A capela (expandida) fica só com o GLOBO no centro; o LOUNGE saiu
 *  da plataforma central e virou uma PLATAFORMA PRÓPRIA, mais alta (na altura do início da ponta da capela), ligada
 *  por uma ESCADA. */
export const ESCALA_ZAEON = 3;
const E = ESCALA_ZAEON;

/** a CAPELA (cidadela): pilares + cúpula + tambor + 2ª cúpula + PONTA (pináculo). As medidas ficam aqui porque a altura
 *  do início da ponta decide a altura do lounge. */
export const CAPELA = { r: 18 * E, pilares: 28, pilarColR: 1.3 * E, altura: 32, achata: 0.55, tamborR: 18, tamborAlt: 14, pontaLen: 60 } as const;
/** a altura (acima do piso) onde a PONTA da capela começa — o lounge flutua mais ou menos aqui */
export function inicioDaPonta(): number {
  const RC = CAPELA.r + 1, RT = CAPELA.tamborR, yT0 = CAPELA.altura + Math.sqrt(RC * RC - RT * RT) * CAPELA.achata - 1;
  return yT0 + CAPELA.tamborAlt + RT * 0.92 * 0.9 - 0.5;
}

export const CIDADE = {
  /** a Zaeon mega NÃO fica mais em cima do buraco negro: com 3× o raio, ela tampava o céu da praça inteira — agora fica
   *  ao SUL, longe da praça, da UNILAB e da Solana (o buraco negro continua sendo o portal, no chão perto da praça) */
  centro: { x: 0, z: -560 },
  pisoY: 450,           // piso da cidade: MUITO acima do buraco negro (y=16), da UNILAB (230) e da Solana (160)
  bordaR: 84 * E,       // borda da ilha principal (252 m)
  andavelR: 76 * E,     // até onde se anda (as muralhas ficam em muralhaR)
  muralhaR: 80 * E,
  ilhaAltura: 180,      // a ilha (cone invertido) vai do piso até pisoY - ilhaAltura
  /** a AGULHA embaixo da ilha: a ponta afiada que desce do ápice (sólida pra nave) */
  agulha: { r: 16, altura: 70 },
  cidadela: { r: CAPELA.r, pilares: CAPELA.pilares, pilarColR: CAPELA.pilarColR, altura: CAPELA.altura },
  /** o GLOBO de luz no centro da capela (sobre a mesa) */
  mesaHolo: { r: 2.4 * E },
  /** os DESKTOPS da capela (monitores verticais clicáveis = Sala de Estudos / biblioteca): um anel em volta do globo,
   *  virados pro centro — as estantes de livros e os servidores saíram, os desktops ficaram */
  monitores: { n: 8, r: 22, largura: 2.9, colR: 1.3 },
  /** as SALAS (pavilhões): só o LOUNGE, agora numa plataforma própria FORA da ilha (referencial local, sem giro),
   *  flutuando na altura `y` (acima do piso) — a porta (o +z da sala) dá pra escada que vem da plataforma central */
  salas: {
    lounge: { x: 0 as number, z: 0, r: 40, y: 0 as number, porta: 0.15 },
  },
  /** parede das salas: colisores ao longo do arco; `porta` = meia-abertura (rad) da porta */
  salaParede: { colR: 0.6, passo: 1, porta: 0.34 },
  portalVolta: { x: -32 * E, z: 15 * E, r: 2.2 * 1.4 },          // anel de volta pra praça (local)
  chegada: { x: -25 * E, z: 21 * E },                            // onde se aparece ao entrar (local)
  /** anel de entrada no CHÃO, embaixo do buraco negro (mundo) */
  portalEntrada: { x: BURACO_NEGRO.x, z: BURACO_NEGRO.z, r: 9 },
};
/** o lounge flutua na altura do início da ponta da capela; a escada sobe com inclinação de escada de verdade (~33°),
 *  então a distância da plataforma dele sai da altura */
export const INCLINACAO_ESCADA = 0.65;
CIDADE.salas.lounge.y = Math.round(inicioDaPonta());
CIDADE.salas.lounge.x = -(CIDADE.andavelR - 8 + CIDADE.salas.lounge.y / INCLINACAO_ESCADA + CIDADE.salas.lounge.r - 1.5);
export const ALTURA_LOUNGE = CIDADE.salas.lounge.y;

/**
 * A ESCADA do lounge: reta, flutuando, do piso da plataforma central (perto da borda) até a porta da plataforma do
 * lounge, subindo `ALTURA_LOUNGE` metros. Corre no eixo −x local (o lounge fica a oeste). Corrimão dos DOIS lados
 * (colisores) do pé ao topo: só se entra pelo pé e sai no lounge — ninguém sobe pela lateral nem passa por baixo.
 */
export const ESCADA_LOUNGE = (() => {
  const L = CIDADE.salas.lounge, ini = CIDADE.andavelR - 8, fim = -L.x - L.r + 1.5;
  return { dir: { x: -1, z: 0 }, meia: 5, ini, fim, len: fim - ini, colR: 0.5, passo: 0.6 };   // corrimão bem denso: cair daqui é queda de verdade
})();
/** onde na escada um ponto LOCAL (relativo ao centro da ilha) está: `u` ao longo (0 = pé), `lat` de lado */
export const naEscadaLocal = (l: P2) => { const e = ESCADA_LOUNGE, along = l.x * e.dir.x + l.z * e.dir.z; return { u: along - e.ini, lat: l.x * -e.dir.z + l.z * e.dir.x }; };
/** está no corredor da escada (local)? */
const dentroDaEscada = (l: P2, folga = 0) => { const q = naEscadaLocal(l); return q.u >= -folga && q.u <= ESCADA_LOUNGE.len + folga && Math.abs(q.lat) <= ESCADA_LOUNGE.meia + folga; };
/** está sobre o disco do lounge (local)? */
const noDiscoDoLounge = (l: P2, folga = 0) => { const L = CIDADE.salas.lounge; return Math.hypot(l.x - L.x, l.z - L.z) <= L.r + folga; };

export const mundo = (l: P2): P2 => ({ x: CIDADE.centro.x + l.x, z: CIDADE.centro.z + l.z });

/** os DESKTOPS (locais) da capela; `rot` deixa o +z local (a tela) virado pro centro — o índice é o instanceId das telas */
export function computadoresLocais(): { x: number; z: number; rot: number }[] {
  const { n, r } = CIDADE.monitores, out: { x: number; z: number; rot: number }[] = [];
  for (let i = 0; i < n; i++) { const a = ((i + 0.5) / n) * Math.PI * 2; out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, rot: Math.atan2(-Math.cos(a), -Math.sin(a)) }); }
  return out;
}
/** desktop mais próximo (índice em computadoresLocais) dentro de `alcance`, ou -1 */
export function computadorPerto(p: P2, alcance = 3.6): number {
  let melhor = -1, md = alcance;
  computadoresLocais().forEach((c, i) => { const w = mundo(c), d = Math.hypot(p.x - w.x, p.z - w.z); if (d < md) { md = d; melhor = i; } });
  return melhor;
}

/** colisores da plataforma (mundo): pilares da capela, a mesa do globo, os desktops, o corrimão da escada do lounge, paredes e móveis
 *  das salas (o lounge, lá em cima). Constante → calculado uma vez (o passo usa todo quadro). */
let colisoresCache: Colisor[] | null = null;
export function colisoresDaCidade(): Colisor[] {
  if (colisoresCache) return colisoresCache;
  const out: Colisor[] = [];
  for (const nome of Object.keys(CIDADE.salas) as NomeSala[]) {
    const s = CIDADE.salas[nome];
    for (const p of paredeDaSala(s)) out.push({ ...mundo(p), r: CIDADE.salaParede.colR });
    for (const m of MOVEIS[nome]) for (const c of colisoresDoMovel(m)) out.push({ ...mundo(daSala(s, c.x, c.z)), r: c.r });
  }
  for (const c of bordaDoPalco()) out.push({ ...mundo(daSala(CIDADE.salas.lounge, c.x, c.z)), r: PALCO.colR });
  for (const c of bordaDaTorre()) out.push({ ...mundo(daSala(CIDADE.salas.lounge, c.x, c.z)), r: TORRE_DJ.colR });
  const { cidadela, mesaHolo } = CIDADE, e = ESCADA_LOUNGE;
  for (let i = 0; i < cidadela.pilares; i++) { const a = (i / cidadela.pilares) * Math.PI * 2; out.push({ ...mundo({ x: Math.cos(a) * cidadela.r, z: Math.sin(a) * cidadela.r }), r: cidadela.pilarColR }); }
  out.push({ ...mundo({ x: 0, z: 0 }), r: mesaHolo.r });
  for (const m of computadoresLocais()) out.push({ ...mundo(m), r: CIDADE.monitores.colR });
  // corrimão da escada: dos dois lados, do pé até a porta do lounge
  for (let u = 0.4; u <= e.len; u += e.passo) for (const s of [-1, 1]) {
    const lat = s * (e.meia + e.colR); out.push({ ...mundo({ x: e.dir.x * (e.ini + u) - e.dir.z * lat, z: e.dir.z * (e.ini + u) + e.dir.x * lat }), r: e.colR });
  }
  colisoresCache = out;
  return out;
}

export type NomeSala = keyof typeof CIDADE.salas;
/** móvel de uma sala, no referencial da SALA (+z local = rumo à porta/centro da ilha); `rot` = giro do móvel (a frente
 *  dele é o seu +z); `larg`×`prof` = pegada (vira colisores). `solido: false` = só visual (tapete). */
export type Movel = { tipo: string; x: number; z: number; rot: number; larg: number; prof: number; solido?: boolean; /** elevação (m) — ex.: em cima do palco */ y?: number; /** cor de destaque (zonas do lounge) */ cor?: number };
/**
 * PALCO do lounge (a FESTA): plataforma de CRISTAL DE GELO no fundo da sala (referencial da sala), com ESCADA na
 * frente (+z, rumo à pista) — a borda é sólida (só se sobe pela escada), e em cima fica a MESA DO DJ (2 pickups +
 * controladora). Atrás da mesa, a CABINE: quem para ali vira DJ (fone na cabeça, mãos na controladora, balançando).
 */
export const PALCO = {
  z: -17, r: 10, h: 3,   // mais alto e maior (o lounge cresceu: plataforma própria de 40 m)
  /** escada: meia-largura e comprimento (desce do palco rumo à pista) */
  escada: { meia: 2.5, len: 6 },
  /** colisores da borda: passo e raio */
  passo: 0.6, colR: 0.5,   // (0,6: os colisores se sobrepõem bem — num quadro lento o passo não atravessa a borda)
  /** a cabine do DJ (atrás da mesa, lá em cima na TORRE): centro, raio; quem está nela olha pra pista (+z da sala) */
  cabine: { x: 0, z: -17.35, r: 0.95 },   // encosta na mesa (o colisor dela vai até −17,05): as mãos alcançam a controladora
} as const;
/** a TORRE DO DJ: a MEGA ESTRUTURA de cristal que sobe do palco até a cabine, lá no alto (na altura da bola de
 *  espelhos). O círculo dela é sólido pra quem está no palco e é o guarda-corpo de quem está lá em cima; sobe-se pelo
 *  ELEVADOR DE LUZ atrás dela (pisou no anel do palco, sobe surfando; no anel lá de cima, desce). */
export const TORRE_DJ = { z: -18, r: 4.5, topo: 12, colR: 0.5, passo: 0.6,
  elevador: { r: 1, sobe: -23.9, chegaEmCima: -20.4, desce: -21.6, rDesce: 0.7, chegaEmbaixo: -25.3, dur: 3.6 } } as const;
export const MESA_DJ = { x: 0, z: -16.4, larg: 4.2, prof: 1, topo: 1.05 } as const;
/** a ESTRUTURA DE METAL alta (treliça) de onde pendem as caixas: 2 torres + viga; as caixas SUSPENSAS (line arrays) */
export const TRELICA = { x: 17, z: -19, alt: 26, viga: 24 } as const;
export const CAIXAS_SUSPENSAS = [{ x: -14, z: -11 }, { x: 14, z: -11 }] as const;
/** uma ZONA de lounge (referencial da sala): tapete aceso + o miolo (mesinha baixa com narguilé, fogueira holográfica
 *  ou só a mesinha) + os assentos em volta virados pra ele, com a boca aberta pra `abre` (ângulo: sen/cos = x/z) */
export function zonaLounge(cx: number, cz: number, abre: number, cor: number, tipo: "narguile" | "fogueira" | "mesinha"): Movel[] {
  const out: Movel[] = [{ tipo: "tapete", x: cx, z: cz, rot: abre, larg: 9, prof: 9, solido: false, cor }];
  if (tipo === "fogueira") out.push({ tipo: "fogueira", x: cx, z: cz, rot: 0, larg: 1.8, prof: 1.8, cor });
  else out.push({ tipo: "mesaBaixa", x: cx, z: cz, rot: 0, larg: 1.6, prof: 1.6, cor });
  if (tipo === "narguile") out.push({ tipo: "narguile", x: cx, z: cz, rot: abre, larg: 0.5, prof: 0.5, solido: false, y: 0.16 + 0.45, cor });
  if (tipo === "fogueira") {   // puffs em roda (menos na boca)
    for (let i = 0; i < 6; i++) { const a = abre + Math.PI / 3.5 + (i / 5) * (Math.PI * 2 - Math.PI / 1.75); out.push({ tipo: "puff", x: cx + Math.sin(a) * 2.9, z: cz + Math.cos(a) * 2.9, rot: a + Math.PI, larg: 1, prof: 1, cor }); }
  } else for (const da of [Math.PI, Math.PI / 2, -Math.PI / 2]) {   // sofás em "U": o do fundo e os dois dos lados
    const a = abre + da; out.push({ tipo: "sofa", x: cx + Math.sin(a) * 3, z: cz + Math.cos(a) * 3, rot: a + Math.PI, larg: 3.4, prof: 1.2, cor });
  }
  return out;
}
export const MOVEIS: Record<NomeSala, Movel[]> = {
  // LOUNGE = CLUBE a céu aberto na plataforma própria: telão no fundo, palco de cristal alto com a mesa do DJ, a
  // treliça com as caixas suspensas (as torres dela são sólidas), as TORRES de som gigantes e os subs no chão, pista de
  // LED e sofás nas laterais
  lounge: [
    { tipo: "tv", x: 0, z: -33, rot: 0, larg: 22, prof: 1 },
    { tipo: "palco", x: 0, z: PALCO.z, rot: 0, larg: 0, prof: 0, solido: false, y: 0 },   // colisão própria (bordaDoPalco)
    { tipo: "torreDJ", x: 0, z: TORRE_DJ.z, rot: 0, larg: 0, prof: 0, solido: false, y: PALCO.h },   // colisão própria (bordaDaTorre)
    { tipo: "mesaDJ", x: MESA_DJ.x, z: MESA_DJ.z, rot: 0, larg: MESA_DJ.larg, prof: MESA_DJ.prof, y: TORRE_DJ.topo },
    { tipo: "trelica", x: -TRELICA.x, z: TRELICA.z, rot: 0, larg: 2.4, prof: 2.4 },
    { tipo: "trelica", x: TRELICA.x, z: TRELICA.z, rot: 0, larg: 2.4, prof: 2.4 },
    { tipo: "caixaSom", x: CAIXAS_SUSPENSAS[0].x, z: CAIXAS_SUSPENSAS[0].z, rot: 0.3, larg: 3.2, prof: 2.2, solido: false },   // suspensa: não ocupa o chão
    { tipo: "caixaSom", x: CAIXAS_SUSPENSAS[1].x, z: CAIXAS_SUSPENSAS[1].z, rot: -0.3, larg: 3.2, prof: 2.2, solido: false },
    { tipo: "torreSom", x: -22, z: -10, rot: 0.45, larg: 3.6, prof: 2.6 },   // as TORRES de som gigantes no chão (10 m), como antes — além das suspensas
    { tipo: "torreSom", x: 22, z: -10, rot: -0.45, larg: 3.6, prof: 2.6 },
    { tipo: "sub", x: -13, z: -4, rot: 0.3, larg: 3, prof: 2 },
    { tipo: "sub", x: 13, z: -4, rot: -0.3, larg: 3, prof: 2 },
    { tipo: "pista", x: 0, z: 9, rot: 0, larg: 26, prof: 18, solido: false },
    // as ZONAS de lounge (pra não ser só pista): 2 rodas de sofá com NARGUILÉ nas laterais, puffs em volta de uma
    // FOGUEIRA holográfica e um cantinho com mesinha perto da entrada — todas abertas pro lado da pista/do caminho
    ...zonaLounge(-27, 7, Math.PI / 2, 0xb98cff, "narguile"),
    ...zonaLounge(27, 7, -Math.PI / 2, 0x66e6ff, "narguile"),
    ...zonaLounge(-17, 27, Math.PI / 2, 0xff9a5c, "fogueira"),
    ...zonaLounge(17, 27, -Math.PI / 2, 0xff5fd2, "mesinha"),
  ],
};
/** pontos (referencial da sala) da BORDA do palco — o círculo todo menos a boca da escada */
export function bordaDoPalco(): { x: number; z: number }[] {
  const { r, z, passo, escada } = PALCO, n = Math.ceil((2 * Math.PI * r) / passo), out: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = Math.cos(a) * r, lz = z + Math.sin(a) * r;
    if (lz > z && Math.abs(x) < escada.meia) continue;   // a boca da escada (na frente)
    out.push({ x, z: lz });
  }
  // laterais da escada (não se sobe por elas)
  for (let k = 0.3; k < escada.len; k += passo) for (const sx of [-1, 1]) out.push({ x: sx * (escada.meia + 0.25), z: z + r + k - 0.3 });
  return out;
}
/** pontos (referencial da sala) do círculo da TORRE do DJ: parede pra quem está no palco, guarda-corpo lá em cima */
export function bordaDaTorre(): { x: number; z: number }[] {
  const { r, z, passo } = TORRE_DJ, n = Math.ceil((2 * Math.PI * r) / passo), out: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push({ x: Math.cos(a) * r, z: z + Math.sin(a) * r }); }
  return out;
}
/** ponto (local da ilha) → referencial da sala (o inverso de `daSala`) */
export function naSala(s: { x: number; z: number }, x: number, z: number): { x: number; z: number } {
  const r = rotDaSala(s), c = Math.cos(r), si = Math.sin(r), dx = x - s.x, dz = z - s.z;
  return { x: dx * c - dz * si, z: dx * si + dz * c };
}
/** quanto o piso sobe aqui (m), `p` no MUNDO: 0 na plataforma central; a ESCADA do lounge é uma rampa até
 *  `ALTURA_LOUNGE`; no disco do lounge, `ALTURA_LOUNGE` + o PALCO (que tem a escadinha dele, rampa também) */
export function alturaNaCidade(p: P2): number {
  const l = { x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z };
  if (noDiscoDoLounge(l)) {
    const s = CIDADE.salas.lounge, q = naSala(s, l.x, l.z), { r, z, h, escada } = PALCO;
    if (Math.hypot(q.x, q.z - TORRE_DJ.z) <= TORRE_DJ.r) return ALTURA_LOUNGE + TORRE_DJ.topo;   // lá em cima, na cabine da torre
    if (Math.hypot(q.x, q.z - z) <= r) return ALTURA_LOUNGE + h;
    const z0 = z + r - 0.3;
    if (Math.abs(q.x) <= escada.meia && q.z >= z0 && q.z <= z0 + escada.len) return ALTURA_LOUNGE + h * (1 - (q.z - z0) / escada.len);
    return ALTURA_LOUNGE;
  }
  if (dentroDaEscada(l)) { const u = naEscadaLocal(l).u; return ALTURA_LOUNGE * Math.max(0, Math.min(1, u / ESCADA_LOUNGE.len)); }
  return 0;
}
/** está na CABINE do DJ (atrás da mesa, em cima do palco)? `p` no mundo */
export function naCabineDJ(p: P2): boolean {
  const s = CIDADE.salas.lounge, l = naSala(s, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);
  return Math.hypot(l.x - PALCO.cabine.x, l.z - PALCO.cabine.z) <= PALCO.cabine.r;
}
/** o ponto (mundo) onde o DJ fica — quem para na cabine é puxado devagar pra cá (as mãos caem na controladora) */
export const pontoDaCabineDJ = (): P2 => mundo(daSala(CIDADE.salas.lounge, PALCO.cabine.x, PALCO.cabine.z));
/** está na PISTA de dança do lounge (o retângulo de LED)? `p` no mundo — quem para ali dança */
export function naPistaDeDanca(p: P2): boolean {
  const pista = MOVEIS.lounge.find((m) => m.tipo === "pista"); if (!pista) return false;
  const q = naSala(CIDADE.salas.lounge, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);
  return Math.abs(q.x - pista.x) <= pista.larg / 2 && Math.abs(q.z - pista.z) <= pista.prof / 2;
}
/** pra onde quem dança olha: pro palco (o −z da sala) */
export const rumoDaPista = () => rotDaSala(CIDADE.salas.lounge) + Math.PI;
/** A ESCADA DE ENERGIA leva sozinha: pisou na BOCA de baixo (vindo da central) sobe; na de cima (vindo do lounge),
 *  desce. A viagem dura `dur` s e termina FORA das bocas (não dispara de novo sem querer). */
export const VIAGEM_ESCADA = { dur: 6.5, boca: 2, alemDoTopo: 2.5, antesDoPe: 3 } as const;
export const naEscadaDoLounge = (p: P2) => dentroDaEscada({ x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z });
export function bocaDaEscada(p: P2): "sobe" | "desce" | null {
  const q = naEscadaLocal({ x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z }), e = ESCADA_LOUNGE, B = VIAGEM_ESCADA.boca;
  if (Math.abs(q.lat) > e.meia + 0.3) return null;
  if (q.u >= -0.2 && q.u < B) return "sobe";
  if (q.u > e.len - B && q.u <= e.len + 0.5) return "desce";
  return null;
}
/** o ponto (mundo) no meio da escada a `u` m do pé (u < 0: antes do pé, na central; u > len: já no lounge) */
export const pontoDaEscada = (u: number): P2 => { const e = ESCADA_LOUNGE; return mundo({ x: e.dir.x * (e.ini + u), z: e.dir.z * (e.ini + u) }); };
/** onde a viagem está (u) com o progresso `k` (0..1): sai devagar, corre no meio, chega devagar */
export function uDaViagem(sentido: "sobe" | "desce", k: number): number {
  const c = Math.max(0, Math.min(1, k)), s = c * c * (3 - 2 * c), e = ESCADA_LOUNGE, V = VIAGEM_ESCADA;
  return sentido === "sobe" ? s * (e.len + V.alemDoTopo) : e.len - s * (e.len + V.antesDoPe);
}
/** o rumo (facing do mundo) de quem é levado */
export const rumoDaViagem = (sentido: "sobe" | "desce") => { const d = ESCADA_LOUNGE.dir; return Math.atan2(d.x, d.z) + (sentido === "sobe" ? 0 : Math.PI); };
/** o ELEVADOR DE LUZ da torre do DJ: "sobe" no anel do palco (atrás da torre), "desce" no anel lá de cima; null fora */
export function bocaDoElevador(p: P2): "sobe" | "desce" | null {
  const q = naSala(CIDADE.salas.lounge, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z), e = TORRE_DJ.elevador;
  if (Math.hypot(q.x, q.z - e.sobe) < e.r) return "sobe";
  if (Math.hypot(q.x, q.z - e.desce) < e.rDesce) return "desce";
  return null;
}
/** a VIAGEM (escada de energia ou elevador da torre) no progresso `k` (0..1): onde está (mundo), a altura acima do piso
 *  central e pra onde olha. O elevador sobe reto no anel e então desliza pra dentro da cabine (e o contrário, descendo) */
export function posDaViagem(tipo: "escada" | "elevador", sentido: "sobe" | "desce", k: number): { p: P2; y: number; rumo: number } {
  if (tipo === "escada") { const p = pontoDaEscada(uDaViagem(sentido, k)); return { p, y: alturaNaCidade(p), rumo: rumoDaViagem(sentido) }; }
  const L = CIDADE.salas.lounge, e = TORRE_DJ.elevador, c = Math.max(0, Math.min(1, k)), s = (x: number) => x * x * (3 - 2 * x);
  const embaixo = ALTURA_LOUNGE + PALCO.h, emCima = ALTURA_LOUNGE + TORRE_DJ.topo, sala = (z: number) => mundo(daSala(L, 0, z));
  if (sentido === "sobe") {
    if (c < 0.7) return { p: sala(e.sobe), y: embaixo + (emCima + 0.4 - embaixo) * s(c / 0.7), rumo: rumoDoDJ() };
    const u = s((c - 0.7) / 0.3); return { p: sala(e.sobe + (e.chegaEmCima - e.sobe) * u), y: emCima + 0.4 * (1 - u), rumo: rumoDoDJ() };
  }
  if (c < 0.3) { const u = s(c / 0.3); return { p: sala(e.desce + (e.sobe - e.desce) * u), y: emCima + 0.4 * u, rumo: rumoDoDJ() + Math.PI }; }
  if (c < 0.85) return { p: sala(e.sobe), y: emCima + 0.4 - (emCima + 0.4 - embaixo) * s((c - 0.3) / 0.55), rumo: rumoDoDJ() + Math.PI };
  const u = s((c - 0.85) / 0.15); return { p: sala(e.sobe + (e.chegaEmbaixo - e.sobe) * u), y: embaixo, rumo: rumoDoDJ() + Math.PI };
}
/** pra onde o DJ olha (facing = atan2(dx, dz) do mundo): o +z da sala, rumo à pista */
export const rumoDoDJ = () => rotDaSala(CIDADE.salas.lounge);
/** giro da sala: +z local aponta pro centro da ilha (onde fica a porta) */
export const rotDaSala = (s: { x: number; z: number }) => Math.atan2(-s.x, -s.z);
/** ponto no referencial da sala → local da ilha */
export function daSala(s: { x: number; z: number }, lx: number, lz: number): { x: number; z: number } {
  const r = rotDaSala(s), c = Math.cos(r), si = Math.sin(r);
  return { x: s.x + lx * c + lz * si, z: s.z - lx * si + lz * c };
}
/** colisores (no referencial da sala) de um móvel: círculos ao longo da largura dele */
export function colisoresDoMovel(m: Movel): { x: number; z: number; r: number }[] {
  if (m.solido === false) return [];
  const r = Math.max(m.prof / 2, 0.35) + 0.15, n = Math.max(1, Math.ceil(m.larg / (2 * r))), out: { x: number; z: number; r: number }[] = [];
  const c = Math.cos(m.rot), s = Math.sin(m.rot);
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : -m.larg / 2 + r + ((m.larg - 2 * r) * i) / (n - 1); out.push({ x: m.x + t * c, z: m.z - t * s, r }); }
  return out;
}
/** pontos (locais da ilha) da parede de uma sala — o arco inteiro menos a porta */
export function paredeDaSala(s: { x: number; z: number; r: number; porta?: number }): { x: number; z: number }[] {
  const { passo } = CIDADE.salaParede, porta = s.porta ?? CIDADE.salaParede.porta, n = Math.ceil((2 * Math.PI * s.r) / passo), out: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;   // ângulo no referencial da sala: a porta fica em +z local (a = π/2)
    let d = a - Math.PI / 2; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) < porta) continue;
    out.push(daSala(s, Math.cos(a) * s.r, Math.sin(a) * s.r));
  }
  return out;
}

/**
 * ILHOTAS em volta da Zaeon (locais, sem giro): plataformas flutuantes com COLISÃO própria — dá pra pousar no topo
 * (e andar nele; passou da borda, cai), e o corpo (cone invertido) é sólido pra nave e pra quem voa de mochila.
 * Layout FIXO (o mesmo pra todo mundo e pro render). `fase` = a flutuação de cada uma (sobe e desce ±1,2 m).
 */
/** o lado da ilha onde a NAVE-QG do dono fica atracada (lib/cyber/naveQG): as ilhotas deixam esse setor livre */
export const DOCA_ANGULO = 1.75, DOCA_MEIA_ABERTURA = 0.95;
/** o setor da ESCADA/plataforma do lounge (a oeste, ângulo π): as ilhotas também o deixam livre */
export const LOUNGE_ANGULO = Math.PI, LOUNGE_MEIA_ABERTURA = 0.42;
export const ILHOTAS: { x: number; z: number; r: number; dy: number; fase: number }[] = (() => {
  // espalhadas no arco entre a doca (≈ +z) e o lounge (−x) dos dois lados, um pouco maiores (a Zaeon cresceu)
  const arcos = [[DOCA_ANGULO + DOCA_MEIA_ABERTURA, LOUNGE_ANGULO - LOUNGE_MEIA_ABERTURA], [LOUNGE_ANGULO + LOUNGE_MEIA_ABERTURA, DOCA_ANGULO - DOCA_MEIA_ABERTURA + Math.PI * 2]] as const;
  const out: { x: number; z: number; r: number; dy: number; fase: number }[] = [];
  let k = 0;
  for (const [a0, a1] of arcos) {
    if (a1 - a0 < 0.5) continue;   // fresta entre a doca e a escada: não cabe ilhota
    const n = Math.round((a1 - a0) / 0.5);
    for (let i = 0; i < n; i++, k++) {
      const a = a0 + ((i + 0.5) / n) * (a1 - a0), dist = CIDADE.bordaR + 30 + (k % 3) * 16;
      out.push({ x: Math.cos(a) * dist, z: Math.sin(a) * dist, r: 8 + (k % 4) * 3, dy: ((k % 3) - 1) * 14, fase: k * 1.7 });
    }
  }
  return out;
})();
export const BOIA_ILHOTA = 1.2;
/** altura do TOPO da ilhota k no instante t (s) — `amp` = 1 normal, menor com "reduzir movimento" */
export const alturaIlhota = (k: number, t: number, amp = 1) => CIDADE.pisoY + ILHOTAS[k]!.dy + Math.sin(t * 0.25 + ILHOTAS[k]!.fase) * BOIA_ILHOTA * amp;
/** a ilhota cujo topo está sob `p` (mundo), ou -1 */
export function ilhotaEm(p: P2, folga = 0): number {
  for (let k = 0; k < ILHOTAS.length; k++) { const il = ILHOTAS[k]!, w = mundo(il); if (Math.hypot(p.x - w.x, p.z - w.z) < il.r - 0.3 + folga) return k; }
  return -1;
}
/** o corpo da ilhota (sólido): cilindro aproximado do topo até `ALTURA_CORPO_ILHOTA × r` pra baixo (o cone afina) */
export const ALTURA_CORPO_ILHOTA = 1.4;

/** ainda em cima de um PISO da Zaeon (a plataforma central, a escada ou o lounge)? Passou da borda = cai (não há
 *  parede invisível em volta da central; a escada e o lounge têm corrimão/parede) */
export const naIlhaPrincipal = (p: P2) => {
  const l = { x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z };
  return Math.hypot(l.x, l.z) <= CIDADE.bordaR + 0.1 || dentroDaEscada(l, 0.3) || noDiscoDoLounge(l, 0.3);
};

/** o PISO sob quem voa de mochila na Zaeon (altura acima do piso central), ou `null` = não há piso embaixo (saiu da
 *  Zaeon: cai pro céu livre). A escada e o lounge só são piso pra quem está ACIMA deles — por baixo, passa direto. */
export function pisoNoAr(p: P2, yRel: number): number | null {
  const h = alturaNaCidade(p);
  if (h > 0 && yRel >= h - 0.6) return h;
  return Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z) <= CIDADE.bordaR + 0.1 ? 0 : null;
}

/** o PISO de onde se voa de mochila aqui (yRel = a altura atual acima do piso central): o teto da mochila e as paredes
 *  baixas contam a partir DELE — no lounge (88 m acima da central) o teto antigo, medido da central, puxava quem pulava
 *  pra baixo do piso do lounge e ele caía da plataforma */
export const pisoDeVoo = (p: P2, yRel: number) => pisoNoAr(p, yRel) ?? 0;

/** andar na Zaeon SEM a parede invisível da borda: só os colisores (quem passa da borda, cai — o engine trata) */
export const resolverCidadeLivre = (prop: P2): P2 => empurrarParaFora(prop, colisoresDaCidade());

/** passo andando na cidade com LIMITE na borda (clicar no chão pra andar não te leva pra fora da ilha) */
export function resolverCidade(prop: P2): P2 {
  let q = empurrarParaFora(prop, colisoresDaCidade());
  const c = CIDADE.centro, dx = q.x - c.x, dz = q.z - c.z, d = Math.hypot(dx, dz), l = { x: dx, z: dz };
  if (d > CIDADE.andavelR && !dentroDaEscada(l) && !noDiscoDoLounge(l)) q = { x: c.x + (dx / d) * CIDADE.andavelR, z: c.z + (dz / d) * CIDADE.andavelR };
  return q;
}

export const dentroDe = (p: P2, alvo: { x: number; z: number; r: number }) => Math.hypot(p.x - alvo.x, p.z - alvo.z) <= alvo.r;
/** pisou no anel de entrada (chão, embaixo do buraco negro)? */
export const noPortalEntrada = (p: P2) => dentroDe(p, CIDADE.portalEntrada);
/** na cidade, pisou no portal de volta? */
export const noPortalVolta = (p: P2) => dentroDe(p, { ...mundo(CIDADE.portalVolta), r: CIDADE.portalVolta.r });
/** volume sólido da ilha (pra NAVE): cilindro aproximado [pisoY - ilhaAltura, pisoY] × bordaR + a AGULHA embaixo (cilindro fino) */
export function foraDaIlha(p: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const c = CIDADE.centro, dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
  const base = CIDADE.pisoY - CIDADE.ilhaAltura, topo = CIDADE.pisoY;
  // a agulha (ponta embaixo do ápice): vindo de baixo, para na ponta; de lado, desliza pra fora
  const ag = CIDADE.agulha, fundo = base - ag.altura;
  if (d < ag.r && p.y >= fundo && p.y < base) {
    if (p.y - fundo < ag.r - d) return { ...p, y: fundo };
    const k = d > 1e-4 ? ag.r / d : 1;
    return { x: c.x + (d > 1e-4 ? dx * k : ag.r), y: p.y, z: c.z + (d > 1e-4 ? dz * k : 0) };
  }
  if (d > CIDADE.bordaR || p.y < base || p.y > topo) return p;
  // dentro do volume: sai pelo lado mais perto (cima = pousa no piso; baixo; ou radialmente)
  const paraCima = topo - p.y, paraBaixo = p.y - base, paraFora = CIDADE.bordaR - d;
  if (paraCima <= paraBaixo && paraCima <= paraFora) return { ...p, y: topo };
  if (paraBaixo <= paraFora) return { ...p, y: base };
  const k = d > 1e-4 ? CIDADE.bordaR / d : 1;
  return { x: c.x + (d > 1e-4 ? dx * k : CIDADE.bordaR), y: p.y, z: c.z + (d > 1e-4 ? dz * k : 0) };
}

/** o chão sob a nave: piso da cidade se está sobre ela (e acima do piso), senão o chão do mapa */
export function chaoDaNave(p: { x: number; y: number; z: number }): number {
  const c = CIDADE.centro;
  return Math.hypot(p.x - c.x, p.z - c.z) <= CIDADE.andavelR && p.y >= CIDADE.pisoY - 0.5 ? CIDADE.pisoY : 0;
}
