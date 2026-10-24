/**
 * lib/whatsapp/zaeon/contexto.ts — o que a Zaeon SABE da pessoa antes de escrever no WhatsApp (IO, server-only).
 * Um retrato curto e barato (poucas consultas, cada uma isolada: falhou → fica de fora): o que estudou (conversas
 * do chat, aulas, trabalhos), a agenda e os lembretes de hoje, prazos, revisões e a conversa recente no WhatsApp.
 * É o "um pouco da harness do chat": o mesmo material que a Aura usa, condensado pra uma mensagem.
 */
export type Contexto = {
  nome: string | null;
  estudosRecentes: string[];      // títulos das conversas/estudos dos últimos 7 dias
  perguntasRecentes: string[];    // o que a pessoa perguntou no chat nas últimas 24 h
  aulasConcluidas: string[];
  aulasEmAndamento: string[];
  trabalhos: string[];
  agendaHoje: string;             // texto pronto (dispatch.agendaFacts) ou ""
  lembretesHoje: string[];        // "08:00 — estudar cálculo"
  prazos: string[];
  revisoes: string;
  conversaWhatsApp: { de: "aluno" | "zaeon"; texto: string }[];
  respondeuDesdeUltimaProativa: boolean;
};

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const ok = async <T,>(p: Promise<T>, padrao: T): Promise<T> => { try { return await p; } catch { return padrao; } };

export async function montarContexto(userId: string, agora: Date, local: { weekday: number; dataKey: string }): Promise<Contexto> {
  const { prisma } = await import("@/src/lib/prisma");
  const d = await import("../dispatch");
  const semana = new Date(agora.getTime() - 7 * 86_400_000), dia = new Date(agora.getTime() - 86_400_000);

  const [user, convs, progs, works, space, lembretes, docs, wa] = await Promise.all([
    ok(prisma.user.findUnique({ where: { id: userId }, select: { name: true } }), null),
    ok(prisma.conversation.findMany({ where: { userId, updatedAt: { gte: semana } }, orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, title: true, tituloSugerido: true } }), []),
    ok(prisma.aulaProgress.findMany({ where: { studentId: userId }, orderBy: { updatedAt: "desc" }, take: 30, select: { aulaId: true, status: true, updatedAt: true } }), []),
    ok(prisma.researchWork.findMany({ where: { userId, updatedAt: { gte: semana } }, orderBy: { updatedAt: "desc" }, take: 4, select: { title: true, workType: true } }), []),
    ok(prisma.userSpaceData.findUnique({ where: { userId }, select: { schedule: true } }), null),
    ok(prisma.zaeonLembrete.findMany({ where: { userId, ativo: true }, orderBy: { minutos: "asc" }, take: 20 }), []),
    ok(prisma.teacherDocument.findMany({ where: { assignedTo: { has: userId }, status: "published", dueAt: { gte: agora, lte: new Date(agora.getTime() + 72 * 3_600_000) } }, select: { id: true, title: true, dueAt: true } }), []),
    ok(prisma.whatsAppMessage.findMany({ where: { userId, kind: { not: "skip" } }, orderBy: { at: "desc" }, take: 8, select: { dir: true, kind: true, text: true, at: true } }), []),
  ]);

  const perguntas = convs.length
    ? await ok(prisma.chatMessage.findMany({ where: { conversationId: { in: convs.map((c) => c.id) }, role: "user", at: { gte: dia } }, orderBy: { at: "desc" }, take: 6, select: { text: true } }), [])
    : [];
  const aulaIds = [...new Set(progs.map((p) => p.aulaId))];
  const aulas = aulaIds.length ? await ok(prisma.aula.findMany({ where: { id: { in: aulaIds } }, select: { id: true, title: true } }), []) : [];
  const titulo = new Map(aulas.map((a) => [a.id, a.title]));

  const dow = local.weekday % 7;   // localParts: 1=seg..7=dom → 0=dom..6=sáb
  const lembretesHoje = lembretes
    .filter((l) => (l.data ? l.data === local.dataKey : l.dias.length === 0 || l.dias.includes(dow)))
    .map((l) => `${hhmm(l.minutos)} — ${l.texto}`);
  const concluidas = progs.filter((p) => p.status === "completed");
  const ultimaProativa = wa.find((m) => m.dir === "out" && m.kind.startsWith("zaeon:"));
  const respondeu = !!ultimaProativa && wa.some((m) => m.dir === "in" && m.at > ultimaProativa.at);

  return {
    nome: (user?.name ?? "").trim().split(/\s+/)[0] || null,
    estudosRecentes: convs.map((c) => (c.title || c.tituloSugerido || "").trim()).filter(Boolean).slice(0, 6),
    perguntasRecentes: perguntas.map((m) => m.text.trim().slice(0, 140)).filter(Boolean),
    aulasConcluidas: concluidas.slice(0, 4).map((p) => titulo.get(p.aulaId)).filter(Boolean) as string[],
    aulasEmAndamento: progs.filter((p) => p.status !== "completed").slice(0, 3).map((p) => titulo.get(p.aulaId)).filter(Boolean) as string[],
    trabalhos: works.map((w) => `${w.title || "sem título"}${w.workType ? ` (${w.workType})` : ""}`),
    agendaHoje: d.agendaFacts(d.agendaForWeekday(space?.schedule, local.weekday), local.weekday),
    lembretesHoje,
    prazos: d.deadlineFacts(docs.map((x) => ({ id: x.id, title: x.title, dueAt: x.dueAt! })), agora, 72).map((f) => f.text),
    revisoes: d.reviewFacts(d.reviewCandidates(concluidas.map((p) => ({ title: titulo.get(p.aulaId) ?? "", completedAt: p.updatedAt })).filter((r) => r.title), agora)),
    conversaWhatsApp: wa.slice(0, 6).reverse().map((m) => ({ de: m.dir === "in" ? "aluno" as const : "zaeon" as const, texto: m.text.slice(0, 300) })),
    respondeuDesdeUltimaProativa: respondeu,
  };
}

