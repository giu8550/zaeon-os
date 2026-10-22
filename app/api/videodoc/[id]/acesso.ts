/**
 * Porta das rotas do vídeo do documento: flag, sessão, o artefato `video-doc` e QUEM pode ver (lib/videodoc/server
 * `podeVerVideo`: o dono, todo mundo se o documento é público, ou quem tem papel num dos blueprints do vídeo).
 */
import { prisma } from "@/src/lib/prisma";
import { resolveUserId } from "@/lib/agent/transcript";
import { KIND_VIDEO_DOC, podeVerVideo, videoDocOn } from "@/lib/videodoc/server";
import type { MetaVideoDoc } from "@/lib/videodoc/gerar-server";

const OID = /^[a-f0-9]{24}$/i;
export async function videoVisivel(id: string) {
  if (!videoDocOn() || !OID.test(id)) return null;
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return null;
  const art = await prisma.studioArtifact.findUnique({ where: { id } });
  if (!art || art.kind !== KIND_VIDEO_DOC) return null;
  const bps = ((art.meta ?? {}) as Partial<MetaVideoDoc>).blueprints?.filter((b) => OID.test(b)) ?? [];
  let comPapel: string[] = [];
  if (art.ownerId !== userId && bps.length) {
    const [donos, membros] = await Promise.all([
      prisma.cartolina.findMany({ where: { id: { in: bps }, ownerId: userId }, select: { id: true } }),
      prisma.cartolinaMembro.findMany({ where: { cartolinaId: { in: bps }, userId }, select: { cartolinaId: true } }),
    ]);
    comPapel = [...donos.map((d) => d.id), ...membros.map((m) => m.cartolinaId)];
  }
  return podeVerVideo(art, userId, comPapel) ? art : null;
}
