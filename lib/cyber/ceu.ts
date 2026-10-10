/**
 * Cyberespaço — a CIDADE ZAEON no céu, o coração do hiperespaço (aberta a todos). PURO, sem three.
 * Conceito das cidades flutuantes (estilo Avatar): uma ilha monumental + ilhotas em volta. Não há chão embaixo (o
 * hiperespaço é só vazio + áreas flutuantes, lib/cyber/praca): chega-se pelo BURACO NEGRO da cidade — o "metrô" que
 * liga a Zaeon às universidades, à Solana House e à praça (lib/cyber/buracos) — ou voando.
 * O buraco negro GRANDE (o do filme) agora fica no LOUNGE, em cima do palco, perto da cabine do DJ: é o par do buraco
 * negro de dentro da nave do dono — e a ÚNICA entrada da cabine (só o dono atravessa).
 *
 * Coordenadas: `centro` no plano (x,z) do mundo; tudo que é "local" é relativo ao centro (sem giro).
 */
import { empurrarParaFora, type Colisor, type P2 } from "./colisao";
import { colisoresDoDistritoTerra } from "./terra";
import { DECK, TEMPLO, alturaDaEscadaria, alturaNoLounge, bordaDoDeck, bordasDaEscadaria, colisoresDoTemplo, noCorredorDaEscadaria, noTemplo, saidaDoLounge, GARAGEM_LOUNGE, naGaragemDoLounge } from "./templo";

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
  /** as SALAS (pavilhões): cada uma numa PLATAFORMA PRÓPRIA fora da ilha (referencial local, sem giro), flutuando na
   *  altura `y` (acima do piso), na direção `ang` (rad, atan2(z, x)) — a porta (o +z da sala) dá pra ESCADA DE ENERGIA
   *  que vem da plataforma central. O LOUNGE (a festa, a oeste), a GARAGEM (a ala dos VEÍCULOS: todas as motos da Zaeon,
   *  os robôs que as fabricam — maior) e 2 espaços de convivência minimalistas e sonorizados (biblioteca e jardim), em
   *  leque a cada 60°, todos do lado oposto à doca da nave. As salas se ligam à central por FIOS DE ENERGIA que puxam */
  salas: {
    lounge: { x: 0 as number, z: 0 as number, r: 70, y: 0 as number, porta: 0.15, ang: Math.PI },   // 3× maior (out/2026): pátio + deck da festa (lib/cyber/templo)
    garagem: { x: 0 as number, z: 0 as number, r: 62, y: 0 as number, porta: 0.15, ang: (Math.PI * 4) / 3 },
    biblioteca: { x: 0 as number, z: 0 as number, r: 40, y: 0 as number, porta: 0.15, ang: (Math.PI * 5) / 3 },
    jardim: { x: 0 as number, z: 0 as number, r: 40, y: 0 as number, porta: 0.15, ang: 0 },
  },
  /** parede das salas: colisores ao longo do arco; `porta` = meia-abertura (rad) da porta */
  salaParede: { colR: 0.6, passo: 1, porta: 0.34 },
  /** o BURACO NEGRO da cidade (o nó central da rede — lib/cyber/buracos): o anel no piso (local) */
  portalTunel: { x: -32 * E, z: 15 * E, r: 3.2 },
  chegada: { x: -25 * E, z: 21 * E },                            // onde se aparece ao chegar pelo túnel (local)
};
/** o lounge flutua na altura do início da ponta da capela; a escada sobe com inclinação de escada de verdade (~33°),
 *  então a distância da plataforma dele sai da altura */
export const INCLINACAO_ESCADA = 0.65;
/** as TORRES da muralha (as grandes, de cristal com a ponta acesa): `n` em volta, na `muralhaR`, a 1ª em π/n. Entre
 *  elas, no lugar dos antigos blocos de granizo, ficam os TUBOS DE ENSAIO onde quem chega nasce (lib/cyber/onboarding) */
export const TORRES_MURALHA = { n: 16, alt: 48, rBase: 3.8 } as const;
export const anguloDaTorre = (k: number) => Math.PI / TORRES_MURALHA.n + (k / TORRES_MURALHA.n) * Math.PI * 2;
/** o vão da muralha onde uma ESCADA sai (local da ilha) — a muralha, as torres, o fogo e os tubos abrem ali */
export const naAberturaDaEscada = (x: number, z: number) => Object.values(ESCADAS).some((e) => x * e.dir.x + z * e.dir.z > 0 && Math.abs(-x * e.dir.z + z * e.dir.x) < e.meia + 5);
/** todas as salas na mesma altura e à mesma distância (a escada sobe com a mesma inclinação) */
const limpo = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
for (const sl of Object.values(CIDADE.salas)) {
  sl.y = Math.round(inicioDaPonta());
  const d = CIDADE.andavelR - 8 + sl.y / INCLINACAO_ESCADA + sl.r - 1.5;
  sl.x = limpo(Math.cos(sl.ang) * d); sl.z = limpo(Math.sin(sl.ang) * d);
}
export const ALTURA_LOUNGE = CIDADE.salas.lounge.y;
/** o piso da FESTA (o deck do lounge, acima do pátio) — o palco, a torre e a cabine do DJ ficam em cima dele */
export const PISO_FESTA = ALTURA_LOUNGE + DECK.h;

/**
 * A ESCADA do lounge: reta, flutuando, do piso da plataforma central (perto da borda) até a porta da plataforma do
 * lounge, subindo `ALTURA_LOUNGE` metros. Corre no eixo −x local (o lounge fica a oeste). Corrimão dos DOIS lados
 * (colisores) do pé ao topo: só se entra pelo pé e sai no lounge — ninguém sobe pela lateral nem passa por baixo.
 */
