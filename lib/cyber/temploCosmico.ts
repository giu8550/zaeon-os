/**
 * Cyberespaço — o TEMPLO CÓSMICO (PURO, sem three e SEM importar o ceu — como lib/cyber/templo: tudo no referencial
 * da SALA do lounge, o mesmo do layout de sempre; o ESPELHO mora no ceu `daSala`/`naSala`). Pedido do dono (out/2026,
 * docs/superpowers/specs/2026-10-20-templo-cosmico-design.md): quem chega pelo buraco negro aparece num SALÃO central
 * e vê, no meio dele, um MONUMENTO ALIENÍGENA em forma de pirâmide; dos lados, conexões subindo pras plataformas mais
 * altas e mais pra fora — à ESQUERDA, o Lounge Cósmico (o lounge de sempre, espelhado); à DIREITA, o Lounge Rasta; e,
 * atrás da pirâmide, na mesma linha, o CAMINHO DO MEIO.
 *
 * No referencial do layout, o salão fica no −x do lounge (onde era a garagem): com o espelho, isso é a DIREITA dele no
 * mundo — então, pra quem chega no salão olhando pra frente (o −z), o lounge fica à esquerda.
 *
 * O LOUNGE RASTA é o lounge espelhado em torno do salão (`ESP`: x → −400 − x): o disco dele, a mesma escadaria
 * tortuosa (com RAÍZES verdes no lugar da muralha-veia) e, lá em cima, a plataforma da capela MAIOR — e dela o SALÃO
 * DE FESTAS, a TORRE e o LOUNGE PRIVATIVO dos casais. Tudo vira uma REDE de plataformas (`PLATS`) e pontes (`PONTES`):
 * o piso, os guarda-corpos (com as aberturas onde as pontes encostam) e os sólidos saem dela.
 */
import { DECK, ESCADARIA, TEMPLO, alturaDaEscadaria, bordasDaEscadaria, curvaDaEscadaria, entradaDoTemplo, noCorredorDaEscadaria, noTemplo } from "./templo";

type P2 = { x: number; z: number };

/** o espelho que leva o LOUNGE (e tudo do layout dele) pro lado RASTA: em torno do x do salão */
export const X_ESPELHO_RASTA = -400;
export const ESP = (p: P2): P2 => ({ x: X_ESPELHO_RASTA - p.x, z: p.z });

/** o SALÃO central: centro, raio e quantos metros ABAIXO do pátio do lounge fica o piso dele (os braços sobem) */
export const SALAO = { x: -200, z: 40, r: 48, desce: 14, colR: 0.6, passo: 1 } as const;
/** o MONUMENTO ALIENÍGENA no meio do salão (no lugar do palco): a pirâmide — meia-base e altura */
export const PIRAMIDE = { x: SALAO.x, z: SALAO.z - 4, meia: 10, alt: 24, colR: 0.7, passo: 1.4 } as const;
/** a PONTE do salão até o pátio do lounge: sai da borda do salão (`a`) e chega na borda do lounge (`b`, no raio 70),
 *  subindo `SALAO.desce` m; `meia` = meia-largura */
/** os LOUNGES ESTUDANTIS (out/2026, o dono): dos dois lados do salão, na altura dele — salas de estudo modernas, cheias
 *  de poltronas e cantos pra ler com os amigos, com o som calmo de estudo; DEPOIS delas, a ESCADA subindo pras festas
 *  (o lounge cósmico à esquerda — o −x do layout é a direita do mundo… o lado do lounge; o rasta, espelhado) */
export const ESTUDO = { x: -112, z: 62, r: 28, h: -SALAO.desce } as const;
/** os ANDARES dos lounges estudantis (o dono, out/2026: "um segundo e terceiro piso, a mesma dinâmica dos lustres no
 *  teto, as paredes mais sólidas"): 3 pisos de `pe` m — o TÉRREO na altura do salão (as entradas, nas mesmas posições,
 *  só nele) —, a parede SÓLIDA até o `teto` (a cúpula de vidro em cima) e, no meio, o ÁTRIO com a ESCADA EM CARACOL em
 *  volta da coluna: uma volta por andar, de onde se vê o lustre grande descendo da cúpula */
export const ANDARES_ESTUDO = { n: 3, pe: 7, teto: 21 } as const;
/** o CARACOL (referencial do lounge estudantil da ESQUERDA — o da direita é o espelho): a coluna, o raio de fora dos
 *  degraus (= o buraco do átrio nos andares de cima), a BOCA (rad: onde cada volta começa e acaba, virada pro corredor
 *  entre as entradas) e a meia-abertura do guarda-corpo do átrio na boca */
export const CARACOL = { col: 1.3, r: 5.2, boca: -1.7, abre: 0.5, grade: 0.35 } as const;
/** a ESCADA do lounge estudantil até o pátio do lounge (sobe os `SALAO.desce` m): da borda dele à borda do lounge (raio 70) */
export const PONTE_LOUNGE = (() => {
  const d = Math.hypot(ESTUDO.x, ESTUDO.z), ux = -ESTUDO.x / d, uz = -ESTUDO.z / d;   // (do estudo rumo ao centro do lounge)
  return { a: { x: ESTUDO.x + ux * (ESTUDO.r - 1.5), z: ESTUDO.z + uz * (ESTUDO.r - 1.5) }, b: { x: -ux * 68.5, z: -uz * 68.5 }, meia: 4.5, colR: 0.5, passo: 0.8 } as const;
})();
/** onde quem chega aparece (na frente do salão, olhando pra pirâmide: o −z) e a BOCA da pista de saída (lib/cyber/
 *  fiosCosmicos — longe o bastante da chegada pra não pegar quem acabou de chegar) */
export const CHEGADA_SALAO = { x: SALAO.x, z: SALAO.z + 33, rumo: Math.PI } as const;
export const BOCA_SAIDA_SALAO = { x: SALAO.x - 27, z: SALAO.z + 31 } as const;

// ───────────── o LOUNGE RASTA (o espelho do lounge em torno do salão) ─────────────
/** o disco do lounge rasta (o mesmo tamanho do lounge, no mesmo nível do pátio) */
export const RASTA = { ...ESP({ x: 0, z: 0 }), r: 70 } as const;
/** a plataforma lá em cima (onde a escadaria das raízes chega): a CAPELA MAIOR — no lugar do templo do lounge, espelhado */
export const TEMPLO_RASTA = { ...ESP(TEMPLO), r: TEMPLO.r, h: TEMPLO.h } as const;
/** a capela maior (raio, altura dos pilares, pilares) */
export const CAPELA_RASTA = { r: 27, altura: 26, pilares: 20, pilarR: 1.2 } as const;
/** o SALÃO DE FESTAS (mais pra fora, no mesmo nível da capela) e o LOUNGE PRIVATIVO dos casais (mais acima) */
export const FESTAS = { x: TEMPLO_RASTA.x - 66, z: TEMPLO_RASTA.z - 66, r: 24, h: TEMPLO.h } as const;
export const CASAIS = { x: FESTAS.x - 30, z: FESTAS.z - 72, r: 12, h: TEMPLO.h + 14 } as const;
/** a ÁRVORE DA VIDA no meio do disco rasta: o raio do tronco (sólido) e até onde ele sobe (a copa por cima) */
export const ARVORE_RASTA = { r: 4.8, alt: 30 } as const;
/** a TORRE (moderna, futurista) na borda do salão de festas: o pé (sólido) e a altura acima do piso dele */
export const TORRE_RASTA = { x: FESTAS.x - 15, z: FESTAS.z + 14, r: 4, alt: 72 } as const;

