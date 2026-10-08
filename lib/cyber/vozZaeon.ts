/**
 * Cyberespaço — a VOZ DA ZAEON no holograma do tutorial (PURO, sem three nem rede). A voz é a mesma do laboratório
 * (Gemini-TTS, Leda, pt-BR), mas o caminho é do cyberespaço: rota própria (app/api/lounge3d/[id]/zaeon/voz), limite
 * próprio e custo como "cyber:zaeon-voz". Aqui ficam as regras:
 *  - o TEXTO que vai pra síntese (sem ✦/emoji — a voz não lê símbolo);
 *  - as falas FIXAS (conhecidas antes: pré-geradas quando o Droid leva a pessoa à capela);
 *  - quanto esperar o áudio antes de mostrar o balão sem voz, e quanto tempo a fala ocupa (`tempoDaFala`);
 *  - a boca do holograma pelo volume da voz (`bocaDoNivel`);
 *  - o CACHE das sínteses (em memória, por texto) com uma fila de poucas chamadas ao mesmo tempo.
 */
import { ABERTURA, OPCOES_SITUACAO, PERGUNTAS, fechamento, perguntaDoRoteiro, reacaoFixa } from "./conversaZaeon";

/** a voz da Zaeon (o id do catálogo de lib/voice/gemini-tts) */
export const VOZ_ZAEON = "leda";
/** teto de caracteres por fala (as dela são curtas; a IA fala até ~200) */
export const MAX_TEXTO_VOZ = 280;

/** o texto que a voz lê: sem emoji/símbolos decorativos, espaços colapsados, com teto */
export function textoDaVoz(texto: string): string {
  return texto.replace(/[\p{Extended_Pictographic}✦✧✨️]/gu, " ").replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO_VOZ);
}

/** a fala que ela repete quando não entende o nome (engine `responderZaeon`) */
export const REPERGUNTA_NOME = "Não peguei… como você quer que eu te chame?";

/** as falas FIXAS da conversa (as que não dependem do que a pessoa responde) — já no texto da voz, sem repetição */
export function falasFixasZaeon(): string[] {
  const situacoes = [...OPCOES_SITUACAO.map((o) => reacaoFixa("situacao", o.rotulo, { situacao: o.v })), reacaoFixa("situacao", "", {})];
  // a 1ª pergunta depois da situação (do roteiro: depende só da situação)
  const roteiro = [...OPCOES_SITUACAO.map((o) => perguntaDoRoteiro("foco", { situacao: o.v }).fala), perguntaDoRoteiro("querEstudar", {}).fala, perguntaDoRoteiro("objetivo", {}).fala];
  const todas = [...ABERTURA, ...PERGUNTAS.map((p) => p.fala), REPERGUNTA_NOME, ...situacoes, ...roteiro, ...fechamento({}).slice(1)];
  return [...new Set(todas.map(textoDaVoz).filter(Boolean))];
}

/** quanto esperar (s) o áudio antes de mostrar o balão SEM voz: fixa (já devia estar no cache) × gerativa (texto novo —
 *  o nome da pessoa, a resposta da IA: a síntese acabou de começar e ela fica com a cara de "pensando"). Se a voz
 *  chegar depois do prazo e ela ainda estiver nessa fala, a voz entra atrasada (`duracaoComAtraso`) */
export const ESPERA_VOZ = { fixa: 1.5, gerativa: 6 } as const;
/** o respiro depois da voz antes da próxima fala */
export const FOLGA_FALA = 0.4;
/** quanto tempo a fala OCUPA (s): o tempo fixo do roteiro ou a duração do áudio + a folga — o que for maior */
export function tempoDaFala(fixo: number, durAudio?: number | null): number {
  return durAudio && Number.isFinite(durAudio) && durAudio > 0 ? Math.max(fixo, durAudio + FOLGA_FALA) : fixo;
}

/** a voz que chegou ATRASADA (o balão já está na tela há `decorrido` s): a fala passa a ocupar o que já passou + o
 *  áudio inteiro (o `tempoDaFala` soma a folga) */
export function duracaoComAtraso(decorrido: number, durAudio: number): number {
  return Math.max(0, Number.isFinite(decorrido) ? decorrido : 0) + Math.max(0, durAudio);
}

/** a boca do holograma pelo nível da voz (0..1, de lib/voice/nivelVoz `nivelDaBoca`): 3 degraus, como no laboratório */
export type BocaHolo = "talk" | "talk_half" | "idle";
export const NIVEIS_BOCA = { meia: 0.15, aberta: 0.55 } as const;
export function bocaDoNivel(nivel: number): BocaHolo {
  return nivel >= NIVEIS_BOCA.aberta ? "talk" : nivel >= NIVEIS_BOCA.meia ? "talk_half" : "idle";
}

/** o CACHE das sínteses: uma promessa por texto (pedir de novo o mesmo texto não sintetiza de novo); no máximo
 *  `paralelo` sínteses ao mesmo tempo (o resto espera na fila — `pegar` passa na frente do `preaquecer`); falha ou
 *  null sai do cache (dá pra tentar de novo depois). */
export type CacheVoz<T> = { pegar(texto: string): Promise<T | null>; preaquecer(textos: string[]): void; tem(texto: string): boolean };
export function criarCacheVoz<T>(sintetizar: (texto: string) => Promise<T | null>, o: { paralelo?: number } = {}): CacheVoz<T> {
  const paralelo = Math.max(1, o.paralelo ?? 3), cache = new Map<string, Promise<T | null>>();
  const fila: { texto: string; ok: (v: T | null) => void }[] = [];
  let rodando = 0;
  const proximo = () => {
    while (rodando < paralelo && fila.length) {
      const it = fila.shift()!; rodando++;
      let p: Promise<T | null>;
      try { p = sintetizar(it.texto); } catch { p = Promise.resolve(null); }
      p.then((v) => v ?? null, () => null).then((v) => { if (v === null) cache.delete(it.texto); it.ok(v); rodando--; proximo(); });
    }
  };
  const pedir = (bruto: string, urgente: boolean): Promise<T | null> => {
    const texto = textoDaVoz(bruto); if (!texto) return Promise.resolve(null);
    const ja = cache.get(texto);
    if (ja) {
      if (urgente) { const i = fila.findIndex((x) => x.texto === texto); if (i > 0) fila.unshift(...fila.splice(i, 1)); }
      return ja;
    }
    const p = new Promise<T | null>((ok) => { const it = { texto, ok }; if (urgente) fila.unshift(it); else fila.push(it); });
    cache.set(texto, p); proximo();
    return p;
  };
  return {
    pegar: (texto) => pedir(texto, true),
    preaquecer(textos) { for (const t of textos) void pedir(t, false); },
    tem: (texto) => cache.has(textoDaVoz(texto)),
  };
}
