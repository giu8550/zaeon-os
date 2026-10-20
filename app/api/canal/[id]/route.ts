/**
 * /api/canal/[id] — GET: canal + últimas mensagens + agentes convocáveis + pessoas (author gate).
 * PATCH (só dono): titulo | acesso | agentes | cartolinaId | adicionarEmail | removerMembro.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag, isObjectId, agentesDoCanal, pessoas, paraWire, agentesPublicos } from "@/lib/canal/server";
import { podeLer, podeGerir, normalizarAcesso } from "@/lib/canal/gate";
import { isAgentKey } from "@/lib/agents/roster";
import { anunciarEntrada } from "@/lib/canal/presenca";
import { entrarComoMembro, sairComoMembro, type DbAtomico } from "@/lib/canal/atomico";
import { EV_MENSAGEM, publicarPusher } from "@/lib/canal/realtime";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canal = await prisma.canal.findUnique({ where: { id: params.id } });
  if (!canal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!podeLer(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [desc, agentes] = await Promise.all([
    prisma.canalMensagem.findMany({ where: { canalId: canal.id }, orderBy: { createdAt: "desc" }, take: 60 }),
    agentesDoCanal(u.id, canal.agentes),
  ]);
  const msgs = [...desc].reverse();
  const gente = await pessoas([canal.ownerId, ...canal.membros, ...(canal.dmCom ? [canal.dmCom] : []), ...msgs.filter((m) => m.autorTipo !== "agente").map((m) => m.autorId)]); // humano e o aviso "fulano entrou" (#423)
  return NextResponse.json({
    canal: { ...canal, souDono: canal.ownerId === u.id },
    eu: { id: u.id, nome: u.name || "Você", avatar: u.image ?? null },
    mensagens: msgs.map((m) => paraWire(m, gente, agentes)),
    agentes: agentesPublicos(agentes),
    pessoas: [...gente.values()],
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canal = await prisma.canal.findUnique({ where: { id: params.id } });
  if (!canal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!podeGerir(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  // #396: a conversa privada é só entre as duas pessoas — não muda de acesso nem recebe gente.
  if (canal.dmCom && (body?.acesso !== undefined || body?.adicionarEmail !== undefined || body?.adicionarMembro !== undefined || body?.removerMembro !== undefined)) {
    return NextResponse.json({ error: "Conversa privada é só entre vocês dois: não muda de acesso nem recebe outras pessoas." }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (typeof body?.titulo === "string" && body.titulo.trim()) data.titulo = body.titulo.trim().slice(0, 80);
  if (body?.acesso !== undefined) data.acesso = normalizarAcesso(body.acesso);
  if (Array.isArray(body?.agentes)) data.agentes = ([...new Set(body.agentes.filter(isAgentKey))] as string[]).slice(0, 12);
  if (body?.cartolinaId === null) data.cartolinaId = null;
  else if (isObjectId(body?.cartolinaId)) data.cartolinaId = body.cartolinaId;
  // #466: entrar/sair do escritório não regrava a lista inteira (lib/canal/atomico) — senão quem entrou no mesmo
  // instante sumia. Os outros campos (título, acesso, agentes, cartolina) seguem no update normal.
  let entra: string | null = null;
  let sai: string | null = null;
  // Adicionar pessoa (por e-mail ou pelo id de um contato). #396: só quem JÁ ACEITOU o convite do dono
  // (botão +) entra — ninguém é colocado num escritório sem ter concordado.
  if (typeof body?.adicionarEmail === "string" || isObjectId(body?.adicionarMembro)) {
    const alvo = typeof body?.adicionarEmail === "string"
      ? await prisma.user.findUnique({ where: { email: body.adicionarEmail.trim().toLowerCase() }, select: { id: true } })
      : await prisma.user.findUnique({ where: { id: body.adicionarMembro }, select: { id: true } });
    if (!alvo) return NextResponse.json({ error: "Ninguém com esse e-mail na Zaeon." }, { status: 404 });
    if (alvo.id !== canal.ownerId) {
      const aceito = await prisma.canalConvite.findFirst({
        where: { status: "aceito", OR: [{ deId: canal.ownerId, paraId: alvo.id }, { deId: alvo.id, paraId: canal.ownerId }] },
        select: { id: true },
      });
      if (!aceito) return NextResponse.json({ error: "Essa pessoa ainda não aceitou um convite seu. Convide pelo botão + primeiro." }, { status: 409 });
      entra = alvo.id;
    }
  }
  if (isObjectId(body?.removerMembro)) sai = body.removerMembro;
  if (!Object.keys(data).length && !entra && !sai) return NextResponse.json({ error: "Nada pra alterar." }, { status: 400 });
  if (Object.keys(data).length) await prisma.canal.update({ where: { id: canal.id }, data });
  const db = prisma as unknown as DbAtomico;
  const entrou = entra ? (await entrarComoMembro(db, canal.id, entra)) === "entrou" : false;
  if (sai) await sairComoMembro(db, canal.id, sai);
  const upd = (await prisma.canal.findUnique({ where: { id: canal.id } })) ?? canal;
  // #423: quem foi ADICIONADO agora ganha a linha "fulano entrou no escritório" no chat (best-effort; #466: só se entrou agora)
  const novos = entrou && entra ? [entra] : [];
  if (novos.length) {
    const gente = await pessoas(novos);
    for (const id of novos) {
      await anunciarEntrada({ criar: (d) => prisma.canalMensagem.create({ data: d }), publicar: publicarPusher, evento: EV_MENSAGEM },
        canal.id, { id, nome: gente.get(id)?.nome ?? null, avatar: gente.get(id)?.avatar ?? null });
    }
  }
  return NextResponse.json({ canal: { ...upd, souDono: true } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canal = await prisma.canal.findUnique({ where: { id: params.id } });
  if (!canal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!podeGerir(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.canalMensagem.deleteMany({ where: { canalId: canal.id } });
  await prisma.canal.delete({ where: { id: canal.id } });
  return NextResponse.json({ ok: true });
}