// ───────────── o CAMINHO DO MEIO: o CAMPUS DE TI e a TORRE TECNOLÓGICA (out/2026, o dono: "falta computadores, terminais,
//    massividade — vários estudantes de TI; a torre mais longe, mais alta, com um elevador") ─────────────
/** o CAMPUS: a praça larga atrás da pirâmide (no nível do salão), da borda do salão até o pé da torre */
export const CAMPUS = { meia: 34, zFim: SALAO.z - 262 } as const;
/** a TORRE: a coluna massiva no fim do campus — o anel de chão em volta dela (a base) e o topo, onde fica o monumento */
export const TORRE_TI = { x: SALAO.x, z: SALAO.z - 302, colR: 30.5, baseR: 46 } as const;
/** o monumento (mais sinistro que a pirâmide): o DECK no TOPO da torre, bem alto, na linha da pirâmide — largo (o dono,
 *  out/2026: "a parte superior pode ser ainda maior pra comportar mais gente e estações de trabalho"): passa da coluna */
export const CYBER = { x: TORRE_TI.x, z: TORRE_TI.z, r: 44, h: 120 } as const;
/** o NÚCLEO do monumento (sólido: a sala ainda está fechada — o resto do caminho do meio vem depois) */
export const NUCLEO_CYBER = { r: 11, alt: 52 } as const;
/** o MIRANTE da pirâmide invertida: o anel lá no alto, em volta dela (a pirâmide flutua no meio, por cima do cubo) —
 *  onde a Nina e o Téo trabalham */
export const ALTO_TI = { x: CYBER.x, z: CYBER.z, rIn: 16, rOut: 30, h: CYBER.h + 34 } as const;
/** a PIRÂMIDE INVERTIDA (no referencial do topo): o centro (m acima do deck), a altura e o raio — bem acima do mirante
 *  (o dono: "mais alta, que o pátio de baixo pegue a visão da ponta": do deck do topo, a ponta aparece pelo vão do
 *  mirante, por cima do cubo) */
export const PIRAMIDE_INV = { y: ALTO_TI.h - CYBER.h + 24, alt: 22, r: 12.5 } as const;

/** os PILARES que seguram o mirante, plantados no deck do topo (entre os anéis de estações) */
export const PILARES_ALTO: readonly (P2 & { r: number })[] = Array.from({ length: 6 }, (_, k) => ({ ...noAnelT(27.5, Math.PI / 2 + Math.PI / 6 + (k * Math.PI) / 3), r: 0.7 }));
function noAnelT(r: number, a: number): P2 { return { x: TORRE_TI.x + Math.cos(a) * r, z: TORRE_TI.z + Math.sin(a) * r }; }

// ── as CÁPSULAS (o dono: "o elevador ficou infantil — um mecanismo de cápsulas, cada uma com no máximo 5 jogadores") ──
/** um POÇO de cápsula: o centro (layout), o piso de baixo e o de cima (acima do pátio), o raio da cápsula, quantos cabem,
 *  a viagem e a parada (s) e a FASE no ciclo (0..1) — o ciclo é do RELÓGIO comum: todo mundo vê a mesma cápsula no mesmo
 *  lugar, sem servidor (como a agenda dos personagens) */
export type PocoTC = { id: string; x: number; z: number; de: number; ate: number; r: number; cap: number; viagem: number; parada: number; fase: number };
const noAnel = (r: number, a: number): P2 => ({ x: TORRE_TI.x + Math.cos(a) * r, z: TORRE_TI.z + Math.sin(a) * r });
export const POCOS_TC: readonly PocoTC[] = [
  // da BASE ao TOPO: três poços colados na coluna, virados pro campus (o +z), defasados — sai uma a cada ~1/3 do ciclo
  ...[-0.55, 0, 0.55].map((da, k) => ({ id: `torre${k}`, ...noAnel(36, Math.PI / 2 + da), de: -SALAO.desce, ate: CYBER.h, r: 2.3, cap: 5, viagem: 9, parada: 7, fase: k / 3 })),
  // do TOPO ao MIRANTE da pirâmide: a cápsula maior
  { id: "alto", ...noAnel(23, Math.PI / 2), de: CYBER.h, ate: ALTO_TI.h, r: 3.1, cap: 8, viagem: 6, parada: 8, fase: 0 },
];
export const cicloDoPoco = (p: PocoTC) => 2 * (p.viagem + p.parada);
/** a cápsula de um poço no instante `t` (s, relógio comum): o piso dela (acima do pátio), onde está ABERTA (null =
 *  viajando), quanto os vidros da porta estão abertos (0..1: abrem ao chegar e fecham antes de sair) e, viajando, de
 *  onde saiu e quanto falta (0..1) */
export const PORTA_CAPSULA = 0.9;
export function capsulaEm(p: PocoTC, t: number): { h: number; aberta: "baixo" | "cima" | null; abre: number; saiu: "baixo" | "cima" | null; k: number } {
  const T = cicloDoPoco(p), u = (((t / T + p.fase) % 1) + 1) % 1 * T, sv = (x: number) => x * x * (3 - 2 * x);
  const abre = (w: number) => sv(Math.max(0, Math.min(1, w / PORTA_CAPSULA, (p.parada - w) / PORTA_CAPSULA)));
  if (u < p.parada) return { h: p.de, aberta: "baixo", abre: abre(u), saiu: null, k: 0 };
  if (u < p.parada + p.viagem) { const k = (u - p.parada) / p.viagem; return { h: p.de + (p.ate - p.de) * sv(k), aberta: null, abre: 0, saiu: "baixo", k }; }
  if (u < 2 * p.parada + p.viagem) return { h: p.ate, aberta: "cima", abre: abre(u - p.parada - p.viagem), saiu: null, k: 0 };
  const k = (u - 2 * p.parada - p.viagem) / p.viagem; return { h: p.ate + (p.de - p.ate) * sv(k), aberta: null, abre: 0, saiu: "cima", k };
}
/** pra onde a PORTA de um poço abre (rad, x = cos, z = sen): pra fora da torre (de onde se chega, nas duas pontas) */
export const portaDoPoco = (p: PocoTC) => Math.atan2(p.z - TORRE_TI.z, p.x - TORRE_TI.x);
/** em que poço (e em que ponta) está quem está em `q` com os pés a `yRel` — null fora das bocas */
export function bocaDoPoco(q: P2, yRel: number): { poco: PocoTC; ponta: "baixo" | "cima" } | null {
  for (const p of POCOS_TC) {
    if (Math.hypot(q.x - p.x, q.z - p.z) > p.r - 0.25) continue;
    if (Math.abs(yRel - p.de) < 1.2) return { poco: p, ponta: "baixo" };
    if (Math.abs(yRel - p.ate) < 1.2) return { poco: p, ponta: "cima" };
  }
  return null;
}
/** quem embarca quando a porta fecha: os que estão dentro, por ordem (o id), até a capacidade — os outros esperam a
 *  próxima. Todo cliente vê as mesmas posições (a rede) e decide igual */
export const embarcam = (p: PocoTC, dentro: readonly string[]) => [...dentro].sort().slice(0, p.cap);

