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
import { DISTANCIA, FADE_ENTRADA, SINTESE, SONS, SONS_ARQUIVO, emendarLoop, criarLimiteVozes, lerPrefs, urlDoSom, type Dist, type NomeSom } from "@/lib/cyber/audio";
export type LoopSom = { audio: THREE.Audio<GainNode | PannerNode> | null; alvo: number; atual: number; nome: NomeSom; vel?: number; taxa?: number; taxaAtual?: number };

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
  /** muda o alvo de volume de um loop (0..1 × o volume base do som); o fade é suave, a cada quadro (`vel` = 1/s; padrão 2,5) */
  volumeLoop(l: LoopSom, alvo: number, vel?: number): void;
  /** afinação (playbackRate) de um loop, suave — ex.: o jato fica mais agudo subindo */
  taxaLoop(l: LoopSom, taxa: number): void;
  /** ajusta a distância de um loop posicional (ex.: a nave em que eu estou) */
  distanciaLoop(l: LoopSom, d: Dist): void;
  /** one-shot: posicional num ponto do mundo (`em`) ou 2D (`em` ausente) */
  tocar(nome: NomeSom, em?: THREE.Vector3 | null, o?: { volume?: number; dist?: Dist; taxa?: number }): void;
  /** releitura das preferências (liga/desliga + volume mestre) */
  aplicarPrefs(): void;
  /** VOZ ao vivo de alguém (WebRTC) presa ao avatar dele: posicional (perto = mais alto). Antes do gesto que
   *  libera o áudio, fica na fila e liga sozinha depois. `remover()` desliga e solta. */
  voz(obj: THREE.Object3D, stream: MediaStream): { remover(): void };
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
  const vozesAoVivo = new Set<{ obj: THREE.Object3D; stream: MediaStream; a: THREE.PositionalAudio | null; el: HTMLAudioElement | null }>();
  /** liga a voz (quando já há listener): PositionalAudio na origem do stream + um <audio> MUDO — no Chrome, o
   *  áudio remoto do WebRTC só "anda" pro Web Audio se também estiver tocando num elemento */
  const ligarVoz = (v: { obj: THREE.Object3D; stream: MediaStream; a: THREE.PositionalAudio | null; el: HTMLAudioElement | null }) => {
    if (!listener || v.a) return;
    try {
      const el = new Audio(); el.muted = true; el.srcObject = v.stream; void el.play().catch(() => {}); v.el = el;
      const a = new THREE.PositionalAudio(listener); aplicarDist(a, DISTANCIA.voz); a.setMediaStreamSource(v.stream); a.setVolume(1.4);
      v.obj.add(a); v.a = a;
    } catch { /* sem áudio */ }
  };
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
    const fc = SONS[nome].filtro; if (fc) { const f = listener.context.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = fc; f.Q.value = 0.5; a.setFilter(f); }   // ex.: passos mais macios
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
      for (const v of vozesAoVivo) ligarVoz(v);   // vozes que chegaram antes do gesto
      const loader = new THREE.AudioLoader();
      // os SINTETIZADOS saem na hora (sem rede): gerados no AudioContext do three
      for (const [n, gerar] of Object.entries(SINTESE) as [NomeSom, (sr: number) => Float32Array][]) {
        try { const d = gerar(ctx.sampleRate), b = ctx.createBuffer(1, d.length, ctx.sampleRate); b.getChannelData(0).set(d); buffers.set(n, b); } catch { /* sem esse som */ }
      }
      montarLoops();
      SONS_ARQUIVO.forEach((n) => {
        loader.load(urlDoSom(n), (buf) => {
          if (!vivo) return;
          const em = SONS[n].emendar;
          if (em) {   // vira loop sem emenda (a ponta entra em crossfade no começo)
            const x = Math.round(em * buf.sampleRate), novo = ctx.createBuffer(buf.numberOfChannels, buf.length - Math.max(1, Math.min(Math.floor(buf.length / 3), x)), buf.sampleRate);
            for (let c = 0; c < buf.numberOfChannels; c++) novo.getChannelData(c).set(emendarLoop(buf.getChannelData(c), x));
            buf = novo;
          }
          buffers.set(n, buf); montarLoops();
        }, undefined, () => { /* arquivo faltando: segue sem esse som */ });
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
    volumeLoop(l, alvo, vel) { l.alvo = Math.max(0, Math.min(1, alvo)); if (vel !== undefined) l.vel = vel; },
    taxaLoop(l, taxa) { l.taxa = taxa; },
    distanciaLoop(l, d) { if (l.audio && (l.audio as THREE.PositionalAudio).panner) aplicarDist(l.audio as THREE.PositionalAudio, d); },
    tocar(nome, em, op = {}) {
      if (!listener || !prefs.ligado || !buffers.has(nome) || !vozes.pegar()) return;
      let holder: THREE.Object3D | null = null;
      if (em && SONS[nome].modo === "pos") { holder = new THREE.Object3D(); holder.position.copy(em); o.cena.add(holder); }
      const a = criarFonte(nome, holder, op.dist ?? DISTANCIA.padrao);
      if (!a) { vozes.soltar(); holder?.removeFromParent(); return; }
      a.setVolume((op.volume ?? 1) * SONS[nome].volume);
      if (op.taxa) a.setPlaybackRate(op.taxa * (SONS[nome].taxa ?? 1));
      const item = { a, holder };
      umaVez.add(item);
      const fim = () => { if (!umaVez.delete(item)) return; vozes.soltar(); try { a.disconnect(); } catch { /* já */ } a.removeFromParent(); holder?.removeFromParent(); };
      a.onEnded = () => { a.isPlaying = false; fim(); };
      try { a.play(); } catch { fim(); }
    },
    voz(obj, stream) {
      const v = { obj, stream, a: null as THREE.PositionalAudio | null, el: null as HTMLAudioElement | null };
      vozesAoVivo.add(v); ligarVoz(v);
      return { remover() { vozesAoVivo.delete(v); try { v.a?.disconnect(); } catch { /* já */ } v.a?.removeFromParent(); if (v.el) { v.el.srcObject = null; } } };
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
        x.l.atual += (x.l.alvo - x.l.atual) * (x.l.vel ? Math.min(1, dt * x.l.vel) : k);
        a.setVolume(x.l.atual * x.volBase * entrada);
        if (x.l.taxa !== undefined) { const tA = x.l.taxaAtual ?? x.l.taxa; x.l.taxaAtual = tA + (x.l.taxa - tA) * Math.min(1, dt * 4); a.setPlaybackRate(x.l.taxaAtual); }
      }
    },
    dispose() {
      vivo = false;
      for (const x of loops) { const a = x.l.audio; if (!a) continue; try { if (a.isPlaying) a.stop(); a.disconnect(); } catch { /* já */ } a.removeFromParent(); x.l.audio = null; }
      for (const it of umaVez) { try { if (it.a.isPlaying) it.a.stop(); it.a.disconnect(); } catch { /* já */ } it.a.removeFromParent(); it.holder?.removeFromParent(); }
      umaVez.clear(); loops.length = 0; buffers.clear();
      for (const v of vozesAoVivo) { try { v.a?.disconnect(); } catch { /* já */ } v.a?.removeFromParent(); if (v.el) v.el.srcObject = null; }
      vozesAoVivo.clear();
      if (listener) { listener.removeFromParent(); listener = null; }   // o AudioContext do three é global (fica pro próximo)
    },
  };
  return api;
}