export type Escada = { sala: NomeSala; dir: P2; meia: number; ini: number; fim: number; len: number; colR: number; passo: number };
/** a ESCADA DE ENERGIA de cada sala (a do lounge é a `ESCADA_LOUNGE`): do pé, perto da borda da central, até a porta */
export const ESCADAS = Object.fromEntries((Object.keys(CIDADE.salas) as NomeSala[]).map((nome) => {
  const L = CIDADE.salas[nome], ini = CIDADE.andavelR - 8, fim = Math.hypot(L.x, L.z) - L.r + 1.5;
  return [nome, { sala: nome, dir: { x: limpo(Math.cos(L.ang)), z: limpo(Math.sin(L.ang)) }, meia: 5, ini, fim, len: fim - ini, colR: 0.5, passo: 0.6 }];   // corrimão bem denso: cair daqui é queda de verdade
})) as Record<NomeSala, Escada>;
export const ESCADA_LOUNGE = ESCADAS.lounge;
/** onde na escada `e` um ponto LOCAL (relativo ao centro da ilha) está: `u` ao longo (0 = pé), `lat` de lado */
export const naEscadaLocal = (l: P2, e: Escada = ESCADA_LOUNGE) => { const along = l.x * e.dir.x + l.z * e.dir.z; return { u: along - e.ini, lat: l.x * -e.dir.z + l.z * e.dir.x }; };
/** a escada cujo corredor contém `l` (local), ou null */
export function escadaEm(l: P2, folga = 0): Escada | null {
  for (const e of Object.values(ESCADAS)) { const q = naEscadaLocal(l, e); if (q.u >= -folga && q.u <= e.len + folga && Math.abs(q.lat) <= e.meia + folga) return e; }
  return null;
}
/** está no corredor de alguma escada (local)? */
const dentroDaEscada = (l: P2, folga = 0) => escadaEm(l, folga) !== null;
/** a sala cujo disco contém `l` (local), ou null */
export function salaEm(l: P2, folga = 0): NomeSala | null {
  for (const nome of Object.keys(CIDADE.salas) as NomeSala[]) { const L = CIDADE.salas[nome]; if (Math.hypot(l.x - L.x, l.z - L.z) <= L.r + folga) return nome; }
  return null;
}
/** está sobre o disco do LOUNGE (local)? (o palco/DJ só existem nele) */
const noDiscoDoLounge = (l: P2, folga = 0) => { const L = CIDADE.salas.lounge; return Math.hypot(l.x - L.x, l.z - L.z) <= L.r + folga; };
/** (local da ilha) numa escada ou no disco de uma sala — o chão que fica FORA do raio andável da central */
export const naEscadaOuLounge = (l: P2) => dentroDaEscada(l) || salaEm(l) !== null;
/** (local da ilha) na plataforma da GARAGEM DO LOUNGE (lib/cyber/templo) — chão, `GARAGEM_LOUNGE.desce` m abaixo do lounge */
export function naGaragemLocal(l: P2, folga = 0): boolean {
  const L = CIDADE.salas.lounge;
  if (Math.hypot(l.x - L.x, l.z - L.z) > L.r + 120) return false;
  return naGaragemDoLounge(naSala(L, l.x, l.z), folga);
}
/** (mundo) na plataforma da garagem do lounge? */
export const naGaragem = (p: P2, folga = 0) => naGaragemLocal({ x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z }, folga);
/** (local da ilha) no TEMPLO ou na ESCADARIA que leva a ele (lib/cyber/templo) — chão também, fora das salas */
export function noTemploOuEscadaria(l: P2, folga = 0): boolean {
  const L = CIDADE.salas.lounge;
  if (Math.hypot(l.x - L.x, l.z - L.z) > L.r + TEMPLO.r * 2 + 80) return false;   // (longe: nem calcula)
  const q = naSala(L, l.x, l.z);
  return noTemplo(q, folga) || (q.x > 40 && q.z < 0 && noCorredorDaEscadaria(q, folga) !== null);
}
/** o FIO DE ENERGIA de cada escada: o cabo passa a `alturaFio` m acima da linha da rampa (do pé ao topo); quem é puxado
 *  vai pendurado na alça, com os pés a `pes` m acima dela; no máximo `max` pessoas por fio ao mesmo tempo */
export const FIO = { alturaFio: 3.1, pes: 0.55, max: 4, flecha: 2.2 } as const;
/** a altura do CABO (acima do piso central) a `u` m do pé da escada `e`: a linha da rampa + `alturaFio`, com uma
 *  barriga leve no meio (`flecha`) — quem é puxado segue a mesma curva, pendurado */
export function alturaDoFio(e: Escada, u: number): number {
  const k = Math.max(0, Math.min(1, u / e.len));
  return ALTURA_LOUNGE * k + FIO.alturaFio - FIO.flecha * 4 * k * (1 - k);
}

export const mundo = (l: P2): P2 => ({ x: CIDADE.centro.x + l.x, z: CIDADE.centro.z + l.z });

/** o GLOBO de luz no centro da capela (local da ilha): raio e altura do centro acima do piso — é de dentro dele que o
 *  holograma da Zaeon sai (components/cyber/HoloZaeon) */
export const GLOBO_CAPELA = (() => { const r = CIDADE.mesaHolo.r * 0.75; return { r, y: 2.2 + r + 1.5 }; })();

/** as ESTAÇÕES DE TRABALHO DOS AGENTES (components/cyber/EstacoesAgentes): um anel em volta do pátio central da capela */
export const ESTACOES = { n: 8, r: 38, platR: 4.4 } as const;
/** as estações (local da ilha): no anel entre o globo e os pilares (r 54) — os desktops de estudo saíram da capela;
 *  `rot` deixa o +z local (a frente das telas) virado pro coração */
export function estacoesLocais(): { x: number; z: number; rot: number }[] {
  return Array.from({ length: ESTACOES.n }, (_, i) => { const a = (i / ESTACOES.n) * Math.PI * 2; return { x: Math.cos(a) * ESTACOES.r, z: Math.sin(a) * ESTACOES.r, rot: Math.atan2(-Math.cos(a), -Math.sin(a)) }; });
}
/** colisores das estações (mundo): a parede de telas atrás, as torres de servidor e o console */
export function colisoresDasEstacoes(): Colisor[] {
  const out: Colisor[] = [];
  for (const e of estacoesLocais()) {
    const s = Math.sin(e.rot), c = Math.cos(e.rot), em = (lx: number, lz: number) => mundo({ x: e.x + lx * c + lz * s, z: e.z - lx * s + lz * c });
    for (let x = -3.4; x <= 3.4; x += 1.1) out.push({ ...em(x, -2.6), r: 0.75 });
    for (const x of [-3.9, 3.9]) out.push({ ...em(x, -2.3), r: 0.85 });
    out.push({ ...em(0, -0.95), r: 0.95 });
  }
  return out;
}

