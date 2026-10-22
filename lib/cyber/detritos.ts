/**
 * Cyberespaço — o CAMPO DE ASTEROIDES do caminho até o buraco negro (PURO; out/2026, o dono: "desvie de asteroides, na
 * pegada game 3D"):
 *  - a ZONA DE APROXIMAÇÃO: do alcance do magnetismo (lib/cyber/fiosCosmicos `raioDeAtracao`) até o PONTO DOCE (perto
 *    do horizonte). Lá dentro, um TÚNEL de asteroides (em volta do eixo você → buraco negro) vem do lado dele VOANDO NA
 *    SUA DIREÇÃO — de tamanhos e formas variados, girando; o que passa por trás de você renasce lá na frente. Quanto mais
 *    perto, mais denso e mais rápido; uns poucos vêm MIRADOS em você (a marca vermelha);
 *  - acertou: empurra pra trás, tira um pouco de vida, a tela treme; passou RASPANDO: o "vush";
 *  - no ponto doce o campo some e ele te puxa sozinho (a tragada — a cutscene).
 * Tudo em coordenadas do MUNDO. Cada cliente tem o seu campo (é só pra quem está chegando).
 */
export type V3 = { x: number; y: number; z: number };

export const DETRITOS = {
  /** o PONTO DOCE: a que distância do CENTRO do buraco negro (× o raio dele) ele puxa sozinho */
  doce: 3.5,   // (com os buracos negros 7× maiores, out/2026: ~3,4 km do centro — o enquadramento em que ele cabe na tela)
  /** quantos asteroides no campo (na borda da zona → chegando no ponto doce); no modo leve, `leve` × isso */
  n: [4, 18] as const, leve: 0.8,
  /** o TÚNEL: o raio em volta do eixo e até onde vai na frente (m) */
  tunelR: 48, fundo: 340, perto: 18,
  /** a velocidade (m/s) com que vêm (na borda → perto) e o raio (m) — a maior parte pequena, uns grandes */
  vel: [45, 110] as const, raio: [1.8, 8] as const,
  /** a fração dos que vêm MIRADOS em você (no começo do caminho → chegando) */
  mirados: [0.55, 0.85] as const,
  /** a zona começa a quantos metros DEPOIS da boca da pista (saiu da Zaeon rumo ao buraco negro: já começa) */
  depoisDaBoca: 40,
  /** no hub, a zona começa a quantos metros DEPOIS DA BORDA da cidadela (em qualquer direção — o buraco negro mais perto) */
  depoisDaCidadela: 100,
  /** o meu raio (m) e o que conta como raspão (m além do contato) */
  euR: 1.7, raspao: 5,
  /** a batida: o empurrão (m/s) e o dano */
  empurrao: 34, dano: 7,
  /** o MAGNETISMO dentro da zona (m/s², na borda → no ponto doce) */
  puxao: [1.5, 7] as const,
} as const;

export type Asteroide = { id: number; p: V3; v: V3; r: number; gira: V3; forma: 0 | 1 | 2; mirado: boolean; passou: boolean };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** onde a ZONA de um buraco negro começa (m do centro dele): logo depois da BOCA da pista — assim que se sai rumo a ele
 *  (o dono, out/2026: "assim que iniciamos nosso caminho a um buraco negro, já deve começar") */
export const inicioDaZona = (boca: V3, bn: V3) => Math.hypot(boca.x - bn.x, boca.y - bn.y, boca.z - bn.z) - DETRITOS.depoisDaBoca;
/** onde estou na ZONA de um buraco negro (começa a `inicio` m do centro): `k` 0 no começo → 1 no ponto doce (ou null
 *  fora); `doce` = já chegou */
export function naZona(p: V3, bn: V3, R: number, inicio: number, jaDentro = false): { k: number; d: number; doce: boolean } | null {
  const d = Math.hypot(p.x - bn.x, p.y - bn.y, p.z - bn.z), fora = inicio, dentro = R * DETRITOS.doce;
  if (d > fora && !jaDentro) return null;   // (`jaDentro`: o chamador já sabe que está no caminho — o k fica 0 até chegar no início)
  const k = Math.max(0, Math.min(1, (fora - d) / Math.max(1, fora - dentro)));
  return { k, d, doce: d <= dentro };
}

/** a BASE do túnel: a frente (eu → buraco negro), o lado e o cima */
export function baseDoTunel(eu: V3, bn: V3) {
  let fx = bn.x - eu.x, fy = bn.y - eu.y, fz = bn.z - eu.z; const L = Math.hypot(fx, fy, fz) || 1; fx /= L; fy /= L; fz /= L;
  let lx = -fz, lz = fx; const ll = Math.hypot(lx, lz) || 1; lx /= ll; lz /= ll;
  return { f: { x: fx, y: fy, z: fz }, l: { x: lx, y: 0, z: lz }, c: { x: fy * lz, y: fz * lx - fx * lz, z: -fy * lx }, dist: L };
}

