/**
 * /api/canal/convites — convites do escritório (#396, item D). Regras em lib/canal/convite.ts.
 *   GET            → { recebidos (pendentes pra mim), enviados (pendentes meus), contatos (aceitos), historico,
 *                      sino: { vistoEm, limpoAte } } — #425: o histórico já vem sem o que a pessoa limpou.
 *   POST { para }  → convida por e-mail (ou nome, se só uma pessoa tiver aquele nome). Cai na aba
 *                    PRIVADO de quem foi convidado, que aceita ou recusa em /api/canal/convites/[id].
 *   POST { paraId }        → #427: o mesmo convite de contato, pelo id (o "Convidar pra conversar" da foto).
 *   POST { para, canalId } → #425: convite PARA ESTA CONVERSA (só o dono dela). No aceite a pessoa entra
 *                    nela (não cria outra); conversa de dois vira grupo privado.
 * Flag NEXT_PUBLIC_ESCRITORIO_COWORK (404 desligada). Sessão obrigatória.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag, pessoas, isObjectId } from "@/lib/canal/server";
import { interpretarAlvo, conviteEmAberto, ehConviteDeConversa, podeConvidarParaConversa } from "@/lib/canal/convite";
import { estaNoCanal } from "@/lib/canal/perfil";
import { depoisDeLimpar, estadoDoSino } from "@/lib/canal/sino";
import { triggerSafe } from "@/lib/collab/realtime";

/** Teto de convites pendentes enviados por pessoa (anti-spam). */
export const MAX_PENDENTES = 20;

type Linha = { id: string; deId: string; paraId: string; status: string; dmCanalId: string | null; canalId?: string | null; createdAt: Date; respondidoEm?: Date | null };

/** Quantos convites já respondidos (aceito/recusado) o sino mostra no histórico (#423). */
export const MAX_HISTORICO = 20;

