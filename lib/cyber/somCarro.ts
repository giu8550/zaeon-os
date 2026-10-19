/**
 * Cyberespaço — o SOM DO CARRO VOADOR (components/cyber/CarroHex) (PURO). Tudo SINTETIZADO no navegador (sem arquivo),
 * como o jato, as asas e a moto (lib/cyber/audio SINTESE). O carro é ELÉTRICO e paira com propulsores — nada de
 * motor a combustão: o que soa é o ar e a eletrônica.
 *
 * Os LOOPS (afinados/misturados por `mixDoCarro` a cada quadro):
 *  - `carro-zumbido`: o zumbido elétrico grave do sistema ligado (o "hum" dos inversores, 2 harmônicos e um batimento lento);
 *  - `carro-turbina`: os PROPULSORES — o ar dos dutos (ruído encorpado) + o ASSOBIO das pás (o tom que sobe com a
 *    potência: a afinação do loop acompanha a velocidade/aceleração);
 *  - `carro-ar`: o VENTO na carroceria, só andando rápido.
 * Os ONE-SHOTS (eventos):
 *  - `carro-liga` (ligou: os inversores sobem num "uíííp" + um acorde curto da eletrônica) e `carro-desliga` (cai e apaga);
 *  - `carro-porta` (o servo da porta tesoura subindo + o chiado pneumático do fim) e `carro-fecha` (o "tum" abafado da
 *    trava + um clique);
 *  - `carro-vidro` (o hexágono do vidro destravando e deslizando: um clique + o deslize + um brilho de cristal).
 * `marcosDaCabine` diz QUANDO (no 0..1 da abertura — a mesma ordem do CarroHex) cada one-shot sai.
 */

export type NomeSomCarro = "carro-zumbido" | "carro-turbina" | "carro-ar" | "carro-liga" | "carro-desliga" | "carro-porta" | "carro-fecha" | "carro-vidro";
export const LOOPS_CARRO = ["carro-zumbido", "carro-turbina", "carro-ar"] as const;

function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normalizar = (x: Float32Array, pico: number) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / m) * pico; return x; };
const passaBaixa = (fc: number, sr: number) => 1 - Math.exp((-2 * Math.PI * fc) / sr);
/** fecha o loop: a ponta além do fim entra em crossfade de potência constante no começo (sem emenda) */
function fecharLoop(raw: Float32Array, n: number) {
  const x = raw.length - n, out = raw.slice(0, n);
  for (let i = 0; i < x; i++) { const u = i / x; out[i] = raw[i]! * Math.sqrt(u) + raw[n + i]! * Math.sqrt(1 - u); }
  return out;
}
const fimSemClique = (x: Float32Array, k = 128) => { for (let i = 0; i < Math.min(k, x.length); i++) x[x.length - 1 - i]! *= i / k; return x; };

/** ZUMBIDO elétrico (loop de 2 s): 60 + 120 Hz com um batimento lento (o 2º um tiquinho desafinado) e um chiado fino */
export function sintetizarZumbidoCarro(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.3), raw = new Float32Array(n + x), r = prng(81), a = passaBaixa(3000, sr);
  let lp = 0;
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr; lp += ((r() * 2 - 1) - lp) * a;
    raw[i] = 0.55 * Math.sin(2 * Math.PI * 60 * t) + 0.35 * Math.sin(2 * Math.PI * 120.5 * t) + 0.12 * Math.sin(2 * Math.PI * 240 * t) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.5 * t)) + 0.04 * lp;
  }
  return normalizar(fecharLoop(raw, n), 0.6);
}
/** os PROPULSORES (loop de 2 s): o ar dos dutos (ruído passa-banda encorpado) + o ASSOBIO das pás (420 Hz com 2
 *  harmônicos e um vibrato leve — a afinação do loop sobe com a potência) */
