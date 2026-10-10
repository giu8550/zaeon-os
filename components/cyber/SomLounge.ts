/**
 * SomLounge — o PLAYER do toca-discos do lounge da Zaeon: um <audio> só (troca de faixa = troca de src) ligado nas
 * caixas de som como áudio POSICIONAL (AudioCyber.musica). O estado vem da sala (lib/lounge3d/musica): a cada
 * ~0,4 s confere onde a música DEVERIA estar (relógio do servidor) e acerta — faixa certa, ponto certo (só pula se
 * desgarrar mais de 1,2 s), tocando/pausado. Assim todo mundo ouve a mesma coisa ao mesmo tempo.
 * Antes do áudio do cyberespaço ser liberado (gesto), não toca nada — nem "seco" pelo alto-falante.
 */
import type * as THREE from "three";
import { posicaoAgora, type SomLounge } from "@/lib/lounge3d/musica";
import type { AudioCyberHandle } from "./AudioCyber";

export type SomLoungeHandle = {
  /** o estado da sala (null = sem playlist) e a diferença servidor − cliente (ms) */
  aplicar(som: SomLounge | null, offsetMs: number): void;
  atualizar(dt: number): void;
  /** tem música saindo agora? (as caixas pulsam, o disco gira) */
  readonly tocando: boolean;
  /** onde a música está (a faixa e o segundo dentro dela, no relógio do servidor) — o show do lounge segue isso */
  posicao(): { i: number; t: number } | null;
  /** a música está TOCANDO NA SALA (o estado compartilhado), mesmo que aqui o áudio ainda não tenha sido liberado —
   *  o show (a mandala, as serpentes, a névoa) é visual: segue a sala, não o alto-falante local */
  readonly tocandoNaSala: boolean;
  /** a batida agora (energia dos graves, 0..1; 0 se parado) — as luzes do palco pulsam com ela */
  readonly nivel: number;
  /** ABAFA as caixas por `seg` s (o trovão energizando o som do lounge): o volume cai a zero e volta devagar */
  abafar(seg: number): void;
  /** os LADOS (o ritual corta uma caixa de cada vez): o volume de cada caixa, na ordem delas (0..1) */
  lados(fatores: number[]): void;
  /** SILENCIA de vez (o ritual: só a nave do dono toca) — a música continua "andando" no relógio; volta de onde está */
  silenciar(on: boolean): void;
  dispose(): void;
};

export const DESGARRE_MAX_S = 1.2;

export function criarSomLounge(o: { audio: AudioCyberHandle; caixas: THREE.Object3D[]; urlDe: (arq: string) => string }): SomLoungeHandle {
  const el = new Audio(); el.preload = "auto";
  const saida = o.audio.musica(o.caixas, el);
  let som: SomLounge | null = null, offset = 0, acc = 1, arqAtual = "", buscaPendente: number | null = null, vivo = true, abafado = 0, silencio = false;
  const aplicarVolume = () => saida.volume(silencio ? 0 : abafado > 0.6 ? 0 : abafado > 0 ? 1 - abafado / 0.6 : 1);
  el.addEventListener("loadedmetadata", () => { if (buscaPendente !== null) { try { el.currentTime = buscaPendente; } catch { /* ainda não dá */ } buscaPendente = null; } });

  const sincronizar = () => {
    if (!vivo) return;
    const p = som ? posicaoAgora(som, Date.now() + offset) : null;
    if (!som || !p || !saida.pronta()) { if (!el.paused) el.pause(); return; }
    const f = som.faixas[p.i]!;
    if (f.arq !== arqAtual) {   // outra faixa: troca o src e pula pro ponto certo quando os metadados chegarem
      arqAtual = f.arq; buscaPendente = p.t; el.src = o.urlDe(f.arq); el.load();
    } else if (buscaPendente === null && el.readyState >= 1 && Math.abs(el.currentTime - p.t) > DESGARRE_MAX_S) {
      try { el.currentTime = p.t; } catch { /* sem seek ainda */ }
    }
    if (som.estado.tocando) { if (el.paused) void el.play().catch(() => { /* sem gesto ainda: tenta de novo no próximo ciclo */ }); }
    else if (!el.paused) el.pause();
  };

  return {
    aplicar(s, off) { som = s && s.faixas.length ? s : null; offset = off; acc = 1; sincronizar(); },
    atualizar(dt) {
      acc += dt; if (acc >= 0.4) { acc = 0; sincronizar(); }
      if (abafado > 0) { abafado -= dt; aplicarVolume(); }
    },
    abafar(seg) { abafado = Math.max(abafado, seg); aplicarVolume(); },
    lados(f) { f.forEach((v, i) => saida.volumeCaixa(i, v)); },
    silenciar(on) { if (silencio === on) return; silencio = on; aplicarVolume(); },
    get tocando() { return !el.paused && !!som?.estado.tocando && !silencio; },
    posicao() { return som ? posicaoAgora(som, Date.now() + offset) : null; },
    get tocandoNaSala() { return !!som?.estado.tocando && !silencio; },
    get nivel() { return !el.paused && som?.estado.tocando ? saida.nivel() : 0; },
    dispose() { vivo = false; el.pause(); el.removeAttribute("src"); el.load(); saida.remover(); },
  };
}
