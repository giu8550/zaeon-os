/**
 * GET /api/octa/design — o índice da biblioteca de estilos DESIGN.md (vendor/design-md, VoltAgent/awesome-design-md, MIT)
 * para a galeria da IDE: `[{ id, nome, resumo, clima, escuro }]`. Sem o markdown nem os tokens (a prévia de cada
 * estilo vem de /api/octa/design/[id]/previa, montada no servidor).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { carregarIndice } from "@/lib/octa/design/indice";

export const runtime = "nodejs";

export type EstiloResumo = { id: string; nome: string; resumo: string; clima: string[]; escuro: boolean };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const lista: EstiloResumo[] = carregarIndice().map((e) => ({
    id: e.id, nome: e.nome, resumo: e.resumo.slice(0, 240), clima: e.clima, escuro: !!e.tokens.escuro,
  }));
  return NextResponse.json(lista, { headers: { "Cache-Control": "private, max-age=3600" } });
}
