/**
 * Cyberespaço — o SOM DO CARRO VOADOR (components/cyber/CarroHex) (PURO). Tudo SINTETIZADO no navegador (sem arquivo),
 * como o jato, as asas e a moto (lib/cyber/audio SINTESE). Baseado em como a CULTURA POP fez os seus carros futuristas:
 *  - o SPINNER de Blade Runner 2049 (Mark Mangini): camadas de BULLROARERS girando + uma textura de VIBRAÇÃO grave (peças
 *    de um carro tremendo com um subwoofer) — aqui: `carro-giro` (o "uom-uom" girando, mais rápido com a velocidade) e
 *    `carro-zumbido` (o tremor grave da marcha lenta); e a sensação de LEVITAR do original (os pads do Vangelis) — o
 *    `carro-liga`/`carro-desliga`;
 *  - o LANDSPEEDER de Star Wars (Ben Burtt): o ronco da via expressa gravado através de uma MANGUEIRA de aspirador — o
 *    tubo oco: `carro-turbina` (ruído num filtro pente, as ressonâncias de um tubo);
 *  - os light cycles de TRON (Legacy): filtro, ressonância e varreduras de tom, os zumbidos AFINADOS na tonalidade da
 *    música — `carro-tom` (um tom em LÁ com a quinta, num filtro ressonante que respira);
 *  - o Nissan CANTO (o som de alerta dos elétricos da Nissan, "eu canto"; o Leaf foi pensado pra lembrar o spinner):
 *    o tom muda ACELERANDO e DESACELERANDO — `mixDoCarro` sobe/baixa o `carro-tom` com a aceleração;
 *  - o NITRO (`carro-turbo`): o pós-combustor de ficção — baque grave, sopro macio abrindo e um assobio limpo subindo.
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
 *  de 38 Hz, o mesmo tremor SATURADO uma oitava acima (76 Hz com os harmônicos ímpares — é o que um alto-falante de
 *  notebook/celular consegue tocar: sem eles o grave some) e o CHOCALHAR (ruído médio em pulsos de 9 Hz) */
export function sintetizarZumbidoCarro(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.3), raw = new Float32Array(n + x), r = prng(81), bf = passaFaixa(sr);
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr, pulso = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 9 * t)), 6);
    raw[i] = 0.5 * Math.sin(2 * Math.PI * 38 * t) + 0.32 * Math.tanh(3 * Math.sin(2 * Math.PI * 76 * t)) + bf(r() * 2 - 1, 520, 2.5) * 1.6 * pulso;
  }
  return normalizar(fecharLoop(raw, n), 0.65);
}
/** o GIRO (loop de 2 s — os BULLROARERS do spinner): ruído num passa-faixa que gira (o centro e o volume pulsam 6×/s:
 *  o "uom-uom"); a afinação do loop acelera o giro com a velocidade */
export function sintetizarGiroCarro(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.3), raw = new Float32Array(n + x), r = prng(87), bf = passaFaixa(sr), bf2 = passaFaixa(sr);
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr, gira = 2 * Math.PI * 6 * t, w = r() * 2 - 1;
    const centro = 440 + 240 * Math.sin(gira), vol = 0.3 + 0.7 * Math.pow(Math.abs(Math.sin(gira)), 1.5);
    raw[i] = (bf(w, centro, 4) * 1.2 + bf2(w, centro * 2.4, 6) * 0.4) * vol;
  }
  return normalizar(fecharLoop(raw, n), 0.75);
}
/** o TOM (loop de 2 s — o hum afinado do TRON): dentes de serra em LÁ (220 Hz), a QUINTA e a oitava, levemente
 *  desafinados (o batimento), num passa-baixa RESSONANTE que respira devagar */
export function sintetizarTomCarro(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.3), raw = new Float32Array(n + x), lpr = passaBaixaRes(sr);
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr, f = 2 * Math.PI * t;
    const v = serra(f * 220) * 0.5 + serra(f * 220.5) * 0.35 + serra(f * 330) * 0.3 + serra(f * 440.5) * 0.18;
    raw[i] = lpr(v, 1100 + 400 * Math.sin(2 * Math.PI * 0.5 * t), 2.2);
  }
  return normalizar(fecharLoop(raw, n), 0.7);
}
/** o TUBO OCO (loop de 2 s — o landspeeder: a via expressa "através de uma mangueira"): ruído grave num FILTRO PENTE
 *  (as ressonâncias de um tubo, ~360 Hz e harmônicos) + um sopro agudo baixinho */
