/**
 * Estúdio de avatar vivo em DEV (Etapa A — o Claude Code cria os avatares da casa com o dono
 * vendo ao lado). Só existe fora de produção. Mesmo contrato da rota do admin, mas salva em
 * public/avatars/<id>/ (vai pro git e pro build).
 *   POST { acao: "base" | "base-de-imagem" | "estado", … } · POST { acao: "salvar", agentId, … }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextResponse } from "next/server";
import { atenderEstudio, validarSalvar } from "@/lib/avatars/estudio";
import { salvarNoDisco } from "@/lib/avatars/disco";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body?.acao === "salvar") {
    const v = validarSalvar(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    try {
      const manifest = salvarNoDisco(String(body.agentId || "").toLowerCase(), v.set);
      return NextResponse.json({ ok: true, versao: manifest.versao });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }
  const r = await atenderEstudio(body);
  return NextResponse.json(r.json, { status: r.status });
}
