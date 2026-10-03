/**
 * GET /api/map/validacoes?status=pendente — a FILA do validador: só validações endereçadas a mim
 * (validadorId = eu), com o rótulo do nó e o título do estudo. O aluno vê as próprias com ?minhas=1.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { entrar } from "@/lib/map/route-auth";
import { isStatusValidacao } from "@/lib/map/validacao";
import { viewDeLinha } from "@/lib/map/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await entrar(req, "map-validacoes");
  if ("response" in a) return a.response;
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") ?? "pendente";
  if (!isStatusValidacao(status)) return NextResponse.json({ error: "status inválido" }, { status: 400 });
  const minhas = sp.get("minhas") === "1";
  const rows = await prisma.mapaValidacao.findMany({ where: minhas ? { alunoId: a.userId, status } : { validadorId: a.userId, status }, orderBy: { createdAt: "desc" }, take: 100 });
  const mapas = await prisma.mapaProbabilistico.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.mapaId))] } } });
  const alunos = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.alunoId))] } }, select: { id: true, name: true, email: true } });
  const porMapa = new Map(mapas.map((m) => [m.id, viewDeLinha(m)]));
  const porAluno = new Map(alunos.map((u) => [u.id, u]));
  return NextResponse.json({
    validacoes: rows.map((r) => {
      const m = porMapa.get(r.mapaId); const no = m?.nos.find((n) => n.id === r.noId); const u = porAluno.get(r.alunoId);
      return { id: r.id, mapaId: r.mapaId, noId: r.noId, status: r.status, evidencia: r.evidencia, comentario: r.comentario, credentialId: r.credentialId, createdAt: r.createdAt.toISOString(),
        estudo: m ? { titulo: m.titulo, tipoTopico: m.tipoTopico, objetivo: m.objetivo } : null, no: no ? { label: no.label, estado: no.estado } : null,
        aluno: u ? { id: u.id, nome: u.name ?? null, email: minhas ? null : u.email ?? null } : null };
    }),
  });
}
