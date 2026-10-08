/**
 * Cyberespaço — o CORAÇÃO da Zaeon (PURO, sem three). Um ciclo, como um coração:
 *  1. um RAIO azul cai na ponta de cristal da capela;
 *  2. o pulso DESCE a capela — pelo eixo central até o globo do centro (de onde o holograma da Zaeon nasce) e pelas
 *     8 nervuras que descem a cúpula e os pilares;
 *  3. o globo BATE ("tum-tum": a 1ª bulha forte, a 2ª mais fraca ~0,3 s depois);
 *  4. a batida se espalha pela cidade em ONDAS concêntricas (como numa água), acendendo as VEIAS por onde passa.
 *
 * As veias crescem como RAÍZES / nervuras de folha (por isso parecem "familiares" ao olho): COLONIZAÇÃO DE ESPAÇO
 * guiada por pontos na espiral de OURO (Fibonacci, 137,5°) — os galhos disputam o espaço e NÃO se cruzam, só se
 * encontram nas bifurcações — e o calibre pela LEI DE MURRAY (r_pai³ = Σ r_filhos³). Determinístico e testável.
 * Cada ponto de veia guarda o seu ATRASO (s depois do raio): o shader acende o pulso quando ele chega.
 *
 * Também ficam aqui (re-exportadas de lib/cyber/ceu) as ESTAÇÕES DE TRABALHO DOS AGENTES em volta do pátio central.
 */
import { CAPELA, CIDADE, GLOBO_CAPELA, inicioDaPonta } from "./ceu";

// ── o RITMO ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const CORACAO = {
  /** s: um ciclo inteiro (raio → descida → batida → ondas) */
  ciclo: 2.6,
  /** s entre a 1ª e a 2ª bulha; a força da 2ª */
  dub: 0.32, forcaDub: 0.6,
  /** m/s: o pulso descendo a capela (é eletricidade) e a onda no piso */
  velDesce: 110, velChao: 30,
} as const;

/** a intensidade do "tum-tum" (0..1) `x` segundos depois de uma 1ª bulha (periódico no ciclo) */
export function pulso(x: number): number {
  const c = CORACAO.ciclo, u = ((x % c) + c) % c;
  const d = (v: number) => { let k = u - v; if (k > c / 2) k -= c; if (k < -c / 2) k += c; return k; };
  const d1 = d(0), d2 = d(CORACAO.dub);
  return Math.min(1, Math.exp(-(d1 * d1) / (0.09 * 0.09)) + CORACAO.forcaDub * Math.exp(-(d2 * d2) / (0.1 * 0.1)));
}
/** onde o raio cai (local): a ponta do cristal */
export const TOPO_DA_CAPELA = () => ({ x: 0, y: inicioDaPonta() + CAPELA.pontaLen + 0.5, z: 0 });
/** s depois do raio em que o pulso chega no GLOBO (desceu o eixo) — é aí que o coração bate */
export const T_CORACAO = () => (TOPO_DA_CAPELA().y - (GLOBO_CAPELA.y + GLOBO_CAPELA.r)) / CORACAO.velDesce;
/** o coração agora (0..1) */
export const batidaNoCoracao = (t: number) => pulso(t - T_CORACAO());
/** o atraso (s depois do raio) da onda num ponto do piso: sai do centro em círculos */
export const atrasoNoChao = (x: number, z: number) => T_CORACAO() + Math.hypot(x, z) / CORACAO.velChao;

// ── as VEIAS ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** um trecho de veia: pontos (local da ilha, y = altura acima do piso), a normal da superfície em cada ponto (o "pra
 *  fora" — a fita deita nela), a largura, a distância percorrida desde o coração (`d`) e o ATRASO do pulso (`a`, s
 *  depois do raio) */
export type Veia = { p: number[]; n: number[]; w: number[]; d: number[]; a: number[]; geracao: number };

function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** o caminho de SUBIDA pela capela (no plano radial do ângulo `a`): pilar → cúpula → tambor → 2ª cúpula → ponta.
 *  Devolve pontos (r, y) e a normal (nr, ny) de cada um, já afastados da superfície */
