/**
 * Cyberespaço — o SOM DO CARRO VOADOR (components/cyber/CarroHex) (PURO). Tudo SINTETIZADO no navegador (sem arquivo),
 * como o jato, as asas e a moto (lib/cyber/audio SINTESE). Baseado em como a CULTURA POP fez os seus carros futuristas:
 *  - o SPINNER de Blade Runner 2049 (Mark Mangini): camadas de BULLROARERS girando + uma textura de VIBRAÇÃO grave (peças
 *    de um carro tremendo com um subwoofer) — aqui: `carro-giro` (o "uom-uom" girando, mais rápido com a velocidade) e
 *    `carro-zumbido` (o tremor grave da marcha lenta); e a sensação de LEVITAR do original (os pads do Vangelis) — o
 *    `carro-liga`/`carro-desliga`;
 *  - o LANDSPEEDER de Star Wars (Ben Burtt): o ronco da via expressa gravado através de uma MANGUEIRA de aspirador — o
 *    tubo oco: `carro-turbina` (ruído num filtro pente, as ressonâncias de um tubo) e o `carro-turbo` (o assobio do tubo subindo);
 *  - os light cycles de TRON (Legacy): filtro, ressonância e varreduras de tom, os zumbidos AFINADOS na tonalidade da
 *    música — `carro-tom` (um tom em LÁ com a quinta, num filtro ressonante que respira);
 *  - o Nissan CANTO (o som de alerta dos elétricos da Nissan, "eu canto"; o Leaf foi pensado pra lembrar o spinner):
 *    o tom muda ACELERANDO e DESACELERANDO — `mixDoCarro` sobe/baixa o `carro-tom` com a aceleração.
 * Os outros one-shots: o servo da porta tesoura, a trava, o vidro deslizando (`marcosDaCabine`).
 */

export type NomeSomCarro = "carro-zumbido" | "carro-giro" | "carro-tom" | "carro-turbina" | "carro-ar" | "carro-liga" | "carro-desliga" | "carro-turbo" | "carro-porta" | "carro-fecha" | "carro-vidro";
export const LOOPS_CARRO = ["carro-zumbido", "carro-giro", "carro-tom", "carro-turbina", "carro-ar"] as const;

function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normalizar = (x: Float32Array, pico: number) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / m) * pico; return x; };
const passaBaixa = (fc: number, sr: number) => 1 - Math.exp((-2 * Math.PI * fc) / sr);
/** fecha o loop: a ponta além do fim entra em crossfade de potência constante no começo (sem emenda) */
function fecharLoop(raw: Float32Array, n: number) {
  const x = raw.length - n, out = raw.slice(0, n);
  for (let i = 0; i < x; i++) { const u = i / x; out[i] = raw[i]! * Math.sqrt(u) + raw[n + i]! * Math.sqrt(1 - u); }
  return out;
}
/** um passa-faixa (biquad RBJ) com o centro mudando a cada amostra */
function passaFaixa(sr: number) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x: number, fc: number, q: number) => {
    const w = (2 * Math.PI * fc) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    const b0 = al / a0, b2 = -al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y;
  };
}
/** um passa-baixa RESSONANTE (state-variable — o "filtro de sintetizador" do Tron) */
function passaBaixaRes(sr: number) {
  let lp = 0, bp = 0;
  return (x: number, fc: number, res: number) => { const f = 2 * Math.sin((Math.PI * Math.min(fc, sr / 6)) / sr), q = 1 / res; lp += f * bp; const hp = x - lp - q * bp; bp += f * hp; return lp; };
}
const serra = (fase: number) => ((fase / (2 * Math.PI)) % 1) * 2 - 1;
const fimSemClique = (x: Float32Array, k = 128) => { for (let i = 0; i < Math.min(k, x.length); i++) x[x.length - 1 - i]! *= i / k; return x; };

/** a VIBRAÇÃO grave (loop de 2 s — a textura do spinner de Blade Runner 2049: peças tremendo com um subwoofer): o grave
 *  de 38 Hz, um zumbido de 60 Hz baixinho e o CHOCALHAR (ruído médio em pulsos de 9 Hz) */