export async function GET(): Promise<NextResponse> {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const linhas: Linha[] = await prisma.canalConvite.findMany({
    // #423: os recusados também vêm — o sino mostra o status de cada convite (pendente, aceito, recusado)
    where: { status: { in: ["pendente", "aceito", "recusado"] }, OR: [{ deId: u.id }, { paraId: u.id }] },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  // #425: o sino de cada pessoa fica no banco (visto / limpo). Sem registro (ou erro), o sino só não lembra.
  const sino = estadoDoSino(await prisma.canalSino.findUnique({ where: { userId: u.id } }).catch(() => null));
  const gente = await pessoas(linhas.flatMap((l) => [l.deId, l.paraId]));
  // #425: convites PARA UMA CONVERSA mostram o título dela no sino
  const idsConversa = [...new Set(linhas.map((l) => l.canalId).filter((v): v is string => !!v))];
  const titulos = new Map<string, string>(idsConversa.length
    ? (await prisma.canal.findMany({ where: { id: { in: idsConversa } }, select: { id: true, titulo: true } }).catch(() => [] as { id: string; titulo: string }[])).map((c: { id: string; titulo: string }) => [c.id, c.titulo])
    : []);
  const outro = (l: Linha) => {
    const id = l.deId === u.id ? l.paraId : l.deId;
    return gente.get(id) ?? { id, nome: "Alguém", avatar: null };
  };
  const vista = (l: Linha) => ({
    id: l.id, status: l.status, dmCanalId: l.dmCanalId, criadoEm: l.createdAt, pessoa: outro(l),
    ...(l.canalId ? { canalId: l.canalId, canalTitulo: titulos.get(l.canalId) ?? "a conversa" } : {}),
  });
  return NextResponse.json({
    recebidos: linhas.filter((l) => l.status === "pendente" && l.paraId === u.id).map(vista),
    enviados: linhas.filter((l) => l.status === "pendente" && l.deId === u.id).map(vista),
    // contato = convite de CONTATO aceito (entrar numa conversa pelo convite dela não faz de ninguém contato)
    contatos: linhas.filter((l) => l.status === "aceito" && !ehConviteDeConversa(l)).map(vista),
    // #423: o que já foi respondido, nas duas direções, do mais recente pro mais antigo (o sino mostra o status)
    historico: depoisDeLimpar(
      linhas.filter((l) => l.status !== "pendente").map((l) => ({ ...vista(l), direcao: l.deId === u.id ? "enviado" : "recebido", respondidoEm: l.respondidoEm ?? null })),
      sino.limpoAte,
    )
      .sort((a, b) => +new Date(b.respondidoEm ?? b.criadoEm) - +new Date(a.respondidoEm ?? a.criadoEm))
      .slice(0, MAX_HISTORICO),
    sino,
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  // #427: pelo id (menu da foto no escritório) — a pessoa já está na tela, não precisa de e-mail
  const porId = isObjectId(body?.paraId) ? (body.paraId as string) : null;
  const alvo = porId ? null : interpretarAlvo(body?.para);
  if (!porId && !alvo) return NextResponse.json({ error: "Digite o e-mail (ou o nome) da pessoa." }, { status: 400 });

  // Quem é a pessoa. A Zaeon não tem "nome de usuário": e-mail é único; nome só vale se for de UMA pessoa.
  let para: { id: string; name: string | null } | null = null;
  if (porId) {
    para = await prisma.user.findUnique({ where: { id: porId }, select: { id: true, name: true } });
    if (!para) return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  } else if (alvo && "email" in alvo) {
    para = await prisma.user.findUnique({ where: { email: alvo.email }, select: { id: true, name: true } });
    if (!para) return NextResponse.json({ error: "Ninguém com esse e-mail na Zaeon." }, { status: 404 });
  } else if (alvo) {
    const achados: { id: string; name: string | null }[] = await prisma.user.findMany({
      where: { name: { equals: alvo.nome, mode: "insensitive" } }, select: { id: true, name: true }, take: 2,
    });
    if (!achados.length) return NextResponse.json({ error: "Ninguém com esse nome na Zaeon. Tente pelo e-mail." }, { status: 404 });
    if (achados.length > 1) return NextResponse.json({ error: "Mais de uma pessoa com esse nome. Use o e-mail." }, { status: 409 });
    para = achados[0]!;
  }
  if (!para) return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  if (para.id === u.id) return NextResponse.json({ error: "Você não pode convidar a si mesma(o)." }, { status: 400 });

  // #425: convite PARA UMA CONVERSA (o + dentro de uma conversa sua)
  if (body?.canalId !== undefined && body?.canalId !== null) {
    if (!isObjectId(body.canalId)) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    const canal = await prisma.canal.findUnique({ where: { id: body.canalId } });
    if (!canal) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    if (!podeConvidarParaConversa(canal, u.id)) return NextResponse.json({ error: "Só quem criou a conversa pode chamar outras pessoas." }, { status: 403 });
    if (estaNoCanal(canal, para.id)) return NextResponse.json({ error: `${para.name || "Essa pessoa"} já está nesta conversa.` }, { status: 409 });
    const jaConvidada: Linha[] = await prisma.canalConvite.findMany({ where: { paraId: para.id, status: "pendente" } });
    if (jaConvidada.some((c) => c.canalId === canal.id)) return NextResponse.json({ error: "Essa pessoa já tem um convite pendente para esta conversa." }, { status: 409 });
    const pend = await prisma.canalConvite.count({ where: { deId: u.id, status: "pendente" } });
    if (pend >= MAX_PENDENTES) return NextResponse.json({ error: `Você tem ${MAX_PENDENTES} convites esperando resposta. Espere alguém responder.` }, { status: 429 });
    const c: Linha = await prisma.canalConvite.create({ data: { deId: u.id, paraId: para.id, status: "pendente", canalId: canal.id } });
    await triggerSafe(`user_${para.id}`, "zaeon-notice", { text: `${u.name || "Alguém"} te convidou para “${canal.titulo}” no escritório. Veja no sino.` });
    return NextResponse.json({ convite: { id: c.id, status: c.status, canalId: canal.id, canalTitulo: canal.titulo, pessoa: { id: para.id, nome: para.name || "Alguém", avatar: null } } }, { status: 201 });
  }

  const entre: Linha[] = await prisma.canalConvite.findMany({
    where: { OR: [{ deId: u.id, paraId: para.id }, { deId: para.id, paraId: u.id }] },
  });
  const aberto = conviteEmAberto(entre.filter((l) => !ehConviteDeConversa(l)), u.id, para.id); // só os de contato
  if (aberto?.status === "aceito") return NextResponse.json({ jaContatos: true, dmCanalId: aberto.dmCanalId }, { status: 200 });
  if (aberto) return NextResponse.json({ error: "Já existe um convite pendente entre vocês." }, { status: 409 });

  const pendentes = await prisma.canalConvite.count({ where: { deId: u.id, status: "pendente" } });
  if (pendentes >= MAX_PENDENTES) return NextResponse.json({ error: `Você tem ${MAX_PENDENTES} convites esperando resposta. Espere alguém responder.` }, { status: 429 });

  const convite: Linha = await prisma.canalConvite.create({ data: { deId: u.id, paraId: para.id, status: "pendente" } });
  // aviso na hora (canal pessoal já usado pelo app pros "zaeon-notice")
  await triggerSafe(`user_${para.id}`, "zaeon-notice", { text: `${u.name || "Alguém"} te convidou para conversar no escritório. Veja na aba Privado.` });
  return NextResponse.json({ convite: { id: convite.id, status: convite.status, pessoa: { id: para.id, nome: para.name || "Alguém", avatar: null } } }, { status: 201 });
}
