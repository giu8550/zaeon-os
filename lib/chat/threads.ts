/**
 * lib/chat/threads.ts — conversas da Aura como coisas separadas.
 *
 * Até aqui a Sala de Estudos tinha UMA thread: a chave `zaeon.cowork.thread.v1` guardava
 * um único histórico, e falar de cafeína e de Kant era a mesma conversa infinita. Isto
 * quebra em threads: cada aba é uma conversa com histórico próprio.
 *
 * Aritmética e armazenamento, sem React: dá pra testar num terminal. Todo acesso ao
 * localStorage é embrulhado — em aba anônima ele lança, e perder a aba é ruim, mas
 * derrubar a sala inteira é pior.
 *
 * A thread velha não é jogada fora: na primeira abertura ela vira a primeira aba, com o
 * histórico intacto. Ninguém perde conversa por causa de refactor.
 */

export type Thread = {
  id: string;
  titulo: string;
  criadaEm: number;
  /** Última vez que a pessoa mexeu nela — ordena as abas. */
  tocadaEm: number;
};

export const CHAVE_INDICE = "zaeon.cowork.threads.v1";
export const CHAVE_ATIVA = "zaeon.cowork.threadAtiva.v1";
/** A thread única de antes do refactor. Vira a aba #1 na migração. */
export const CHAVE_LEGADA = "zaeon.cowork.thread.v1";

export const TITULO_PADRAO = "Nova conversa";
/** Teto de abas: acima disso a barra vira um acordeão e ninguém acha nada. */
export const MAX_ABAS = 12;

export const chaveDaThread = (id: string) => `zaeon.cowork.thread.${id}`;

/** Armazenamento injetável — o teste passa um mapa, o navegador passa o localStorage. */
export type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function ler<T>(a: Armazem, chave: string, padrao: T): T {
  try {
    const bruto = a.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(a: Armazem, chave: string, valor: unknown): void {
  try {
    a.setItem(chave, JSON.stringify(valor));
  } catch {
    /* aba anônima / cota estourada: a sessão segue em memória */
  }
}

export function novoId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Título a partir da primeira mensagem — igual ao que toda IA faz, e melhor do que
 * "Nova conversa (3)". Corta na primeira quebra de sentido, não no meio da palavra.
 */
export function tituloAPartirDe(texto: string, limite = 34): string {
  const limpo = (texto || "").replace(/\s+/g, " ").trim();
  if (!limpo) return TITULO_PADRAO;
  const frase = limpo.split(/[.!?\n]/)[0].trim() || limpo;
  if (frase.length <= limite) return frase;
  const corte = frase.slice(0, limite);
  const espaco = corte.lastIndexOf(" ");
  let base = (espaco > limite * 0.6 ? corte.slice(0, espaco) : corte).trim();
  // Tira artigo/preposição pendurada no fim: "profundamente a…" fica feio e não informa.
  base = base.replace(/\s+(a|o|as|os|de|da|do|das|dos|em|no|na|um|uma|e|ou|que|com|por)$/i, "");
  return base + "…";
}

/**
 * Lê o índice de threads. Na primeira vez, adota a conversa legada como aba #1 —
 * migração silenciosa: o aluno abre e a conversa dele está lá, agora numa aba.
 */
export function carregarThreads(a: Armazem): Thread[] {
  const salvas = ler<Thread[]>(a, CHAVE_INDICE, []);
  if (Array.isArray(salvas) && salvas.length) return salvas.filter((t) => t && t.id);

  const legado = ler<any[]>(a, CHAVE_LEGADA, []);
  const agora = Date.now();
  const primeira: Thread = {
    id: novoId(),
    titulo: TITULO_PADRAO,
    criadaEm: agora,
    tocadaEm: agora,
  };
  if (Array.isArray(legado) && legado.length) {
    // Move o histórico pra chave da thread nova e batiza pela 1ª fala do aluno.
    gravar(a, chaveDaThread(primeira.id), legado);
    const primeiraDoAluno = legado.find((m) => m?.role === "user" && typeof m?.text === "string");
    if (primeiraDoAluno) primeira.titulo = tituloAPartirDe(primeiraDoAluno.text);
  }
  gravar(a, CHAVE_INDICE, [primeira]);
  return [primeira];
}

export function salvarThreads(a: Armazem, threads: readonly Thread[]): void {
  gravar(a, CHAVE_INDICE, threads.slice(0, MAX_ABAS));
}

export function threadAtiva(a: Armazem, threads: readonly Thread[]): string | null {
  const salva = (() => { try { return a.getItem(CHAVE_ATIVA); } catch { return null; } })();
  if (salva && threads.some((t) => t.id === salva)) return salva;
  return threads[0]?.id ?? null;
}

export function marcarAtiva(a: Armazem, id: string): void {
  try { a.setItem(CHAVE_ATIVA, id); } catch { /* ignore */ }
}

export function criarThread(threads: readonly Thread[], titulo = TITULO_PADRAO): { threads: Thread[]; nova: Thread } {
  const agora = Date.now();
  const nova: Thread = { id: novoId(), titulo, criadaEm: agora, tocadaEm: agora };
  // Entra no começo: a conversa nova é a que interessa agora.
  return { threads: [nova, ...threads].slice(0, MAX_ABAS), nova };
}

export function renomearThread(threads: readonly Thread[], id: string, titulo: string): Thread[] {
  const limpo = (titulo || "").trim();
  if (!limpo) return [...threads];
  return threads.map((t) => (t.id === id ? { ...t, titulo: limpo, tocadaEm: Date.now() } : t));
}

/**
 * Fecha uma aba e apaga o histórico dela. Nunca deixa zero abas: fechar a última cria
 * uma vazia no lugar — uma sala de conversa sem conversa nenhuma é um beco sem saída.
 */
export function fecharThread(a: Armazem, threads: readonly Thread[], id: string): { threads: Thread[]; proxima: string } {
  try { a.removeItem(chaveDaThread(id)); } catch { /* ignore */ }
  const restantes = threads.filter((t) => t.id !== id);
  if (!restantes.length) {
    const { threads: nova, nova: n } = criarThread([]);
    return { threads: nova, proxima: n.id };
  }
  const idx = threads.findIndex((t) => t.id === id);
  const proxima = restantes[Math.min(idx, restantes.length - 1)].id;
  return { threads: restantes, proxima };
}

/** Marca uso — mantém a ordem estável, só atualiza o carimbo. */
export function tocarThread(threads: readonly Thread[], id: string): Thread[] {
  return threads.map((t) => (t.id === id ? { ...t, tocadaEm: Date.now() } : t));
}

export function carregarMensagens<T = any>(a: Armazem, id: string): T[] {
  return ler<T[]>(a, chaveDaThread(id), []);
}

export function salvarMensagens(a: Armazem, id: string, mensagens: readonly unknown[]): void {
  gravar(a, chaveDaThread(id), mensagens.slice(-60));
}