/** os PISOS da torre num ponto (acima do pátio): o anel da BASE, o DECK do topo e o MIRANTE da pirâmide */
export function pisosDaTorre(q: P2): number[] {
  const d = Math.hypot(q.x - TORRE_TI.x, q.z - TORRE_TI.z), out: number[] = [];
  if (d <= TORRE_TI.baseR && d >= TORRE_TI.colR) out.push(-SALAO.desce);
  if (d <= CYBER.r) out.push(CYBER.h);
  if (d >= ALTO_TI.rIn && d <= ALTO_TI.rOut) out.push(ALTO_TI.h);
  return out;
}
/** em que NÍVEL da torre (0 base, 1 topo, 2 mirante) está quem está em `q` com os pés a `yRel` — null longe dela */
export function nivelNaTorre(q: P2, yRel: number): 0 | 1 | 2 | null {
  if (Math.hypot(q.x - TORRE_TI.x, q.z - TORRE_TI.z) > TORRE_TI.baseR + 1) return null;
  return yRel < CYBER.h - 4 ? 0 : yRel < ALTO_TI.h - 4 ? 1 : 2;
}
/** os TELÕES DO MERCADO no corredor do campus (out/2026, o dono: "telões em perspectiva de cinema dos lados da ponte
 *  central — 2 na esquerda: um dashboard só pra Solana, outro pras outras moedas; um na direita com as métricas da
 *  blockchain, algo como Bloomberg"; depois: "não todos juntos — perto dos computadores, de preferência mais perto da
 *  torre"). Espalhados no trecho final do corredor, cada um com a sua MESA DE OPERAÇÕES na frente, em pé sobre dois
 *  pilares, virados pro corredor e um pouco pra quem chega do salão.
 *  `x`/`z` = o centro da base da tela; `l`/`a` = largura/altura; `rot` = pra onde a tela olha (ângulo no plano, a partir do
 *  +x); `base` = a altura da borda de baixo acima do piso do salão */
export type TelaoMercado = { id: "solana" | "moedas" | "blockchain"; x: number; z: number; l: number; a: number; rot: number; base: number };
export const TELOES_MERCADO: readonly TelaoMercado[] = (() => {
  const olha = (lado: -1 | 1) => (lado < 0 ? 0 : Math.PI) - lado * 0.6;   // (pro corredor, girado ~35° pra quem vem do salão)
  const pe = TORRE_TI.z + TORRE_TI.baseR;   // (o pé da torre: os telões contam a partir dele)
  return [
    // (a sala do lounge é ESPELHADA: o +x do layout fica à ESQUERDA de quem vem do salão)
    { id: "solana", x: SALAO.x + 24, z: pe + 104, l: 26, a: 14.6, rot: olha(1), base: 3.2 },
    { id: "blockchain", x: SALAO.x - 23, z: pe + 66, l: 34, a: 19, rot: olha(-1), base: 3.2 },
    { id: "moedas", x: SALAO.x + 24, z: pe + 28, l: 26, a: 14.6, rot: olha(1), base: 3.2 },
  ];
})();
/** um ponto na tela (`u` -0,5..0,5 ao longo da largura) → layout */
export const naTelaMercado = (t: TelaoMercado, u: number): P2 => ({ x: t.x - Math.sin(t.rot) * u * t.l, z: t.z + Math.cos(t.rot) * u * t.l });
/** os dois PILARES de cada telão (a 1/3 de cada ponta) */
export const pilaresDoTelao = (t: TelaoMercado): P2[] => [naTelaMercado(t, -0.3), naTelaMercado(t, 0.3)];
/** os TERMINAIS DE TRADING do campus (out/2026, o dono: "retire essa enorme quantidade de computadores com fusíveis e
 *  deixe apenas terminais integrados aos monitores, onde poderemos fazer trade real"): a mesa de operações de cada
 *  telão — 4 terminais em arco NA FRENTE dele, virados pra tela (quem senta vê o telão por cima dos monitores). O
 *  molde é o da cabine (`CABINE_TI`), com três monitores. `telao` = de qual telão é a mesa */
export type TerminalTI = { x: number; z: number; rot: number; telao: TelaoMercado["id"] };
export const ESTACOES_TI: readonly TerminalTI[] = (() => {
  const out: TerminalTI[] = [];
  for (const t of TELOES_MERCADO) {
    const nx = Math.cos(t.rot), nz = Math.sin(t.rot), FRENTE = 9;
    for (const u of [-0.33, -0.11, 0.11, 0.33]) {
      const p = naTelaMercado(t, u * (t.l >= 30 ? 0.85 : 1)), x = p.x + nx * FRENTE, z = p.z + nz * FRENTE;
      out.push({ x, z, rot: Math.atan2(t.x - x, t.z - z), telao: t.id });   // (o monitor — o +z da cabine — virado pro telão)
    }
  }
  return out;
})();
/** a cabine do campus (o mesmo molde da da cidadela; referencial dela: x ao longo da largura, z pra FRENTE — o monitor
 *  — que no campus aponta pro −z, a torre) */
export const CABINE_TI = { larg: 3.0, prof: 2.8, mesaZ: 0.75, monitorZ: 1.05, assentoZ: -0.35, painelX: 1.45 } as const;
/** um ponto do referencial de uma cabine → layout (o mesmo giro do `daCabine` da cidadela; sem `rot`, a do campus: olha
 *  pro −z, a meia volta) */
export function daCabineTI(e: { x: number; z: number; rot?: number }, lx: number, lz: number): P2 {
  if (e.rot === undefined) return { x: e.x - lx, z: e.z - lz };
  const sn = Math.sin(e.rot), co = Math.cos(e.rot);
  return { x: e.x + lx * co + lz * sn, z: e.z - lx * sn + lz * co };
}
/** as estações LÁ EM CIMA da torre (`nivel` 1 = o deck do topo, viradas pra fora — pra cidade; 2 = o mirante, viradas
 *  pra pirâmide): em anéis, fora das bocas das cápsulas. `y` = o piso (acima do pátio); `quem` = o personagem que
 *  trabalha ali (a Nina e o Téo, no mirante) */
export type CabineTorre = { id: string; x: number; z: number; rot: number; y: number; nivel: 1 | 2; quem?: "nina" | "teo" };
export const CABINES_TORRE: readonly CabineTorre[] = (() => {
  const out: CabineTorre[] = [], livreDosPocos = (a: number, r: number, y: number) => POCOS_TC.every((p) => (p.de !== y && p.ate !== y) || Math.hypot(TORRE_TI.x + Math.cos(a) * r - p.x, TORRE_TI.z + Math.sin(a) * r - p.z) > p.r + 3.6);
  const anel = (nivel: 1 | 2, r: number, y: number, passo: number, pra: "fora" | "dentro") => {
    const n = Math.floor((2 * Math.PI * r) / passo);
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (i + 0.5) * ((2 * Math.PI) / n); if (!livreDosPocos(a, r, y)) continue;
      const c = noAnel(r, a), s = pra === "fora" ? 1 : -1;
      out.push({ id: `t${nivel}-${r}-${i}`, ...c, rot: Math.atan2(s * Math.cos(a), s * Math.sin(a)), y, nivel });
    }
  };
  anel(1, 33, CYBER.h, 6.2, "fora"); anel(1, 22, CYBER.h, 6.4, "dentro"); anel(2, 24.5, ALTO_TI.h, 6.6, "dentro");
  // a Nina e o Téo: as duas estações do mirante mais perto da chegada da cápsula (lado a lado)
  const alto = out.filter((c) => c.nivel === 2).sort((a, b) => Math.hypot(a.x - POCOS_TC[3]!.x, a.z - POCOS_TC[3]!.z) - Math.hypot(b.x - POCOS_TC[3]!.x, b.z - POCOS_TC[3]!.z));
  if (alto[0]) alto[0].quem = "nina"; if (alto[1]) alto[1].quem = "teo";
  return out;
})();
/** a TEMPESTADE do campus: as nuvens por cima das mesas de operações (altura acima do salão) e de quanto em quanto tempo
 *  pisca um clarão nelas (s, em média — os raios e os difusores saíram com as fileiras de computadores) */