/** o contexto em texto pro prompt (só o que existe; nunca inventa) */
export function contextoEmTexto(c: Contexto): string {
  const l: string[] = [];
  if (c.nome) l.push(`Nome: ${c.nome}`);
  if (c.estudosRecentes.length) l.push(`Estudou nos últimos dias (conversas/estudos): ${c.estudosRecentes.join("; ")}`);
  if (c.perguntasRecentes.length) l.push(`Perguntou nas últimas 24 h: ${c.perguntasRecentes.map((p) => `"${p}"`).join("; ")}`);
  if (c.aulasConcluidas.length) l.push(`Aulas concluídas: ${c.aulasConcluidas.join("; ")}`);
  if (c.aulasEmAndamento.length) l.push(`Aulas em andamento: ${c.aulasEmAndamento.join("; ")}`);
  if (c.trabalhos.length) l.push(`Trabalhos em andamento: ${c.trabalhos.join("; ")}`);
  if (c.agendaHoje) l.push(`Agenda de hoje: ${c.agendaHoje}`);
  if (c.lembretesHoje.length) l.push(`Lembretes de hoje: ${c.lembretesHoje.join("; ")}`);
  if (c.prazos.length) l.push(`Prazos: ${c.prazos.join("; ")}`);
  if (c.revisoes) l.push(`Revisões: ${c.revisoes}`);
  if (c.conversaWhatsApp.length) l.push(`Últimas mensagens no WhatsApp:\n${c.conversaWhatsApp.map((m) => `${m.de === "aluno" ? "Aluno" : "Zaeon"}: ${m.texto}`).join("\n")}`);
  return l.length ? l.join("\n") : "Ainda não há estudos registrados desta pessoa na Zaeon.";
}
