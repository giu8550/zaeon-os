/**
 * /api/studio/[id]/aula/[beat] — a narração de UM beat da aula (.studio/<id>-<beat>.<mp3|wav>).
 * Só o dono ouve. A extensão vem dos tempos guardados no artefato (mp3 com ffmpeg; wav sem).
 */
import { prisma } from "@/src/lib/prisma";
import { studioUid } from "@/lib/studio/auth";
import { readStudioFile, sanitizeId } from "@/lib/studio/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string; beat: string } }) {
  const userId = await studioUid();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const art = await prisma.studioArtifact.findUnique({ where: { id: params.id } });
  if (!art || art.ownerId !== userId || art.kind !== "aula") return new Response("Não encontrado", { status: 404 });
  const beat = sanitizeId(params.beat);
  const ext = (art.meta as any)?.tempos?.[beat]?.audio;
  if (ext !== "mp3" && ext !== "wav") return new Response("Beat sem áudio", { status: 404 });
  try {
    const buf = await readStudioFile(`${art.id}-${beat}`, ext);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": ext === "mp3" ? "audio/mpeg" : "audio/wav",
        "Content-Length": String(buf.length),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new Response("Áudio indisponível", { status: 404 });
  }
}
