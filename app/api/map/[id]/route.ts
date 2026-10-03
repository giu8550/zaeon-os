/**
 * GET   /api/map/[id]                      → o mapa (dono ou membro do estudo)
 * PATCH /api/map/[id] { noId, estado?, msgIds? } → o ALUNO marca um nó como "aprendido" (só pra frente;
 *       "aplicado" é pela rota apply; "validado" só pelo validador) e/ou acrescenta msgIds.
 */
import { NextResponse } from "next/server";
import { entrar, falha } from "@/lib/map/route-auth";
import { getMapaForUser, patchMapa } from "@/lib/map/store";
import { setEstado } from "@/lib/map/grafo";
import { completudes } from "@/lib/map/backbone";
import { sanitizeScopeId } from "@/lib/cartolina/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await entrar(req, "map-id-get");
  if ("response" in a) return a.response;
  const r = await getMapaForUser(params.id, a.userId);
  if (!r) return falha("not_found");
  return NextResponse.json({ mapa: r.mapa, papel: r.papel });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const a = await entrar(req, "map-id-patch");
  if ("response" in a) return a.response;
  const r = await getMapaForUser(params.id, a.userId);
  if (!r) return falha("not_found");
  if (r.papel === "leitor") return falha("forbidden");
  const b = await req.json().catch(() => ({}));
  const noId = sanitizeScopeId(b?.noId);
  if (!noId) return falha("invalid");
  const estado = b?.estado === "aprendido" ? "aprendido" : null;
  const msgIds = Array.isArray(b?.msgIds) ? b.msgIds.map(sanitizeScopeId).filter((x: string | null): x is string => !!x).slice(0, 20) : [];
  if (!estado && !msgIds.length) return falha("invalid");
  const p = await patchMapa(params.id, (atual) => {
    let nos = atual.nos;
    if (!nos.some((n) => n.id === noId)) return null;
    if (estado) nos = setEstado(nos, noId, estado) ?? nos;
    if (msgIds.length) nos = nos.map((n) => (n.id === noId ? { ...n, msgIds: [...new Set([...n.msgIds, ...msgIds])].slice(-20) } : n));
    const c = completudes({ nos, backbone: atual.backbone, modoValidacao: atual.modoValidacao });
    return { nos, completudeAprendizado: c.aprendizado, completudeConclusao: c.conclusao };
  });
  if (!p.ok) return falha(p.reason);
  return NextResponse.json({ mapa: p.mapa });
}
