/**
 * POST /api/canal/convites/[id] { acao: "aceitar" | "recusar" } — só quem foi convidado responde, e só
 * enquanto está pendente. Aceitar cria a conversa privada (Canal com dmCom: só os dois leem) e avisa
 * quem convidou. #425: convite PARA UMA CONVERSA (canalId) → aceitar ENTRA nela (não cria outra); se era a
 * conversa de dois, ela vira grupo privado. Regras em lib/canal/convite.ts; acesso da conversa em lib/canal/gate.ts.
 * #443: a entrada na conversa não apaga quem entrou ao mesmo tempo (lib/canal/atomico); e se a entrada FALHAR depois
 * do "aceito", o convite volta a pendente (antes ficava aceito pra sempre e não dava pra aceitar de novo).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag, isObjectId } from "@/lib/canal/server";
import { podeResponder, statusDepois, tituloConversa, podeConvidarParaConversa } from "@/lib/canal/convite";
import { triggerSafe } from "@/lib/collab/realtime";
import { anunciarEntrada } from "@/lib/canal/presenca";
import { EV_MENSAGEM, publicarPusher } from "@/lib/canal/realtime";
import { entrarNaConversaAtomico, type DbAtomico } from "@/lib/canal/atomico";

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

  // #425: convite para uma conversa — ela ainda existe e quem convidou ainda é o dono? (senão não dá pra entrar)
  const conversa = convite.canalId ? await prisma.canal.findUnique({ where: { id: convite.canalId } }) : null;
  if (convite.canalId && novo === "aceito" && (!conversa || !podeConvidarParaConversa(conversa, convite.deId))) {
    return NextResponse.json({ error: "Essa conversa não existe mais." }, { status: 410 });
  }

  // "reserva" a resposta: só passa quem ainda vê o convite pendente (dois cliques não criam duas conversas)
  const { count } = await prisma.canalConvite.updateMany({
    where: { id: convite.id, status: "pendente" },
    data: { status: novo, respondidoEm: new Date() },
  });
  if (!count) return NextResponse.json({ error: "Esse convite já foi respondido." }, { status: 409 });

  if (novo === "recusado") return NextResponse.json({ convite: { id: convite.id, status: novo } });

  // #443: daqui pra baixo, se falhar, o convite VOLTA a pendente (dá pra aceitar de novo)
  const conv = convite, eu = u;
  try {
    if (conversa) {
      // entra NA conversa: vira membro (e a conversa de dois vira grupo privado) — sem apagar quem entrou junto
      const r = await entrarNaConversaAtomico(prisma as unknown as DbAtomico, conversa.id, eu.id);
      if (!r) throw new Error("a conversa sumiu ou mudou demais no meio da entrada");
      await prisma.canalConvite.update({ where: { id: conv.id }, data: { dmCanalId: conversa.id } });
      if (r.resultado === "entrou") {
        await anunciarEntrada({ criar: (d) => prisma.canalMensagem.create({ data: d }), publicar: publicarPusher, evento: EV_MENSAGEM },
          conversa.id, { id: eu.id, nome: eu.name, avatar: eu.image ?? null }, { conversa: true });
        await triggerSafe(`user_${conv.deId}`, "zaeon-notice", { text: `${eu.name || "Alguém"} aceitou e entrou em “${conversa.titulo}”.` });
      }
      return NextResponse.json({ convite: { id: conv.id, status: novo, dmCanalId: conversa.id }, canal: { ...conversa, ...r.canal, souDono: false } });
    }

    const de = await prisma.user.findUnique({ where: { id: conv.deId }, select: { id: true, name: true } });
    const canal = await prisma.canal.create({
      data: {
        ownerId: conv.deId, dmCom: eu.id, acesso: "privado", membros: [], agentes: [],
        titulo: tituloConversa(de?.name, eu.name),
      },
    });
    await prisma.canalConvite.update({ where: { id: conv.id }, data: { dmCanalId: canal.id } });
    // #423: a conversa já abre com a linha "fulano aceitou o convite e entrou na conversa"
    await anunciarEntrada({ criar: (d) => prisma.canalMensagem.create({ data: d }), publicar: publicarPusher, evento: EV_MENSAGEM },
      canal.id, { id: eu.id, nome: eu.name, avatar: eu.image ?? null }, { conversa: true });
    await triggerSafe(`user_${conv.deId}`, "zaeon-notice", { text: `${eu.name || "Alguém"} aceitou seu convite. A conversa de vocês está na aba Privado do escritório.` });
    return NextResponse.json({ convite: { id: conv.id, status: novo, dmCanalId: canal.id }, canal: { ...canal, souDono: false } });
  } catch (e) {
    console.error("[canal] aceitar convite falhou — volta a pendente:", e);
    await prisma.canalConvite.updateMany({ where: { id: conv.id, status: novo }, data: { status: "pendente", respondidoEm: null } }).catch(() => undefined);
    return NextResponse.json({ error: "Não deu pra entrar agora. Tente aceitar de novo." }, { status: 500 });
  }
}
