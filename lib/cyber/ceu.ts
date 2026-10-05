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

export const CIDADE = {
  centro: { x: BURACO_NEGRO.x, z: BURACO_NEGRO.z },
  pisoY: 230,           // piso da cidade: BEM acima do buraco negro (y=16) — flutuando nas alturas
  bordaR: 56,           // borda da ilha principal
  andavelR: 50,         // até onde se anda (as muralhas ficam em 53)
  muralhaR: 53,
  ilhaAltura: 72,       // a ilha (cone invertido) vai do piso até pisoY - ilhaAltura
  /** a AGULHA embaixo da ilha: a ponta afiada que desce do ápice (sólida pra nave) */
  agulha: { r: 6, altura: 32 },
  cidadela: { r: 18, pilares: 16, pilarColR: 1.3, altura: 16 },  // pilares + cúpula em 2 andares + pináculo
  /** BIBLIOTECA em anel rodeando a sala (dentro da cidadela): estantes de livros de luz e, a cada `monitorCada`,
   *  um MONITOR vertical (clicável = Sala de Estudos). Vãos entre os módulos deixam passar. */
  biblioteca: { n: 16, r: 15, largura: 3.6, colR: 0.75, monitorCada: 4 },
  /** SALAS DE SERVIDORES: 4 alas em arco (racks virados pro centro) entre a mesa holográfica e a biblioteca;
   *  `n` vagas no anel, a cada `vaoCada` uma fica livre (corredor de passagem pra mesa) */
  servidores: { n: 16, r: 7.5, vaoCada: 4, largura: 1.3, prof: 1, alt: 3.4, colR: 0.75 },
  mesaHolo: { r: 2.4 },
  /** HANGAR grande (cabem naves maiores): plataforma + pilones de luz em volta (sem teto: a nave entra por cima) */
  hangar: { x: 34, z: 12, r: 12, pilones: 8, pilonR: 0.6 },
  /** SALAS em volta da cidadela: pavilhões redondos de vidro, com a PORTA virada pro centro da ilha */
  salas: {
    lounge: { x: 27, z: -27, r: 8.5 },
  },
  /** parede das salas: colisores ao longo do arco; `porta` = meia-abertura (rad) da porta */
  salaParede: { colR: 0.6, passo: 1, porta: 0.34 },                                 // plataforma da nave (local)
  portalVolta: { x: -21, z: 10, r: 2.2 },                        // anel de volta pra praça (local)
  chegada: { x: -16, z: 14 },                                    // onde se aparece ao entrar (local)
  /** anel de entrada no CHÃO, embaixo do buraco negro (mundo) */
  portalEntrada: { x: BURACO_NEGRO.x, z: BURACO_NEGRO.z, r: 9 },
} as const;

export const mundo = (l: P2): P2 => ({ x: CIDADE.centro.x + l.x, z: CIDADE.centro.z + l.z });

export type ModuloBiblioteca = { x: number; z: number; rot: number; tipo: "estante" | "monitor" };
/** módulos (locais) da biblioteca: anel virado pro centro; `rot` deixa o +z local apontando pro centro */
export function bibliotecaLocais(): ModuloBiblioteca[] {
  const { n, r, monitorCada } = CIDADE.biblioteca, out: ModuloBiblioteca[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, rot: Math.atan2(-Math.cos(a), -Math.sin(a)), tipo: i % monitorCada === 1 ? "monitor" : "estante" });
  }
  return out;
}
/** os MONITORES da biblioteca (clicáveis: Sala de Estudos) — o índice é o instanceId do mesh das telas */
export const computadoresLocais = () => bibliotecaLocais().filter((m) => m.tipo === "monitor");

/** racks (locais) das salas de servidores: anel com corredores; `rot` deixa o +z local (a frente) apontando pro centro */
export function servidoresLocais(): { x: number; z: number; rot: number }[] {
  const { n, r, vaoCada } = CIDADE.servidores, out: { x: number; z: number; rot: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (i % vaoCada === 0) continue;
    const a = (i / n) * Math.PI * 2;
    out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, rot: Math.atan2(-Math.cos(a), -Math.sin(a)) });
  }
  return out;
}