export function sintetizarTurbinaCarro(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.3), raw = new Float32Array(n + x), r = prng(82);
  let lp1 = 0, lp2 = 0, fase = 0;
  const a1 = passaBaixa(1600, sr), a2 = passaBaixa(500, sr);
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr, w = r() * 2 - 1; lp1 += (w - lp1) * a1; lp2 += (lp1 - lp2) * a2;
    fase += (2 * Math.PI * (420 + 6 * Math.sin(2 * Math.PI * 3 * t))) / sr;
    const assobio = 0.16 * Math.sin(fase) + 0.07 * Math.sin(fase * 2) + 0.035 * Math.sin(fase * 3.01);
    raw[i] = (lp1 - lp2) * 2.2 + lp2 * 0.9 + assobio;
  }
  return normalizar(fecharLoop(raw, n), 0.8);
}
/** o VENTO na carroceria (loop de 3 s): ruído passa-baixa com rajadas lentas */
export function sintetizarArCarro(sr: number): Float32Array {
  const n = sr * 3, x = Math.round(sr * 0.4), raw = new Float32Array(n + x), r = prng(83);
  let lp1 = 0, lp2 = 0;
  const a1 = passaBaixa(1100, sr), a2 = passaBaixa(1700, sr);
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr; lp1 += ((r() * 2 - 1) - lp1) * a1; lp2 += (lp1 - lp2) * a2;
    raw[i] = lp2 * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.45 * t + Math.sin(2 * Math.PI * 0.17 * t) * 2));
  }
  return normalizar(fecharLoop(raw, n), 0.7);
}
/** LIGA (1,4 s): os inversores subindo (90 → 520 Hz, exponencial) + o acorde curto da eletrônica (dó-mi-sol agudo) */
export function sintetizarLigaCarro(sr: number): Float32Array {
  const n = Math.round(sr * 1.4), out = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, u = t / 1.4, f = 90 * Math.pow(520 / 90, Math.min(1, t / 0.9));
    fase += (2 * Math.PI * f) / sr;
    const sobe = (Math.sin(fase) * 0.6 + Math.sin(fase * 2) * 0.25) * Math.min(1, t / 0.05) * (1 - 0.6 * Math.max(0, (t - 0.9) / 0.5));
    const acorde = t > 0.85 ? [1046.5, 1318.5, 1568].reduce((s, fr, k) => s + Math.sin(2 * Math.PI * fr * (t - 0.85) + k) * 0.16, 0) * Math.exp(-(t - 0.85) * 5) : 0;
    out[i] = (sobe + acorde) * (1 - Math.pow(u, 8));
  }
  return normalizar(fimSemClique(out), 0.8);
}
/** DESLIGA (1,1 s): o tom caindo (480 → 70 Hz) e apagando */
export function sintetizarDesligaCarro(sr: number): Float32Array {
  const n = Math.round(sr * 1.1), out = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = 480 * Math.pow(70 / 480, Math.min(1, t / 1.0));
    fase += (2 * Math.PI * f) / sr;
    out[i] = (Math.sin(fase) * 0.6 + Math.sin(fase * 2) * 0.2) * Math.min(1, t / 0.02) * Math.exp(-t * 2.2);
  }
  return normalizar(fimSemClique(out), 0.7);
}
/** PORTA subindo (1,0 s): o SERVO (dente de serra filtrado, 150 → 210 Hz, com o motorzinho tremendo) + o CHIADO
 *  pneumático no fim do curso */
export function sintetizarPortaCarro(sr: number): Float32Array {
  const n = Math.round(sr * 1.0), out = new Float32Array(n), r = prng(84), a = passaBaixa(1400, sr);
  let fase = 0, lp = 0, hp = 0, wAnt = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = 150 + 60 * Math.min(1, t / 0.7);
    fase += (2 * Math.PI * f) / sr;
    const serra = ((fase / (2 * Math.PI)) % 1) * 2 - 1; lp += (serra - lp) * a;
    const servo = lp * (0.55 + 0.1 * Math.sin(2 * Math.PI * 23 * t)) * Math.min(1, t / 0.04) * (t < 0.72 ? 1 : Math.exp(-(t - 0.72) * 18));
    const w = r() * 2 - 1; hp = 0.8 * (hp + w - wAnt); wAnt = w;
    const chiado = t > 0.66 ? hp * 0.35 * Math.exp(-(t - 0.66) * 7) : 0;
    out[i] = servo + chiado;
  }
  return normalizar(fimSemClique(out), 0.7);
}
/** FECHA (0,35 s): o "tum" abafado da trava (70 Hz caindo) + o clique */
export function sintetizarFechaCarro(sr: number): Float32Array {
  const n = Math.round(sr * 0.35), out = new Float32Array(n), r = prng(85);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr; fase += (2 * Math.PI * (70 + 40 * Math.exp(-t * 30))) / sr;
    out[i] = Math.sin(fase) * Math.exp(-t * 16) + (r() * 2 - 1) * 0.5 * Math.exp(-t * 260);
  }
  return normalizar(fimSemClique(out, 64), 0.85);
}
/** o VIDRO destravando e deslizando (0,7 s): um clique, o deslize (ruído fino subindo) e um brilho de cristal */
export function sintetizarVidroCarro(sr: number): Float32Array {
  const n = Math.round(sr * 0.7), out = new Float32Array(n), r = prng(86);
  let hp = 0, wAnt = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1; hp = 0.9 * (hp + w - wAnt); wAnt = w; lp += (hp - lp) * 0.25;
    const clique = t < 0.012 ? (r() * 2 - 1) * (1 - t / 0.012) : 0;
    const desliza = lp * 0.35 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.05) / 0.5)));
    const cristal = t > 0.08 ? (Math.sin(2 * Math.PI * 1760 * t) * 0.12 + Math.sin(2 * Math.PI * 2637 * t) * 0.07) * Math.exp(-(t - 0.08) * 6) : 0;
    out[i] = clique + desliza + cristal;
  }
  return normalizar(fimSemClique(out), 0.6);
}
export const SINTESE_CARRO: Record<NomeSomCarro, (sr: number) => Float32Array> = {
  "carro-zumbido": sintetizarZumbidoCarro, "carro-turbina": sintetizarTurbinaCarro, "carro-ar": sintetizarArCarro,
  "carro-liga": sintetizarLigaCarro, "carro-desliga": sintetizarDesligaCarro, "carro-porta": sintetizarPortaCarro, "carro-fecha": sintetizarFechaCarro, "carro-vidro": sintetizarVidroCarro,
};