export const TEMPESTADE_TI = { alt: 24, cadaRaio: 0.45 } as const;

// ───────────── o que o RENDER desenha e a COLISÃO usa (o mesmo lugar nos dois — out/2026, o dono: "as colisões mais bem
//    estruturadas": o que se vê bloqueia, e nada invisível bloqueia) ─────────────
/** o CUBO do monumento no topo da torre (o NÚCLEO): meia-aresta e altura — o que se desenha (components/cyber/TemploMeio) */
export const CUBO_CYBER = { meia: NUCLEO_CYBER.r * Math.SQRT2 * 0.45, alt: NUCLEO_CYBER.r * Math.SQRT2 * 0.9 * 1.5 } as const;
/** os RACKS de servidor nas laterais do campus (centro; a caixa tem 1,6 × 1,1 m, 4,2 de altura) */
export const RACKS_TI: readonly P2[] = (() => {
  const out: P2[] = [], z0 = SALAO.z - SALAO.r + 1.5, z1 = TORRE_TI.z + TORRE_TI.baseR - 1.5;
  for (let z = z0 - 14; z > z1 + 10; z -= 7) for (const s of [-1, 1]) if (!TELOES_MERCADO.some((t) => Math.sign(t.x - SALAO.x) === s && Math.abs(t.z - z) < 17)) out.push({ x: SALAO.x + s * (CAMPUS.meia - 2.4), z });   // (atrás dos telões, não)
  return out;
})();
/** as LUMINÁRIAS de pé e as PLANTAS dos lounges estudantis (a partir do centro, sem espelho; em todos os andares) */
export const LUMINARIAS_ESTUDO: readonly (readonly [number, number])[] = [[-20, 6], [20, 6], [-8, 21], [8, 21], [-7, 3], [7, 3]];
export const PLANTAS_ESTUDO: readonly (readonly [number, number])[] = [[-22, 12], [22, 12], [-15, 20], [15, 20], [0, 24], [-3, -23]];
/** as ESTANTES em arco dos lounges estudantis: o raio (do centro) e o passo angular — no térreo, fora das entradas */
export const ESTANTES_ESTUDO = { dentro: 1.6, passo: 2.6 } as const;

// ───────────── a REDE: plataformas e pontes ─────────────
export type PlatTC = { id: string; x: number; z: number; r: number; /** piso acima do pátio do lounge */ h: number };
export type PonteTC = { id: string; a: P2; b: P2; /** piso nas pontas */ ha: number; hb: number; meia: number };
export const PLATS: readonly PlatTC[] = [
  { id: "salao", x: SALAO.x, z: SALAO.z, r: SALAO.r, h: -SALAO.desce },
  { id: "rasta", x: RASTA.x, z: RASTA.z, r: RASTA.r, h: 0 },
  { id: "estudoL", x: ESTUDO.x, z: ESTUDO.z, r: ESTUDO.r, h: ESTUDO.h },
  { id: "estudoR", ...ESP(ESTUDO), r: ESTUDO.r, h: ESTUDO.h },
  { id: "capelaRasta", x: TEMPLO_RASTA.x, z: TEMPLO_RASTA.z, r: TEMPLO_RASTA.r, h: TEMPLO_RASTA.h },
  { id: "festas", x: FESTAS.x, z: FESTAS.z, r: FESTAS.r, h: FESTAS.h },
  { id: "casais", x: CASAIS.x, z: CASAIS.z, r: CASAIS.r, h: CASAIS.h },
  // (a BASE antes do TOPO: sem a altura dos pés — NPC, a frota —, é o chão; lá em cima quem decide é `pisosDaTorre`)
  { id: "baseTorre", x: TORRE_TI.x, z: TORRE_TI.z, r: TORRE_TI.baseR, h: -SALAO.desce },
  { id: "cyber", x: CYBER.x, z: CYBER.z, r: CYBER.r, h: CYBER.h },
];
/** uma ponte reta entre duas plataformas (de borda a borda, na linha dos centros) */
function entre(id: string, p: PlatTC, q: PlatTC, meia: number): PonteTC {
  const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
  return { id, a: { x: p.x + ux * (p.r - 1.5), z: p.z + uz * (p.r - 1.5) }, b: { x: q.x - ux * (q.r - 1.5), z: q.z - uz * (q.r - 1.5) }, ha: p.h, hb: q.h, meia };
}
const plat = (id: string) => PLATS.find((p) => p.id === id)!;
export const PONTES: readonly PonteTC[] = [
  entre("estudoL", plat("salao"), plat("estudoL"), 6), entre("estudoR", plat("salao"), plat("estudoR"), 6),   // (do salão aos lounges estudantis: retas, no mesmo nível)
  { id: "lounge", a: PONTE_LOUNGE.a, b: PONTE_LOUNGE.b, ha: -SALAO.desce, hb: 0, meia: PONTE_LOUNGE.meia },   // as ESCADAS subindo pras festas
  { id: "rasta", a: ESP(PONTE_LOUNGE.a), b: ESP(PONTE_LOUNGE.b), ha: -SALAO.desce, hb: 0, meia: PONTE_LOUNGE.meia },
  entre("festas", plat("capelaRasta"), plat("festas"), 4),
  entre("casais", plat("festas"), plat("casais"), 2.6),
  // o CAMPUS DE TI: uma "ponte" larga (é uma praça retangular) do salão até a base da torre
  { id: "meio", a: { x: SALAO.x, z: SALAO.z - SALAO.r + 1.5 }, b: { x: SALAO.x, z: TORRE_TI.z + TORRE_TI.baseR - 1.5 }, ha: -SALAO.desce, hb: -SALAO.desce, meia: CAMPUS.meia },
];
const COL = { r: 0.6, passo: 1, ponte: 0.5, ponteP: 0.8 } as const;

export function naPonte(p: PonteTC, q: P2, folga = 0): { u: number; lat: number } | null {
  const vx = p.b.x - p.a.x, vz = p.b.z - p.a.z, L = Math.hypot(vx, vz);
  const t = ((q.x - p.a.x) * vx + (q.z - p.a.z) * vz) / (L * L), lat = ((q.x - p.a.x) * vz - (q.z - p.a.z) * vx) / L;
  if (t < -folga / L || t > 1 + folga / L || Math.abs(lat) > p.meia + folga) return null;
  return { u: Math.max(0, Math.min(1, t)), lat };
}
export const naPlat = (p: PlatTC, q: P2, folga = 0) => Math.hypot(q.x - p.x, q.z - p.z) <= p.r + folga;
/** a escadaria das RAÍZES (a do lounge, espelhada): onde nela `q` está (só o trecho fora do disco rasta e da capela) */
export function naEscadariaRasta(q: P2, folga = 0): { s: number; lat: number } | null {
  const r = ESP(q);
  if (Math.hypot(r.x, r.z) < 69 || Math.hypot(r.x - TEMPLO.x, r.z - TEMPLO.z) < TEMPLO.r - 1) return null;
  if (r.x < 40 || r.z > 0) return null;   // (o mesmo recorte do lounge: a escadaria fica no quadrante do templo)
  return noCorredorDaEscadaria(r, folga);
}
/** a altura da escadaria rasta (acima do pátio) a `s` m do começo: sobe do PISO do disco rasta (não há deck) até a capela */
export const alturaDaEscadariaRasta = (s: number) => ((alturaDaEscadaria(s) - DECK.h) / (TEMPLO.h - DECK.h)) * TEMPLO_RASTA.h;