/** as BASES DO DONO na Zaeon (local): fora da capela, uma por fundador (lib/cyber/bases usa estas) — as cabines de
 *  estudo desviam delas */
export const BASES_DONO_LOCAIS: readonly { x: number; z: number }[] = [{ x: 0, z: 75 }, { x: 0, z: -75 }, { x: -75, z: -18.75 }];

/** a HIERARQUIA da cidadela (lib/cyber/credenciais): quem tem CABINE DE ESTUDO e em que fileira. Logo depois dos
 *  pilares da capela, os PROFESSORES (doutorado); atrás deles, os DOUTORES; depois, os MESTRANDOS. Graduando não tem
 *  cabine (estuda no chão, em volta das supertrees e das cabines, nas pontas — lib/cyber/cidadela) */
export type NivelCabine = "professor" | "doutor" | "mestrando";
export const FILEIRAS_CABINES: readonly { nivel: NivelCabine; r: number; n: number; fase: number }[] = [
  { nivel: "professor", r: 64, n: 9, fase: 0.5 },
  { nivel: "doutor", r: 78, n: 9, fase: 0 },
  { nivel: "mestrando", r: 93, n: 34, fase: 0.25 },
];
/** a CABINE (referencial dela: o +z = a frente, virada pra capela; a pessoa senta em `assento`, de frente pra mesa e
 *  pra capela, com o monitor entre ela e o centro) */
export const CABINE = { larg: 3.0, prof: 2.8, mesaZ: 0.75, monitorZ: 1.05, assento: { x: 0, z: -0.35 }, painelX: 1.45 } as const;
export type CabineEstudo = { id: string; nivel: NivelCabine; fileira: number; i: number; x: number; z: number; rot: number };
/** um ponto do referencial de uma cabine → local da ilha */
export function daCabine(c: { x: number; z: number; rot: number }, lx: number, lz: number): P2 {
  const s = Math.sin(c.rot), co = Math.cos(c.rot);
  return { x: c.x + lx * co + lz * s, z: c.z - lx * s + lz * co };
}
/** as cabines (local da ilha), fileira por fileira, espaçadas por igual; uma vaga que cai na boca de uma escada, no
 *  portal/chegada do túnel ou numa base do dono desliza pro lado até ficar livre. Determinístico (constante) */
let cabinesCache: CabineEstudo[] | null = null;
export function cabinesDaCidadela(): CabineEstudo[] {
  if (cabinesCache) return cabinesCache;
  const out: CabineEstudo[] = [], pt = CIDADE.portalTunel, ch = CIDADE.chegada;
  const livre = (l: P2) => !escadaEm(l, 4) && Math.hypot(l.x - pt.x, l.z - pt.z) > 12 && Math.hypot(l.x - ch.x, l.z - ch.z) > 10
    && BASES_DONO_LOCAIS.every((b) => Math.hypot(l.x - b.x, l.z - b.z) > 9) && out.every((o) => Math.hypot(l.x - o.x, l.z - o.z) > CABINE.larg + 2.4);
  FILEIRAS_CABINES.forEach((f, fi) => {
    const passo = (Math.PI * 2) / f.n;
    for (let i = 0; i < f.n; i++) {
      const a0 = (i + f.fase) * passo;
      let l = { x: Math.cos(a0) * f.r, z: Math.sin(a0) * f.r };
      for (let k = 1; k <= 8 && !livre(l); k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * passo * 0.18; l = { x: Math.cos(a) * f.r, z: Math.sin(a) * f.r }; }
      out.push({ id: `cabine-${f.nivel}-${i}`, nivel: f.nivel, fileira: fi, i, x: l.x, z: l.z, rot: Math.atan2(-l.x, -l.z) });
    }
  });
  return (cabinesCache = out);
}
/** colisores das cabines (mundo): a mesa com o monitor e os dois painéis de vidro dos lados (a cadeira não: quem senta
 *  entra por trás) */
export function colisoresDasCabines(): Colisor[] {
  const out: Colisor[] = [];
  for (const c of cabinesDaCidadela()) {
    for (const x of [-0.65, 0.65]) out.push({ ...mundo(daCabine(c, x, CABINE.mesaZ + 0.1)), r: 0.75 });
    for (const sx of [-1, 1]) for (const z of [-0.7, 0.5]) out.push({ ...mundo(daCabine(c, sx * CABINE.painelX, z)), r: 0.4 });
  }
  return out;
}

/** colisores da plataforma (mundo): pilares da capela, a mesa do globo, paredes e móveis
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
  { const L = CIDADE.salas.lounge;   // o desnível pátio↔deck, a escadaria do templo (muralha + guarda-corpo) e o templo
    for (const c of bordaDoDeck(L.r)) out.push({ ...mundo(daSala(L, c.x, c.z)), r: DECK.colR });
    for (const c of bordasDaEscadaria(L.r)) out.push({ ...mundo(daSala(L, c.x, c.z)), r: 0.5 });
    for (const c of colisoresDoTemplo()) out.push({ ...mundo(daSala(L, c.x, c.z)), r: c.r }); }
  const { cidadela, mesaHolo } = CIDADE;
  for (let i = 0; i < cidadela.pilares; i++) { const a = (i / cidadela.pilares) * Math.PI * 2; out.push({ ...mundo({ x: Math.cos(a) * cidadela.r, z: Math.sin(a) * cidadela.r }), r: cidadela.pilarColR }); }
  out.push({ ...mundo({ x: 0, z: 0 }), r: mesaHolo.r });
  out.push(...colisoresDasEstacoes());
  out.push(...colisoresDasCabines());   // as CABINES DE ESTUDO da hierarquia (professores, doutores, mestrandos)
  out.push(...colisoresDoDistritoTerra(mundo));   // o Observatório da Terra (supertrees, motores, telões, globo)
  // (sem corrimão: as escadas viraram FIOS DE ENERGIA — o corredor não é piso, ninguém anda nele)
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
  z: -44, r: 10, h: 3,   // no fundo do DECK da festa (o lounge cresceu de novo: 70 m) — em cima do deck (`PISO_FESTA`)
  /** escada: meia-largura e comprimento (desce do palco rumo à pista) */
  escada: { meia: 2.5, len: 6 },
  /** colisores da borda: passo e raio */
  passo: 0.6, colR: 0.5,   // (0,6: os colisores se sobrepõem bem — num quadro lento o passo não atravessa a borda)
  /** a cabine do DJ (atrás da mesa, lá em cima na TORRE): centro, raio; quem está nela olha pra pista (+z da sala) */
  cabine: { x: 0, z: -44.35, r: 0.95 },   // encosta na mesa (o colisor dela vai até −17,05): as mãos alcançam a controladora
} as const;
/** a TORRE DO DJ: a MEGA ESTRUTURA de cristal que sobe do palco até a cabine, lá no alto (na altura da bola de
 *  espelhos). O círculo dela é sólido pra quem está no palco e é o guarda-corpo de quem está lá em cima; sobe-se pelo
 *  ELEVADOR DE LUZ atrás dela (pisou no anel do palco, sobe surfando; no anel lá de cima, desce). */
