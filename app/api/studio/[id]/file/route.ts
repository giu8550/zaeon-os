/**
 * /api/studio/[id]/file — stream do arquivo binário do artefato (áudio/vídeo/imagem).
 * Lê de .studio/<id>.<storageRef>. Só o dono baixa. HTML (diagrama) sai com CSP sandbox.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { studioUid } from "@/lib/studio/auth";
import { readStudioFile } from "@/lib/studio/storage";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await studioUid();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const art = await prisma.studioArtifact.findUnique({ where: { id: params.id } });
  if (!art || art.ownerId !== userId) return new Response("Não encontrado", { status: 404 });
  if (!art.storageRef) return new Response("Sem arquivo (artefato é textual)", { status: 404 });

  try {
    const buf = await readStudioFile(art.id, art.storageRef);
    const download = new URL(req.url).searchParams.get("download") === "1";
    const filename = `${(art.title || art.kind || "artefato").replace(/[^\w.-]+/g, "_").slice(0, 80)}.${art.storageRef}`;
    // HTML gerado (diagrama do archify) traz JS próprio (zoom, caminho, exportar). Ele roda SEMPRE em
    // sandbox: no iframe (sandbox="allow-scripts") e, se alguém abrir o link numa aba, o CSP `sandbox`
    // abaixo dá a ele uma origem opaca — script nenhum ganha acesso aos cookies/API do site.
    const html = art.storageRef === "html";
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": html ? "text/html; charset=utf-8" : art.mime || "application/octet-stream",
        "Content-Length": String(buf.length),
        "Cache-Control": "private, max-age=3600",
        ...(html ? {
          "Content-Security-Policy": "sandbox allow-scripts allow-downloads allow-popups; default-src 'none'; style-src 'unsafe-inline' data:; script-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-ancestors 'self'",
          "X-Content-Type-Options": "nosniff",
        } : {}),
        ...(download ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
      },
    });
  } catch {
    return new Response("Arquivo indisponível", { status: 404 });
  }
}