// ───────────── os ANDARES dos lounges estudantis ─────────────
const ehEstudo = (p: PlatTC) => p.id === "estudoL" || p.id === "estudoR";
/** o lounge estudantil em `q` (referencial do layout), ou null */
export const estudoEm = (q: P2, folga = 0): PlatTC | null => PLATS.find((p) => ehEstudo(p) && naPlat(p, q, folga)) ?? null;
/** `q` no referencial do lounge estudantil `p` (a partir do centro; o da DIREITA é espelhado: o caracol gira ao contrário) */
export const noEstudoLocal = (p: PlatTC, q: P2): P2 => ({ x: (q.x - p.x) * (p.id === "estudoR" ? -1 : 1), z: q.z - p.z });
/** o inverso: local do lounge estudantil → layout */
export const doEstudoLocal = (p: PlatTC, l: P2): P2 => ({ x: p.x + l.x * (p.id === "estudoR" ? -1 : 1), z: p.z + l.z });
/** que fração da volta do caracol (0..1) está em `l` (local): 0 na boca, crescendo no sentido de quem sobe */
export function voltaDoCaracol(l: P2): number {
  const v = (Math.atan2(l.z, l.x) - CARACOL.boca) / (Math.PI * 2);
  return v - Math.floor(v);
}
/** os PISOS que existem num ponto do lounge estudantil `p` (acima do pátio): o térreo em todo o disco; os andares de cima
 *  fora do átrio; e, no átrio, cada volta do caracol (uma por andar) */
export function pisosDoEstudo(p: PlatTC, q: P2): number[] {
  const l = noEstudoLocal(p, q), d = Math.hypot(l.x, l.z), A = ANDARES_ESTUDO, out = [p.h];
  if (d >= CARACOL.r) for (let k = 1; k < A.n; k++) out.push(p.h + k * A.pe);
  else if (d >= CARACOL.col) { const f = voltaDoCaracol(l); for (let k = 0; k < A.n - 1; k++) out.push(p.h + (k + f) * A.pe); }
  return out;
}
/** o quanto um piso pode estar ACIMA dos pés e ainda ser "o meu" (o degrau do caracol, andando) */
export const DEGRAU_ESTUDO = 1.1;
/** a altura do piso de quem está em `q`, nos pés a `yRel` (acima do pátio): o piso mais alto que não passa dos pés +
 *  um degrau — sem `yRel` (quem não sabe a altura: NPC, a frota, um teleporte), o térreo */
export function alturaNoEstudo(p: PlatTC, q: P2, yRel?: number): number {
  if (yRel === undefined) return p.h;
  let m = -Infinity, menor = Infinity;
  for (const h of pisosDoEstudo(p, q)) { if (h <= yRel + DEGRAU_ESTUDO && h > m) m = h; if (h < menor) menor = h; }
  return m === -Infinity ? menor : m;
}
/** em que ANDAR (0 = térreo) de qual lounge estudantil está quem está em `q` com os pés a `yRel` — null fora */
export function andarNoEstudo(q: P2, yRel: number): { p: PlatTC; andar: number } | null {
  const p = estudoEm(q, 0.8); if (!p || yRel < p.h - 1.5 || yRel > p.h + ANDARES_ESTUDO.teto) return null;
  return { p, andar: Math.max(0, Math.min(ANDARES_ESTUDO.n - 1, Math.round((yRel - p.h) / ANDARES_ESTUDO.pe))) };
}
/** o vão do guarda-corpo do átrio num andar (ângulos LOCAIS [de, até]): no térreo, o lado de quem SOBE; no último, o de
 *  quem CHEGA; nos do meio, os dois */
export function vaoDoAtrio(andar: number): [number, number] {
  const { boca, abre } = CARACOL, ult = ANDARES_ESTUDO.n - 1;
  return andar === 0 ? [boca, boca + abre] : andar === ult ? [boca - abre, boca] : [boca - abre, boca + abre];
}
/** os colisores (layout) que só valem num ANDAR do lounge estudantil: o GUARDA-CORPO do átrio (aberto só no vão do
 *  caracol) e, nos andares de cima, a PAREDE fechando onde, no térreo, ficam as entradas (as pontes chegam embaixo) */
export function colisoresDoAndarEstudo(p: PlatTC, andar: number): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [], [de, ate] = vaoDoAtrio(andar), rr = CARACOL.r + CARACOL.grade, n = Math.ceil((2 * Math.PI * rr) / 0.45);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; let d = a - de; d -= Math.floor(d / (Math.PI * 2)) * Math.PI * 2;
    if (d < ate - de) continue;
    out.push({ ...doEstudoLocal(p, { x: Math.cos(a) * rr, z: Math.sin(a) * rr }), r: CARACOL.grade });
  }
  if (andar > 0) for (const ab of aberturasDe(p)) for (let a = ab.ang - ab.meia - 0.04; a <= ab.ang + ab.meia + 0.04; a += COL.passo / p.r) out.push({ x: p.x + Math.cos(a) * p.r, z: p.z + Math.sin(a) * p.r, r: COL.r });
  return out;
}

export const noSalao = (q: P2, folga = 0) => naPlat(PLATS[0]!, q, folga);
export const naPonteLounge = (q: P2, folga = 0) => naPonte(PONTES[0]!, q, folga);
/** está no complexo do Templo Cósmico FORA do disco do lounge (o salão, os braços, as pontes e a escadaria rasta)? */
export const noComplexo = (q: P2, folga = 0) => PLATS.some((p) => naPlat(p, q, folga)) || PONTES.some((p) => naPonte(p, q, folga) !== null) || naEscadariaRasta(q, folga) !== null;
/** até onde (m, do centro do lounge) o complexo vai — o ceu nem calcula além disso */
export const ALCANCE_COMPLEXO = Math.max(...PLATS.map((p) => Math.hypot(p.x, p.z) + p.r)) + 20;
/** a altura do piso (acima do PÁTIO do lounge — negativa no salão) num ponto do complexo, ou null fora dele */
export function alturaNoComplexo(q: P2, yRel?: number): number | null {
  // (os LOUNGES ESTUDANTIS têm andares: lá em cima ou no átrio, manda a altura dos pés — as pontes que chegam no térreo,
  // por baixo, não contam)
  // a TORRE (o deck do topo e o mirante ficam por cima do anel da base): lá em cima, manda a altura dos pés
  const nt = yRel === undefined ? null : nivelNaTorre(q, yRel);
  if (nt !== null && nt > 0) { let m = -Infinity, menor = Infinity; for (const h of pisosDaTorre(q)) { if (h <= yRel! + DEGRAU_ESTUDO && h > m) m = h; if (h < menor) menor = h; } if (m > -Infinity) return m; if (menor < Infinity) return menor; }
  const est = estudoEm(q);
  if (est && yRel !== undefined && (yRel > est.h + 2 || Math.hypot(q.x - est.x, q.z - est.z) < CARACOL.r + 0.8)) return alturaNoEstudo(est, q, yRel);
  for (const p of PONTES) { const n = naPonte(p, q); if (n) return p.ha + (p.hb - p.ha) * n.u; }
  for (const p of PLATS) if (naPlat(p, q)) return p.h;
  const e = naEscadariaRasta(q); if (e) return alturaDaEscadariaRasta(e.s);
  return null;
}
/** dentro da base da pirâmide (não se anda: é sólida)? */
export const naPiramide = (q: P2, folga = 0) => Math.abs(q.x - PIRAMIDE.x) <= PIRAMIDE.meia + folga && Math.abs(q.z - PIRAMIDE.z) <= PIRAMIDE.meia + folga;

