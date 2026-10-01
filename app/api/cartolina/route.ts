/**
 * GET  /api/cartolina?surface=&scopeId=  → { board | null }   (o board do dono p/ aquela conversa)
 * POST /api/cartolina { topic, surface, scopeId, regenerar? } → { board }   (gera com a Aura e PERSISTE)
 * Docs: docs/HANDOFF_CARTOLINA_MEMORIA.md. Atrás de CARTOLINA_MEMORIA=1.
 */
import { NextResponse } from "next/server";
import { gerarCartolina } from "@/lib/caderno/cartolina";
import { entrar, sanitizeScopeId } from "@/lib/cartolina/route-auth";
import { createBoard, findOwnBoard, isCartolinaSurface } from "@/lib/cartolina/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const a = await entrar(req, "cartolina-get");
  if ("response" in a) return a.response;
  const sp = new URL(req.url).searchParams;
  const surface = sp.get("surface") ?? "estudos";
  if (!isCartolinaSurface(surface)) return NextResponse.json({ error: "surface inválida" }, { status: 400 });
  const board = await findOwnBoard(a.userId, surface, sanitizeScopeId(sp.get("scopeId")));
  return NextResponse.json({ board });
}

export async function POST(req: Request) {
  const a = await entrar(req, "cartolina-post", "ai-heavy"); // gera com LLM → balde pesado
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const topic = typeof body?.topic === "string" ? body.topic.trim().slice(0, 300) : "";
  const surface = body?.surface ?? "estudos";
  if (!topic) return NextResponse.json({ error: "Informe um tópico." }, { status: 400 });
  if (!isCartolinaSurface(surface)) return NextResponse.json({ error: "surface inválida" }, { status: 400 });
  const scopeId = sanitizeScopeId(body?.scopeId);

  // Já existe board nessa conversa e ninguém pediu pra regerar → devolve o existente.
  // Evita duplicata em duplo-clique/reload E custo de modelo à toa.
  if (body?.regenerar !== true) {
    const existente = await findOwnBoard(a.userId, surface, scopeId);
    if (existente) return NextResponse.json({ board: existente });
  }
  const cards = await gerarCartolina(topic);
  if (!cards.length) return NextResponse.json({ error: "Falha ao gerar a cartolina." }, { status: 502 });
  const board = await createBoard({ ownerId: a.userId, surface, scopeId, titulo: cards[0]?.titulo || topic, cards });
  return NextResponse.json({ board }, { status: 201 });
}
