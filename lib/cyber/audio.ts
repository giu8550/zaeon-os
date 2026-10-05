/**
 * Cyberespaço — regras PURAS do áudio (o three fica em components/cyber/AudioCyber.ts):
 *  - os 20 sons e COMO tocam (posicional MONO preso a um objeto × 2D estéreo/UI);
 *  - preferências do usuário (`zaeon_sfx` liga/desliga, `zaeon_volume` mestre 0..1);
 *  - modelo de distância (some longe), teto de vozes simultâneas, cadência de passos;
 *  - o leito ambiente "abaixa" enquanto a música da intro toca (cross-fade quando ela fadeia).
 */
export const PASTA_SONS = "/assets/sounds/cyber/";

export type NomeSom =
  | "space-bed" | "blackhole-hum" | "crystals" | "ship-flight" | "ship-idle"
  | "ship-takeoff" | "ship-landing" | "step-1" | "step-2" | "step-3" | "jump" | "land"
  | "near-ping" | "neuron-chime" | "rise" | "whoosh-hyperspace" | "study-confirm" | "chat-pop" | "join" | "leave";

/** como cada som toca: `pos` = PositionalAudio (mono, no mundo); `2d` = THREE.Audio (leito/UI) */
export const SONS: Record<NomeSom, { modo: "pos" | "2d"; loop: boolean; volume: number }> = {
  "space-bed": { modo: "2d", loop: true, volume: 0.22 },
  "blackhole-hum": { modo: "pos", loop: true, volume: 0.55 },
  crystals: { modo: "pos", loop: true, volume: 0.35 },
  "ship-flight": { modo: "pos", loop: true, volume: 0.7 },
  "ship-idle": { modo: "pos", loop: true, volume: 0.35 },
  "ship-takeoff": { modo: "pos", loop: false, volume: 0.9 },
  "ship-landing": { modo: "pos", loop: false, volume: 0.85 },
  "step-1": { modo: "pos", loop: false, volume: 0.3 },
  "step-2": { modo: "pos", loop: false, volume: 0.3 },
  "step-3": { modo: "pos", loop: false, volume: 0.3 },
  jump: { modo: "pos", loop: false, volume: 0.6 },
  land: { modo: "pos", loop: false, volume: 0.55 },
  "near-ping": { modo: "pos", loop: false, volume: 0.45 },
  "neuron-chime": { modo: "pos", loop: false, volume: 0.35 },
  rise: { modo: "pos", loop: false, volume: 0.6 },
  "whoosh-hyperspace": { modo: "2d", loop: false, volume: 0.6 },
  "study-confirm": { modo: "2d", loop: false, volume: 0.6 },
  "chat-pop": { modo: "2d", loop: false, volume: 0.45 },
  join: { modo: "pos", loop: false, volume: 0.55 },
  leave: { modo: "pos", loop: false, volume: 0.5 },
};
export const urlDoSom = (n: NomeSom) => `${PASTA_SONS}${n}.ogg`;

/** distância: cai com a distância e some longe (cull). A nave de quem PILOTA quase não paneia (rolloff baixo). */
export const DISTANCIA = {
  padrao: { ref: 6, max: 60, rolloff: 1.2 },
  perto: { ref: 2.5, max: 22, rolloff: 1.4 },       // passos, pulo, sentar (coisas pequenas)
  grande: { ref: 14, max: 160, rolloff: 1 },        // buraco negro, nave dos outros
  naveLocal: { ref: 40, max: 400, rolloff: 0.25 },  // a nave em que EU estou: não vira de lado ao girar a câmera
} as const;

export const PREF_SFX = "zaeon_sfx", PREF_VOLUME = "zaeon_volume";
/** preferências: som ligado por padrão ("0" desliga); volume mestre 0..1 (padrão 0,8) */
export function lerPrefs(get: (k: string) => string | null): { ligado: boolean; volume: number } {
  let ligado = true, volume = 0.8;
  try { ligado = get(PREF_SFX) !== "0"; const v = Number.parseFloat(get(PREF_VOLUME) ?? ""); if (Number.isFinite(v)) volume = Math.max(0, Math.min(1, v)); } catch { /* storage bloqueado */ }
  return { ligado, volume };
}

/** fade-in (s) dos loops ao entrar na cena 3D — o som do cyberespaço nunca entra seco */
export const FADE_ENTRADA = 1.6;

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
