/**
 * O SOM DO LOUNGE da Zaeon (PURO): a playlist que o dono sobe pelo TOCA-DISCOS e que toca nas caixas de som — a
 * MESMA música, no MESMO ponto, pra todo mundo da sala.
 *  - o estado é só { faixa atual, tocando?, `desde` (o instante, no relógio do servidor, em que a faixa `i` estaria
 *    no segundo 0), `pos` (onde parou, se pausado) } — cada cliente calcula sozinho onde a música está agora
 *    (`posicaoAgora`), inclusive a troca de faixa quando uma acaba (a playlist dá a volta). Ninguém precisa ser "o DJ";
 *  - controles (tocar/pausar/parar/próxima/anterior/ir) e o upload são do DONO (servidor confere a sessão).
 */
export type Faixa = { id: string; nome: string; arq: string; dur: number; deId: string };
export type EstadoSom = { i: number; tocando: boolean; desde: number; pos: number };
export type SomLounge = { faixas: Faixa[]; estado: EstadoSom };
export type AcaoSom = "tocar" | "pausar" | "parar" | "proxima" | "anterior" | "ir";

export const MAX_FAIXAS = 30;
export const MAX_BYTES_FAIXA = 20 * 1024 * 1024;
/** formatos aceitos (mime → extensão do arquivo guardado) */
export const EXT_AUDIO: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/webm": "webm", "audio/flac": "flac", "audio/x-flac": "flac",
};
export const MIME_DA_EXT: Record<string, string> = { mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", webm: "audio/webm", flac: "audio/flac" };
/** o arquivo guardado: "lm_<20 hex>.<ext>" (nada de caminho vindo do cliente) */
export const ARQ_RE = /^lm_[a-f0-9]{20}\.(mp3|ogg|wav|m4a|aac|webm|flac)$/;
/** "anterior" volta pro começo da MESMA faixa se ela já passou disso (s), como num player normal */
export const VOLTA_INICIO_S = 3;

export const somVazio = (): SomLounge => ({ faixas: [], estado: { i: 0, tocando: false, desde: 0, pos: 0 } });

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const num = (v: unknown, min: number, max: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);

export function sanitizarFaixa(raw: unknown): Faixa | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !/^[a-z0-9]{6,32}$/i.test(r.id) || typeof r.arq !== "string" || !ARQ_RE.test(r.arq)) return null;
  return { id: r.id, nome: texto(r.nome, 80) || "Sem nome", arq: r.arq, dur: num(r.dur, 0, 4 * 3600, 0), deId: typeof r.deId === "string" ? r.deId.slice(0, 40) : "" };
}
export function sanitizarSom(raw: unknown): SomLounge | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const faixas = (Array.isArray(r.faixas) ? r.faixas : []).map(sanitizarFaixa).filter((f): f is Faixa => !!f).slice(0, MAX_FAIXAS);
  const e = (r.estado && typeof r.estado === "object" ? r.estado : {}) as Record<string, unknown>;
  const i = Math.round(num(e.i, 0, Math.max(0, faixas.length - 1), 0));
  return { faixas, estado: { i, tocando: e.tocando === true && faixas.length > 0, desde: num(e.desde, 0, 1e14, 0), pos: num(e.pos, 0, 4 * 3600, 0) } };
}

/** onde a música está AGORA (`agora` no relógio do servidor, ms): faixa e segundo dentro dela; a playlist dá a volta */
export function posicaoAgora(s: SomLounge, agora: number): { i: number; t: number } | null {
  const n = s.faixas.length; if (!n) return null;
  const e = s.estado, i0 = Math.min(n - 1, Math.max(0, e.i));
  if (!e.tocando) return { i: i0, t: e.pos };
  let t = Math.max(0, (agora - e.desde) / 1000), i = i0;
  const total = s.faixas.reduce((a, f) => a + f.dur, 0);
  if (total <= 0) return { i, t };                         // sem duração conhecida: fica na faixa atual
  if (t >= total) t %= total;                              // ciclos inteiros da playlist
  for (let k = 0; k < n * 2; k++) {
    const d = s.faixas[i]!.dur;
    if (d <= 0 || t < d) return { i, t };
    t -= d; i = (i + 1) % n;
  }
  return { i, t: 0 };
}

/** aplica um controle do toca-discos no instante `agora` (relógio do servidor) */
export function controlar(s: SomLounge, acao: AcaoSom, agora: number, alvo?: number): SomLounge {
  const n = s.faixas.length; if (!n) return { ...s, estado: { i: 0, tocando: false, desde: 0, pos: 0 } };
  const p = posicaoAgora(s, agora)!, tocando = s.estado.tocando;
  const em = (i: number, pos: number, toca: boolean): SomLounge => ({ ...s, estado: { i: ((i % n) + n) % n, tocando: toca, desde: toca ? agora - pos * 1000 : 0, pos: toca ? 0 : pos } });
  switch (acao) {
    case "tocar": return tocando ? s : em(p.i, p.t, true);
    case "pausar": return tocando ? em(p.i, p.t, false) : s;
    case "parar": return em(p.i, 0, false);
    case "proxima": return em(p.i + 1, 0, tocando);
    case "anterior": return p.t > VOLTA_INICIO_S ? em(p.i, 0, tocando) : em(p.i - 1, 0, tocando);
    case "ir": return typeof alvo === "number" && alvo >= 0 && alvo < n ? em(Math.floor(alvo), 0, true) : s;
  }
}

/** põe uma faixa no fim da playlist (com teto) — se nada tocava e a lista estava vazia, já começa a tocar */
export function adicionarFaixa(s: SomLounge, f: Faixa, agora: number): SomLounge {
  if (s.faixas.length >= MAX_FAIXAS) return s;
  const faixas = [...s.faixas, f];
  return s.faixas.length === 0 ? { faixas, estado: { i: 0, tocando: true, desde: agora, pos: 0 } } : { ...s, faixas };
}

/** tira uma faixa; se era a que tocava, segue na próxima (do começo); o índice da atual se ajusta */
export function removerFaixa(s: SomLounge, id: string, agora: number): SomLounge {
  const k = s.faixas.findIndex((f) => f.id === id); if (k < 0) return s;
  const p = posicaoAgora(s, agora)!, faixas = s.faixas.filter((f) => f.id !== id), n = faixas.length;
  if (!n) return somVazio();
  const tocando = s.estado.tocando;
  if (k === p.i) { const i = k % n; return { faixas, estado: { i, tocando, desde: tocando ? agora : 0, pos: 0 } }; }
  const i = k < p.i ? p.i - 1 : p.i;
  return { faixas, estado: tocando ? { i, tocando, desde: agora - p.t * 1000, pos: 0 } : { i, tocando, desde: 0, pos: p.t } };
}

/** "3:07" */
export const tempo = (s: number) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
/** nome bonito a partir do arquivo enviado ("01 - Minha Música.mp3" → "01 - Minha Música") */
export const nomeDoArquivo = (n: string) => texto(n.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " "), 80) || "Sem nome";