/** a abertura na parede do LOUNGE onde a ponte chega (ângulo no referencial da sala e a meia-abertura, rad) */
export const entradaDaPonteNoLounge = (r: number) => ({ ang: Math.atan2(PONTE_LOUNGE.b.z, PONTE_LOUNGE.b.x), meia: (PONTE_LOUNGE.meia + 0.9) / r });
/** as aberturas na borda de uma plataforma (ângulo no referencial dela): onde as pontes encostam e, no disco rasta e na
 *  capela rasta, onde a escadaria das raízes sai/chega */
export function aberturasDe(p: PlatTC): { ang: number; meia: number }[] {
  const out: { ang: number; meia: number }[] = [];
  if (p.id === "cyber") return out;   // (o deck do topo da torre não encosta em ponte nenhuma: a do campus chega na BASE)
  for (const po of PONTES) for (const e of [po.a, po.b]) {
    const d = Math.hypot(e.x - p.x, e.z - p.z); if (Math.abs(d - p.r) >= 3) continue;
    // (a ponte LARGA — o campus — encosta numa corda menor que ela: a abertura é só a corda; o resto do guarda-corpo fecha)
    const corda = Math.sqrt(Math.max(0, p.r * p.r - d * d)), larg = Math.min(po.meia + 0.9, corda > 0 ? corda + 0.4 : po.meia + 0.9);
    out.push({ ang: Math.atan2(e.z - p.z, e.x - p.x), meia: Math.asin(Math.min(1, larg / p.r)) });
  }
  const C = ESCADARIA.controle;
  if (p.id === "rasta") { const s = ESP(C[0]!); out.push({ ang: Math.atan2(s.z - p.z, s.x - p.x), meia: (ESCADARIA.meia + 0.9) / p.r }); }
  if (p.id === "capelaRasta") { const s = ESP(C[C.length - 2]!); out.push({ ang: Math.atan2(s.z - p.z, s.x - p.x), meia: (ESCADARIA.meia + 0.9) / p.r }); }
  return out;
}
export const aberturasDoSalao = () => aberturasDe(PLATS[0]!);
const dentroDe = (ang: number, ab: { ang: number; meia: number }) => { let d = ang - ab.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) < ab.meia; };
/** os PILARES da cobertura do salão de festas (no anel de dentro da borda) — menos onde a ponte da capela chega (um
 *  ficava no meio do caminho) */
export const PILARES_FESTAS: readonly P2[] = (() => {
  const abs = aberturasDe(plat("festas")), out: P2[] = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.31; if (abs.some((ab) => dentroDe(a, { ang: ab.ang, meia: ab.meia + 0.06 }))) continue; out.push({ x: FESTAS.x + Math.cos(a) * (FESTAS.r - 3), z: FESTAS.z + Math.sin(a) * (FESTAS.r - 3) }); }
  return out;
})();
/** a abertura da CÚPULA dos casais (ângulo e meia-abertura, rad — onde a ponte das festas chega) */
export const portaDosCasais = () => aberturasDe(plat("casais"))[0]!;

/** os COLISORES (referencial do lounge) do complexo: o guarda-corpo de cada plataforma (menos as aberturas), os das
 *  pontes (dos dois lados, fora das plataformas e do lounge), a escadaria das raízes, a base da PIRÂMIDE, os pilares
 *  da capela maior e o pé da TORRE */
export function colisoresDoComplexo(rLounge: number): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (const p of PLATS) {
    if (p.id === "cyber") continue;   // (o guarda-corpo do TOPO da torre só vale lá em cima: `colisoresDaTorre`)
    const abs = aberturasDe(p), n = Math.ceil((2 * Math.PI * p.r) / COL.passo);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; if (abs.some((ab) => dentroDe(a, ab))) continue; out.push({ x: p.x + Math.cos(a) * p.r, z: p.z + Math.sin(a) * p.r, r: COL.r }); }
  }
  for (const po of PONTES) {
    const vx = po.b.x - po.a.x, vz = po.b.z - po.a.z, L = Math.hypot(vx, vz), nx = vz / L, nz = -vx / L;
    for (let s = 0; s <= L; s += COL.ponteP) for (const lado of [-1, 1]) {
      const c = { x: po.a.x + (vx * s) / L + nx * (po.meia + COL.ponte) * lado, z: po.a.z + (vz * s) / L + nz * (po.meia + COL.ponte) * lado };
      if (PLATS.some((p) => naPlat(p, c, -0.5)) || Math.hypot(c.x, c.z) < rLounge - 0.5) continue;
      out.push({ ...c, r: COL.ponte });
    }
    // as PONTAS da ponte: o que dela fica FORA da plataforma onde encosta (a do campus é mais larga que a corda do salão e
    // da base da torre — sobrava uma cunha sem piso nem guarda-corpo, de onde se caía)
    for (const [e, sd] of [[po.a, 1], [po.b, -1]] as const) for (let l = -(po.meia + COL.ponte); l <= po.meia + COL.ponte + 1e-6; l += 0.4) {   // (bem juntos: espaçados, quem chega reto escorregava entre dois)
      const c = { x: e.x + nx * l + (vx / L) * 0.6 * sd, z: e.z + nz * l + (vz / L) * 0.6 * sd };   // (um tiquinho pra DENTRO da ponte: a fresta sem piso fica toda atrás)
      if (PLATS.some((p) => naPlat(p, c, -0.5)) || Math.hypot(c.x, c.z) < rLounge - 0.5) continue;
      out.push({ ...c, r: COL.ponte });
    }
  }
  for (const c of bordasDaEscadaria(RASTA.r)) out.push({ ...ESP(c), r: 0.5 });   // a escadaria das raízes (a do lounge, espelhada)
  const P = PIRAMIDE;
  for (let k = -P.meia; k <= P.meia; k += P.passo) for (const [x, z] of [[k, -P.meia], [k, P.meia], [-P.meia, k], [P.meia, k]] as const) out.push({ x: P.x + x, z: P.z + z, r: P.colR });
  const C = CAPELA_RASTA;
  for (let i = 0; i < C.pilares; i++) { const a = (i / C.pilares) * Math.PI * 2 + Math.PI / C.pilares; out.push({ x: TEMPLO_RASTA.x + Math.cos(a) * C.r, z: TEMPLO_RASTA.z + Math.sin(a) * C.r, r: C.pilarR + 0.2 }); }
  out.push({ x: RASTA.x, z: RASTA.z, r: ARVORE_RASTA.r + 1.2 });   // (o tronco: as raízes abrem até ~6 m no chão)
  out.push({ ...ESP({ x: 66.5, z: -24 }), r: 0.6 });   // (o cantinho onde a escadaria das raízes sai do disco rasta)
  for (const p of PILARES_FESTAS) out.push({ ...p, r: 0.65 });   // os PILARES do salão de festas
  { const abs = aberturasDe(plat("casais")), rr = CASAIS.r - 1;   // a CÚPULA dos casais (aberta só na porta) e o SOFÁ redondo
    for (let a = 0; a < Math.PI * 2; a += 0.7 / rr) if (!abs.some((ab) => dentroDe(a, { ang: ab.ang, meia: ab.meia + 0.05 }))) out.push({ x: CASAIS.x + Math.cos(a) * rr, z: CASAIS.z + Math.sin(a) * rr, r: 0.45 });
    for (let a = 0; a <= Math.PI * 1.5 + 1e-6; a += 0.3) out.push({ x: CASAIS.x + Math.cos(a) * 3.2, z: CASAIS.z + Math.sin(a) * 3.2, r: 0.75 }); }
  for (const r of RACKS_TI) for (const dx of [-0.4, 0.4]) out.push({ x: r.x + dx, z: r.z, r: 0.62 });   // os RACKS do campus
  for (const t of TELOES_MERCADO) for (const p of pilaresDoTelao(t)) out.push({ ...p, r: 1.1 });   // os pilares dos TELÕES do mercado
  for (const p of PLATS) if (ehEstudo(p)) {   // os LOUNGES ESTUDANTIS: as estantes (no térreo, fora das entradas), as luminárias e as plantas
    const abs = aberturasDe(p), R = p.r - ESTANTES_ESTUDO.dentro, n = Math.ceil((2 * Math.PI * R) / 0.9);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; if (abs.some((ab) => dentroDe(a, { ang: ab.ang, meia: ab.meia + 0.12 }))) continue; out.push({ x: p.x + Math.cos(a) * R, z: p.z + Math.sin(a) * R, r: 0.5 }); }
    for (const [lx, lz] of LUMINARIAS_ESTUDO) out.push({ x: p.x + lx, z: p.z + lz, r: 0.35 });
    for (const [lx, lz] of PLANTAS_ESTUDO) out.push({ x: p.x + lx, z: p.z + lz, r: 0.8 });
  }
  for (const p of PLATS) if (ehEstudo(p)) out.push({ x: p.x, z: p.z, r: CARACOL.col });   // a COLUNA do caracol dos lounges estudantis
  for (const e of ESTACOES_TI) {   // os TERMINAIS do campus (a mesa com os três monitores, os painéis)
    for (const x of [-0.65, 0.65]) out.push({ ...daCabineTI(e, x, CABINE_TI.mesaZ + 0.1), r: 0.75 });
    for (const sx of [-1, 1]) for (const z of [-0.7, 0.5]) out.push({ ...daCabineTI(e, sx * CABINE_TI.painelX, z), r: 0.4 });
  }   // as MESAS do campus   // o NÚCLEO do monumento da Cyber Room (fechado, por ora)   // o tronco da ÁRVORE DA VIDA no meio do disco rasta
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; out.push({ x: TORRE_RASTA.x + Math.cos(a) * TORRE_RASTA.r, z: TORRE_RASTA.z + Math.sin(a) * TORRE_RASTA.r, r: 0.8 }); }
  return out;
}
/** os colisores (layout) de cada NÍVEL da torre — a colisão é no plano, e a base, o topo e o mirante ficam no mesmo xz:
 *  na BASE, o contorno da coluna; no TOPO, o guarda-corpo da borda, o núcleo do monumento e as estações; no MIRANTE, o
 *  guarda-corpo de dentro (a pirâmide) e o de fora, e as estações */
