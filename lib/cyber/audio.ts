/**
 * Cyberespaço — regras PURAS do áudio (o three fica em components/cyber/AudioCyber.ts):
 *  - os 21 sons e COMO tocam (posicional MONO preso a um objeto × 2D estéreo/UI);
 *  - preferências do usuário (`zaeon_sfx` liga/desliga, `zaeon_volume` mestre 0..1);
 *  - modelo de distância (some longe), teto de vozes simultâneas, cadência de passos;
 *  - o leito ambiente "abaixa" enquanto a música da intro toca (cross-fade quando ela fadeia).
 */
export const PASTA_SONS = "/assets/sounds/cyber/";

export type NomeSom =
  | "space-bed" | "blackhole-hum" | "crystals" | "ship-flight" | "ship-idle"
  | "ship-takeoff" | "ship-landing" | "ship-touchdown" | "step-1" | "step-2" | "step-3" | "jump" | "land"
  | "near-ping" | "neuron-chime" | "rise" | "cyber-enter" | "study-confirm" | "chat-pop" | "join" | "leave";

/** afinação 432 Hz: a faixa do leito (danamusic) é gravada em A=440 (medido: +0,1 cent) — tocada a 432/440 vira A=432 */
export const TAXA_432 = 432 / 440;

/** como cada som toca: `pos` = PositionalAudio (mono, no mundo); `2d` = THREE.Audio (leito/UI); `taxa` = playbackRate */
export const SONS: Record<NomeSom, { modo: "pos" | "2d"; loop: boolean; volume: number; taxa?: number }> = {
  "space-bed": { modo: "2d", loop: true, volume: 0.22, taxa: TAXA_432 },
  "blackhole-hum": { modo: "pos", loop: true, volume: 0.55 },
  crystals: { modo: "pos", loop: true, volume: 0.3 },
  "ship-flight": { modo: "pos", loop: true, volume: 0.7 },
  "ship-idle": { modo: "pos", loop: true, volume: 0.35 },
  "ship-takeoff": { modo: "pos", loop: false, volume: 0.9 },
  "ship-landing": { modo: "pos", loop: false, volume: 0.8 },     // ao DESCER: o motor baixando (sem impacto)
  "ship-touchdown": { modo: "pos", loop: false, volume: 0.9 },   // no instante do POUSO: impacto grave + assentamento
  "step-1": { modo: "pos", loop: false, volume: 0.6 },
  "step-2": { modo: "pos", loop: false, volume: 0.6 },
  "step-3": { modo: "pos", loop: false, volume: 0.6 },
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
export const urlDoSom = (n: NomeSom) => `${PASTA_SONS}${n}.ogg`;

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

/** cadência dos passos (s) e o próximo arquivo (alterna os 3) */
export const cadenciaPasso = (correndo: boolean) => (correndo ? 0.3 : 0.44);
export const PASSOS: NomeSom[] = ["step-1", "step-2", "step-3"];

/** o leito ambiente abaixa enquanto a música da intro toca e sobe quando ela fadeia (cross-fade) */
export const fatorLeito = (musica: "parado" | "tocando" | "fade") => (musica === "tocando" ? 0.2 : musica === "fade" ? 0.6 : 1);

/** próximo intervalo (s) do brilho dos neurônios na base — esporádico */
export const intervaloNeuronio = (aleatorio: number) => 7 + aleatorio * 9;
