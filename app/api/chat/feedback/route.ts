/**
 * POST /api/chat/feedback — o 👍/👎 de uma resposta da Aura, ANONIMIZADO (lib/chat/feedbackDataset).
 * Corpo: { msgId, voto: "up"|"down"|null, pergunta, resposta, modelo, sala }. voto null = desfazer.
 * Guarda só um hash salgado do aluno (pra trocar/desfazer o voto dele) e o texto já anonimizado.
 * Best-effort: nunca derruba nada no chat (o voto também fica no aparelho, como antes).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { resolveUserId } from "@/lib/agent/transcript";
import { anonimizar, hashUsuario, lerEntrada } from "@/lib/chat/feedbackDataset";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const e = lerEntrada(await req.json().catch(() => null));
  if (!e) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const sal = process.env.FEEDBACK_SAL || process.env.NEXTAUTH_SECRET || "zaeon";
  const usuarioHash = hashUsuario(userId, sal);
  const db = prisma as any;
  const atual = await db.chatFeedback.findFirst({ where: { usuarioHash, msgId: e.msgId }, select: { id: true } });
  if (e.voto === null) {
    if (atual) await db.chatFeedback.delete({ where: { id: atual.id } });
    return NextResponse.json({ ok: true, removido: !!atual });
  }
  const dados = {
    voto: e.voto, sala: e.sala ?? "estudos", modelo: e.modelo ?? null,
    pergunta: anonimizar(e.pergunta ?? ""), resposta: anonimizar(e.resposta ?? ""),
    exportadoEm: null, // voto trocado = sai de novo na próxima exportação (a linha nova tem o mesmo id)
  };
  if (atual) await db.chatFeedback.update({ where: { id: atual.id }, data: dados });
  else await db.chatFeedback.create({ data: { usuarioHash, msgId: e.msgId, ...dados } });
  return NextResponse.json({ ok: true });
}