export function meridianoDaCapela(passos = 1): { r: number; y: number; nr: number; ny: number }[] {
  const CA = CAPELA.altura, RC = CAPELA.r + 1, ACH = CAPELA.achata, RT = CAPELA.tamborR, AT = CAPELA.tamborAlt;
  const yT0 = CA + Math.sqrt(RC * RC - RT * RT) * ACH - 1, R2 = RT * 0.92, yPin = inicioDaPonta(), L = CAPELA.pontaLen, F = 0.45;
  const out: { r: number; y: number; nr: number; ny: number }[] = [];
  const push = (r: number, y: number, nr: number, ny: number) => { const k = Math.hypot(nr, ny); out.push({ r: r + (nr / k) * F, y: y + (ny / k) * F, nr: nr / k, ny: ny / k }); };
  // pilar (o lado de fora do pilar, subindo)
  for (let i = 0; i <= 6 * passos; i++) push(CAPELA.r + 2.2, (i / (6 * passos)) * CA, 1, 0);
  // cúpula (elipsoide achatado): φ de 0 até onde o raio chega no tambor
  const fT = Math.acos(RT / RC);
  for (let i = 1; i <= 16 * passos; i++) { const f = (i / (16 * passos)) * fT; push(Math.cos(f) * RC, CA + Math.sin(f) * RC * ACH, Math.cos(f) / RC, Math.sin(f) / (RC * ACH)); }
  // tambor (vertical, afinando de RT pra R2)
  for (let i = 1; i <= 4 * passos; i++) { const u = i / (4 * passos); push(RT + (R2 - RT) * u, yT0 + u * AT, 1, (RT - R2) / AT); }
  // 2ª cúpula
  const yc = yT0 + AT, f2 = Math.acos(Math.min(1, 3.6 / R2));
  for (let i = 1; i <= 10 * passos; i++) { const f = (i / (10 * passos)) * f2; push(Math.cos(f) * R2, yc + Math.sin(f) * R2 * 0.9, Math.cos(f) / R2, Math.sin(f) / (R2 * 0.9)); }
  // a PONTA de cristal (cone r 4 → 0)
  for (let i = 0; i <= 8 * passos; i++) { const u = i / (8 * passos), h = u * L * 0.97; push(4 * (1 - h / L), yPin + h, L, 4); }
  return out;
}
/** ângulo de ouro (rad): 360° × (1 − 1/φ) ≈ 137,5° — a filotaxia (Fibonacci) dos girassóis e das pinhas */
export const ANGULO_DE_OURO = Math.PI * (3 - Math.sqrt(5));

/** o PISO: uma árvore de veias crescida por COLONIZAÇÃO DE ESPAÇO (Runions et al. — o modelo de raízes e de nervuras
 *  de folha): pontos-guia espalhados pela cidade na espiral de ouro (Vogel/Fibonacci); a cada passo cada ponto puxa o nó
 *  da veia mais próximo, que cresce um passo na direção média dos que o puxam; pontos alcançados morrem. Os galhos
 *  DISPUTAM os pontos, então não se cruzam — só se encontram nas bifurcações. O calibre sai da LEI DE MURRAY de baixo
 *  pra cima (r_pai³ = Σ r_filhos³, das pontas finas até o tronco). Os 8 troncos que sobem a capela começam retos até
 *  o pé do pilar (e dali brotam galhos como os outros). */
