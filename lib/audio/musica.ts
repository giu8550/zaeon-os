/**
 * lib/audio/musica.ts — DONO ÚNICO da música do site (a faixa da intro + o miniplayer do navbar).
 *
 * Antes, um único <audio> tinha dois donos que brigavam (a intro dava play/fade e o navbar dava `pause()` +
 * `currentTime=0` ao ver a home) — o play da intro é assíncrono, e nessa janela o navbar cortava a faixa SECO no
 * meio. Agora todo mundo CHAMA este controlador:
 *  - `destravar()` no gesto do "Conectar" ao cyberespaço (e em qualquer gesto lá dentro): libera áudio no navegador
 *    (a entrada do site não tem mais música nem botão);
 *  - `tocar(src?, {loop})` → fade-in; `fadeTo(vol, ms)`; `parar(ms)` → fade até 0 e SÓ então pausa;
 *  - `estado`: "parado" | "tocando" | "fade" — o navbar só reseta a faixa se estiver "parado".
 * Nada para seco: toda parada passa por um fade. Quem quiser (o leito do cyberespaço) ouve `inscrever()`.
 * Testável: o elemento de áudio e o relógio são injetáveis.
 */
export type EstadoMusica = "parado" | "tocando" | "fade";
export type AudioLike = {
  src: string; volume: number; loop: boolean; paused: boolean; currentTime: number;
  play(): Promise<void>; pause(): void;
};
type Deps = {
  criarElemento: (src: string) => AudioLike;
  /** agenda um tique (padrão: setTimeout) — injetável nos testes */
  agendar?: (fn: () => void, ms: number) => unknown;
  cancelar?: (id: unknown) => void;
};

export const VOLUME_MUSICA = 0.4;
/** curva suave (ease-in-out) entre dois volumes, `u` de 0 a 1 */
export const volumeNoFade = (de: number, para: number, u: number) => { const k = Math.max(0, Math.min(1, u)); const s = k * k * (3 - 2 * k); return de + (para - de) * s; };

export function criarControladorMusica(deps: Deps) {
  const agendar = deps.agendar ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const cancelar = deps.cancelar ?? ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let el: AudioLike | null = null, estado: EstadoMusica = "parado", destravado = false, alvoVolume = VOLUME_MUSICA;
  let fadeId: unknown = null, fadeGen = 0, encerrarFade: (() => void) | null = null;
  const ouvintes = new Set<(e: EstadoMusica) => void>();
  const mudar = (e: EstadoMusica) => { if (e === estado) return; estado = e; ouvintes.forEach((f) => { try { f(e); } catch { /* ouvinte */ } }); };

  const api = {
    /** o elemento (criado sob demanda; `window.zaeonAudio` aponta pra ele por compatibilidade/analisador) */
    elemento(src = ""): AudioLike { if (!el) { el = deps.criarElemento(src); el.volume = 0; } return el; },
    get estado() { return estado; },
    get destravado() { return destravado; },
    /** gesto do usuário (o "Iniciar" e qualquer clique/toque depois) — sem isso, nada toca */
    destravar() { destravado = true; },
    inscrever(f: (e: EstadoMusica) => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    /** muda o volume suavemente (`ms`); resolve no fim. Um fade novo cancela o anterior. */
    fadeTo(vol: number, ms = 800): Promise<void> {
      const a = api.elemento(); const gen = ++fadeGen; if (fadeId !== null) { cancelar(fadeId); fadeId = null; }
      encerrarFade?.(); encerrarFade = null;   // o fade anterior foi substituído: libera quem esperava por ele
      const de = a.volume, passos = Math.max(1, Math.round(ms / 40));
      return new Promise((ok) => {
        encerrarFade = ok;
        let i = 0;
        const tique = () => {
          if (gen !== fadeGen) return ok();   // outro fade assumiu
          i++; a.volume = volumeNoFade(de, vol, i / passos);
          if (i >= passos) { fadeId = null; encerrarFade = null; ok(); return; }
          fadeId = agendar(tique, ms / passos);
        };
        fadeId = agendar(tique, ms / passos);
      });
    },
    /** toca (troca de faixa se `src` vier) com fade-in; se já tocava outra faixa, faz fade-out antes (sem corte) */
    async tocar(src?: string, o: { loop?: boolean; volume?: number; fadeMs?: number } = {}): Promise<boolean> {
      const a = api.elemento(src ?? "");
      alvoVolume = o.volume ?? VOLUME_MUSICA;
      if (src && a.src && !a.src.endsWith(src) && !a.paused) { mudar("fade"); await api.fadeTo(0, 400); }
      if (src && !a.src.endsWith(src)) { a.src = src; a.currentTime = 0; }
      if (o.loop !== undefined) a.loop = o.loop;
      if (a.paused) a.volume = 0;
      try { await a.play(); } catch { mudar("parado"); return false; }
      mudar("tocando");
      void api.fadeTo(alvoVolume, o.fadeMs ?? 800);   // o fade-in segue sozinho; quem chamou já sabe que tocou
      return true;
    },
    /** para SEM corte: fade até 0 (`ms`) e só então pausa */
    async parar(ms = 800): Promise<void> {
      if (!el || el.paused) { mudar("parado"); return; }
      mudar("fade"); const gen = fadeGen + 1;
      await api.fadeTo(0, ms);
      if (gen !== fadeGen) return;   // alguém voltou a tocar no meio do fade
      try { el.pause(); el.loop = false; } catch { /* ignore */ }
      mudar("parado");
    },
    /** só se estiver PARADO: volta pra faixa inicial (o reset que o navbar fazia na home, agora sem cortar nada) */
    rebobinarSeParado(src: string) { if (estado !== "parado" || !el || !el.paused) return false; if (!el.src.endsWith(src)) el.src = src; el.currentTime = 0; return true; },
  };
  return api;
}

/** o controlador do site (singleton do navegador) */
let unico: ReturnType<typeof criarControladorMusica> | null = null;
export function musica() {
  if (!unico) unico = criarControladorMusica({
    criarElemento: (src) => { const a = new Audio(src || undefined); a.crossOrigin = "anonymous"; (window as unknown as { zaeonAudio?: HTMLAudioElement }).zaeonAudio = a; return a as unknown as AudioLike; },
  });
  return unico;
}
