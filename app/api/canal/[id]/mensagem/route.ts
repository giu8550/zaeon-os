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
import { prisma, sessaoUsuario, exigirFlag, isObjectId, agentesDoCanal, pessoas } from "@/lib/canal/server";
import { chamadasPeloNome, falaComPessoa, pedeOutraAgente } from "@/lib/canal/chamada";
import { podeEscrever } from "@/lib/canal/gate";
import { montarAliases, parseMentions } from "@/lib/canal/mention";
import { resolverAlvos, estaForaDaConversa, agentesPorRecencia } from "@/lib/canal/alvo";
import { humanosNoCanal } from "@/lib/canal/convite";
import { EV_MENSAGEM, publicarPusher, type MensagemWire } from "@/lib/canal/realtime";
import { dispararTurnos, depsReais } from "@/lib/canal/queue";
import { pedidoDeChore } from "@/lib/chore/triagem";
import { saidasDaMensagem, textoDespedida, textoSaiu, textoVoltou, agentesDepois } from "@/lib/canal/dispensa";
import { atualizarAgentes, type DbAtomico } from "@/lib/canal/atomico";
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
  // #466: sem @, o NOME usado pra chamar também chama ("sim continue aura…") — nunca o nome de uma pessoa da conversa
  const gente = await pessoasDaConversa(canal);
  const chamadas = mencoes.length ? mencoes : chamadasPeloNome(texto, agentes, gente.map((p) => p.nome));

  // Quem responde: @menção manda; sem @, continua o último agente que falou no canal (ou a Aura,
  // no primeiro oi). Lê o histórico ANTES de gravar a mensagem atual. Ver lib/canal/alvo.ts.
  // #440: o histórico vem sempre (com @ também): é por ele que se sabe se a agente chamada tinha saído (→ "voltou")
  const recentes = await prisma.canalMensagem.findMany({
    where: { canalId: canal.id }, orderBy: { createdAt: "desc" }, take: 100, select: { autorTipo: true, autorId: true, texto: true },
  });
  const historico = [...recentes].reverse();
  const resolvido = resolverAlvos({
    mencoes: chamadas,
    historico,
    remetenteId: u.id,
    disponiveis: agentes.map((a) => a.agentKey),
    // conversa privada conta as duas pessoas → a IA não responde sozinha numa conversa de duas pessoas
    humanos: humanosNoCanal(canal),
  });
  const humanos = humanosNoCanal(canal);
  // #551: conversa com outras pessoas e a mensagem fala COM uma delas ("tchau martinez, até amanhã") → sem @ nem
  // nome de agente, a agente da vez fica quieta (antes respondia o que era pra pessoa) e não é dispensada
  const comPessoa = resolvido.implicito && humanos > 1 && falaComPessoa(texto, gente.filter((p) => p.id !== u.id).map((p) => p.nome));
  const disponiveis = agentes.map((a) => a.agentKey);
  // #560: da agente que falou por último pra trás, só quem não saiu ("vocês duas", "explica você")
  const recencia = agentesPorRecencia(historico, disponiveis).filter((k) => !estaForaDaConversa(historico, k));
  let alvos = comPessoa ? [] : resolvido.alvos;
  // #560: "teo explicou mal, explica você" com o Téo da vez → responde a OUTRA agente da conversa (a última que falou)
  const daVez = resolvido.implicito && alvos.length === 1 ? agentes.find((a) => a.agentKey === alvos[0]) : undefined;
  const outra = daVez && pedeOutraAgente(texto, daVez) ? recencia.find((k) => k !== daVez.agentKey) : undefined;
  if (outra) alvos = [outra];

  // #438: a mensagem dispensa a agente da vez? (decide antes de gravar, pra barra já sair certa)
  // #443: só sai a agente PRA QUEM foi a despedida ("a zenita pode sair, aura continua comigo" → só a Zenita)
  // #551: entre TODAS da conversa ("vocês duas podem ir"); despedida de quem nem estava é ignorada
  const naConversa = comPessoa ? [] : [...new Set([...(canal.agentes ?? []), ...(resolvido.implicito ? alvos : [])])]
    .filter((k) => disponiveis.includes(k) && !estaForaDaConversa(historico, k));
  const { dispensadas, respondem, chamados } = saidasDaMensagem(texto, { alvos, naConversa, agentes, humanos, recencia });
  // #440: chamada com @ depois de ter saído → entra a linha "Zenita voltou para a conversa"
  const voltando = chamadas.filter((k) => respondem.includes(k) && estaForaDaConversa(historico, k));

  const row = await prisma.canalMensagem.create({ data: { canalId: canal.id, autorTipo: "humano", autorId: u.id, texto, mencoes } });
  // agente convocado passa a "estar" no canal (aparece na barra pra todo mundo); #440: a dispensada SAI da barra
  // #443: grava SEM apagar o que outra mensagem gravou ao mesmo tempo (lib/canal/atomico)
  const agentesNoCanal = (await atualizarAgentes(prisma as unknown as DbAtomico, canal.id, chamados, dispensadas).catch(() => null))
    ?? agentesDepois(canal.agentes, chamados, dispensadas);
  await prisma.canal.updateMany({ where: { id: canal.id }, data: { updatedAt: new Date() } }).catch(() => undefined);

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

  const vias = await dispararTurnos(
    respondem.map((agentKey) => ({ canalId: canal.id, agentKey, userId: u.id, mensagemId: row.id })),
    depsReais,
  );
  return NextResponse.json({
    ok: true, mensagem: wire, turnos: respondem.map((agentKey, i) => ({ agentKey, via: vias[i] })), agentesNoCanal,
    ...(dispensadas.length ? { dispensadas } : {}), ...(voltando.length ? { voltaram: voltando } : {}),
  }, { status: 201 });
}

/**
 * #466: as pessoas do canal (quem tem nome de agente não chama a agente); #551: com o id, pra saber quando a
 * mensagem fala com OUTRA pessoa. Falhou → nenhuma.
 */
async function pessoasDaConversa(canal: { ownerId: string; membros: string[]; dmCom?: string | null }): Promise<{ id: string; nome: string }[]> {
  try {
    const gente = await pessoas([canal.ownerId, ...(canal.membros ?? []), ...(canal.dmCom ? [canal.dmCom] : [])]);
    return [...gente.entries()].map(([id, p]) => ({ id, nome: p.nome ?? "" })).filter((p) => p.nome);
  } catch {
    return [];
  }
}