function colonizar(o: { low: boolean; R0: number; LIM: number; raizes: { ang: number; ate?: number }[]; semente: number; /** dentro deste raio NÃO brota galho (só os troncos retos) */ livreAte?: number }) {
  const r = prng(o.semente), N = o.low ? 650 : 1500, DI = 24, DK = 5.2, D = 2.6, MAXIT = o.low ? 170 : 240, LIVRE = o.livreAte ?? 0;
  // os pontos-guia: espiral de ouro (densidade uniforme no anel R0+5 … LIM — ou de fora da área livre), com um tremor leve pra não ficar cristalino
  const r0 = Math.max(o.R0, LIVRE) + 5, ax: number[] = [], az: number[] = [], vivo: boolean[] = [];
  for (let i = 0; i < N; i++) { const rr = Math.sqrt(r0 * r0 + ((i + 0.5) / N) * (o.LIM * o.LIM - r0 * r0)), th = i * ANGULO_DE_OURO; ax.push(Math.cos(th) * rr + (r() - 0.5) * 2.4); az.push(Math.sin(th) * rr + (r() - 0.5) * 2.4); vivo.push(true); }
  // os nós (x, z, pai); grade espacial pra achar o mais próximo rápido
  const nx: number[] = [], nz: number[] = [], pai: number[] = [], grade = new Map<number, number[]>(), CEL = DI;
  const celula = (cx: number, cz: number) => cx * 4099 + cz, chave = (x: number, z: number) => celula(Math.floor(x / CEL), Math.floor(z / CEL));
  const novoNo = (x: number, z: number, p: number) => { const k = nx.length; nx.push(x); nz.push(z); pai.push(p); const c = chave(x, z); (grade.get(c) ?? grade.set(c, []).get(c)!).push(k); return k; };
  const doTronco = new Set<number>();
  for (const raiz of o.raizes) {
    let k = novoNo(Math.cos(raiz.ang) * o.R0, Math.sin(raiz.ang) * o.R0, -1);
    if (raiz.ate) for (let rr = o.R0 + D; rr <= raiz.ate; rr += D) { k = novoNo(Math.cos(raiz.ang) * rr, Math.sin(raiz.ang) * rr, k); doTronco.add(k); }   // tronco reto até o pilar
  }
  const maisPerto = (x: number, z: number) => {
    let melhor = -1, md = DI; const cx = Math.floor(x / CEL), cz = Math.floor(z / CEL);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const k of grade.get(celula(cx + i, cz + j)) ?? []) { const d = Math.hypot(nx[k]! - x, nz[k]! - z); if (d < md) { md = d; melhor = k; } }
    return { k: melhor, d: md };
  };
  for (let it = 0; it < MAXIT; it++) {
    const soma = new Map<number, { x: number; z: number }>();
    for (let i = 0; i < N; i++) {
      if (!vivo[i]) continue;
      const { k, d } = maisPerto(ax[i]!, az[i]!);
      if (k < 0) continue;
      if (d < DK) { vivo[i] = false; continue; }
      const s = soma.get(k) ?? { x: 0, z: 0 }; s.x += (ax[i]! - nx[k]!) / d; s.z += (az[i]! - nz[k]!) / d; soma.set(k, s);
    }
    if (!soma.size) break;
    for (const [k, s] of soma) {
      // um tiquinho do rumo do próprio galho (continuidade: veias não fazem zigue-zague)
      const p = pai[k]!, tx = p >= 0 ? nx[k]! - nx[p]! : nx[k]!, tz = p >= 0 ? nz[k]! - nz[p]! : nz[k]!, tl = Math.hypot(tx, tz) || 1;
      let dx = s.x / Math.hypot(s.x, s.z) + 0.35 * (tx / tl), dz = s.z / Math.hypot(s.x, s.z) + 0.35 * (tz / tl); const l = Math.hypot(dx, dz);
      if (l < 1e-3) continue; dx /= l; dz /= l;
      const x = nx[k]! + dx * D, z = nz[k]! + dz * D;
      if (Math.hypot(x, z) > o.LIM || Math.hypot(x, z) < LIVRE - 0.5) continue;   // (dentro da capela: só os troncos)
      if (maisPerto(x, z).d < D * 0.45) continue;   // já tem veia ali (não empilha)
      novoNo(x, z, k);
    }
  }
  // as PONTAS que pararam no meio (os vizinhos pegaram os pontos delas) continuam crescendo até a BORDA, como raiz:
  // rumo pra fora, desviando das outras veias (testa ±ângulos); se não houver passagem, encosta e para
  const temFilho = new Uint8Array(nx.length); for (const p of pai) if (p >= 0) temFilho[p] = 1;
  const pontas = nx.map((_, k) => k).filter((k) => !temFilho[k] && Math.hypot(nx[k]!, nz[k]!) < o.LIM - 3);
  const livre = (x: number, z: number, i1: number, i2: number, i3: number) => {
    const cx = Math.floor(x / CEL), cz = Math.floor(z / CEL), lim = D * 1.15;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const k of grade.get(celula(cx + i, cz + j)) ?? []) if (k !== i1 && k !== i2 && k !== i3 && Math.abs(nx[k]! - x) < lim && Math.abs(nz[k]! - z) < lim && Math.hypot(nx[k]! - x, nz[k]! - z) < lim) return false;
    return true;
  };
  for (const ponta of pontas) {
    let k = ponta;
    for (let passo = 0; passo < 120 && Math.hypot(nx[k]!, nz[k]!) < o.LIM - 1; passo++) {
      const p = pai[k]!, hx = p >= 0 ? nx[k]! - nx[p]! : nx[k]!, hz = p >= 0 ? nz[k]! - nz[p]! : nz[k]!, hl = Math.hypot(hx, hz) || 1, rl = Math.hypot(nx[k]!, nz[k]!) || 1;
      const base = Math.atan2(0.55 * hz / hl + nz[k]! / rl, 0.55 * hx / hl + nx[k]! / rl);
      const avo = p >= 0 ? pai[p]! : -1;
      let foi = false;
      for (const dv of [0, 0.22, -0.22, 0.45, -0.45, 0.7, -0.7]) {
        const x = nx[k]! + Math.cos(base + dv) * D, z = nz[k]! + Math.sin(base + dv) * D;
        if (Math.hypot(x, z) > o.LIM || !livre(x, z, k, p, avo)) continue;
        k = novoNo(x, z, k); foi = true; break;
      }
      if (!foi) break;
    }
  }
  // PODA: o galho que mesmo assim não chegou na borda é podado até a bifurcação de onde saiu (de folha em folha) —
  // toda veia que sobra vai do coração ATÉ O FIM da cidade (os troncos retos dos pilares ficam)
  const n = nx.length, nFilhos = new Int32Array(n), morto = new Uint8Array(n), fixo = new Uint8Array(n);
  for (const p of pai) if (p >= 0) nFilhos[p]++;
  for (let k = 0; k < n; k++) if (pai[k]! < 0 || doTronco.has(k)) fixo[k] = 1;
  for (let k = n - 1; k >= 0; k--) {   // (filhos nascem depois do pai: de trás pra frente, a folha some antes do pai)
    if (morto[k] || fixo[k] || nFilhos[k]! > 0 || Math.hypot(nx[k]!, nz[k]!) >= o.LIM - 8) continue;
    let j = k;
    while (j >= 0 && !morto[j] && !fixo[j] && nFilhos[j] === 0 && Math.hypot(nx[j]!, nz[j]!) < o.LIM - 8) { morto[j] = 1; const p = pai[j]!; if (p >= 0) nFilhos[p]--; j = p; }
  }
  const novoIdx = new Int32Array(n).fill(-1), ox: number[] = [], oz: number[] = [], op: number[] = [];
  for (let k = 0; k < n; k++) { if (morto[k]) continue; novoIdx[k] = ox.length; ox.push(nx[k]!); oz.push(nz[k]!); op.push(pai[k]! >= 0 ? novoIdx[pai[k]!]! : -1); }
  return { nx: ox, nz: oz, pai: op };
}

