/**
 * GET /api/lounge3d/[id]/musica/<lm_xxx.ext> — serve uma música do toca-discos do lounge pra quem é MEMBRO da sala.
 * Com suporte a Range (206): o player pula direto pro ponto em que a música está pra todo mundo.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readStudioFile } from "@/lib/studio/storage";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { lerConteudo } from "@/lib/lounge3d/sala";
import { ARQ_RE, MIME_DA_EXT } from "@/lib/lounge3d/musica";

export async function GET(req: Request, { params }: { params: { id: string; arq: string } }) {
  const off = exigirFlag(); if (off) return off;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ARQ_RE.test(params.arq)) return NextResponse.json({ error: "Inválido" }, { status: 400 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lerConteudo(s.content).somLounge?.faixas.some((f) => f.arq === params.arq)) return NextResponse.json({ error: "Not found" }, { status: 404 });   // só o que está na playlist DESTA sala
  const dot = params.arq.lastIndexOf("."), ext = params.arq.slice(dot + 1);
  let buf: Buffer;
  try { buf = await readStudioFile(params.arq.slice(0, dot), ext); } catch { return NextResponse.json({ error: "Não encontrado" }, { status: 404 }); }
  const tipo = MIME_DA_EXT[ext] ?? "application/octet-stream", total = buf.length;
  const base = { "Content-Type": tipo, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=86400" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (m && (m[1] || m[2])) {
    let ini = m[1] ? Number(m[1]) : total - Number(m[2]), fim = m[1] && m[2] ? Number(m[2]) : total - 1;
    ini = Math.max(0, ini); fim = Math.min(total - 1, fim);
    if (ini > fim || ini >= total) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    return new NextResponse(new Uint8Array(buf.subarray(ini, fim + 1)), { status: 206, headers: { ...base, "Content-Range": `bytes ${ini}-${fim}/${total}`, "Content-Length": String(fim - ini + 1) } });
  }
  return new NextResponse(new Uint8Array(buf), { status: 200, headers: { ...base, "Content-Length": String(total) } });
}