export function sintetizarZumbidoCarro(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.3), raw = new Float32Array(n + x), r = prng(81), bf = passaFaixa(sr);
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr, pulso = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 9 * t)), 6);
    raw[i] = 0.7 * Math.sin(2 * Math.PI * 38 * t) + 0.18 * Math.sin(2 * Math.PI * 60 * t) + bf(r() * 2 - 1, 320, 2.5) * 0.9 * pulso;
  }
  return normalizar(fecharLoop(raw, n), 0.65);
}
/** o GIRO (loop de 2 s — os BULLROARERS do spinner): ruído num passa-faixa que gira (o centro e o volume pulsam 6×/s:
 *  o "uom-uom"); a afinação do loop acelera o giro com a velocidade */
export function sintetizarGiroCarro(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.3), raw = new Float32Array(n + x), r = prng(87), bf = passaFaixa(sr), bf2 = passaFaixa(sr);
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr, gira = 2 * Math.PI * 6 * t, w = r() * 2 - 1;
    const centro = 280 + 160 * Math.sin(gira), vol = 0.3 + 0.7 * Math.pow(Math.abs(Math.sin(gira)), 1.5);
    raw[i] = (bf(w, centro, 4) * 1.2 + bf2(w, centro * 2.4, 6) * 0.4) * vol;
  }
  return normalizar(fecharLoop(raw, n), 0.75);
}
/** o TOM (loop de 2 s — o hum afinado do TRON): dentes de serra em LÁ (110 Hz), a QUINTA e a oitava, levemente
 *  desafinados (o batimento), num passa-baixa RESSONANTE que respira devagar */
export function sintetizarTomCarro(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.3), raw = new Float32Array(n + x), lpr = passaBaixaRes(sr);
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr, f = 2 * Math.PI * t;
    const v = serra(f * 110) * 0.5 + serra(f * 110.5) * 0.35 + serra(f * 165) * 0.3 + serra(f * 220.5) * 0.18;
    raw[i] = lpr(v, 700 + 420 * Math.sin(2 * Math.PI * 0.5 * t), 4.5);
  }
  return normalizar(fecharLoop(raw, n), 0.7);
}
/** o TUBO OCO (loop de 2 s — o landspeeder: a via expressa "através de uma mangueira"): ruído grave num FILTRO PENTE
 *  (as ressonâncias de um tubo, ~180 Hz e harmônicos) + um sopro agudo baixinho */
export function sintetizarTurbinaCarro(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.3), raw = new Float32Array(n + x), r = prng(82);
  const atraso = Math.round(sr / 180), buf = new Float32Array(atraso);
  let lp = 0, k = 0, hp = 0, wAnt = 0;
  const a = passaBaixa(1800, sr);
  for (let i = 0; i < raw.length; i++) {
    const w = r() * 2 - 1; lp += (w - lp) * a; hp = 0.85 * (hp + w - wAnt); wAnt = w;
    const y = lp + buf[k]! * 0.82; buf[k] = y; k = (k + 1) % atraso;   // (o pente: o tubo ressoando)
    raw[i] = y * 0.6 + hp * 0.05;
  }
  return normalizar(fecharLoop(raw, n), 0.75);
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
/** LIGA (2,2 s — a LEVITAÇÃO do spinner, os pads do Vangelis): um acorde (lá–mi–lá–si: aberto, flutuante) em dentes de
 *  serra desafinados aos pares, o filtro ABRINDO devagar, e o giro subindo por baixo */
