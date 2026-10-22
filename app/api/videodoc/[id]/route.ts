/**
 * GET /api/videodoc/:id → { status, titulo, documento, roteiro?, tempos?, duracao?, erro? } — o vídeo de um documento
 * (lib/videodoc): o roteiro dos slides e onde cada frase começa; o áudio sai em /audio. Flag VIDEO_DOC.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import type { MetaVideoDoc } from "@/lib/videodoc/gerar-server";
import { estadoVisivel } from "@/lib/videodoc/server";
import { videoVisivel } from "./acesso";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const rl = await guard(req, "videodoc-get", "ai-light"); if (!rl.ok) return rl.response;
  const art = await videoVisivel(params.id);
  if (!art) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = (art.meta ?? {}) as Partial<MetaVideoDoc>;
  const status = estadoVisivel(art);
  return NextResponse.json({ status, erro: status === "error" ? art.error ?? "interrompido" : null, titulo: art.title, documento: m.documento ?? null, roteiro: m.roteiro ?? null, tempos: m.tempos ?? null, duracao: m.duracao ?? null });
}
