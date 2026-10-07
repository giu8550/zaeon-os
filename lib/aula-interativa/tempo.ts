/**
 * lib/aula-interativa/tempo.ts — quando cada `[[marca]]` é dita e as legendas por frase.
 *
 * O Papermorph tira isso do edge-tts, que devolve o instante de cada palavra (WordBoundary).
 * O Gemini-TTS (a voz da Zaeon) não devolve — então estimamos pela PROPORÇÃO do texto: a marca
 * na posição p de um texto de n caracteres, num áudio de d segundos, cai em ~p/n·d. Pontuação
 * pesa um pouco mais (é onde a voz respira). Erro típico: meio segundo — suficiente pra uma
 * animação entrar "junto" com a palavra. Sem áudio, a duração é estimada pela fala (~14 car/s).
 */
import { separarMarcas, type TempoBeat } from "@/lib/aula-interativa/contrato";

/** Peso de cada caractere no tempo da fala: pausa em pontuação. */
function peso(ch: string): number {
  if (/[.!?…]/.test(ch)) return 6;
  if (/[,;:—–]/.test(ch)) return 3;
  return 1;
}

function pesosAcumulados(texto: string): number[] {
  const acc = [0];
  for (const ch of texto) acc.push(acc[acc.length - 1] + peso(ch));
  return acc;
}

/** Duração estimada da fala em PT-BR (sem áudio): ~14 caracteres/s + pausas. */
export function duracaoEstimada(narracao: string): number {
  const { limpa } = separarMarcas(narracao);
  const acc = pesosAcumulados(limpa);
  return Math.max(2.5, Math.round((acc[acc.length - 1] / 14 + 0.6) * 10) / 10);
}

/** Frases da narração (para a legenda), com a posição em que cada uma começa. */
function frases(limpa: string): { pos: number; texto: string }[] {
  const out: { pos: number; texto: string }[] = [];
  const re = /[^.!?…]+[.!?…]*\s*/g;
  for (const m of limpa.matchAll(re)) {
    const t = m[0].trim();
    if (t) out.push({ pos: m.index ?? 0, texto: t });
  }
  return out;
}

/**
 * Tempos do beat dado o áudio real (`duracao` em s) ou a estimativa. A primeira fração de segundo
 * é ataque da voz; o fim, respiro — a proporção roda no meio.
 */
export function temposDoBeat(narracao: string, duracao?: number, audio?: string): TempoBeat {
  const { limpa, marcas } = separarMarcas(narracao);
  const d = duracao && duracao > 0 ? duracao : duracaoEstimada(narracao);
  const acc = pesosAcumulados(limpa);
  const total = acc[acc.length - 1] || 1;
  const ataque = Math.min(0.25, d * 0.05);
  const util = Math.max(0.1, d - ataque - Math.min(0.35, d * 0.06));
  const em = (pos: number) => Math.round((ataque + (acc[Math.min(pos, acc.length - 1)] / total) * util) * 100) / 100;
  const tm: Record<string, number> = {};
  for (const [nome, pos] of Object.entries(marcas)) tm[nome] = em(pos);
  return {
    duracao: Math.round(d * 100) / 100,
    marcas: tm,
    legendas: frases(limpa).map((f) => [em(f.pos), f.texto] as [number, string]),
    ...(audio ? { audio } : {}),
  };
}

/** Duração de um WAV PCM (cabeçalho padrão de 44 bytes ou chunks), em segundos. */
export function duracaoWav(buf: Buffer): number {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") return 0;
  let off = 12, byteRate = 0, dados = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const tam = buf.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(off + 16);
    if (id === "data") { dados = Math.min(tam, buf.length - off - 8); break; }
    off += 8 + tam + (tam % 2);
  }
  return byteRate ? dados / byteRate : 0;
}
