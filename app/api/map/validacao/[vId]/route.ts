/**
 * POST /api/map/validacao/[vId] { status: "aprovada"|"rejeitada", comentario? } — decisão do VALIDADOR
 * (professor vinculado e habilitado, ou instituição). Aprovar → nó validado + AURA + atestado (humana).
 * Ninguém valida o próprio estudo (403); fora do vínculo (403); já decidida (409).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { entrar, falha } from "@/lib/map/route-auth";
import { decidirValidacao, podeValidar } from "@/lib/map/validacao";
import { depsReais, OID, verificadorAtual, vinculadoAoAluno } from "@/lib/map/validacao-server";
import { viewDeLinha } from "@/lib/map/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { vId: string } }) {
  const a = await entrar(req, "map-validacao");
  if ("response" in a) return a.response;
  if (!OID.test(params.vId)) return falha("not_found");
  const v = await prisma.mapaValidacao.findUnique({ where: { id: params.vId } });
  if (!v) return falha("not_found");
  const me = await verificadorAtual();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (v.validadorId !== me.id) return falha("not_found"); // endereçada a outro: indistinguível de inexistente
  const g = podeValidar(me, v.alunoId, await vinculadoAoAluno(me.id, me.role, me.institution, v.alunoId));
  if (!g.ok) return NextResponse.json({ error: g.motivo === "conflito" ? "Ninguém valida o próprio estudo." : "Forbidden", motivo: g.motivo }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const status = b?.status;
  if (status !== "aprovada" && status !== "rejeitada") return NextResponse.json({ error: "status deve ser aprovada|rejeitada" }, { status: 400 });
  const comentario = typeof b?.comentario === "string" ? b.comentario.trim().slice(0, 2000) || null : null;
  const row = await prisma.mapaProbabilistico.findUnique({ where: { id: v.mapaId } });
  if (!row) return falha("not_found");
  const out = await decidirValidacao(depsReais(), v as any, viewDeLinha(row), status, comentario);
  if (!out.ok) {
    if (out.motivo === "ja_decidida") return NextResponse.json({ error: "Validação já decidida.", motivo: out.motivo }, { status: 409 });
    return falha(out.motivo === "not_found" || out.motivo === "no_inexistente" ? "not_found" : "conflict");
  }
  return NextResponse.json({ ok: true, status: out.validacao.status, estado: out.estado, credentialId: out.credentialId, completudeConclusao: out.mapa.completudeConclusao });
}
