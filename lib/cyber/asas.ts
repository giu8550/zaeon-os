/**
 * Cyberespaço — as ASAS NEGRAS DE ANJO (do founder, no lugar da mochila a jato) — a parte PURA: o que as asas estão
 * fazendo (estado de voo → abertura, batida, eventos) e os SONS delas, sintetizados no navegador (como o jato e a moto:
 * lib/cyber/audio SINTESE). O desenho e as juntas ficam em components/cyber/AsasAnjo.
 *
 * Os modos (a física do voo é a MESMA da mochila — lib/cyber/jet; aqui só muda o corpo e o som):
 *  - CHÃO: ABERTAS (sempre imponentes — o dono preferiu a recolhida não), só respirando devagar;
 *  - SUBINDO (segurando o ESPAÇO): abertas, BATENDO forte (~2,6 Hz) — cada descida é um "vush";
 *  - VOANDO PRA FRENTE: abertas, batidas lentas e largas;
 *  - PLANANDO (soltou o ESPAÇO): abertas, quase paradas (só ondulam) — vento contínuo;
 *  - MERGULHO (caindo rápido): meio fechadas, sem bater.
 * Eventos: ABRIU (decolou), FECHOU (pousou), BATEU (começo de cada descida da asa).
 */

export type EntradaAsas = { noAr: boolean; empuxo: number; vy: number; movendo: boolean };
export type EstadoAsas = { abertura: number; fase: number; amp: number; freq: number; noAr: boolean; t: number };
export type ModoAsas = "chao" | "sobe" | "frente" | "plana" | "mergulho";
export type SaidaAsas = { e: EstadoAsas; modo: ModoAsas; bateu: boolean; abriu: boolean; fechou: boolean; /** o ângulo da batida agora (rad, + = asa pra cima) */ batida: number };

export const ASAS = {
  /** batidas por segundo e amplitude (rad) de cada modo */
  sobe: { freq: 2.6, amp: 0.62 }, frente: { freq: 1.5, amp: 0.42 }, plana: { freq: 0.55, amp: 0.07 }, chao: { freq: 0.3, amp: 0.045 },
  /** a abertura no mergulho (meio fechadas) */
  aberturaMergulho: 0.5,
  /** quão rápido abre/fecha (1/s) e a amplitude/frequência mudam */
  abre: 5, fecha: 3.2, ajuste: 4,
  /** abaixo disso a batida não faz som (é só ondulação) */
  ampSom: 0.2,
  /** vy (m/s) abaixo do qual soltar o espaço vira mergulho */
  quedaMergulho: -7,
} as const;

export const ASAS_INICIO: EstadoAsas = { abertura: 1, fase: 0, amp: 0, freq: ASAS.chao.freq, noAr: false, t: 0 };

export function modoDasAsas(i: EntradaAsas): ModoAsas {
  if (!i.noAr) return "chao";
  if (i.empuxo >= 0.95) return "sobe";
  if (i.vy < ASAS.quedaMergulho && i.empuxo < 0.5) return "mergulho";
  if (i.movendo && i.empuxo >= 0.6) return "frente";
  return "plana";
}

/** um passo: aproxima abertura/amplitude/frequência do modo, avança a fase da batida e diz o que aconteceu */
export function passoAsas(e: EstadoAsas, i: EntradaAsas, dt: number): SaidaAsas {
  const modo = modoDasAsas(i);
  const alvo = modo === "chao" ? ASAS.chao : modo === "mergulho" ? { freq: 0, amp: 0 } : ASAS[modo];
  const alvoAbertura = modo === "mergulho" ? ASAS.aberturaMergulho : 1;   // abertas sempre (só o mergulho fecha um pouco)
  const k = (v: number) => Math.min(1, dt * v);
  const abertura = e.abertura + (alvoAbertura - e.abertura) * k(alvoAbertura > e.abertura ? ASAS.abre : ASAS.fecha);
  const amp = e.amp + (alvo.amp - e.amp) * k(ASAS.ajuste), freq = e.freq + (alvo.freq - e.freq) * k(ASAS.ajuste);
  const fase0 = e.fase, fase = fase0 + 2 * Math.PI * freq * dt;
  // a DESCIDA começa quando a fase passa por um múltiplo de 2π (cos no máximo = asa lá em cima)
  const bateu = Math.floor(fase / (2 * Math.PI)) > Math.floor(fase0 / (2 * Math.PI)) && amp >= ASAS.ampSom && i.noAr;
  const abriu = i.noAr && !e.noAr, fechou = !i.noAr && e.noAr;
  return { e: { abertura, fase: fase % (2 * Math.PI * 1000), amp, freq, noAr: i.noAr, t: e.t + dt }, modo, bateu, abriu, fechou, batida: amp * Math.cos(fase) };
}

/** o vento nas penas (loop): alto planando/voando pra frente, baixo batendo, nada no chão */
export function ventoDasAsas(modo: ModoAsas, velHoriz: number): number {
  if (modo === "chao") return 0;
  const v = Math.min(1, velHoriz / 10);
  return modo === "plana" ? 0.45 + 0.4 * v : modo === "mergulho" ? 0.9 : modo === "frente" ? 0.35 + 0.45 * v : 0.2;
}

