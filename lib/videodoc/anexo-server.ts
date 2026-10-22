/**
 * VÍDEO DE UM PDF ANEXADO no chat (servidor). O anexo vivia só no navegador; pra virar vídeo ele sobe, e — decisão do
 * dono — ENTRA NA BASE DA PESSOA (Minha base, RAG: mesmo caminho e mesmo teto do upload da Minha base). Daí vira um
 * documento `base` e segue o caminho do pedido no chat (lib/videodoc/chat-server).
 */
import { MAX_BYTES } from "@/lib/rag/ingerir";
import { LIMITE_PESSOAL } from "@/lib/rag/minhaBase";
import type { StructuredAnswer } from "@/lib/agent/contracts";
import { sanitizarDocumento } from "@/lib/blueprint/tipos";
import { videoDoChat, type VideoNoChat } from "./chat-server";
import { MOTIVO_CHAT } from "./pedido";

/** os bytes do anexo, se for PDF (data URL "data:application/pdf;base64,…" ou base64 cru — o fluxo legado é PDF) */
export function bytesDoPdf(fileData: string): Uint8Array | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(fileData);
  if (m && m[1] !== "application/pdf") return null;
  const b = Buffer.from(m ? m[2]! : fileData, "base64");
  return b.length > 4 && b.subarray(0, 4).toString("latin1") === "%PDF" && b.length <= MAX_BYTES ? new Uint8Array(b) : null;
}

export async function videoDoAnexo(i: { userId: string; fileData: string; prompt: string; scopeId: string | null }): Promise<VideoNoChat> {
  const bytes = bytesDoPdf(i.fileData);
  if (!bytes) return { titulo: "", motivo: "pdf_falhou" };
  const [{ ragPg }, { ingerirPdf }, { contarEnviadosPessoais, buscarPorId }, { extractPdfStructured }, { enfileirarIndexacao }] = await Promise.all([
    import("@/lib/rag/pg"), import("@/lib/rag/ingerir"), import("@/lib/rag/store"), import("@/lib/scholar/pdf"), import("@/lib/queue/rag"),
  ]);
  const db = ragPg();
  if ((await contarEnviadosPessoais(db, i.userId)) >= LIMITE_PESSOAL) return { titulo: "", motivo: "base_cheia" };
  const r = await ingerirPdf({ db, extrair: extractPdfStructured, enfileirar: enfileirarIndexacao }, { bytes, nomeArquivo: "anexo-do-chat.pdf", origem: "chat", criadoPor: i.userId, permissao: { donoId: i.userId } });
  if (r.status === "erro" || !r.documentoId) return { titulo: "", motivo: "pdf_falhou" };
  const row = await buscarPorId(db, r.documentoId);
  const anexo = sanitizarDocumento({ id: `b${r.documentoId.replace(/[^\w]/g, "").slice(0, 40)}`, titulo: row?.titulo || "Documento anexado", tipo: "base", ref: r.documentoId, base: true });
  return videoDoChat({ userId: i.userId, scopeId: i.scopeId, prompt: i.prompt, anexo });
}

/** a resposta da Aura pro pedido (vai no protocolo @@STRUCTURED@@ — o cliente mostra o card com ▶) */
export function respostaDoVideo(v: VideoNoChat): StructuredAnswer {
  if (v.videoId) return { nucleo: `Pronto — guardei o documento na sua base e a Zaeon está preparando o vídeo de **${v.titulo}**. Ele aparece aqui embaixo (e no estudo, se esta conversa tiver um); leva alguns minutos.`, videoDoc: v };
  return { nucleo: MOTIVO_CHAT[v.motivo ?? ""] ?? "Não consegui preparar o vídeo agora.", videoDoc: v };
}
