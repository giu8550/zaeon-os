/**
 * POST /api/canal/convites/[id] { acao: "aceitar" | "recusar" } — só quem foi convidado responde, e só
 * enquanto está pendente. Aceitar cria a conversa privada (Canal com dmCom: só os dois leem) e avisa
 * quem convidou. Regras em lib/canal/convite.ts; acesso da conversa em lib/canal/gate.ts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag, isObjectId } from "@/lib/canal/server";
import { podeResponder, statusDepois, tituloConversa } from "@/lib/canal/convite";
import { triggerSafe } from "@/lib/collab/realtime";
import { anunciarEntrada } from "@/lib/canal/presenca";
import { EV_MENSAGEM, publicarPusher } from "@/lib/canal/realtime";

export async function POST(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const novo = statusDepois(body?.acao);
  if (!novo) return NextResponse.json({ error: "Ação inválida (aceitar ou recusar)." }, { status: 400 });

  const convite = await prisma.canalConvite.findUnique({ where: { id: params.id } });
  if (!convite) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (convite.paraId !== u.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!podeResponder(convite, u.id)) return NextResponse.json({ error: "Esse convite já foi respondido." }, { status: 409 });

  // "reserva" a resposta: só passa quem ainda vê o convite pendente (dois cliques não criam duas conversas)
  const { count } = await prisma.canalConvite.updateMany({
    where: { id: convite.id, status: "pendente" },
    data: { status: novo, respondidoEm: new Date() },
  });
  if (!count) return NextResponse.json({ error: "Esse convite já foi respondido." }, { status: 409 });

  if (novo === "recusado") return NextResponse.json({ convite: { id: convite.id, status: novo } });

  const de = await prisma.user.findUnique({ where: { id: convite.deId }, select: { id: true, name: true } });
  const canal = await prisma.canal.create({
    data: {
      ownerId: convite.deId, dmCom: u.id, acesso: "privado", membros: [], agentes: [],
      titulo: tituloConversa(de?.name, u.name),
    },
  });
  await prisma.canalConvite.update({ where: { id: convite.id }, data: { dmCanalId: canal.id } });
  // #423: a conversa já abre com a linha "fulano aceitou o convite e entrou na conversa"
  await anunciarEntrada({ criar: (d) => prisma.canalMensagem.create({ data: d }), publicar: publicarPusher, evento: EV_MENSAGEM },
    canal.id, { id: u.id, nome: u.name, avatar: u.image ?? null }, { conversa: true });
  await triggerSafe(`user_${convite.deId}`, "zaeon-notice", { text: `${u.name || "Alguém"} aceitou seu convite. A conversa de vocês está na aba Privado do escritório.` });
  return NextResponse.json({ convite: { id: convite.id, status: novo, dmCanalId: canal.id }, canal: { ...canal, souDono: false } });
}
