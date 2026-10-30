/**
 * POST /api/map/[id]/node/[noId]/apply { evidencia, validadorId? } — o ALUNO (dono) aplica um nó.
 * #661: a evidência é OBRIGATÓRIA (antes, OK com a caixa vazia avançava a etapa e rendia AURA).
 * Modo humana → abre MapaValidacao pendente pro professor vinculado (409 se não há professor).
 * Outros modos → gate automático (AURA node_applied pesada pelo arquétipo).
 */
import { NextResponse } from "next/server";
import { entrar, falha } from "@/lib/map/route-auth";
import { getMapaForUser } from "@/lib/map/store";
import { aplicarNo } from "@/lib/map/validacao";
import { depsReais, OID } from "@/lib/map/validacao-server";
import { sanitizeScopeId } from "@/lib/cartolina/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string; noId: string } }) {
  const a = await entrar(req, "map-apply");
  if ("response" in a) return a.response;
  const r = await getMapaForUser(params.id, a.userId);
  if (!r) return falha("not_found");
  if (r.papel !== "dono") return falha("forbidden"); // só o aluno aplica o PRÓPRIO estudo
  const noId = sanitizeScopeId(params.noId);
  if (!noId) return falha("invalid");
  const b = await req.json().catch(() => ({}));
  const evidencia = typeof b?.evidencia === "string" && b.evidencia.trim() ? b.evidencia.trim().slice(0, 4000) : null;
  if (!evidencia) return NextResponse.json({ error: "Conte como você aplicou esta etapa.", motivo: "sem_evidencia" }, { status: 400 });
  const validadorId = typeof b?.validadorId === "string" && OID.test(b.validadorId) ? b.validadorId : null;
  const out = await aplicarNo(depsReais(), r.mapa, noId, evidencia, validadorId);
  if (!out.ok) {
    if (out.motivo === "sem_professor") return NextResponse.json({ error: "Este estudo exige validação humana e você ainda não tem professor vinculado.", motivo: out.motivo }, { status: 409 });
    if (out.motivo === "ja_validado") return NextResponse.json({ error: "Nó já validado.", motivo: out.motivo }, { status: 409 });
    if (out.motivo === "no_inexistente") return falha("not_found");
    return falha(out.motivo === "not_found" ? "not_found" : "conflict");
  }
  return NextResponse.json({ mapa: out.mapa, validacao: out.validacao, estado: out.estado }, { status: out.validacao ? 201 : 200 });
}
