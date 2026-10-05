/**
 * Cyberespaço — regras PURAS do áudio (o three fica em components/cyber/AudioCyber.ts):
 *  - os 21 sons (arquivos) + 2 SINTETIZADOS no código (jato contínuo da mochila, baque do pouso) e COMO tocam
 *    (posicional MONO preso a um objeto × 2D estéreo/UI);
 *  - preferências do usuário (`zaeon_sfx` liga/desliga, `zaeon_volume` mestre 0..1);
 *  - modelo de distância (some longe), teto de vozes simultâneas, cadência de passos;
 *  - o leito ambiente "abaixa" enquanto a música da intro toca (cross-fade quando ela fadeia).
 */
export const PASTA_SONS = "/assets/sounds/cyber/";

export type NomeSom =
  | "space-bed" | "blackhole-hum" | "crystals" | "ship-flight" | "ship-idle"
  | "ship-takeoff" | "ship-landing" | "ship-touchdown" | "step-1" | "step-2" | "step-3" | "jump" | "land"
  | "near-ping" | "neuron-chime" | "rise" | "cyber-enter" | "study-confirm" | "chat-pop" | "join" | "leave"
  | "jetpack" | "jato-sopro" | "baque";

/** afinação 432 Hz: a faixa do leito (danamusic) é gravada em A=440 (medido: +0,1 cent) — tocada a 432/440 vira A=432 */
export const TAXA_432 = 432 / 440;

/** como cada som toca: `pos` = PositionalAudio (mono, no mundo); `2d` = THREE.Audio (leito/UI); `taxa` = playbackRate */
/** `emendar` = segundos de crossfade da ponta no começo (vira loop sem emenda ao carregar); `filtro` = passa-baixa (Hz) */
export const SONS: Record<NomeSom, { modo: "pos" | "2d"; loop: boolean; volume: number; taxa?: number; sintetico?: boolean; ext?: "wav"; emendar?: number; filtro?: number }> = {
  // JATO da mochila (contínuo enquanto se segura o ESPAÇO) em 2 camadas: o ronco gravado ("Rocket Engine", CC0,
  // OpenGameArt — WAV mono, loop sem emenda) + o sopro/chiado sintetizado por cima
  jetpack: { modo: "pos", loop: true, volume: 0.55, ext: "wav" },
  // SINTETIZADOS (sem arquivo): gerados no navegador por sintetizarJetpack / sintetizarBaque
  "jato-sopro": { modo: "pos", loop: true, volume: 0.32, sintetico: true },
  baque: { modo: "pos", loop: false, volume: 0.95, sintetico: true },   // o corpo batendo no chão (força pela queda)
  "space-bed": { modo: "2d", loop: true, volume: 0.22, taxa: TAXA_432 },
  "blackhole-hum": { modo: "pos", loop: true, volume: 0.55 },
  crystals: { modo: "pos", loop: true, volume: 0.3 },
  "ship-flight": { modo: "pos", loop: true, volume: 0.7 },
  "ship-idle": { modo: "pos", loop: true, volume: 0.35 },
  "ship-takeoff": { modo: "pos", loop: true, volume: 0.85, emendar: 0.4 },   // SUBINDO: o motor empurrando — contínuo enquanto se segura o botão
  "ship-landing": { modo: "pos", loop: true, volume: 0.8, emendar: 0.4 },   // DESCENDO: o motor baixando — contínuo enquanto se segura o botão
  "ship-touchdown": { modo: "pos", loop: false, volume: 0.9 },   // no instante do POUSO: impacto grave + assentamento
  // passos SUTIS: volume baixo + passa-baixa (tira o "estalo"); no compasso do pé de verdade (criarDetectorPasso)
  "step-1": { modo: "pos", loop: false, volume: 0.3, filtro: 2300 },
  "step-2": { modo: "pos", loop: false, volume: 0.3, filtro: 2300 },
  "step-3": { modo: "pos", loop: false, volume: 0.3, filtro: 2300 },
  jump: { modo: "pos", loop: false, volume: 0.6 },
  land: { modo: "pos", loop: false, volume: 0.55 },
  "near-ping": { modo: "pos", loop: false, volume: 0.45 },
  "neuron-chime": { modo: "pos", loop: false, volume: 0.35 },
  rise: { modo: "pos", loop: false, volume: 0.6 },
  "cyber-enter": { modo: "2d", loop: false, volume: 0.6 },       // entrada no cyberespaço (play): startup 432 + arpejo
  "study-confirm": { modo: "2d", loop: false, volume: 0.6 },
  "chat-pop": { modo: "2d", loop: false, volume: 0.45 },
  join: { modo: "pos", loop: false, volume: 0.55 },
  leave: { modo: "pos", loop: false, volume: 0.5 },
};
export const urlDoSom = (n: NomeSom) => `${PASTA_SONS}${n}.${SONS[n].ext ?? "ogg"}`;
/** os sons que vêm de ARQUIVO (os sintetizados não) */
export const SONS_ARQUIVO = (Object.keys(SONS) as NomeSom[]).filter((n) => !SONS[n].sintetico);

