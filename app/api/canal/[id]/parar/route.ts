/**
 * POST /api/canal/[id]/parar — o "■ Parar" do Escritório (#635). Grava a linha "Fulana interrompeu a resposta"
 * (sistema, autorId = AUTOR_PARAR): o turno de cada agente que ainda está escrevendo confere, antes de gravar, se ela
 * chegou depois da mensagem que o convocou — e aí a resposta não entra no canal (lib/canal/parar). Se mais de uma
 * agente estava respondendo, para todas. `agentes` (opcional) = quem a tela mostrava escrevendo: o balão de cada uma
 * some na hora pra todo mundo (o turno ainda termina por trás, sem gravar).
 * Author gate: só quem pode escrever no canal para a resposta.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag, isObjectId } from "@/lib/canal/server";
import { podeEscrever } from "@/lib/canal/gate";
import { AUTOR_PARAR, textoParou } from "@/lib/canal/parar";
import { EV_DIGITANDO, EV_MENSAGEM, publicarPusher, type MensagemWire } from "@/lib/canal/realtime";

export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canal = await prisma.canal.findUnique({ where: { id: params.id } });
  if (!canal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!podeEscrever(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const corpo = await req.json().catch(() => ({}));
  const agentes = Array.isArray(corpo?.agentes) ? corpo.agentes.filter((k: unknown): k is string => typeof k === "string" && /^[\w.-]{1,40}$/.test(k)).slice(0, 10) : [];

  const row = await prisma.canalMensagem.create({ data: { canalId: canal.id, autorTipo: "sistema", autorId: AUTOR_PARAR, texto: textoParou(u.name || ""), mencoes: [] } });
  await publicarPusher(canal.id, EV_MENSAGEM, {
    id: row.id, canalId: canal.id, autorTipo: "sistema", autorId: AUTOR_PARAR, texto: row.texto, mencoes: [],
    createdAt: row.createdAt.toISOString(), autorNome: u.name || "Alguém", autorAvatar: null,
  } satisfies MensagemWire);
  for (const agentKey of agentes) await publicarPusher(canal.id, EV_DIGITANDO, { agentKey, estado: "ocioso" });
  return NextResponse.json({ ok: true, mensagem: { id: row.id } });
}