/** as veias da cidade: SÓ no PISO — a árvore de colonização + Murray: dentro da capela só 8 troncos RETOS, que
 *  terminam no EPICENTRO (o globo, onde o holograma nasce), no chão; os galhos brotam do pé dos pilares pra fora. Nada
 *  sobe a capela. Cada ponto guarda o atraso do pulso (o azul que se propaga pelas veias, do centro pra fora) */
const cacheVeias = new Map<string, { veias: Veia[]; distTopo: number }>();
/** (determinístico → calculado UMA vez por página: sair e voltar pro cyberespaço não refaz os ~0,2 s de crescimento) */
export function gerarVeias(o: { semente?: number; low?: boolean } = {}): { veias: Veia[]; distTopo: number } {
  const chave = `${o.semente ?? 2026}|${!!o.low}`, pronto = cacheVeias.get(chave);
  if (pronto) return pronto;
  const r = gerarVeiasSemCache(o); cacheVeias.set(chave, r); return r;
}
function gerarVeiasSemCache(o: { semente?: number; low?: boolean }): { veias: Veia[]; distTopo: number } {
  // até a BEIRA da ilha: depois do anel das cápsulas de nascimento (os tubos ficam na muralha)
  const veias: Veia[] = [], R0 = CIDADE.mesaHolo.r + 0.4, LIM = CIDADE.bordaR - 2, Y = 0.06;
  const RTIP = 0.36, LMIN = 0.6;   // meia-largura (m) da ponta de uma veia; nada mais fino que LMIN de largura (some de longe)
  const novo = (g: number): Veia => ({ p: [], n: [], w: [], d: [], a: [], geracao: g });
  const ponto = (v: Veia, x: number, y: number, z: number, nx: number, ny: number, nz: number, w: number, d: number, atraso: number) => { v.p.push(x, y, z); v.n.push(nx, ny, nz); v.w.push(w); v.d.push(d); v.a.push(atraso); };
  const sobem = Array.from({ length: 8 }, (_, i) => Math.round((i * CAPELA.pilares) / 8) % CAPELA.pilares);
  const angSobe = (i: number) => (sobem[i]! / CAPELA.pilares) * Math.PI * 2 + 0.035, PE = CAPELA.r + 2.2;
  const raizes = Array.from({ length: 8 }, (_, k) => ({ ang: angSobe(k), ate: PE }));
  const { nx, nz, pai } = colonizar({ low: !!o.low, R0, LIM, raizes, semente: o.semente ?? 2026, livreAte: PE });
  const n = nx.length, filhos: number[][] = Array.from({ length: n }, () => []);
  for (let k = 0; k < n; k++) if (pai[k]! >= 0) filhos[pai[k]!]!.push(k);
  // MURRAY de baixo pra cima (os nós nascem depois do pai: a ordem inversa é pós-ordem) + a distância pelo caminho
  const rad = new Array<number>(n).fill(RTIP), dist = new Array<number>(n).fill(0), ger = new Array<number>(n).fill(0);
  for (let k = n - 1; k >= 0; k--) if (filhos[k]!.length) rad[k] = Math.cbrt(filhos[k]!.reduce((s, f) => s + rad[f]! ** 3, 0));
  for (let k = 0; k < n; k++) { const p = pai[k]!; if (p >= 0) { dist[k] = dist[p]! + Math.hypot(nx[k]! - nx[p]!, nz[k]! - nz[p]!); ger[k] = ger[p]! + (filhos[p]!.length > 1 ? 1 : 0); } }
  const larg = (k: number) => Math.max(LMIN, Math.min(3.2, rad[k]! * 2));
  const atraso = (k: number) => T_CORACAO() + dist[k]! / CORACAO.velChao;   // o azul corre PELA veia, do coração pra fora
  // as CORRENTES: de cada raiz/bifurcação, segue enquanto o nó tem 1 filho; suaviza (Chaikin) pra a veia não quebrar
  const inicios: number[] = []; for (let k = 0; k < n; k++) if (pai[k]! < 0) inicios.push(k);
  while (inicios.length) {
    const ini = inicios.pop()!;
    for (const f0 of pai[ini]! < 0 && filhos[ini]!.length <= 1 ? [filhos[ini]![0]] : filhos[ini]!) {
      if (f0 === undefined) continue;
      const cadeia = [ini]; let k = f0;
      for (;;) { cadeia.push(k); if (filhos[k]!.length !== 1) break; k = filhos[k]![0]!; }
      if (filhos[k]!.length > 1) inicios.push(k);
      const v = novo(ger[cadeia[1] ?? ini]!);
      cadeia.forEach((c, i) => {
        if (i > 0 && i < cadeia.length - 1) {   // Chaikin (1 passada): 2 pontos a 1/4 e 3/4 de cada lado
          const a = cadeia[i - 1]!, b = cadeia[i + 1]!;
          ponto(v, (nx[a]! + 3 * nx[c]!) / 4, Y, (nz[a]! + 3 * nz[c]!) / 4, 0, 1, 0, larg(c), dist[c]!, atraso(c));
          ponto(v, (3 * nx[c]! + nx[b]!) / 4, Y, (3 * nz[c]! + nz[b]!) / 4, 0, 1, 0, larg(c), dist[c]!, atraso(c));
        } else ponto(v, nx[c]!, Y, nz[c]!, 0, 1, 0, larg(c), dist[c]!, atraso(c));
      });
      if (v.p.length >= 6) veias.push(v);
    }
  }
  // (as NERVURAS que subiam a capela e o EIXO do raio saíram — o dono: "os fios terminam no epicentro onde o holograma
  //  nasce, ainda no chão. ponto." As veias são só as do PISO)
  const distTopo = 0;
  return { veias, distTopo };
}

