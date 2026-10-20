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
 */

type P2 = { x: number; z: number };

/** o SALÃO central: centro, raio e quantos metros ABAIXO do pátio do lounge fica o piso dele (os braços sobem) */
export const SALAO = { x: -200, z: 40, r: 48, desce: 14, colR: 0.6, passo: 1 } as const;
/** o MONUMENTO ALIENÍGENA no meio do salão (no lugar do palco): a pirâmide — meia-base e altura */
export const PIRAMIDE = { x: SALAO.x, z: SALAO.z - 4, meia: 10, alt: 24, colR: 0.7, passo: 1.4 } as const;
/** a PONTE do salão até o pátio do lounge: sai da borda do salão (`a`) e chega na borda do lounge (`b`, no raio 70),
 *  subindo `SALAO.desce` m; `meia` = meia-largura */
export const PONTE_LOUNGE = { a: { x: -153.5, z: 32 }, b: { x: -65, z: 26 }, meia: 4.5, colR: 0.5, passo: 0.8 } as const;
/** onde quem chega aparece (na frente do salão, olhando pra pirâmide: o −z) e a BOCA da pista de saída (lib/cyber/
 *  fiosCosmicos — longe o bastante da chegada pra não pegar quem acabou de chegar) */
export const CHEGADA_SALAO = { x: SALAO.x, z: SALAO.z + 33, rumo: Math.PI } as const;
export const BOCA_SAIDA_SALAO = { x: SALAO.x - 27, z: SALAO.z + 31 } as const;

export const noSalao = (q: P2, folga = 0) => Math.hypot(q.x - SALAO.x, q.z - SALAO.z) <= SALAO.r + folga;
/** onde na ponte do lounge `q` está: `u` (0 no salão → 1 no lounge) e `lat` de lado, ou null fora dela */
export function naPonteLounge(q: P2, folga = 0): { u: number; lat: number } | null {
  const { a, b, meia } = PONTE_LOUNGE, vx = b.x - a.x, vz = b.z - a.z, L = Math.hypot(vx, vz);
  const t = ((q.x - a.x) * vx + (q.z - a.z) * vz) / (L * L), lat = ((q.x - a.x) * vz - (q.z - a.z) * vx) / L;
  if (t < -folga / L || t > 1 + folga / L || Math.abs(lat) > meia + folga) return null;
  return { u: Math.max(0, Math.min(1, t)), lat };
}
/** está no complexo do Templo Cósmico FORA do disco do lounge (o salão e as conexões)? */
export const noComplexo = (q: P2, folga = 0) => noSalao(q, folga) || naPonteLounge(q, folga) !== null;
/** a altura do piso (acima do PÁTIO do lounge — negativa no salão) num ponto do complexo, ou null fora dele */
export function alturaNoComplexo(q: P2): number | null {
  const p = naPonteLounge(q); if (p) return -SALAO.desce * (1 - p.u);
  if (noSalao(q)) return -SALAO.desce;
  return null;
}
/** dentro da base da pirâmide (não se anda: é sólida)? */
export const naPiramide = (q: P2, folga = 0) => Math.abs(q.x - PIRAMIDE.x) <= PIRAMIDE.meia + folga && Math.abs(q.z - PIRAMIDE.z) <= PIRAMIDE.meia + folga;

/** a abertura na parede do LOUNGE onde a ponte chega (ângulo no referencial da sala e a meia-abertura, rad) */
export const entradaDaPonteNoLounge = (r: number) => ({ ang: Math.atan2(PONTE_LOUNGE.b.z, PONTE_LOUNGE.b.x), meia: (PONTE_LOUNGE.meia + 0.9) / r });
/** as aberturas na borda do SALÃO (ângulo no referencial do salão): a ponte do lounge */
export function aberturasDoSalao(): { ang: number; meia: number }[] {
  const { a, meia } = PONTE_LOUNGE;
  return [{ ang: Math.atan2(a.z - SALAO.z, a.x - SALAO.x), meia: (meia + 0.9) / SALAO.r }];
}
const dentroDe = (ang: number, ab: { ang: number; meia: number }) => { let d = ang - ab.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) < ab.meia; };

/** os COLISORES (referencial do lounge) do complexo: o guarda-corpo do salão (menos as aberturas), os da ponte (dos
 *  dois lados, fora do salão e do lounge) e a base da PIRÂMIDE */
export function colisoresDoComplexo(rLounge: number): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [], S = SALAO, abs = aberturasDoSalao(), n = Math.ceil((2 * Math.PI * S.r) / S.passo);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; if (abs.some((ab) => dentroDe(a, ab))) continue; out.push({ x: S.x + Math.cos(a) * S.r, z: S.z + Math.sin(a) * S.r, r: S.colR }); }
  const { a, b, meia, passo, colR } = PONTE_LOUNGE, vx = b.x - a.x, vz = b.z - a.z, L = Math.hypot(vx, vz), nx = vz / L, nz = -vx / L;
  for (let s = 0; s <= L; s += passo) for (const lado of [-1, 1]) {
    const c = { x: a.x + (vx * s) / L + nx * (meia + colR) * lado, z: a.z + (vz * s) / L + nz * (meia + colR) * lado };
    if (noSalao(c, -0.5) || Math.hypot(c.x, c.z) < rLounge - 0.5) continue;
    out.push({ ...c, r: colR });
  }
  const P = PIRAMIDE;
  for (let k = -P.meia; k <= P.meia; k += P.passo) for (const [x, z] of [[k, -P.meia], [k, P.meia], [-P.meia, k], [P.meia, k]] as const) out.push({ x: P.x + x, z: P.z + z, r: P.colR });
  return out;
}
