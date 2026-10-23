/**
 * lib/canal/anexos.ts — arquivos no Escritório (o 📎 do composer, como no chat).
 *
 * O PDF sobe pra "Minha base" de quem anexou (RAG F3, o mesmo envio do chat: lib/chat/enviarBase) e a mensagem
 * leva a linha "📎 nome.pdf" — o turno do agente (lib/canal/agent-turn) consulta a base com a pergunta e acha o
 * conteúdo; o nome na mensagem também ajuda a busca por palavra e mostra pro canal o que foi anexado.
 */
export const PREFIXO_ANEXO = "📎";
/** Pedido padrão quando a pessoa só anexa (sem escrever nada). */
export const PEDIDO_SO_ANEXO = "Leia o que anexei e me diga os pontos principais.";

const ehPdf = (f: { name: string; type?: string }) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/** Separa o que dá pra anexar (PDF) do resto (o aviso diz quais ficaram de fora). */
export function separarArquivos<T extends { name: string; type?: string }>(arquivos: T[]): { pdfs: T[]; recusados: T[] } {
  const pdfs = arquivos.filter(ehPdf);
  return { pdfs, recusados: arquivos.filter((f) => !ehPdf(f)) };
}

/** O texto que vai pro canal: a linha dos anexos + o que a pessoa escreveu (ou o pedido padrão). */
export function mensagemComAnexos(texto: string, nomes: string[]): string {
  const t = texto.trim();
  if (!nomes.length) return t;
  return `${PREFIXO_ANEXO} ${nomes.join(", ")}\n${t || PEDIDO_SO_ANEXO}`;
}