export function colisoresDaTorre(nivel: 0 | 1 | 2): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [], anel = (r: number, passo: number, rc: number) => { const n = Math.ceil((2 * Math.PI * r) / passo); for (let i = 0; i < n; i++) out.push({ ...noAnel(r, (i / n) * Math.PI * 2), r: rc }); };
  if (nivel === 0) anel(TORRE_TI.colR + 1, 0.9, 0.9);   // (a coluna desenhada abre até ~32 m no pé)
  if (nivel === 1) {
    anel(CYBER.r, COL.passo, COL.r); out.push(...PILARES_ALTO.map((p) => ({ ...p, r: 0.9 })));
    const M = CUBO_CYBER.meia + 0.3;   // o CUBO (o contorno quadrado dele — o redondo antigo era uma parede invisível nos cantos)
    for (let k = -M; k <= M + 1e-6; k += 0.9) for (const [x, z] of [[k, -M], [k, M], [-M, k], [M, k]] as const) out.push({ x: CYBER.x + x, z: CYBER.z + z, r: 0.5 });
  }
  // as CÁPSULAS: as quatro GUIAS do poço (desenhadas de ponta a ponta; o vidro da cápsula vai e vem — não vira parede)
  for (const p of POCOS_TC) {
    const nv = (h: number) => (h < CYBER.h - 4 ? 0 : h < ALTO_TI.h - 4 ? 1 : 2);
    if (nv(p.de) !== nivel && nv(p.ate) !== nivel) continue;
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; out.push({ x: p.x + Math.cos(a) * (p.r + 0.4), z: p.z + Math.sin(a) * (p.r + 0.4), r: 0.25 }); }
  }
  if (nivel === 2) { anel(ALTO_TI.rIn, 0.6, 0.45); anel(ALTO_TI.rOut, COL.passo, COL.r); }
  for (const c of CABINES_TORRE) if (c.nivel === nivel) {
    for (const x of [-0.65, 0.65]) out.push({ ...daCabineTI(c, x, CABINE_TI.mesaZ + 0.1), r: 0.75 });
    for (const sx of [-1, 1]) for (const z of [-0.7, 0.5]) out.push({ ...daCabineTI(c, sx * CABINE_TI.painelX, z), r: 0.4 });
  }
  return out;
}

/** os SÓLIDOS de voo do complexo (referencial do lounge; `topo`/`base` acima do pátio): as lajes, a pirâmide, a capela
 *  maior e a torre */