/** colisores da plataforma (mundo): pilares da cidadela, módulos da biblioteca (3 círculos ao longo de cada um), racks,
 *  mesa holográfica, paredes e móveis das salas, pilones do hangar. Constante → calculado uma vez (o passo usa todo quadro). */
let colisoresCache: Colisor[] | null = null;
export function colisoresDaCidade(): Colisor[] {
  if (colisoresCache) return colisoresCache;
  const out: Colisor[] = [];
  for (const nome of Object.keys(CIDADE.salas) as NomeSala[]) {
    const s = CIDADE.salas[nome];
    for (const p of paredeDaSala(s)) out.push({ ...mundo(p), r: CIDADE.salaParede.colR });
    for (const m of MOVEIS[nome]) for (const c of colisoresDoMovel(m)) out.push({ ...mundo(daSala(s, c.x, c.z)), r: c.r });
  }
  for (const p of pilonesDoHangar()) out.push({ ...mundo(p), r: CIDADE.hangar.pilonR });
  const { cidadela, biblioteca, mesaHolo, servidores } = CIDADE;
  for (const s of servidoresLocais()) out.push({ ...mundo(s), r: servidores.colR });
  for (let i = 0; i < cidadela.pilares; i++) { const a = (i / cidadela.pilares) * Math.PI * 2; out.push({ ...mundo({ x: Math.cos(a) * cidadela.r, z: Math.sin(a) * cidadela.r }), r: cidadela.pilarColR }); }
  for (const m of bibliotecaLocais()) {
    const tx = Math.cos(m.rot), tz = -Math.sin(m.rot);   // eixo "largura" do módulo (x local girado)
    for (const k of [-1, 0, 1]) out.push({ ...mundo({ x: m.x + tx * k * (biblioteca.largura / 2 - biblioteca.colR), z: m.z + tz * k * (biblioteca.largura / 2 - biblioteca.colR) }), r: biblioteca.colR });
  }
  out.push({ ...mundo({ x: 0, z: 0 }), r: mesaHolo.r });
  colisoresCache = out;
  return out;
}

export type NomeSala = keyof typeof CIDADE.salas;
/** móvel de uma sala, no referencial da SALA (+z local = rumo à porta/centro da ilha); `rot` = giro do móvel (a frente
 *  dele é o seu +z); `larg`×`prof` = pegada (vira colisores). `solido: false` = só visual (tapete). */
export type Movel = { tipo: string; x: number; z: number; rot: number; larg: number; prof: number; solido?: boolean };
export const MOVEIS: Record<NomeSala, Movel[]> = {
  // LOUNGE: TV grande na parede do fundo, 2 caixas de som, sofá em U virado pra TV, mesinha e tapete
  lounge: [
    { tipo: "tv", x: 0, z: -7.1, rot: 0, larg: 6.4, prof: 0.6 },
    { tipo: "caixaSom", x: -4.6, z: -5.6, rot: 0.55, larg: 0.95, prof: 0.95 },
    { tipo: "caixaSom", x: 4.6, z: -5.6, rot: -0.55, larg: 0.95, prof: 0.95 },
    { tipo: "sofa", x: 0, z: 0.9, rot: Math.PI, larg: 6, prof: 1.4 },
    { tipo: "sofa", x: -3.8, z: -1.7, rot: Math.PI / 2, larg: 3, prof: 1.3 },
    { tipo: "sofa", x: 3.8, z: -1.7, rot: -Math.PI / 2, larg: 3, prof: 1.3 },
    { tipo: "mesinha", x: 0, z: -2.2, rot: 0, larg: 2.2, prof: 1.1 },
    { tipo: "tapete", x: 0, z: -1.9, rot: 0, larg: 7, prof: 5, solido: false },
  ],
};
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
export function paredeDaSala(s: { x: number; z: number; r: number }): { x: number; z: number }[] {
  const { passo, porta } = CIDADE.salaParede, n = Math.ceil((2 * Math.PI * s.r) / passo), out: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;   // ângulo no referencial da sala: a porta fica em +z local (a = π/2)
    let d = a - Math.PI / 2; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) < porta) continue;
    out.push(daSala(s, Math.cos(a) * s.r, Math.sin(a) * s.r));
  }
  return out;
}
/** pilones (locais da ilha) em volta do hangar */
export function pilonesDoHangar(): { x: number; z: number }[] {
  const h = CIDADE.hangar, R = h.r + h.pilonR + 0.3;
  return Array.from({ length: h.pilones }, (_, i) => { const a = (i / h.pilones) * Math.PI * 2 + Math.PI / h.pilones; return { x: h.x + Math.cos(a) * R, z: h.z + Math.sin(a) * R }; });
}