export const TORRE_DJ = { z: -45, r: 4.5, topo: 12, colR: 0.5, passo: 0.6,
  elevador: { r: 1, sobe: -50.9, chegaEmCima: -47.4, desce: -48.6, rDesce: 0.7, chegaEmbaixo: -52.3, dur: 3.6 } } as const;
export const MESA_DJ = { x: 0, z: -43.4, larg: 4.2, prof: 1, topo: 1.05 } as const;
/** a ESTRUTURA DE METAL alta (treliça) de onde pendem as caixas: 2 torres + viga; as caixas SUSPENSAS (line arrays) */
export const TRELICA = { x: 17, z: -46, alt: 26, viga: 24 } as const;
export const CAIXAS_SUSPENSAS = [{ x: -14, z: -38 }, { x: 14, z: -38 }] as const;
/** uma ZONA de lounge (referencial da sala): tapete aceso + o miolo (mesinha baixa com narguilé, fogueira holográfica
 *  ou só a mesinha) + os assentos em volta virados pra ele, com a boca aberta pra `abre` (ângulo: sen/cos = x/z) */
export function zonaLounge(cx: number, cz: number, abre: number, cor: number, tipo: "narguile" | "fogueira" | "mesinha"): Movel[] {
  const out: Movel[] = [{ tipo: "tapete", x: cx, z: cz, rot: abre, larg: 9, prof: 9, solido: false, cor }];
  if (tipo === "fogueira") out.push({ tipo: "fogueira", x: cx, z: cz, rot: 0, larg: 1.8, prof: 1.8, cor });
  else out.push({ tipo: "mesaBaixa", x: cx, z: cz, rot: 0, larg: 1.6, prof: 1.6, cor });
  if (tipo === "narguile") out.push({ tipo: "narguile", x: cx, z: cz, rot: abre, larg: 0.5, prof: 0.5, solido: false, y: 0.16 + 0.45, cor });
  if (tipo === "fogueira") {   // puffs em roda (menos na boca)
    for (let i = 0; i < 6; i++) { const a = abre + Math.PI / 3.5 + (i / 5) * (Math.PI * 2 - Math.PI / 1.75); out.push({ tipo: "puff", x: cx + Math.sin(a) * 2.9, z: cz + Math.cos(a) * 2.9, rot: a + Math.PI, larg: 1, prof: 1, cor }); }
  } else {
    for (const da of [Math.PI, Math.PI / 2, -Math.PI / 2]) {   // sofás em "U": o do fundo e os dois dos lados
      const a = abre + da; out.push({ tipo: "sofa", x: cx + Math.sin(a) * 3, z: cz + Math.cos(a) * 3, rot: a + Math.PI, larg: 3.4, prof: 1.2, cor });
    }
    for (const lado of [-1, 1]) {   // 2 PUFES (os grandes, de largar o corpo) na boca do U, virados pro meio — a passagem fica livre
      const a = abre + lado * 0.62; out.push({ tipo: "pufe", x: cx + Math.sin(a) * 3.4, z: cz + Math.cos(a) * 3.4, rot: a + Math.PI, larg: 1.3, prof: 1.3, cor });
    }
  }
  return out;
}
/** os móveis do lounge vão em cima do DECK da festa: a elevação de cada um soma DECK.h */
function noDeck(lista: Movel[]): Movel[] { return lista.map((m) => ({ ...m, y: (m.y ?? 0.16) + DECK.h })); }
export const MOVEIS: Record<NomeSala, Movel[]> = {
  // LOUNGE = CLUBE a céu aberto na plataforma própria: telão no fundo, palco de cristal alto com a mesa do DJ, a
  // treliça com as caixas suspensas (as torres dela são sólidas), as TORRES de som gigantes e os subs no chão, pista de
  // LED e sofás nas laterais
  // (out/2026) tudo isso em cima do DECK da festa (`y` já soma DECK.h); o pátio (a chegada, as motos) fica na frente
  lounge: noDeck([
    { tipo: "palco", x: 0, z: PALCO.z, rot: 0, larg: 0, prof: 0, solido: false, y: 0 },   // colisão própria (bordaDoPalco)
    { tipo: "torreDJ", x: 0, z: TORRE_DJ.z, rot: 0, larg: 0, prof: 0, solido: false, y: PALCO.h },   // colisão própria (bordaDaTorre)
    { tipo: "mesaDJ", x: MESA_DJ.x, z: MESA_DJ.z, rot: 0, larg: MESA_DJ.larg, prof: MESA_DJ.prof, y: TORRE_DJ.topo },
    { tipo: "trelica", x: -TRELICA.x, z: TRELICA.z, rot: 0, larg: 2.4, prof: 2.4 },
    { tipo: "trelica", x: TRELICA.x, z: TRELICA.z, rot: 0, larg: 2.4, prof: 2.4 },
    { tipo: "caixaSom", x: CAIXAS_SUSPENSAS[0].x, z: CAIXAS_SUSPENSAS[0].z, rot: 0.3, larg: 3.2, prof: 2.2, solido: false },   // suspensa: não ocupa o chão
    { tipo: "caixaSom", x: CAIXAS_SUSPENSAS[1].x, z: CAIXAS_SUSPENSAS[1].z, rot: -0.3, larg: 3.2, prof: 2.2, solido: false },
    { tipo: "torreSom", x: -25, z: -37, rot: 0.45, larg: 3.6, prof: 2.6 },   // as TORRES de som gigantes no chão (10 m), como antes — além das suspensas
    { tipo: "torreSom", x: 25, z: -37, rot: -0.45, larg: 3.6, prof: 2.6 },
    { tipo: "sub", x: -14, z: -30, rot: 0.3, larg: 3, prof: 2 },
    { tipo: "sub", x: 14, z: -30, rot: -0.3, larg: 3, prof: 2 },
    // as ZONAS de lounge (pra não ser só pista): rodas de sofá com NARGUILÉ, puffs em volta de FOGUEIRAS holográficas e
    // cantinhos com mesinha, dos dois lados da pista — o corredor da DIREITA (rumo à escadaria do templo) fica livre
    ...zonaLounge(-34, -22, Math.PI / 2, 0xb98cff, "narguile"),
    ...zonaLounge(34, 0, -Math.PI / 2, 0x66e6ff, "narguile"),
    ...zonaLounge(-30, 2, Math.PI / 2, 0xff9a5c, "fogueira"),
    ...zonaLounge(42, -42, -Math.PI / 2, 0xff5fd2, "fogueira"),
    ...zonaLounge(-42, -40, Math.PI / 2, 0x9affd0, "mesinha"),
    ...zonaLounge(-52, -12, Math.PI / 2, 0xffc46b, "mesinha"),
  ]),
  // os 3 espaços de CONVIVÊNCIA: minimalistas e sonorizados (CAIXAS de som discretas com música ambiente) — sofás,
  // pufes, plantas; NADA de estrutura de festa (sem palco, pista, treliça). O corredor do meio (da porta, +z, ao centro)
  // fica livre
  // a GARAGEM (a ala dos veículos): os 2 estacionamentos das motos (lib/cyber/motos — o piso e os robôs são de lá) no
  // fundo, as TORRES DE CARGA nas laterais e o corredor da porta livre (as motos saem voando por cima do guarda-corpo)
  garagem: [
    ...[[-44, -14], [44, -14], [-46, 14], [46, 14], [-30, -42], [30, -42]].map(([x, z]) => ({ tipo: "torreCarga", x: x!, z: z!, rot: Math.atan2(-x!, -z!), larg: 1.6, prof: 1.6 })),
  ],
  biblioteca: [
    // ESTANTES em arco no fundo e nas laterais, viradas pro meio
    ...[-1.2, -0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9, 1.2, -1.65, 1.65, -1.95, 1.95].map((a) => { const x = Math.sin(a) * 33, z = -Math.cos(a) * 33; return { tipo: "estante", x, z, rot: Math.atan2(-x, -z), larg: 5.6, prof: 1 }; }),
    // MESAS de leitura com luminária, um pufe de cada lado
    ...[[-7, -10], [7, -10], [-7, 2], [7, 2]].flatMap(([x, z]) => [
      { tipo: "mesaLeitura", x: x!, z: z!, rot: 0, larg: 3, prof: 1.4, cor: 0x7fb8ff },
      { tipo: "pufe", x: x!, z: z! - 2, rot: 0, larg: 1.3, prof: 1.3, cor: 0x7fb8ff },
      { tipo: "pufe", x: x!, z: z! + 2, rot: Math.PI, larg: 1.3, prof: 1.3, cor: 0x7fb8ff },
    ]),
    ...zonaLounge(-22, 16, Math.PI / 2, 0x7fb8ff, "mesinha"),
    ...zonaLounge(22, 16, -Math.PI / 2, 0x9fd0ff, "mesinha"),
    ...caixasEmVolta([0.45 + Math.PI, -0.45 + Math.PI, 0.98, -0.98], 36),
  ],
  jardim: [
    // o ESPELHO D'ÁGUA no meio, com PUFES em volta virados pra ele (menos do lado da porta)
    { tipo: "espelhoAgua", x: 0, z: -8, rot: 0, larg: 14, prof: 14, cor: 0x7dffb0 },
    ...[1.15, 1.9, 2.65, 3.63, 4.38, 5.13].map((a) => ({ tipo: "pufe", x: Math.sin(a) * 10.5, z: -8 + Math.cos(a) * 10.5, rot: a + Math.PI, larg: 1.3, prof: 1.3, cor: 0x7dffb0 })),
    // ÁRVORES de luz em volta (a porta, +z, fica aberta)
    ...[0.62, 1.05, 1.5, 1.95, 2.4, 2.85, 3.43, 3.88, 4.33, 4.78, 5.23, 5.66].map((a) => ({ tipo: "planta", x: Math.sin(a) * 34, z: Math.cos(a) * 34, rot: a, larg: 1.6, prof: 1.6 })),
    ...zonaLounge(-22, 12, Math.PI / 2, 0x7dffb0, "mesinha"),
    ...zonaLounge(22, 12, -Math.PI / 2, 0xa8ffcf, "mesinha"),
    ...caixasEmVolta([0.8, -0.8, 2.4, -2.4], 36),
  ],
};
/** CAIXAS DE SOM discretas (colunas finas) num círculo de raio `r`, nos ângulos dados (sen/cos = x/z), viradas pro meio */
function caixasEmVolta(angs: number[], r: number): Movel[] {
  return angs.map((a) => { const x = Math.sin(a) * r, z = Math.cos(a) * r; return { tipo: "caixaMinimal", x, z, rot: Math.atan2(-x, -z), larg: 0.8, prof: 0.6 }; });
}
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
    if (Math.hypot(q.x, q.z - TORRE_DJ.z) <= TORRE_DJ.r) return PISO_FESTA + TORRE_DJ.topo;   // lá em cima, na cabine da torre
    if (Math.hypot(q.x, q.z - z) <= r) return PISO_FESTA + h;
    const z0 = z + r - 0.3;
    if (Math.abs(q.x) <= escada.meia && q.z >= z0 && q.z <= z0 + escada.len) return PISO_FESTA + h * (1 - (q.z - z0) / escada.len);
    return ALTURA_LOUNGE + alturaNoLounge(q);   // o pátio, a rampa ou o deck
  }
  if (salaEm(l)) return ALTURA_LOUNGE;   // as outras salas: piso plano
  if (naGaragemLocal(l)) return ALTURA_LOUNGE - GARAGEM_LOUNGE.desce;   // a GARAGEM do lounge (as motos), 25 m abaixo dele
  if (noTemploOuEscadaria(l)) {   // o TEMPLO e a escadaria em curva até ele
    const q = naSala(CIDADE.salas.lounge, l.x, l.z);
    if (noTemplo(q)) return ALTURA_LOUNGE + TEMPLO.h;
    const e = noCorredorDaEscadaria(q); if (e) return ALTURA_LOUNGE + alturaDaEscadaria(e.s);
  }
  return 0;   // (o corredor do FIO não é piso: atravessa-se pendurado nele)
}
/** está na CABINE do DJ (atrás da mesa, em cima do palco)? `p` no mundo */
export function naCabineDJ(p: P2): boolean {
  const s = CIDADE.salas.lounge, l = naSala(s, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);
  return Math.hypot(l.x - PALCO.cabine.x, l.z - PALCO.cabine.z) <= PALCO.cabine.r;
}
/** o ponto (mundo) onde o DJ fica — quem para na cabine é puxado devagar pra cá (as mãos caem na controladora) */
export const pontoDaCabineDJ = (): P2 => mundo(daSala(CIDADE.salas.lounge, PALCO.cabine.x, PALCO.cabine.z));
/** a ÁREA DE DANÇA do deck (referencial da sala): sem piso de LED (saiu — o centro do evento é a MANDALA em cima do
 *  DJ); quem para aqui dança, virado pra ela */