export function solidosDoComplexo(): { x: number; z: number; r: number; topo: number; base: number }[] {
  return [
    ...PLATS.map((p) => ({ x: p.x, z: p.z, r: p.r, topo: p.h, base: p.h - 2.5 })),
    { x: PIRAMIDE.x, z: PIRAMIDE.z, r: PIRAMIDE.meia * 1.05, topo: -SALAO.desce + PIRAMIDE.alt * 0.75, base: -SALAO.desce },
    { x: TEMPLO_RASTA.x, z: TEMPLO_RASTA.z, r: CAPELA_RASTA.r + 1, topo: TEMPLO_RASTA.h + CAPELA_RASTA.altura + 12, base: TEMPLO_RASTA.h + CAPELA_RASTA.altura - 1 },   // (o teto: por baixo dele, a capela é aberta)
    { x: TORRE_RASTA.x, z: TORRE_RASTA.z, r: TORRE_RASTA.r + 0.5, topo: FESTAS.h + TORRE_RASTA.alt, base: FESTAS.h },
    // (out/2026, o dono: "não queremos atravessar texturas" — o que faltava pra quem VOA, de moto ou de mochila)
    // o salão de FESTAS: os pilares e a cobertura em anel (o meio fica aberto: a tela é luz)
    ...PILARES_FESTAS.map((p) => ({ x: p.x, z: p.z, r: 0.75, topo: FESTAS.h + 14, base: FESTAS.h })),
    ...Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2; return { x: FESTAS.x + Math.cos(a) * (FESTAS.r - 3), z: FESTAS.z + Math.sin(a) * (FESTAS.r - 3), r: 1.9, topo: FESTAS.h + 16, base: FESTAS.h + 13 }; }),
    // a CÚPULA dos casais: a parede de vidro (menos a porta) e o domo por cima
    ...(() => { const abs = aberturasDe(plat("casais")), rr = CASAIS.r - 1, out: { x: number; z: number; r: number; topo: number; base: number }[] = [];
      for (let a = 0; a < Math.PI * 2; a += 0.5 / rr) if (!abs.some((ab) => dentroDe(a, { ang: ab.ang, meia: ab.meia + 0.05 }))) out.push({ x: CASAIS.x + Math.cos(a) * rr, z: CASAIS.z + Math.sin(a) * rr, r: 0.6, topo: CASAIS.h + 7, base: CASAIS.h - 0.5 });
      out.push({ x: CASAIS.x, z: CASAIS.z, r: rr, topo: CASAIS.h + rr + 0.5, base: CASAIS.h + 6 });
      return out; })(),
    // as CABINES do campus e as do deck/mirante da torre (mesa, monitor e painéis — quem passa voando baixo bate)
    ...ESTACOES_TI.map((e) => ({ ...daCabineTI(e, 0, 0.2), r: 1.7, topo: -SALAO.desce + 2.4, base: -SALAO.desce })),
    ...CABINES_TORRE.map((c) => ({ ...daCabineTI(c, 0, 0.2), r: 1.7, topo: c.y + 2.4, base: c.y })),
    ...RACKS_TI.map((r) => ({ x: r.x, z: r.z, r: 1.2, topo: -SALAO.desce + 2.6, base: -SALAO.desce })),
    // os TELÕES do mercado: os pilares e a TELA (uma fileira de cilindros ao longo dela — quem voa não atravessa)
    ...TELOES_MERCADO.flatMap((t) => [
      ...pilaresDoTelao(t).map((p) => ({ ...p, r: 1.1, topo: -SALAO.desce + t.base, base: -SALAO.desce })),
      ...Array.from({ length: Math.ceil(t.l / 2) + 1 }, (_, k) => ({ ...naTelaMercado(t, -0.5 + k / Math.ceil(t.l / 2)), r: 1.1, topo: -SALAO.desce + t.base + t.a, base: -SALAO.desce + t.base - 0.4 })),
    ]),
    { x: RASTA.x, z: RASTA.z, r: ARVORE_RASTA.r, topo: ARVORE_RASTA.alt, base: 0 },
    { x: CYBER.x, z: CYBER.z, r: CUBO_CYBER.meia * 1.15, topo: CYBER.h + CUBO_CYBER.alt, base: CYBER.h },   // (o cubo, do tamanho do desenhado)
    // a PIRÂMIDE INVERTIDA flutuando (o dono: "não parece ter colisão"): a metade de cima, larga, e a ponta com o olho
    // (com a folga do sobe-e-desce dela, ±1,2 m)
    { x: CYBER.x, z: CYBER.z, r: PIRAMIDE_INV.r * 0.85, topo: CYBER.h + PIRAMIDE_INV.y + PIRAMIDE_INV.alt / 2 + 1.4, base: CYBER.h + PIRAMIDE_INV.y - 1.2 },
    { x: CYBER.x, z: CYBER.z, r: PIRAMIDE_INV.r * 0.4, topo: CYBER.h + PIRAMIDE_INV.y, base: CYBER.h + PIRAMIDE_INV.y - PIRAMIDE_INV.alt / 2 - 3.2 },
    { x: TORRE_TI.x, z: TORRE_TI.z, r: TORRE_TI.colR + 1, topo: CYBER.h, base: -SALAO.desce },
    { x: ALTO_TI.x, z: ALTO_TI.z, r: ALTO_TI.rOut, topo: ALTO_TI.h, base: ALTO_TI.h - 0.8 },   // a laje do MIRANTE
    // os LOUNGES ESTUDANTIS: as lajes dos andares de cima, a cúpula e a PAREDE (sólida também pra quem voa — embaixo das
    // entradas do térreo, aberta)
    ...PLATS.filter(ehEstudo).flatMap((p) => {
      const A = ANDARES_ESTUDO, out = [{ x: p.x, z: p.z, r: p.r + 0.6, topo: p.h + A.teto + 3, base: p.h + A.teto - 0.3 }];
      for (let k = 1; k < A.n; k++) out.push({ x: p.x, z: p.z, r: p.r, topo: p.h + k * A.pe, base: p.h + k * A.pe - 0.6 });
      const abs = aberturasDe(p), n = Math.ceil((2 * Math.PI * p.r) / 1.6);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push({ x: p.x + Math.cos(a) * (p.r + 0.3), z: p.z + Math.sin(a) * (p.r + 0.3), r: 0.9, topo: p.h + A.teto, base: abs.some((ab) => dentroDe(a, ab)) ? p.h + 4.4 : p.h - 0.5 }); }
      return out;
    }),   // a COLUNA da torre (sólida pra quem voa; em cima, pousa no topo)   // o monumento   // a árvore (o tronco até a copa)
  ];
}
/** a curva da escadaria das raízes (no referencial do layout) — o render desenha na do lounge, num grupo espelhado */
export const curvaDaEscadariaRasta = () => curvaDaEscadaria();

// ───────────── a GUARDIÃ do braço esquerdo: a Examiner e a CÚPULA fechada ─────────────
/** a CÚPULA fechada em volta da capela do lounge (o templo lá em cima): raio, altura (acima do piso do templo) e a
 *  PORTA — na entrada da escadaria-veia. Fechada pra quem não venceu o duelo de linguagem (lib/cyber/dueloIngles): sem
 *  outra entrada nem portal — a cúpula É o bloqueio (o dono, out/2026) */
export const CUPULA = { r: TEMPLO.r + 0.8, alt: 44, portaAlt: 9 } as const;
/** a porta da cúpula (referencial do lounge): o centro dela, na borda do templo, e pra onde ela dá (o rumo de quem sai) */
export function portaDaCupula(): { x: number; z: number; ang: number; meia: number } {
  const e = entradaDoTemplo();
  return { x: TEMPLO.x + Math.cos(e.ang) * TEMPLO.r, z: TEMPLO.z + Math.sin(e.ang) * TEMPLO.r, ang: e.ang, meia: e.meia };
}
/** onde a EXAMINER monta guarda: na escadaria, logo antes da porta, de frente pra quem sobe (referencial do lounge) */
export function postoDaGuardia(): { x: number; z: number; rumoLocal: number } {
  const p = portaDaCupula(), d = 6, x = TEMPLO.x + Math.cos(p.ang) * (TEMPLO.r + d), z = TEMPLO.z + Math.sin(p.ang) * (TEMPLO.r + d);
  return { x, z, rumoLocal: Math.atan2(Math.cos(p.ang), Math.sin(p.ang)) };   // (yaw: olhando pra fora da porta, escada abaixo)
}
/** a que distância (m) da guardiã o duelo começa (quem vem subindo a escadaria) */
export const ALCANCE_DUELO = 14;
/** quem ainda NÃO venceu o duelo e está DENTRO da cúpula (pela porta ou voando) é posto de volta no posto da guardiã,
 *  um pouco escada abaixo; null = pode ficar (já venceu, ou está fora) — `q` no referencial do lounge */
export function barradoNaCupula(q: P2, liberado: boolean): P2 | null {
  if (liberado || !noTemplo(q, 0.3)) return null;
  const p = portaDaCupula(), d = 9;
  return { x: TEMPLO.x + Math.cos(p.ang) * (TEMPLO.r + d), z: TEMPLO.z + Math.sin(p.ang) * (TEMPLO.r + d) };
}