/**
 * ILHOTAS em volta da Zaeon (locais, sem giro): plataformas flutuantes com COLISÃO própria — dá pra pousar no topo
 * (e andar nele; passou da borda, cai), e o corpo (cone invertido) é sólido pra nave e pra quem voa de mochila.
 * Layout FIXO (o mesmo pra todo mundo e pro render). `fase` = a flutuação de cada uma (sobe e desce ±1,2 m).
 */
export const ILHOTAS: { x: number; z: number; r: number; dy: number; fase: number }[] = Array.from({ length: 7 }, (_, k) => {
  const a = (k / 7) * Math.PI * 2 + 0.4, dist = 80 + (k % 3) * 12;
  return { x: Math.cos(a) * dist, z: Math.sin(a) * dist, r: 6 + (k % 4) * 2.5, dy: ((k % 3) - 1) * 12, fase: k * 1.7 };
});
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

/** ainda em cima do PISO da ilha principal? Passou da borda = cai (não há mais parede invisível em volta) */
export const naIlhaPrincipal = (p: P2) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z) <= CIDADE.bordaR + 0.1;   // = onde o piso (e o corpo sólido) acaba

/** andar na Zaeon SEM a parede invisível da borda: só os colisores (quem passa da borda, cai — o engine trata) */
export const resolverCidadeLivre = (prop: P2): P2 => empurrarParaFora(prop, colisoresDaCidade());

/** passo andando na cidade com LIMITE na borda (clicar no chão pra andar não te leva pra fora da ilha) */
export function resolverCidade(prop: P2): P2 {
  let q = empurrarParaFora(prop, colisoresDaCidade());
  const c = CIDADE.centro, dx = q.x - c.x, dz = q.z - c.z, d = Math.hypot(dx, dz);
  if (d > CIDADE.andavelR) q = { x: c.x + (dx / d) * CIDADE.andavelR, z: c.z + (dz / d) * CIDADE.andavelR };
  return q;
}

export const dentroDe = (p: P2, alvo: { x: number; z: number; r: number }) => Math.hypot(p.x - alvo.x, p.z - alvo.z) <= alvo.r;
/** pisou no anel de entrada (chão, embaixo do buraco negro)? */
export const noPortalEntrada = (p: P2) => dentroDe(p, CIDADE.portalEntrada);
/** na cidade, pisou no portal de volta? */
export const noPortalVolta = (p: P2) => dentroDe(p, { ...mundo(CIDADE.portalVolta), r: CIDADE.portalVolta.r });
/** monitor da biblioteca mais próximo (índice em computadoresLocais) dentro de `alcance`, ou -1 */
export function computadorPerto(p: P2, alcance = 2.6): number {
  let melhor = -1, md = alcance;
  computadoresLocais().forEach((c, i) => { const w = mundo(c), d = Math.hypot(p.x - w.x, p.z - w.z); if (d < md) { md = d; melhor = i; } });
  return melhor;
}

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
