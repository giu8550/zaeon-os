/**
 * AudioCyber — o áudio do cyberespaço em 3 camadas, com o áudio NATIVO do three:
 *  1. ESPACIAL: um THREE.AudioListener na câmera + THREE.PositionalAudio presos aos objetos (buraco negro, bases,
 *     cristais das bases, naves) — atenua com a distância e paneia sozinho quando se anda/orbita. Buffers MONO.
 *  2. LEITO ambiente (THREE.Audio 2D, estéreo) bem baixinho — abaixa enquanto a música da intro toca.
 *  3. EVENTOS: one-shots posicionais num ponto do mundo (passos, pulo, chegada…) ou 2D (UI), com teto de vozes.
 * Nada toca antes de um GESTO, e o engine só chama ativar() ao ENTRAR na cena 3D (nunca na landing/menu): só então o
 * listener (e o AudioContext do three) é criado, e os loops entram com fade-in (FADE_ENTRADA). Respeita `zaeon_sfx` (liga/desliga) e `zaeon_volume` (mestre).
 * Regras puras e a tabela dos sons em lib/cyber/audio.ts. dispose() para e desconecta tudo.
 */
import * as THREE from "three";
import { DISTANCIA, FADE_ENTRADA, SONS, criarLimiteVozes, lerPrefs, urlDoSom, type Dist, type NomeSom } from "@/lib/cyber/audio";
export type LoopSom = { audio: THREE.Audio<GainNode | PannerNode> | null; alvo: number; atual: number; nome: NomeSom };

export type AudioCyberHandle = {
  /** já tem gesto + listener (e os buffers estão carregando/carregados) */
  readonly ativo: boolean;
  /** o buffer desse som já chegou (dá pra tocar agora)? */
  temSom(nome: NomeSom): boolean;
  /** chamar no 1º gesto (ou já, se a intro destravou) */
  ativar(): void;
  /** loop preso a um objeto (posicional) ou 2D (`obj` null). Fica na fila até os buffers chegarem. */
  loop(nome: NomeSom, obj: THREE.Object3D | null, o?: { volume?: number; dist?: Dist }): LoopSom;
  /** desliga e solta um loop (o objeto dele saiu de cena: nave remota, base) */
  soltarLoop(l: LoopSom): void;
  /** muda o alvo de volume de um loop (0..1 × o volume base do som); o fade é suave, a cada quadro */
  volumeLoop(l: LoopSom, alvo: number): void;
  /** ajusta a distância de um loop posicional (ex.: a nave em que eu estou) */
  distanciaLoop(l: LoopSom, d: Dist): void;
  /** one-shot: posicional num ponto do mundo (`em`) ou 2D (`em` ausente) */
  tocar(nome: NomeSom, em?: THREE.Vector3 | null, o?: { volume?: number; dist?: Dist }): void;
  /** releitura das preferências (liga/desliga + volume mestre) */
  aplicarPrefs(): void;
  /** fade dos loops (chamar a cada quadro) */
  atualizar(dt: number): void;
  dispose(): void;
};

/** som de UI 2D fora da cena (ex.: "Estudar" — a cena é desmontada logo em seguida); respeita as preferências */
export function tocarUI(nome: NomeSom) {
  try {
    const p = lerPrefs((k) => localStorage.getItem(k)); if (!p.ligado) return;
    const a = new Audio(urlDoSom(nome)); a.volume = Math.min(1, SONS[nome].volume * p.volume); void a.play().catch(() => {});
  } catch { /* sem áudio */ }
}