export const PISTA = { x: 0, z: -12, larg: 36, prof: 26 } as const;
/** está na área de dança do lounge? `p` no mundo — quem para ali dança */
export function naPistaDeDanca(p: P2): boolean {
  const q = naSala(CIDADE.salas.lounge, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);
  return Math.abs(q.x - PISTA.x) <= PISTA.larg / 2 && Math.abs(q.z - PISTA.z) <= PISTA.prof / 2;
}
/** pra onde quem dança olha: pro palco (o −z da sala) */
export const rumoDaPista = () => rotDaSala(CIDADE.salas.lounge) + Math.PI;
/** A ESCADA DE ENERGIA leva sozinha: pisou na BOCA de baixo (vindo da central) sobe; na de cima (vindo do lounge),
 *  desce. A viagem dura `dur` s e termina FORA das bocas (não dispara de novo sem querer). */
export const VIAGEM_ESCADA = { dur: 6.5, boca: 2, alemDoTopo: 2.5, antesDoPe: 3 } as const;
/** está no corredor de ALGUMA escada (de qualquer sala)? `p` no mundo */
export const naEscadaDoLounge = (p: P2) => dentroDaEscada({ x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z });
/** pisou numa BOCA de escada? qual sala e pra que lado ela leva */
export function bocaDeEscada(p: P2): { sala: NomeSala; sentido: "sobe" | "desce" } | null {
  const l = { x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z }, B = VIAGEM_ESCADA.boca;
  for (const e of Object.values(ESCADAS)) {
    const q = naEscadaLocal(l, e);
    if (Math.abs(q.lat) > e.meia + 0.3) continue;
    if (q.u >= -0.2 && q.u < B) return { sala: e.sala, sentido: "sobe" };
    if (q.u > e.len - B && q.u <= e.len + 0.5) return { sala: e.sala, sentido: "desce" };
  }
  return null;
}
export const bocaDaEscada = (p: P2): "sobe" | "desce" | null => bocaDeEscada(p)?.sentido ?? null;
/** o ponto (mundo) no meio da escada a `u` m do pé (u < 0: antes do pé, na central; u > len: já na sala) */
export const pontoDaEscada = (u: number, sala: NomeSala = "lounge"): P2 => { const e = ESCADAS[sala]; return mundo({ x: e.dir.x * (e.ini + u), z: e.dir.z * (e.ini + u) }); };
/** onde a viagem está (u) com o progresso `k` (0..1): sai devagar, corre no meio, chega devagar */
export function uDaViagem(sentido: "sobe" | "desce", k: number, sala: NomeSala = "lounge"): number {
  const c = Math.max(0, Math.min(1, k)), s = c * c * (3 - 2 * c), e = ESCADAS[sala], V = VIAGEM_ESCADA;
  return sentido === "sobe" ? s * (e.len + V.alemDoTopo) : e.len - s * (e.len + V.antesDoPe);
}
/** o rumo (facing do mundo) de quem é levado */
export const rumoDaViagem = (sentido: "sobe" | "desce", sala: NomeSala = "lounge") => { const d = ESCADAS[sala].dir; return Math.atan2(d.x, d.z) + (sentido === "sobe" ? 0 : Math.PI); };
/** o ELEVADOR DE LUZ da torre do DJ: só DESCE (o anel lá de cima). Subir pra cabine, só pelo buraco negro do dono
 *  (lib/cyber/buracos) — o anel do palco saiu */