/** PRNG determinístico (mulberry32) — a síntese sai igual sempre (e dá pra testar) */
function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normalizar = (x: Float32Array, pico: number) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i]! / m) * pico; return x; };

/**
 * JATO da mochila (mono, loop de `seg` s): ronco grave (ruído marrom) + corpo (ruído passa-baixa ~550 Hz) + chiado fino
 * (passa-alta) com um "crepitar" de combustão (tremolo ~23 Hz). A ponta é emendada no começo (crossfade de potência
 * constante) → loop sem clique. O engine controla volume e afinação pelo empuxo (somDoJato).
 */
export function sintetizarJetpack(sr: number, seg = 3): Float32Array {
  const n = Math.round(sr * seg), x = Math.round(sr * 0.3), raw = new Float32Array(n + x), r = prng(7);
  let marrom = 0, lp1 = 0, lp2 = 0, hp = 0, wAnt = 0;
  const a1 = 1 - Math.exp((-2 * Math.PI * 550) / sr), a2 = 1 - Math.exp((-2 * Math.PI * 900) / sr);
  for (let i = 0; i < raw.length; i++) {
    const w = r() * 2 - 1, t = i / sr;
    marrom = 0.996 * marrom + 0.06 * w; lp1 += (w - lp1) * a1; lp2 += (lp1 - lp2) * a2; hp = 0.82 * (hp + w - wAnt); wAnt = w;
    const crepita = 1 + 0.22 * Math.sin(2 * Math.PI * 23 * t + 0.6 * Math.sin(2 * Math.PI * 3.1 * t));
    raw[i] = (marrom * 1.6 + lp2 * 2.2 + hp * 0.1) * crepita;
  }
  const out = raw.slice(0, n);
  for (let i = 0; i < x; i++) { const u = i / x; out[i] = raw[i]! * Math.sqrt(u) + raw[n + i]! * Math.sqrt(1 - u); }
  return normalizar(out, 0.8);
}

/** BAQUE do pouso (mono, ~0,5 s): batida grave com o tom caindo (110 → 38 Hz) + um estalo de terra abafado no início */
export function sintetizarBaque(sr: number): Float32Array {
  const n = Math.round(sr * 0.5), out = new Float32Array(n), r = prng(13), aLp = 1 - Math.exp((-2 * Math.PI * 700) / sr);
  let fase = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = 38 + 72 * Math.exp(-t * 18); fase += (2 * Math.PI * f) / sr;
    const env = (1 - Math.exp(-t * 900)) * Math.exp(-t * 9);
    lp += (r() * 2 - 1 - lp) * aLp;
    out[i] = Math.sin(fase) * env + lp * Math.exp(-t * 45) * 1.4;
  }
  for (let i = 0; i < 64; i++) out[n - 1 - i]! *= i / 64;   // fim sem clique
  return normalizar(out, 0.92);
}
export const SINTESE: Partial<Record<NomeSom, (sr: number) => Float32Array>> = { "jato-sopro": sintetizarJetpack, baque: sintetizarBaque };