// ── os SONS (mono, gerados no 1º gesto) ─────────────────────────────────────────────────────────────────────────────
function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normalizar = (x: Float32Array, pico: number) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / m) * pico; return x; };
const passaBaixa = (fc: number, sr: number) => 1 - Math.exp((-2 * Math.PI * fc) / sr);
const fimSemClique = (x: Float32Array, k = 128) => { for (let i = 0; i < Math.min(k, x.length); i++) x[x.length - 1 - i]! *= i / k; return x; };

/** BATIDA de asa (~0,45 s): o "vush" — ar empurrado (ruído passa-banda que abre e fecha) + o baque grave do ar
 *  deslocado + o farfalhar das penas (ruído agudo picotado) no começo */
export function sintetizarBaterAsa(sr: number): Float32Array {
  const n = Math.round(sr * 0.45), out = new Float32Array(n), r = prng(41);
  let lpA = 0, lpB = 0, lpGrave = 0, fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1;
    // o "vush": passa-banda cuja frequência sobe e desce com o golpe
    const fc = 260 + 900 * Math.sin(Math.min(1, t / 0.3) * Math.PI);
    lpA += (w - lpA) * passaBaixa(fc * 1.6, sr); lpB += (lpA - lpB) * passaBaixa(fc * 0.6, sr);
    const banda = lpA - lpB, envVush = Math.pow(Math.sin(Math.min(1, t / 0.38) * Math.PI), 1.6);
    // o baque do ar (grave, curto)
    fase += (2 * Math.PI * (62 + 30 * Math.exp(-t * 20))) / sr; lpGrave += (w - lpGrave) * passaBaixa(140, sr);
    const envGrave = (1 - Math.exp(-t * 300)) * Math.exp(-t * 14);
    // farfalhar: agudo picotado, só no começo
    const picote = r() < 0.35 ? 1 : 0.2, farfalha = (w - lpA) * picote * Math.exp(-t * 16) * 0.25;
    out[i] = banda * envVush * 2.6 + (Math.sin(fase) * 0.5 + lpGrave * 1.4) * envGrave + farfalha;
  }
  return normalizar(fimSemClique(out), 0.85);
}

/** VENTO nas penas (loop de 3 s): sopro suave, com rajadas lentas — toca planando */
export function sintetizarVentoAsas(sr: number, seg = 3): Float32Array {
  const n = Math.round(sr * seg), x = Math.round(sr * 0.3), raw = new Float32Array(n + x), r = prng(43);
  let lp1 = 0, lp2 = 0, hp = 0, ant = 0;
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr, w = r() * 2 - 1;
    lp1 += (w - lp1) * passaBaixa(1400, sr); lp2 += (lp1 - lp2) * passaBaixa(700, sr); hp = 0.9 * (hp + lp1 - ant); ant = lp1;
    const rajada = 0.65 + 0.35 * Math.sin(2 * Math.PI * (t / seg) * 2) * Math.sin(2 * Math.PI * (t / seg) * 3 + 1);
    raw[i] = (lp2 * 1.8 + hp * 0.5) * rajada;
  }
  const out = raw.slice(0, n);
  for (let i = 0; i < x; i++) { const u = i / x; out[i] = raw[i]! * Math.sqrt(u) + raw[n + i]! * Math.sqrt(1 - u); }
  return normalizar(out, 0.7);
}

/** ABRIR as asas (~0,8 s): o tecido de penas se desdobrando — farfalhar crescente que termina num "vuuf" aberto */
export function sintetizarAbrirAsas(sr: number): Float32Array {
  const n = Math.round(sr * 0.8), out = new Float32Array(n), r = prng(47);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1, u = t / 0.8;
    lp += (w - lp) * passaBaixa(500 + 2600 * u, sr); lp2 += (lp - lp2) * passaBaixa(300 + 800 * u, sr);
    const farfalha = (w - lp) * (r() < 0.25 + 0.5 * u ? 1 : 0.15) * 0.3 * Math.sin(Math.min(1, u * 1.2) * Math.PI);
    const vuuf = (lp - lp2) * 2.2 * Math.pow(Math.sin(Math.max(0, Math.min(1, (u - 0.45) / 0.55)) * Math.PI), 1.3);
    out[i] = farfalha + vuuf;
  }
  return normalizar(fimSemClique(out), 0.75);
}

/** FECHAR as asas (~0,5 s): farfalhar descendo + um "fop" abafado das penas assentando */
export function sintetizarFecharAsas(sr: number): Float32Array {
  const n = Math.round(sr * 0.5), out = new Float32Array(n), r = prng(53);
  let lp = 0, lpG = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = r() * 2 - 1, u = t / 0.5;
    lp += (w - lp) * passaBaixa(2400 - 1900 * u, sr); lpG += (w - lpG) * passaBaixa(180, sr);
    const farfalha = (w - lp) * (r() < 0.6 - 0.4 * u ? 1 : 0.1) * 0.35 * Math.exp(-u * 2.5);
    const fop = lpG * 1.6 * (u > 0.55 ? Math.exp(-(u - 0.55) * 14) * Math.min(1, (u - 0.55) * 60) : 0);
    out[i] = farfalha + lp * 0.4 * Math.exp(-u * 4) + fop;
  }
  return normalizar(fimSemClique(out), 0.7);
}

export const SINTESE_ASAS = { "asa-bater": sintetizarBaterAsa, "asa-vento": sintetizarVentoAsas, "asa-abrir": sintetizarAbrirAsas, "asa-fechar": sintetizarFecharAsas } as const;
export type NomeSomAsas = keyof typeof SINTESE_ASAS;