export function bocaDoElevador(p: P2): "sobe" | "desce" | null {
  const q = naSala(CIDADE.salas.lounge, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z), e = TORRE_DJ.elevador;
  if (Math.hypot(q.x, q.z - e.desce) < e.rDesce) return "desce";
  return null;
}
/** o ELEVADOR DE LUZ da GARAGEM DO LOUNGE (lib/cyber/templo): o anel no pé (na plataforma das motos) SOBE até o lado
 *  esquerdo do pátio; o anel lá em cima DESCE. `p` no mundo */
export function bocaDaGaragem(p: P2): "sobe" | "desce" | null {
  const q = naSala(CIDADE.salas.lounge, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z), e = GARAGEM_LOUNGE.elevador;
  if (Math.hypot(q.x - e.pe.x, q.z - e.pe.z) < e.r) return "sobe";
  if (Math.hypot(q.x - e.topo.x, q.z - e.topo.z) < e.r) return "desce";
  return null;
}
/** a duração (s) de cada viagem levada: a escada de energia, o elevador da torre do DJ e o da garagem do lounge */
export const durDaViagem = (tipo: "escada" | "elevador" | "garagem") => tipo === "escada" ? VIAGEM_ESCADA.dur : tipo === "elevador" ? TORRE_DJ.elevador.dur : GARAGEM_LOUNGE.elevador.dur;
/** alguém (mundo, `yRel` = altura acima do piso central) está dentro da coluna de luz do elevador da garagem? (surfando) */
export function naColunaDaGaragem(p: P2, yRel: number): boolean {
  const q = naSala(CIDADE.salas.lounge, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z), e = GARAGEM_LOUNGE.elevador, base = ALTURA_LOUNGE - GARAGEM_LOUNGE.desce;
  return Math.hypot(q.x - e.pe.x, q.z - e.pe.z) < 1.6 && yRel > base + 0.6 && yRel < ALTURA_LOUNGE + 0.8;
}
/** dentro do círculo da TORRE do DJ (mundo, com folga)? — quem não é o dono não pousa lá em cima */
export function naTorreDJ(p: P2, folga = 0): boolean {
  const q = naSala(CIDADE.salas.lounge, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);
  return Math.hypot(q.x, q.z - TORRE_DJ.z) <= TORRE_DJ.r + folga;
}
/** empurra pra fora do círculo da torre (mundo) — o "campo de força" da cabine pra quem não é o dono */
export function foraDaTorreDJ(p: P2, folga = 0.6): P2 {
  const s = CIDADE.salas.lounge, q = naSala(s, p.x - CIDADE.centro.x, p.z - CIDADE.centro.z), dx = q.x, dz = q.z - TORRE_DJ.z, d = Math.hypot(dx, dz), R = TORRE_DJ.r + folga;
  if (d >= R) return p;
  const k = d > 1e-4 ? R / d : 1, l = daSala(s, d > 1e-4 ? dx * k : R, TORRE_DJ.z + (d > 1e-4 ? dz * k : 0));
  return mundo(l);
}
/** a VIAGEM (escada de energia ou elevador da torre) no progresso `k` (0..1): onde está (mundo), a altura acima do piso
 *  central e pra onde olha. O elevador sobe reto no anel e então desliza pra dentro da cabine (e o contrário, descendo) */
