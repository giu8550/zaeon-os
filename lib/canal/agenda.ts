/**
 * lib/canal/agenda.ts — a AGENDA do escritório (PURO e isomórfico; servidor e tela usam o mesmo).
 *
 * Grade semanal: colunas = dias da semana, linhas = horas (1 quadrado = 1h). Cada pessoa com acesso ao
 * canal marca o seu horário de trabalho; todo mundo do canal vê (decisão do #396). Repete TODA semana:
 * um bloco é (dia da semana, hora inicial, hora final) — não tem data.
 *
 * Marcar: 1º clique escolhe o quadrado inicial; 2º clique NA MESMA COLUNA fecha o intervalo
 * (terça 9 + terça 15 = terça das 9h às 16h: o quadrado das 15h está incluído). A foto da pessoa fica só
 * no quadrado inicial; a cor dela pinta todos até o final. Clique em outra coluna recomeça a seleção.
 */

/** 0 = domingo … 6 = sábado (o mesmo de Date.getDay()). */
export type Dia = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Primeira e última hora da grade (quadrados 7h … 22h; o último vai até 23h). */
export const HORA_INICIO = 7;
export const HORA_FIM = 22;
export const HORAS: readonly number[] = Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i);

/** Ordem das colunas: semana de trabalho primeiro (segunda → domingo). */
export const DIAS_ORDEM: readonly Dia[] = [1, 2, 3, 4, 5, 6, 0];
export const DIA_CURTO: Record<Dia, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };
export const DIA_LONGO: Record<Dia, string> = { 0: "domingo", 1: "segunda", 2: "terça", 3: "quarta", 4: "quinta", 5: "sexta", 6: "sábado" };

/** Um horário marcado. `inicio` e `fim` são QUADRADOS (inclusivos): 9..15 = das 9h às 16h. */
export type Bloco = { id?: string; userId: string; dia: Dia; inicio: number; fim: number };

const ehDia = (v: unknown): v is Dia => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6;
const ehHora = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= HORA_INICIO && (v as number) <= HORA_FIM;

/** Valida e ordena (aceita os dois cliques em qualquer ordem). null = inválido. */
export function normalizarBloco(dia: unknown, a: unknown, b: unknown): Omit<Bloco, "userId" | "id"> | null {
  const d = typeof dia === "string" ? Number(dia) : dia;
  const x = typeof a === "string" ? Number(a) : a;
  const y = typeof b === "string" ? Number(b) : b;
  if (!ehDia(d) || !ehHora(x) || !ehHora(y)) return null;
  return { dia: d, inicio: Math.min(x, y), fim: Math.max(x, y) };
}

const sobrepoe = (p: Pick<Bloco, "dia" | "inicio" | "fim">, q: Pick<Bloco, "dia" | "inicio" | "fim">) =>
  p.dia === q.dia && p.inicio <= q.fim && q.inicio <= p.fim;

/**
 * Aplica o bloco novo de UMA pessoa: os blocos dela que se sobrepõem no mesmo dia saem (ela está
 * redesenhando o próprio horário). Os de outras pessoas ficam — várias pessoas podem dividir o mesmo horário.
 * Devolve também quais saíram (o servidor apaga esses).
 */
export function aplicarBloco<T extends Bloco>(blocos: T[], novo: T): { blocos: T[]; removidos: T[] } {
  const removidos = blocos.filter((b) => b.userId === novo.userId && sobrepoe(b, novo));
  const ficam = blocos.filter((b) => !removidos.includes(b));
  return { blocos: [...ficam, novo], removidos };
}

/** Quem ocupa um quadrado (dia, hora), e se ali é o quadrado INICIAL do bloco (onde vai a foto). */
export function ocupantes<T extends Bloco>(blocos: T[], dia: Dia, hora: number): { bloco: T; inicial: boolean }[] {
  return blocos
    .filter((b) => b.dia === dia && b.inicio <= hora && hora <= b.fim)
    .map((b) => ({ bloco: b, inicial: b.inicio === hora }));
}

// ───────────────────────────── seleção por dois cliques ─────────────────────────────

export type Ancora = { dia: Dia; hora: number } | null;
export type Clique = { dia: Dia; hora: number };
export type ResultadoClique = { ancora: Ancora; bloco: Omit<Bloco, "userId" | "id"> | null };

/** 1º clique marca a âncora; 2º na mesma coluna fecha o bloco; em outra coluna vira a nova âncora. */
export function proximoClique(ancora: Ancora, clique: Clique): ResultadoClique {
  if (!ancora || ancora.dia !== clique.dia) return { ancora: { dia: clique.dia, hora: clique.hora }, bloco: null };
  return { ancora: null, bloco: normalizarBloco(clique.dia, ancora.hora, clique.hora) };
}

// ───────────────────────────── cor e texto ─────────────────────────────

/** Paleta das pessoas (legível no claro e no escuro). A cor é fixa por pessoa — sempre a mesma. */
export const PALETA = ["#38bdf8", "#a78bfa", "#34d399", "#fb923c", "#f472b6", "#facc15", "#60a5fa", "#4ade80", "#f87171", "#2dd4bf"] as const;

export function corDaPessoa(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length]!;
}

/** "terça, das 9h às 16h" (o quadrado final conta inteiro). */
export function textoBloco(b: Pick<Bloco, "dia" | "inicio" | "fim">): string {
  return `${DIA_LONGO[b.dia]}, das ${b.inicio}h às ${b.fim + 1}h`;
}
