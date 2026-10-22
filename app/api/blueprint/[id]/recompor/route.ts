/**
 * POST /api/blueprint/:id/recompor → { blueprint, resultado } — "Zaeon, atualiza": recompõe agora (ignora o intervalo de
 * 2 min) a partir do que a conversa já tem. Sem o histórico do chat aqui, a Zaeon trabalha com o próprio blueprint e o
 * pedido de revisão. Só o dono (é quem conversa).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { NextResponse } from "next/server";
import { blueprintDoTurno, blueprintDoUsuario } from "@/lib/blueprint/server";
import { blueprintOn } from "@/lib/blueprint/tipos";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!blueprintOn()) return falhaBoard("not_found");
  const a = await entrarNoBoard(req, "blueprint-recompor", "ai-heavy"); if ("response" in a) return a.response;
  const atual = await blueprintDoUsuario(params.id, a.userId);
  if (!atual || !atual.scopeId) return falhaBoard("not_found");
  if (atual.papel !== "dono") return falhaBoard("forbidden");
  const resultado = await blueprintDoTurno({
    userId: a.userId, scopeId: atual.scopeId, sinal: null, forcar: true, history: [],
    prompt: "Revise e melhore este blueprint: deixe os passos, as peças e os críticos mais concretos e práticos.", answerTexto: "",
  });
  const blueprint = await blueprintDoUsuario(params.id, a.userId);
  return NextResponse.json({ blueprint, resultado });
}