/** um asteroide NOVO no túnel, à profundidade `prof` (m na frente de você), voando na sua direção */
export function novoAsteroide(rnd: () => number, id: number, eu: V3, euVel: V3, bn: V3, k: number, prof: number): Asteroide {
  const D = DETRITOS, b = baseDoTunel(eu, bn);
  const a = rnd() * Math.PI * 2, rr = D.tunelR * Math.sqrt(rnd()), fundo = Math.min(prof, Math.max(D.perto, b.dist - 60));   // (nunca dentro do buraco negro)
  const p = { x: eu.x + b.f.x * fundo + b.l.x * Math.cos(a) * rr + b.c.x * Math.sin(a) * rr, y: eu.y + b.f.y * fundo + b.c.y * Math.sin(a) * rr, z: eu.z + b.f.z * fundo + b.l.z * Math.cos(a) * rr + b.c.z * Math.sin(a) * rr };
  const vel = lerp(D.vel[0], D.vel[1], k) * (0.75 + 0.5 * rnd()), mirado = rnd() < lerp(D.mirados[0], D.mirados[1], k);
  let v: V3;
  if (mirado) {   // o MIRADO: vai pra onde você vai estar
    const tc = Math.hypot(eu.x - p.x, eu.y - p.y, eu.z - p.z) / vel, al = { x: eu.x + euVel.x * tc - p.x, y: eu.y + euVel.y * tc - p.y, z: eu.z + euVel.z * tc - p.z }, n = Math.hypot(al.x, al.y, al.z) || 1;
    v = { x: (al.x / n) * vel, y: (al.y / n) * vel, z: (al.z / n) * vel };
  } else {   // o do CAMPO: vem reto pra trás (contra o eixo), derivando um pouco de lado
    const dl = (rnd() - 0.5) * 8, dc = (rnd() - 0.5) * 8;
    v = { x: -b.f.x * vel + b.l.x * dl + b.c.x * dc, y: -b.f.y * vel + b.c.y * dc, z: -b.f.z * vel + b.l.z * dl + b.c.z * dc };
  }
  // o tamanho: a maior parte pequena, uns poucos grandes (os que dão medo)
  const s = rnd(), r = lerp(D.raio[0], D.raio[1], s * s * s);
  return { id, p, v, r, gira: { x: rnd() * 2 - 1, y: rnd() * 2 - 1, z: rnd() * 2 - 1 }, forma: Math.floor(rnd() * 3) as 0 | 1 | 2, mirado, passou: false };
}

/** quantos asteroides o campo quer agora */
export const tamanhoDoCampo = (k: number, leve = false) => Math.round(lerp(DETRITOS.n[0], DETRITOS.n[1], k) * (leve ? DETRITOS.leve : 1));

/** um passo do asteroide: `acertou` = passou por mim nesse passo (o segmento contra a esfera — rápido não atravessa);
 *  `raspou` = passou perto sem acertar (o vush); `atras` = já ficou pra trás (renasce na frente) */
export function passoAsteroide(d: Asteroide, dt: number, eu: V3, frente: V3): { acertou: boolean; raspou: boolean; atras: boolean } {
  const a = { ...d.p };
  d.p.x += d.v.x * dt; d.p.y += d.v.y * dt; d.p.z += d.v.z * dt;
  const sx = d.p.x - a.x, sy = d.p.y - a.y, sz = d.p.z - a.z, s2 = sx * sx + sy * sy + sz * sz;
  const u = s2 > 0 ? Math.max(0, Math.min(1, ((eu.x - a.x) * sx + (eu.y - a.y) * sy + (eu.z - a.z) * sz) / s2)) : 0;
  const dist = Math.hypot(a.x + sx * u - eu.x, a.y + sy * u - eu.y, a.z + sz * u - eu.z);
  const acertou = dist < d.r + DETRITOS.euR;
  const prof = (d.p.x - eu.x) * frente.x + (d.p.y - eu.y) * frente.y + (d.p.z - eu.z) * frente.z;
  const raspou = !acertou && !d.passou && prof < 0 && dist < d.r + DETRITOS.euR + DETRITOS.raspao;
  if (prof < 0) d.passou = true;
  return { acertou, raspou, atras: prof < -DETRITOS.perto - d.r };
}

/** vai me acertar se eu não fizer nada? (a marca vermelha) — a menor distância nos próximos 2,5 s */
export function vaiAcertar(d: Asteroide, eu: V3, euVel: V3, folga = 1.5): boolean {
  const rx = d.p.x - eu.x, ry = d.p.y - eu.y, rz = d.p.z - eu.z, vx = d.v.x - euVel.x, vy = d.v.y - euVel.y, vz = d.v.z - euVel.z;
  const v2 = vx * vx + vy * vy + vz * vz; if (v2 < 1e-6) return false;
  const t = -(rx * vx + ry * vy + rz * vz) / v2; if (t < 0 || t > 2.5) return false;
  return Math.hypot(rx + vx * t, ry + vy * t, rz + vz * t) < d.r + DETRITOS.euR + folga;
}

/** o EMPURRÃO de uma batida: na direção do asteroide, e um pouco pra trás (pra longe do buraco negro) */
export function empurraoDaBatida(d: Asteroide, eu: V3, bn: V3): V3 {
  const v = Math.hypot(d.v.x, d.v.y, d.v.z) || 1, b = { x: eu.x - bn.x, y: eu.y - bn.y, z: eu.z - bn.z }, bl = Math.hypot(b.x, b.y, b.z) || 1, E = DETRITOS.empurrao * Math.min(1.6, 0.7 + d.r / 6);
  return { x: (d.v.x / v) * E * 0.7 + (b.x / bl) * E * 0.5, y: (d.v.y / v) * E * 0.7 + (b.y / bl) * E * 0.5 + 6, z: (d.v.z / v) * E * 0.7 + (b.z / bl) * E * 0.5 };
}
/** o MAGNETISMO dentro da zona: a aceleração (m/s²) rumo ao centro */
export function puxaoDaZona(eu: V3, bn: V3, k: number): V3 {
  const a = lerp(DETRITOS.puxao[0], DETRITOS.puxao[1], k * k), d = { x: bn.x - eu.x, y: bn.y - eu.y, z: bn.z - eu.z }, l = Math.hypot(d.x, d.y, d.z) || 1;
  return { x: (d.x / l) * a, y: (d.y / l) * a, z: (d.z / l) * a };
}
