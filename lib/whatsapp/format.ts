/**
 * lib/whatsapp/format.ts — markdown (resposta do harness) → texto do WhatsApp. PURO.
 * O Zap entende *negrito*, _itálico_, ~riscado~ e ``` monoespaçado; não entende #, [x](y), tabelas.
 */

export const WA_MAX_CHARS = 3500; // limite prático (o WhatsApp aceita ~65k, mas ninguém lê)

export function toWhatsAppText(md: string | null | undefined, max = WA_MAX_CHARS): string {
  let t = (md ?? "").replace(/\r\n/g, "\n").trim();
  if (!t) return "Sem resposta agora.";
  t = t.replace(/```[a-z]*\n?([\s\S]*?)```/g, "$1");        // blocos de código → texto
  t = t.replace(/`([^`\n]+)`/g, "$1");                          // inline code
  t = t.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");                   // headings → negrito
  t = t.replace(/\*\*([^*\n]+)\*\*/g, "*$1*");                  // **x** → *x*
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)"); // links
  t = t.replace(/^\s*[-*]\s+/gm, "• ");                         // listas
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  if (t.length > max) t = t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
  return t;
}