/** o SOM do coração (a batida e o raio) só se ouve no CENTRO da capela, em volta do globo de onde o holograma nasce —
 *  no resto da cidade o pulso é só luz (som pulsando o tempo todo cansa). `local` = relativo ao centro da ilha */
export const R_SOM_CORACAO = 20;
export const ouveOCoracao = (local: { x: number; z: number }) => Math.hypot(local.x, local.z) <= R_SOM_CORACAO;

/** o raio CAI neste quadro? (começo de um ciclo) */
export const disparaRaio = (tAnt: number, t: number) => Math.floor(t / CORACAO.ciclo) > Math.floor(tAnt / CORACAO.ciclo);
/** o coração BATE neste quadro? (a 1ª bulha — o som) */
export const bateAgora = (tAnt: number, t: number) => Math.floor((t - T_CORACAO()) / CORACAO.ciclo) > Math.floor((tAnt - T_CORACAO()) / CORACAO.ciclo);

// ── as ESTAÇÕES DOS AGENTES: o layout mora em lib/cyber/ceu (a colisão da cidade precisa dele) ──
export { ESTACOES, estacoesLocais, colisoresDasEstacoes } from "./ceu";

// ── os SONS (sintetizados no navegador, como o jato e a moto — lib/cyber/audio SINTESE) ─────────────────────────────
function prngS(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normalizarS = (x: Float32Array, pico: number) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / m) * pico; return x; };
const fimS = (x: Float32Array, k = 256) => { for (let i = 0; i < Math.min(k, x.length); i++) x[x.length - 1 - i]! *= i / k; return x; };