export function posDaViagem(tipo: "escada" | "elevador" | "garagem", sentido: "sobe" | "desce", k: number, nomeSala: NomeSala = "lounge"): { p: P2; y: number; rumo: number } {
  if (tipo === "garagem") {   // o elevador da GARAGEM do lounge: sobe reto no pé e desliza pra dentro do pátio (e o contrário)
    const L = CIDADE.salas.lounge, e = GARAGEM_LOUNGE.elevador, c = Math.max(0, Math.min(1, k)), s = (x: number) => x * x * (3 - 2 * x);
    const base = ALTURA_LOUNGE - GARAGEM_LOUNGE.desce, topo = ALTURA_LOUNGE, em = (x: number, z: number) => mundo(daSala(L, x, z)), rumo = rotDaSala(L) + Math.PI / 2;   // (olhando pro lounge: +x da sala)
    if (sentido === "sobe") {
      if (c < 0.72) return { p: em(e.pe.x, e.pe.z), y: base + (topo + 0.4 - base) * s(c / 0.72), rumo };
      const u = s((c - 0.72) / 0.28); return { p: em(e.pe.x + (e.topo.x - e.pe.x) * u, e.pe.z + (e.topo.z - e.pe.z) * u), y: topo + 0.4 * (1 - u), rumo };
    }
    if (c < 0.28) { const u = s(c / 0.28); return { p: em(e.topo.x + (e.pe.x - e.topo.x) * u, e.topo.z + (e.pe.z - e.topo.z) * u), y: topo + 0.4 * u, rumo: rumo + Math.PI }; }
    return { p: em(e.pe.x, e.pe.z), y: topo + 0.4 - (topo + 0.4 - base) * s((c - 0.28) / 0.72), rumo: rumo + Math.PI };
  }
  if (tipo === "escada") {   // PENDURADO no fio: a linha da rampa + os pés suspensos (sai do chão e pousa no chão nas pontas)
    const e = ESCADAS[nomeSala], u = uDaViagem(sentido, k, nomeSala), p = pontoDaEscada(u, nomeSala);
    const solto = Math.max(0, Math.min(1, u / 2, (e.len - u) / 2));   // 0 nas pontas (pés no chão), 1 no meio (pendurado)
    const pendurado = alturaDoFio(e, u) - FIO.alturaFio + FIO.pes, noChao = ALTURA_LOUNGE * Math.max(0, Math.min(1, u / e.len));
    return { p, y: noChao + (pendurado - noChao) * solto, rumo: rumoDaViagem(sentido, nomeSala) };
  }
  const L = CIDADE.salas.lounge, e = TORRE_DJ.elevador, c = Math.max(0, Math.min(1, k)), s = (x: number) => x * x * (3 - 2 * x);
  const embaixo = PISO_FESTA + PALCO.h, emCima = PISO_FESTA + TORRE_DJ.topo, sala = (z: number) => mundo(daSala(L, 0, z));
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
    if (s === CIDADE.salas.lounge) { const sd = saidaDoLounge(s.r); let e = a - sd.ang; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI; if (Math.abs(e) < sd.meia) continue; }   // a SAÍDA pra escadaria do templo
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
/** o setor de cada ESCADA/plataforma de sala (o lounge a oeste, ângulo π; as outras a cada 60°): as ilhotas deixam livre */
export const LOUNGE_ANGULO = Math.PI, LOUNGE_MEIA_ABERTURA = 0.2;
/** os setores livres pras ilhotas: tudo menos a doca e as escadas/plataformas das salas */
export const SETORES_OCUPADOS: { ang: number; meia: number }[] = [{ ang: DOCA_ANGULO, meia: DOCA_MEIA_ABERTURA }, ...Object.values(CIDADE.salas).map((sl) => ({ ang: sl.ang, meia: LOUNGE_MEIA_ABERTURA }))];
export const ILHOTAS: { x: number; z: number; r: number; dy: number; fase: number }[] = (() => {
  // espalhadas nos arcos LIVRES entre a doca (≈ +z) e as escadas das salas, um pouco maiores (a Zaeon cresceu)
  const D = Math.PI * 2, ocup = SETORES_OCUPADOS.map((o) => ({ a0: (((o.ang - o.meia) % D) + D) % D, a1: (((o.ang - o.meia) % D) + D) % D + 2 * o.meia })).sort((a, b) => a.a0 - b.a0);
  const arcos: [number, number][] = ocup.map((o, i) => [o.a1, i + 1 < ocup.length ? ocup[i + 1]!.a0 : ocup[0]!.a0 + D]);
  const out: { x: number; z: number; r: number; dy: number; fase: number }[] = [];
  let k = 0;
  for (const [a0, a1] of arcos) {
    if (a1 - a0 < 0.3) continue;   // fresta entre a doca e uma escada: não cabe ilhota
    const n = Math.max(1, Math.round((a1 - a0) / 0.3));
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
  return Math.hypot(l.x, l.z) <= CIDADE.bordaR + 0.1 || salaEm(l, 0.3) !== null || noTemploOuEscadaria(l, 0.3) || naGaragemLocal(l, 0.3);   // (o corredor do fio não é piso)
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
  if (d > CIDADE.andavelR && salaEm(l) === null && !noTemploOuEscadaria(l) && !naGaragemLocal(l)) q = { x: c.x + (dx / d) * CIDADE.andavelR, z: c.z + (dz / d) * CIDADE.andavelR };
  return q;
}

export const dentroDe = (p: P2, alvo: { x: number; z: number; r: number }) => Math.hypot(p.x - alvo.x, p.z - alvo.z) <= alvo.r;
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

/** o chão sob a nave/moto: piso da cidade se está sobre ela (e acima do piso) — a ESCADA, o LOUNGE, o palco e a cabine
 *  do DJ também (quem desce de moto ali pousa ali, não atravessa até a plataforma central) —, senão o chão do mapa */
export function chaoDaNave(p: { x: number; y: number; z: number }): number {
  const c = CIDADE.centro, h = alturaNaCidade(p);
  if (h > 0 && p.y >= CIDADE.pisoY + h - 0.5) return CIDADE.pisoY + h;
  if (h > ALTURA_LOUNGE && salaEm({ x: p.x - c.x, z: p.z - c.z }) && p.y >= CIDADE.pisoY + ALTURA_LOUNGE - 0.5) return CIDADE.pisoY + ALTURA_LOUNGE;   // de lado no deck/palco: o pátio
  return Math.hypot(p.x - c.x, p.z - c.z) <= CIDADE.andavelR && p.y >= CIDADE.pisoY - 0.5 ? CIDADE.pisoY : 0;
}
/** os SÓLIDOS de voo da Zaeon além da ilha (cilindros `{x,z,r,topo,base}` no mundo — o mesmo formato dos `Pilar` do
 *  voo): a CAPELA (de moto não se entra nela; de cima, pousa no telhado do tambor), a LAJE do lounge (de lado não se
 *  atravessa; por baixo passa) e a TORRE do DJ. Sem eles a moto atravessava tudo isso voando. `dono` = quem pode
 *  pousar na cabine do DJ; pra todo o resto a torre é um CAMPO DE FORÇA bem mais alto que a cabine (não se pousa nela) */
export function solidosDaCidade(dono = true): { x: number; z: number; r: number; topo: number; base: number }[] {
  const c = CIDADE.centro, s = CIDADE.salas.lounge, L = CIDADE.pisoY + ALTURA_LOUNGE;
  const torre = mundo(daSala(s, 0, TORRE_DJ.z));
  return [
    { x: c.x, z: c.z, r: CAPELA.r + 1, topo: CIDADE.pisoY + inicioDaPonta(), base: CIDADE.pisoY - 1 },
    { x: c.x + s.x, z: c.z + s.z, r: s.r, topo: L, base: L - 2.5 },   // a LAJE do lounge
    { x: torre.x, z: torre.z, r: TORRE_DJ.r, topo: L + DECK.h + TORRE_DJ.topo + (dono ? 0 : CAMPO_DJ), base: L - 0.1 },
    (() => { const t = mundo(daSala(s, TEMPLO.x, TEMPLO.z)), y = L + TEMPLO.h; return { x: t.x, z: t.z, r: TEMPLO.r, topo: y, base: y - 3 }; })(),   // a laje do TEMPLO
    (() => { const G = GARAGEM_LOUNGE, g = mundo(daSala(s, G.x, G.z)), y = L - G.desce; return { x: g.x, z: g.z, r: Math.hypot(G.larg, G.prof) / 2, topo: y, base: y - 2 }; })(),   // a plataforma da GARAGEM do lounge
    (() => { const t = mundo(daSala(s, TEMPLO.x, TEMPLO.z)), y = L + TEMPLO.h, C = TEMPLO.capela; return { x: t.x, z: t.z, r: C.r + 1, topo: y + C.altura + C.r * C.achata, base: y }; })(),   // a CAPELA do templo
    ...(Object.keys(CIDADE.salas) as NomeSala[]).filter((n) => n !== "lounge").map((n) => { const sl = CIDADE.salas[n]; return { x: c.x + sl.x, z: c.z + sl.z, r: sl.r, topo: L, base: L - 2.5 }; }),   // as lajes das outras salas
  ];
}
/** quanto o campo de força da cabine do DJ sobe acima dela (quem não é o dono não pousa lá) */
export const CAMPO_DJ = 40;

/**
 * O BURACO NEGRO GRANDE (o do filme, que ficava no chão perto da praça): agora paira em cima do palco do LOUNGE, acima
 * da treliça, perto da cabine do DJ. É o PAR do buraco negro de dentro da nave do dono (lib/cyber/buracos) — e o anel
 * na cabine (lá em cima da torre) é a boca dele. Centro (mundo) e raio do horizonte.
 */
/** o buraco negro grande no referencial da SALA do lounge: `z` (atrás do palco) e a altura `y` acima do piso do lounge */
export const BN_NA_SALA = { z: -54, y: 33 + DECK.h } as const;
export const BURACO_NEGRO = (() => {
  const s = CIDADE.salas.lounge, w = mundo(daSala(s, 0, BN_NA_SALA.z));
  return { x: w.x, y: CIDADE.pisoY + ALTURA_LOUNGE + BN_NA_SALA.y, z: w.z, r: 6 };
})();
