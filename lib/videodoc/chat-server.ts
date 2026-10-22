/**
 * VÍDEO DO DOCUMENTO pedido no CHAT (servidor). "Faz um vídeo desse artigo" → escolhe o documento (os do blueprint da
 * conversa + os que esta resposta trouxe; o PDF anexado vence — e entra na Minha base da pessoa, decisão do dono) →
 * `garantirVideo` → o id vai na resposta (`answer.videoDoc`) e, se a conversa tem blueprint, o documento entra lá com o
 * vídeo (o card aparece na Sala de Estudos também — o mesmo vídeo, sem gerar de novo).
 */
import { SURFACE_BLUEPRINT, type Documento } from "@/lib/blueprint/tipos";
import { documentosDaResposta, juntarDocumentos } from "./documentos";
import { escolherDocumento } from "./pedido";
export { MOTIVO_CHAT } from "./pedido";
import { garantirVideo } from "./server";

export type VideoNoChat = { videoId?: string; titulo: string; motivo?: string };

export async function videoDoChat(i: { userId: string; scopeId: string | null; prompt: string; answer?: Parameters<typeof documentosDaResposta>[0]; anexo?: Documento | null }): Promise<VideoNoChat> {
  const [{ prisma }, bp] = await Promise.all([import("@/src/lib/prisma"), import("@/lib/blueprint/server")]);
  const linha = i.scopeId ? await prisma.cartolina.findFirst({ where: { ownerId: i.userId, surface: SURFACE_BLUEPRINT, scopeId: i.scopeId }, orderBy: { createdAt: "asc" } }) : null;
  const doBlueprint = linha ? bp.docDaLinha(linha).documentos : [];
  const docs = juntarDocumentos(doBlueprint, documentosDaResposta(i.answer));
  const doc = escolherDocumento(i.prompt, docs, i.anexo);
  if (!doc) return { titulo: "", motivo: "nenhum_documento" };
  const r = await garantirVideo({ userId: i.userId, documento: doc, blueprintId: linha?.id ?? "" });
  if (!("videoId" in r)) return { titulo: doc.titulo, motivo: r.motivo };
  if (linha) {
    await bp.gravarDoc(linha.id, i.userId, (d) => {
      const todos = juntarDocumentos(d.documentos, [doc]);
      return { ...d, documentos: todos.map((x) => (x.id === doc.id ? { ...x, base: true, videoId: x.videoId ?? r.videoId } : x)) };
    }).catch(() => null);
  }
  return { videoId: r.videoId, titulo: doc.titulo };
}