/** a BATIDA do coração (~0,7 s): as duas bulhas — "tum" grave (55 Hz) e "tum" mais fraco — abafadas, sentidas no peito */
export function sintetizarBatida(sr: number): Float32Array {
  const n = Math.round(sr * 0.75), out = new Float32Array(n), r = prngS(61), aLp = 1 - Math.exp((-2 * Math.PI * 160) / sr);
  let f1 = 0, f2 = 0, lp = 0;
  const dub = CORACAO.dub;
  for (let i = 0; i < n; i++) {
    const t = i / sr, t2 = t - dub;
    f1 += (2 * Math.PI * (52 + 18 * Math.exp(-t * 30))) / sr; f2 += (2 * Math.PI * (60 + 16 * Math.exp(-Math.max(0, t2) * 30))) / sr;
    const e1 = (1 - Math.exp(-t * 400)) * Math.exp(-t * 16), e2 = t2 > 0 ? (1 - Math.exp(-t2 * 400)) * Math.exp(-t2 * 18) * CORACAO.forcaDub : 0;
    lp += (r() * 2 - 1 - lp) * aLp;
    out[i] = Math.sin(f1) * e1 + Math.sin(f2) * e2 + lp * 0.6 * (e1 + e2);
  }
  return normalizarS(fimS(out), 0.85);
}

/** o RAIO (~1,8 s): o estalo elétrico (ruído picotado agudo, rasgando) + o trovão grave rolando depois */
export function sintetizarRaio(sr: number): Float32Array {
  const n = Math.round(sr * 1.8), out = new Float32Array(n), r = prngS(67);
  let lpT = 0, lpT2 = 0, hp = 0, ant = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1;
    hp = 0.9 * (hp + w - ant); ant = w;
    const picote = r() < 0.18 + 0.5 * Math.exp(-t * 30) ? 1 : 0.05;
    const estalo = hp * picote * Math.exp(-t * 9) * (1 - Math.exp(-t * 2000));
    lpT += (w - lpT) * (1 - Math.exp((-2 * Math.PI * 180) / sr)); lpT2 += (lpT - lpT2) * (1 - Math.exp((-2 * Math.PI * 90) / sr));
    const rola = 0.6 + 0.4 * Math.sin(2 * Math.PI * 3.2 * t) * Math.sin(2 * Math.PI * 1.1 * t + 1);
    const trovao = lpT2 * 9 * Math.exp(-Math.max(0, t - 0.08) * 2.2) * Math.min(1, t * 12) * rola;
    out[i] = estalo * 0.9 + trovao;
  }
  return normalizarS(fimS(out, 1024), 0.9);
}
