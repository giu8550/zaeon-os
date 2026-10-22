/**
 * GET /api/videodoc/:id/audio → a NARRAÇÃO do vídeo do documento (WAV, voz da Zaeon). Mesma regra de quem vê da rota do
 * vídeo. Aceita Range (o player pula de slide em slide).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { guard } from "@/src/lib/ratelimit";
import { readStudioFile } from "@/lib/studio/storage";
import { videoVisivel } from "../acesso";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const rl = await guard(req, "videodoc-audio", "ai-light"); if (!rl.ok) return rl.response;
  const art = await videoVisivel(params.id);
  if (!art || art.status !== "done" || art.storageRef !== "wav") return new Response("Não encontrado", { status: 404 });
  const buf = await readStudioFile(art.id, "wav").catch(() => null);
  if (!buf) return new Response("Não encontrado", { status: 404 });
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
  if (range) {
    // "bytes=-N" = os ÚLTIMOS N bytes (sufixo); "bytes=A-" = de A até o fim
    const sufixo = !range[1] && !!range[2];
    const ini = sufixo ? Math.max(0, buf.length - Number(range[2])) : range[1] ? Number(range[1]) : 0;
    const fim = sufixo ? buf.length - 1 : range[2] ? Math.min(Number(range[2]), buf.length - 1) : buf.length - 1;
    if (ini > fim || ini >= buf.length) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${buf.length}` } });
    return new Response(new Uint8Array(buf.subarray(ini, fim + 1)), { status: 206, headers: { "Content-Type": "audio/wav", "Content-Range": `bytes ${ini}-${fim}/${buf.length}`, "Content-Length": String(fim - ini + 1), "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=86400" } });
  }
  return new Response(new Uint8Array(buf), { status: 200, headers: { "Content-Type": "audio/wav", "Content-Length": String(buf.length), "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=86400" } });
}
