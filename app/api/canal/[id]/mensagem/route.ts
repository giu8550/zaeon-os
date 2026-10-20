/**
 * POST /api/canal/[id]/mensagem { texto } — grava a mensagem humana, publica no Pusher e,
 * pra cada agente-alvo (os @marcados; sem @, o último agente que falou no canal — lib/canal/alvo.ts),
 * dispara UM turno do harness daquele agente (fila/inline).
 * Author gate: quem não pode escrever recebe 403 (IDOR coberto em teste).
 * Fatia 7 (CHORES_QUEUE=1): "@aura resume <url>" é CHORE (pool grátis, 1 mensagem com fonte), não
 * turno — triagem conservadora (lib/chore/triagem.ts): em dúvida, turno como sempre.
 * #438: mensagem que DISPENSA a agente da vez ("pode ir", "é só isso"… — lib/canal/dispensa.ts) não gasta
 * turno: ela se despede (frase fixa) e entra a linha "Zenita saiu da conversa"; sem @, ninguém responde mais.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag, isObjectId, agentesDoCanal } from "@/lib/canal/server";
import { podeEscrever } from "@/lib/canal/gate";
import { montarAliases, parseMentions } from "@/lib/canal/mention";
import { resolverAlvos, estaForaDaConversa } from "@/lib/canal/alvo";
import { humanosNoCanal } from "@/lib/canal/convite";
import { EV_MENSAGEM, publicarPusher, type MensagemWire } from "@/lib/canal/realtime";
import { dispararTurnos, depsReais } from "@/lib/canal/queue";
import { pedidoDeChore } from "@/lib/chore/triagem";
import { quemFoiDispensada, textoDespedida, textoSaiu, textoVoltou, agentesDepois } from "@/lib/canal/dispensa";
import { choresLigadas, criarDoPedido } from "@/lib/chore/criar";

export const MAX_TEXTO = 4000;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canal = await prisma.canal.findUnique({ where: { id: params.id } });
  if (!canal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!podeEscrever(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const texto = String(body?.texto ?? "").trim();
  if (!texto) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  if (texto.length > MAX_TEXTO) return NextResponse.json({ error: `Máximo de ${MAX_TEXTO} caracteres.` }, { status: 413 });

  const agentes = await agentesDoCanal(u.id, canal.agentes);
  const mencoes = parseMentions(texto, montarAliases(agentes.map((a) => ({ agentKey: a.agentKey, nome: a.nome }))));

  // Quem responde: @menção manda; sem @, continua o último agente que falou no canal (ou a Aura,
  // no primeiro oi). Lê o histórico ANTES de gravar a mensagem atual. Ver lib/canal/alvo.ts.
  // #440: o histórico vem sempre (com @ também): é por ele que se sabe se a agente chamada tinha saído (→ "voltou")
  const recentes = await prisma.canalMensagem.findMany({
    where: { canalId: canal.id }, orderBy: { createdAt: "desc" }, take: 100, select: { autorTipo: true, autorId: true, texto: true },
  });
  const historico = [...recentes].reverse();
  const { alvos } = resolverAlvos({
    mencoes,
    historico,
    remetenteId: u.id,
    disponiveis: agentes.map((a) => a.agentKey),
    // conversa privada conta as duas pessoas → a IA não responde sozinha numa conversa de duas pessoas
    humanos: humanosNoCanal(canal),
  });

  // #438: a mensagem dispensa a agente da vez? (decide antes de gravar, pra barra já sair certa)
  const humanos = humanosNoCanal(canal);
  // #443: só sai a agente PRA QUEM foi a despedida ("a zenita pode sair, aura continua comigo" → só a Zenita)
  const dispensadas = quemFoiDispensada(
    texto,
    alvos.map((k) => { const nome = agentes.find((a) => a.agentKey === k)?.nome ?? ""; return { key: k, nomes: [nome, nome.split(/\s+/)[0] ?? ""] }; }),
    humanos,
  );
  // #440: chamada com @ depois de ter saído → entra a linha "Zenita voltou para a conversa"
  const voltando = mencoes.filter((k) => alvos.includes(k) && !dispensadas.includes(k) && estaForaDaConversa(historico, k));

  const row = await prisma.canalMensagem.create({ data: { canalId: canal.id, autorTipo: "humano", autorId: u.id, texto, mencoes } });
  // agente convocado passa a "estar" no canal (aparece na barra pra todo mundo); #440: a dispensada SAI da barra
  const agentesNoCanal = agentesDepois(canal.agentes, alvos, dispensadas);
  const mudou = agentesNoCanal.length !== canal.agentes.length || agentesNoCanal.some((k, i) => k !== canal.agentes[i]);
  await prisma.canal.update({ where: { id: canal.id }, data: mudou ? { agentes: agentesNoCanal, updatedAt: new Date() } : { updatedAt: new Date() } }).catch(() => undefined);

  const wire: MensagemWire = {
    id: row.id, canalId: row.canalId, autorTipo: "humano", autorId: u.id, texto, mencoes,
    createdAt: row.createdAt.toISOString(), autorNome: u.name || "Alguém", autorAvatar: u.image ?? null,
  };
  await publicarPusher(canal.id, EV_MENSAGEM, wire);

  // #440/#443: chamada com @ depois de ter saído → "Zenita voltou para a conversa". ANTES da chore: o pedido de
  // tarefa ("@zenita resume <link>") retorna logo abaixo e ficava sem a linha.
  for (const k of voltando) {
    const ag = agentes.find((a) => a.agentKey === k);
    const voltou = await prisma.canalMensagem.create({ data: { canalId: canal.id, autorTipo: "sistema", autorId: k, texto: textoVoltou(ag?.nome ?? k), mencoes: [] } });
    await publicarPusher(canal.id, EV_MENSAGEM, {
      id: voltou.id, canalId: canal.id, autorTipo: "sistema", autorId: k, texto: voltou.texto, mencoes: [],
      createdAt: voltou.createdAt.toISOString(), autorNome: ag?.nome ?? k, autorAvatar: null,
    } satisfies MensagemWire);
  }

  // Chore em vez de turno: 1 por mensagem, do 1º agente mencionado, na thread desta mensagem.
  const pedido = mencoes.length && choresLigadas() ? pedidoDeChore(texto) : null;
  if (pedido) {
    const { dispararChore } = await import("@/lib/queue/chores");
    const r = await criarDoPedido(prisma as any, { tipo: pedido.tipo, alvo: { url: pedido.url }, agentKey: mencoes[0], canalId: canal.id, parentId: row.id, requesterId: u.id });
    if (!("erro" in r)) {
      const via = r.row.status === "queued" ? await dispararChore(r.row) : "existente";
      return NextResponse.json({
        ok: true, mensagem: wire, turnos: [], chore: { id: r.row.id, tipo: r.row.tipo, agentKey: r.row.agentKey, via }, agentesNoCanal,
        ...(voltando.length ? { voltaram: voltando } : {}),
      }, { status: 201 });
    }
  }

  // #438: dispensou a agente da vez → despedida + "saiu da conversa", sem turno (não gasta IA)
  for (const k of dispensadas) {
    const ag = agentes.find((a) => a.agentKey === k);
    const nome = ag?.nome ?? k;
    const tchau = await prisma.canalMensagem.create({ data: { canalId: canal.id, autorTipo: "agente", autorId: k, texto: textoDespedida(k), mencoes: [] } });
    await publicarPusher(canal.id, EV_MENSAGEM, {
      id: tchau.id, canalId: canal.id, autorTipo: "agente", autorId: k, texto: tchau.texto, mencoes: [],
      createdAt: tchau.createdAt.toISOString(), autorNome: nome, autorAvatar: ag?.avatarUrl ?? null,
    } satisfies MensagemWire);
    const saiu = await prisma.canalMensagem.create({ data: { canalId: canal.id, autorTipo: "sistema", autorId: k, texto: textoSaiu(nome), mencoes: [] } });
    await publicarPusher(canal.id, EV_MENSAGEM, {
      id: saiu.id, canalId: canal.id, autorTipo: "sistema", autorId: k, texto: saiu.texto, mencoes: [],
      createdAt: saiu.createdAt.toISOString(), autorNome: nome, autorAvatar: null,
    } satisfies MensagemWire);
  }
  const respondem = alvos.filter((k) => !dispensadas.includes(k));

  const vias = await dispararTurnos(
    respondem.map((agentKey) => ({ canalId: canal.id, agentKey, userId: u.id, mensagemId: row.id })),
    depsReais,
  );
  return NextResponse.json({
    ok: true, mensagem: wire, turnos: respondem.map((agentKey, i) => ({ agentKey, via: vias[i] })), agentesNoCanal,
    ...(dispensadas.length ? { dispensadas } : {}), ...(voltando.length ? { voltaram: voltando } : {}),
  }, { status: 201 });
}