export function sintetizarTurbinaCarro(sr: number): Float32Array {
  const n = sr * 2, x = Math.round(sr * 0.3), raw = new Float32Array(n + x), r = prng(82);
  const atraso = Math.round(sr / 360), buf = new Float32Array(atraso);
  let lp = 0, k = 0, hp = 0, wAnt = 0;
  const a = passaBaixa(2600, sr);
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
/** NITRO (1,6 s — o pós-combustor de ficção: o "salto" do Millennium Falcon / o boost do Podracer, sem chiado): um BAQUE
 *  grave que cai (o tranco no peito), um SOPRO de ar com o filtro ABRINDO e fechando (o empurrão — ruído rosado, macio,
 *  nada de pente metálico) e um ASSOBIO limpo subindo uma oitava (seno com um pouco de vibrato e a quinta por cima),
 *  que fica e some devagar */
export function sintetizarTurboCarro(sr: number): Float32Array {
  const n = Math.round(sr * 1.6), out = new Float32Array(n), r = prng(89);
  let fBaque = 0, fAss = 0, lp1 = 0, lp2 = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // o baque: 95 → 42 Hz em ~0,2 s, saturado de leve (os harmônicos fazem ele chegar no alto-falante pequeno)
    fBaque += (2 * Math.PI * (42 + 53 * Math.exp(-t * 14))) / sr;
    const baque = Math.tanh(2.2 * Math.sin(fBaque)) * Math.exp(-t * 7) * Math.min(1, t / 0.004);
    // o sopro: ruído ROSADO (Paul Kellet, simplificado) num passa-baixa de 2 polos que abre 300 → 3800 Hz e volta
    const w = r() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
    const rosa = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    const abre = Math.sin(Math.PI * Math.min(1, t / 1.3)), fc = 300 + 3500 * abre * abre, a = passaBaixa(fc, sr);
    lp1 += (rosa - lp1) * a; lp2 += (lp1 - lp2) * a;
    const sopro = lp2 * Math.min(1, t / 0.08) * Math.exp(-Math.max(0, t - 0.5) * 2.4);
    // o assobio: 330 → 660 Hz (uma oitava, em LÁ/MI com o tom do carro), vibrato de 5 Hz, a quinta baixinha
    const f = 330 * Math.pow(2, Math.min(1, t / 0.9)) * (1 + 0.006 * Math.sin(2 * Math.PI * 5 * t));
    fAss += (2 * Math.PI * f) / sr;
    const assobio = (Math.sin(fAss) + 0.25 * Math.sin(fAss * 1.5)) * Math.min(1, Math.max(0, t - 0.06) / 0.35) * Math.exp(-Math.max(0, t - 0.8) * 3.2);
    out[i] = baque * 0.85 + sopro * 1.6 + assobio * 0.22;
  }
  return normalizar(fimSemClique(out, 512), 0.8);
}
/** PORTA subindo (1,0 s) — som de PORTA, não de motor (nada de zumbido afinado): a TRAVA soltando (um clique seco
 *  com um brilho metálico), o CHIADO pneumático do amortecedor a gás (ruído agudo num passa-faixa que desce 3,2 → 1,6 kHz,
 *  sobe rápido e esvai), o "fuuu" macio do ar deslocado por baixo, e o BATENTE abafado quando chega em cima */
export function sintetizarPortaCarro(sr: number): Float32Array {
  const n = Math.round(sr * 1.0), out = new Float32Array(n), r = prng(84), bf = passaFaixa(sr), a = passaBaixa(380, sr);
  let lp = 0, fBat = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1;
    const trava = t < 0.03 ? w * Math.exp(-t * 220) * 0.9 + Math.sin(2 * Math.PI * 2400 * t) * 0.35 * Math.exp(-t * 90) : 0;
    const chiado = bf(w, 3200 - 1600 * Math.min(1, t / 0.75), 1.4) * Math.min(1, Math.max(0, t - 0.02) / 0.08) * Math.exp(-Math.max(0, t - 0.12) * 3.2);
    lp += (w - lp) * a; const ar = lp * Math.sin(Math.PI * Math.min(1, t / 0.8)) * 1.4;
    const tb = t - 0.78; let batente = 0;
    if (tb > 0) { fBat += (2 * Math.PI * (95 + 50 * Math.exp(-tb * 40))) / sr; batente = Math.sin(fBat) * Math.exp(-tb * 22) * 0.6 + w * 0.2 * Math.exp(-tb * 160); }
    out[i] = trava + chiado * 0.9 + ar + batente;
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
    "carro-zumbido": { vol: l * (0.75 - 0.35 * v), taxa: 1 + 0.25 * p },
    "carro-giro": { vol: l * (0.25 + 0.5 * v), taxa: 0.65 + 0.95 * v },
    "carro-tom": { vol: l * (0.4 + 0.35 * Math.max(p, v)), taxa: 0.85 + 0.55 * v + 0.07 * a },
    "carro-turbina": { vol: l * (0.2 + 0.6 * Math.max(p * 0.7, v)), taxa: 0.8 + 0.5 * v },
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