/** a MISTURA dos loops: `ligado` 0..1 (sobe/desce suave), `vel` (m/s) e `potencia` 0..1 (o acelerador). O zumbido só
 *  ligado; a turbina sempre que ligado (mais alta e mais aguda com a potência e a velocidade); o vento com a velocidade */
export function mixDoCarro(o: { ligado: number; vel: number; potencia: number }): Record<(typeof LOOPS_CARRO)[number], { vol: number; taxa: number }> {
  const l = Math.max(0, Math.min(1, o.ligado)), v = Math.min(1, Math.max(0, o.vel) / 45), p = Math.max(0, Math.min(1, o.potencia));
  return {
    "carro-zumbido": { vol: 0.5 * l, taxa: 0.95 + 0.1 * p },
    "carro-turbina": { vol: l * (0.32 + 0.38 * Math.max(p, v)), taxa: 0.8 + 0.55 * v + 0.25 * p },
    "carro-ar": { vol: l * 0.75 * Math.pow(v, 1.4), taxa: 0.85 + 0.35 * v },
  };
}

/** QUANDO cada one-shot da cabine sai (no 0..1 da abertura — os mesmos tempos do CarroHex `abrir`): a porta do
 *  motorista no começo, os vidros em cascata e a porta do passageiro; FECHANDO (descendo), a trava das portas quando
 *  chegam embaixo. `vidros` = quantos hexágonos do vidro abrem */
export function marcosDaCabine(vidros: number): { k: number; som: NomeSomCarro; subindo: boolean }[] {
  const m: { k: number; som: NomeSomCarro; subindo: boolean }[] = [{ k: 0.001, som: "carro-porta", subindo: true }];
  for (let i = 0; i < vidros; i++) m.push({ k: 0.2 + (vidros > 1 ? (i / (vidros - 1)) * 0.22 : 0) + 0.005, som: "carro-vidro", subindo: true });
  m.push({ k: 0.555, som: "carro-porta", subindo: true });
  m.push({ k: 0.56, som: "carro-fecha", subindo: false }, { k: 0.01, som: "carro-fecha", subindo: false });   // (fechando: a do passageiro trava, depois a do motorista)
  for (let i = 0; i < vidros; i++) m.push({ k: 0.2 + (vidros > 1 ? (i / (vidros - 1)) * 0.22 : 0) + 0.38, som: "carro-vidro", subindo: false });
  return m;
}
/** os one-shots cruzados entre o `antes` e o `agora` da abertura (abrindo, os que sobem; fechando, os que descem) */
export function sonsDaCabine(antes: number, agora: number, vidros: number): NomeSomCarro[] {
  if (agora === antes) return [];
  const sobe = agora > antes;
  return marcosDaCabine(vidros).filter((m) => m.subindo === sobe && (sobe ? antes < m.k && agora >= m.k : antes > m.k && agora <= m.k)).map((m) => m.som);
}