/** distância: cai com a distância e some longe (cull). A nave de quem PILOTA quase não paneia (rolloff baixo).
 *  Atenção: no modelo "inverse" do Web Audio o `max` NÃO corta (o som só vai ficando fraco, mas se ouve de longe);
 *  quem precisa SUMIR de verdade usa `modelo: "linear"` (ganho chega a 0 no `max`). */
export type Dist = { ref: number; max: number; rolloff: number; modelo?: "inverse" | "linear" };
export const DISTANCIA: Record<"padrao" | "perto" | "eu" | "cristais" | "grande" | "naveLocal", Dist> = {
  padrao: { ref: 6, max: 60, rolloff: 1.2 },
  perto: { ref: 2.5, max: 22, rolloff: 1.4 },       // passos/pulo dos COLEGAS (coisas pequenas)
  eu: { ref: 12, max: 60, rolloff: 1 },             // os MEUS passos/pulo: a câmera (o ouvinte) fica ~8–10 m atrás do avatar
  cristais: { ref: 4, max: 26, rolloff: 1, modelo: "linear" },   // só perto: some de verdade longe
  grande: { ref: 14, max: 160, rolloff: 1 },        // buraco negro, nave dos outros
  naveLocal: { ref: 40, max: 400, rolloff: 0.25 },  // a nave em que EU estou: não vira de lado ao girar a câmera
};

/** cristais da base: só se ouvem com o AVATAR perto dela (cheio até 4 m, some aos 12 m) — o ouvinte é a câmera */
export const CRISTAIS_PERTO = { cheio: 4, some: 12 };
export function fatorCristais(d: number): number {
  const k = (CRISTAIS_PERTO.some - d) / (CRISTAIS_PERTO.some - CRISTAIS_PERTO.cheio);
  const u = Math.max(0, Math.min(1, k)); return u * u * (3 - 2 * u);
}

export const PREF_SFX = "zaeon_sfx", PREF_VOLUME = "zaeon_volume";
/** preferências: som ligado por padrão ("0" desliga); volume mestre 0..1 (padrão 0,8) */
export function lerPrefs(get: (k: string) => string | null): { ligado: boolean; volume: number } {
  let ligado = true, volume = 0.8;
  try { ligado = get(PREF_SFX) !== "0"; const v = Number.parseFloat(get(PREF_VOLUME) ?? ""); if (Number.isFinite(v)) volume = Math.max(0, Math.min(1, v)); } catch { /* storage bloqueado */ }
  return { ligado, volume };
}

/** fade-in (s) dos loops ao entrar na cena 3D — o som do cyberespaço nunca entra seco */
export const FADE_ENTRADA = 1.6;

/** quando a nave "começa a descer": vy abaixo disso (m/s), a mais de `alturaMin` do chão; no máx. 1× a cada `intervalo` s */
export const NAVE_DESCIDA = { vy: -8, alturaMin: 3, intervalo: 2.5 };
export type EstadoSomNave = { pousado: boolean; descendo: boolean; esfria: number };
export const somNaveInicial = (pousado = true): EstadoSomNave => ({ pousado, descendo: false, esfria: 0 });
/**
 * Os eventos de som da nave, por quadro: `decolou` (saiu do solo → ship-takeoff), `desceu` (começou a DESCER → ship-landing,
 * o motor baixando) e `pousou` (tocou o chão, UMA vez → ship-touchdown). A descida tem histerese (só "sai" de descendo
 * quando a queda cai pra menos da metade) e um intervalo mínimo, pra não repetir ao ajustar a altura.
 */