export function sintetizarLigaCarro(sr: number): Float32Array {
  const n = Math.round(sr * 2.2), out = new Float32Array(n), lpr = passaBaixaRes(sr), r = prng(88), bf = passaFaixa(sr);
  const notas = [110, 164.8, 220, 246.9];
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = 2 * Math.PI * t;
    let v = 0; for (const nt of notas) v += serra(f * nt) + serra(f * nt * 1.006);
    const corte = 180 + 3200 * Math.pow(Math.min(1, t / 1.6), 1.6), env = Math.min(1, t / 0.5) * (t < 1.6 ? 1 : Math.exp(-(t - 1.6) * 4));
    const gira = bf(r() * 2 - 1, 150 + 420 * Math.min(1, t / 1.6), 5) * (0.5 + 0.5 * Math.abs(Math.sin(2 * Math.PI * (2 + 4 * t) * t)));
    out[i] = (lpr(v * 0.18, corte, 2.2) + gira * 0.5) * env;
  }
  return normalizar(fimSemClique(out), 0.8);
}
/** DESLIGA (1,6 s): o mesmo acorde CAINDO uma oitava com o filtro fechando */
export function sintetizarDesligaCarro(sr: number): Float32Array {
  const n = Math.round(sr * 1.6), out = new Float32Array(n), lpr = passaBaixaRes(sr), fases = [0, 0, 0, 0];
  const notas = [110, 164.8, 220, 246.9];
  for (let i = 0; i < n; i++) {
    const t = i / sr, cai = Math.pow(0.5, Math.min(1, t / 1.3));
    let v = 0; notas.forEach((nt, k) => { fases[k]! += (2 * Math.PI * nt * cai) / sr; v += serra(fases[k]!); });
    out[i] = lpr(v * 0.2, 2600 * Math.exp(-t * 2.2) + 120, 2) * Math.min(1, t / 0.03) * Math.exp(-t * 1.6);
  }
  return normalizar(fimSemClique(out), 0.7);
}
/** TURBO (1,0 s — o tubo do landspeeder ASSOBIANDO): ruído no filtro pente com o tubo encurtando (a ressonância sobe
 *  de 140 a 620 Hz) + o sopro */
export function sintetizarTurboCarro(sr: number): Float32Array {
  const n = Math.round(sr * 1.0), out = new Float32Array(n), r = prng(89), max = Math.round(sr / 140), buf = new Float32Array(max);
  let k = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = 140 * Math.pow(620 / 140, Math.min(1, t / 0.7)), atraso = Math.max(2, Math.round(sr / f));
    const w = r() * 2 - 1; lp += (w - lp) * 0.3;
    const y = lp + buf[(k - atraso + max) % max]! * 0.88; buf[k] = y; k = (k + 1) % max;
    out[i] = y * Math.min(1, t / 0.05) * (t < 0.7 ? 1 : Math.exp(-(t - 0.7) * 8));
  }
  return normalizar(fimSemClique(out), 0.75);
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
  "carro-zumbido": sintetizarZumbidoCarro, "carro-giro": sintetizarGiroCarro, "carro-tom": sintetizarTomCarro, "carro-turbina": sintetizarTurbinaCarro, "carro-ar": sintetizarArCarro,
  "carro-liga": sintetizarLigaCarro, "carro-desliga": sintetizarDesligaCarro, "carro-turbo": sintetizarTurboCarro, "carro-porta": sintetizarPortaCarro, "carro-fecha": sintetizarFechaCarro, "carro-vidro": sintetizarVidroCarro,
};

/** a MISTURA dos loops: `ligado` 0..1, `vel` (m/s), `potencia` 0..1 (o acelerador) e `acel` −1..1 (acelerando /
 *  desacelerando — o CANTO: o tom sobe acelerando e desce freando). Parado ligado: a vibração grave e o tom baixinho;
 *  andando: o giro acelera, o tom sobe, o tubo e o vento crescem */
export function mixDoCarro(o: { ligado: number; vel: number; potencia: number; acel?: number }): Record<(typeof LOOPS_CARRO)[number], { vol: number; taxa: number }> {
  const l = Math.max(0, Math.min(1, o.ligado)), v = Math.min(1, Math.max(0, o.vel) / 45), p = Math.max(0, Math.min(1, o.potencia)), a = Math.max(-1, Math.min(1, o.acel ?? 0));
  return {
    "carro-zumbido": { vol: l * (0.55 - 0.3 * v), taxa: 1 + 0.25 * p },
    "carro-giro": { vol: l * (0.25 + 0.5 * v), taxa: 0.65 + 0.95 * v },
    "carro-tom": { vol: l * (0.28 + 0.3 * Math.max(p, v)), taxa: 0.85 + 0.55 * v + 0.07 * a },
    "carro-turbina": { vol: l * (0.12 + 0.55 * Math.max(p * 0.7, v)), taxa: 0.8 + 0.5 * v },
    "carro-ar": { vol: l * 0.7 * Math.pow(v, 1.4), taxa: 0.85 + 0.35 * v },
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