export function criarAudioCyber(o: { camera: THREE.Camera; cena: THREE.Scene; low: boolean }): AudioCyberHandle {
  let listener: THREE.AudioListener | null = null, vivo = true, entrada = 0;   // entrada: 0→1 no fade-in dos loops
  const buffers = new Map<NomeSom, AudioBuffer>();
  const loops: { l: LoopSom; obj: THREE.Object3D | null; dist?: Dist; volBase: number }[] = [];
  const umaVez = new Set<{ a: THREE.Audio<GainNode | PannerNode>; holder: THREE.Object3D | null }>();
  const vozes = criarLimiteVozes(o.low ? 8 : 12);
  const ler = () => lerPrefs((k) => (typeof localStorage !== "undefined" ? localStorage.getItem(k) : null));
  let prefs = ler();

  const aplicarDist = (a: THREE.PositionalAudio, d: Dist) => { a.setRefDistance(d.ref); a.setMaxDistance(d.max); a.setRolloffFactor(d.rolloff); a.setDistanceModel(d.modelo ?? "inverse"); };
  const criarFonte = (nome: NomeSom, obj: THREE.Object3D | null, dist?: Dist): THREE.Audio<GainNode | PannerNode> | null => {
    const buf = buffers.get(nome); if (!buf || !listener) return null;
    const pos = SONS[nome].modo === "pos" && obj;
    const a: THREE.Audio<GainNode | PannerNode> = pos ? new THREE.PositionalAudio(listener) : new THREE.Audio(listener);
    if (pos) { aplicarDist(a as THREE.PositionalAudio, dist ?? DISTANCIA.padrao); obj!.add(a); }
    a.setBuffer(buf);
    const taxa = SONS[nome].taxa; if (taxa) a.setPlaybackRate(taxa);   // ex.: o leito retocado pra 432 Hz
    return a;
  };
  /** cria (quando der) as fontes dos loops que estavam esperando os buffers */
  const montarLoops = () => {
    for (const x of loops) {
      if (x.l.audio || !buffers.has(x.l.nome)) continue;
      const a = criarFonte(x.l.nome, x.obj, x.dist); if (!a) continue;
      a.setLoop(true); a.setVolume(0); x.l.audio = a; x.l.atual = 0;
      try { a.play(); } catch { /* contexto ainda suspenso */ }
    }
  };

  const api: AudioCyberHandle = {
    get ativo() { return !!listener; },
    temSom(nome) { return !!listener && buffers.has(nome); },
    ativar() {
      if (listener || !vivo) return;
      listener = new THREE.AudioListener(); o.camera.add(listener);
      const ctx = listener.context; if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      api.aplicarPrefs();
      const loader = new THREE.AudioLoader();
      (Object.keys(SONS) as NomeSom[]).forEach((n) => {
        loader.load(urlDoSom(n), (buf) => { if (!vivo) return; buffers.set(n, buf); montarLoops(); }, undefined, () => { /* arquivo faltando: segue sem esse som */ });
      });
    },
    loop(nome, obj, op = {}) {
      const l: LoopSom = { audio: null, alvo: 0, atual: 0, nome };
      loops.push({ l, obj, dist: op.dist, volBase: (op.volume ?? 1) * SONS[nome].volume });
      montarLoops();
      return l;
    },
    soltarLoop(l) {
      const i = loops.findIndex((x) => x.l === l); if (i < 0) return;
      const a = l.audio; if (a) { try { if (a.isPlaying) a.stop(); a.disconnect(); } catch { /* já */ } a.removeFromParent(); l.audio = null; }
      loops.splice(i, 1);
    },
    volumeLoop(l, alvo) { l.alvo = Math.max(0, Math.min(1, alvo)); },
    distanciaLoop(l, d) { if (l.audio && (l.audio as THREE.PositionalAudio).panner) aplicarDist(l.audio as THREE.PositionalAudio, d); },
    tocar(nome, em, op = {}) {
      if (!listener || !prefs.ligado || !buffers.has(nome) || !vozes.pegar()) return;
      let holder: THREE.Object3D | null = null;
      if (em && SONS[nome].modo === "pos") { holder = new THREE.Object3D(); holder.position.copy(em); o.cena.add(holder); }
      const a = criarFonte(nome, holder, op.dist ?? DISTANCIA.padrao);
      if (!a) { vozes.soltar(); holder?.removeFromParent(); return; }
      a.setVolume((op.volume ?? 1) * SONS[nome].volume);
      const item = { a, holder };
      umaVez.add(item);
      const fim = () => { if (!umaVez.delete(item)) return; vozes.soltar(); try { a.disconnect(); } catch { /* já */ } a.removeFromParent(); holder?.removeFromParent(); };
      a.onEnded = () => { a.isPlaying = false; fim(); };
      try { a.play(); } catch { fim(); }
    },
    aplicarPrefs() {
      prefs = ler();
      if (listener) listener.setMasterVolume(prefs.ligado ? prefs.volume : 0);
    },
    atualizar(dt) {
      if (!listener) return;
      entrada = Math.min(1, entrada + dt / FADE_ENTRADA);
      const k = Math.min(1, dt * 2.5);   // fades suaves (~0,4 s) — nada liga/desliga seco
      for (const x of loops) {
        const a = x.l.audio; if (!a) continue;
        x.l.atual += (x.l.alvo - x.l.atual) * k;
        a.setVolume(x.l.atual * x.volBase * entrada);
      }
    },
    dispose() {
      vivo = false;
      for (const x of loops) { const a = x.l.audio; if (!a) continue; try { if (a.isPlaying) a.stop(); a.disconnect(); } catch { /* já */ } a.removeFromParent(); x.l.audio = null; }
      for (const it of umaVez) { try { if (it.a.isPlaying) it.a.stop(); it.a.disconnect(); } catch { /* já */ } it.a.removeFromParent(); it.holder?.removeFromParent(); }
      umaVez.clear(); loops.length = 0; buffers.clear();
      if (listener) { listener.removeFromParent(); listener = null; }   // o AudioContext do three é global (fica pro próximo)
    },
  };
  return api;
}