export function eventosNave(e: EstadoSomNave, agora: { pousado: boolean; vy: number; altura: number }, dt: number) {
  const decolou = e.pousado && !agora.pousado, pousou = !e.pousado && agora.pousado;
  const descendo = !agora.pousado && (e.descendo ? agora.vy < NAVE_DESCIDA.vy / 2 : agora.vy < NAVE_DESCIDA.vy && agora.altura > NAVE_DESCIDA.alturaMin);
  let esfria = Math.max(0, e.esfria - dt);
  const desceu = descendo && !e.descendo && esfria <= 0;
  if (desceu) esfria = NAVE_DESCIDA.intervalo;
  return { e: { pousado: agora.pousado, descendo, esfria }, decolou, desceu, pousou };
}

/** teto de vozes simultâneas de one-shots (os loops são fixos e contados à parte) */
export function criarLimiteVozes(max = 12) {
  let ativas = 0;
  return { get ativas() { return ativas; }, pegar() { if (ativas >= max) return false; ativas++; return true; }, soltar() { ativas = Math.max(0, ativas - 1); } };
}

/** loop SEM EMENDA a partir de um som que não foi feito pra repetir: a ponta (`x` amostras) entra em crossfade de
 *  potência constante no começo — o resultado tem `n − x` amostras e o fim casa com o início */
export function emendarLoop(d: Float32Array, x: number): Float32Array {
  const n = d.length; x = Math.max(1, Math.min(Math.floor(n / 3), Math.floor(x)));
  const out = d.slice(0, n - x);
  for (let i = 0; i < x; i++) { const u = i / x; out[i] = d[i]! * Math.sqrt(u) + d[n - x + i]! * Math.sqrt(1 - u); }
  return out;
}

/**
 * PASSO no compasso da animação. `fasesDeContato`: dadas as alturas de cada pé amostradas ao longo de UM ciclo da
 * animação (andar ou correr), as fases (0..1) em que cada pé ENCOSTA no chão (mínimo local perto do mínimo do ciclo).
 * `pisadasEntre`: quantas dessas fases o relógio da animação cruzou entre dois quadros (com a volta do ciclo) — assim o
 * passo soa exatamente quando o pé encosta, em QUALQUER fps (no celular a 20 fps também).
 */
export function fasesDeContato(alturasPorPe: number[][], folga = 0.03): number[] {
  const fases: number[] = [];
  for (const h of alturasPorPe) {
    // o pé "plantado" = perto do mínimo; a PISADA é o instante em que ele chega lá (o começo de cada apoio, com a volta)
    const n = h.length, min = Math.min(...h), apoio = h.map((v) => v < min + folga);
    if (apoio.every(Boolean)) continue;
    for (let i = 0; i < n; i++) if (apoio[i] && !apoio[(i - 1 + n) % n]) fases.push(i / n);
  }
  return fases.sort((x, y) => x - y);
}
export function pisadasEntre(uAnt: number, u: number, fases: number[]): number {
  const dentro = (f: number, a: number, b: number) => f > a && f <= b;
  let n = 0;
  for (const f of fases) n += u >= uAnt ? (dentro(f, uAnt, u) ? 1 : 0) : (dentro(f, uAnt, 1) || dentro(f, -1e-9, u) ? 1 : 0);
  return n;
}

/** cadência dos passos (s) e o próximo arquivo (alterna os 3) — reserva quando o avatar não tem pés (sem o modelo) */
export const cadenciaPasso = (correndo: boolean) => (correndo ? 0.3 : 0.44);
export const PASSOS: NomeSom[] = ["step-1", "step-2", "step-3"];

/** o leito ambiente abaixa enquanto a música da intro toca e sobe quando ela fadeia (cross-fade) */
export const fatorLeito = (musica: "parado" | "tocando" | "fade") => (musica === "tocando" ? 0.2 : musica === "fade" ? 0.6 : 1);

/** próximo intervalo (s) do brilho dos neurônios na base — esporádico */
export const intervaloNeuronio = (aleatorio: number) => 7 + aleatorio * 9;
