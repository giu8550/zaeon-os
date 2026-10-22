/**
 * lib/chat/loteAnexos.ts — VÁRIOS arquivos anexados na conversa (📎 com vários / soltar vários / pasta). PURO.
 *
 * 1 PDF segue o chip de hoje (a IA lê o arquivo inteiro). Vários vão pra "Minha base" e ficam VISÍVEIS como chips
 * enquanto estiverem na conversa: cada pergunta leva só os NOMES (por referência — os bytes não vão de novo), e o
 * conteúdo chega pelos trechos da base (lib/rag/turno). Tirar um chip tira o arquivo do foco, não da base.
 */
export type ItemLote = { id: string; nome: string };

/** Teto de nomes no contexto (uma pasta grande não vira um parágrafo de títulos). */
export const MAX_NOMES_NO_CONTEXTO = 12;

/** A frase do systemContext com os arquivos do lote ("" sem lote). */
export function contextoDoLote(lote: readonly ItemLote[]): string {
  if (!lote.length) return "";
  const nomes = lote.slice(0, MAX_NOMES_NO_CONTEXTO).map((a) => `"${a.nome.replace(/"/g, "'")}"`).join("; ");
  const resto = lote.length > MAX_NOMES_NO_CONTEXTO ? ` e mais ${lote.length - MAX_NOMES_NO_CONTEXTO}` : "";
  return ` O aluno anexou ${lote.length} arquivos a esta conversa (guardados na base dele): ${nomes}${resto}. ` +
    "Responda com base nos trechos desses arquivos que vierem da base, citando o título; se a pergunta for sobre eles e nada vier da base, diga isso.";
}

/** O rótulo do balão do aluno (📎 ao lado da pergunta). */
export function rotuloDoLote(lote: readonly ItemLote[]): string | undefined {
  if (!lote.length) return undefined;
  return lote.length === 1 ? lote[0].nome : `${lote.length} arquivos: ${lote.slice(0, 3).map((a) => a.nome).join(", ")}${lote.length > 3 ? "…" : ""}`;
}
