/**
 * lib/canal/agent-turn.ts — UM turno de agente no canal (padrão ACP do Buzz: prompt → stopReason,
 * aqui `trajectory` + `buildHarnessDeps`, o nosso "ACP interno").
 *
 * Fluxo: carrega canal + últimas N mensagens → confirma o author gate → monta a IDENTIDADE
 * (persona do roster OU mentor do catálogo, com nome do AgentProfile) → roda o harness com
 * o contexto do canal → grava a resposta como `CanalMensagem` do agente → publica no Pusher
 * (cada agente fala com SEU nome/avatar) → registra `AgentUsage`.
 *
 * Tudo injetável (`TurnoDeps`) → testável sem Prisma/Gemini/Pusher. Serialização por canal
 * fica em `lib/canal/serial.ts` (chamador/fila), não aqui.
 */
import { podeEscrever } from "@/lib/canal/gate";
import { montarAliases, semMencoes } from "@/lib/canal/mention";
import { registrarUso } from "@/lib/canal/usage";
import { rosterComMentores, mergeProfiles, type AgentView } from "@/lib/agents/roster";
import { EV_DIGITANDO, EV_MENSAGEM, publicarPusher, type MensagemWire, type Publicar } from "@/lib/canal/realtime";
import { limparSaidaAgente } from "@/lib/canal/saida";
import { estadoDeFase, type EstadoAgente } from "@/lib/canal/estadoAgente";
import { proximoDaCadeia, podePassar } from "@/lib/canal/encadear";
import { estaForaDaConversa } from "@/lib/canal/alvo";
import { agentesDasSalas } from "@/lib/canal/agentesSalas";

export const N_CONTEXTO = 30;

export type TurnoInput = {
  canalId: string;
  agentKey: string;
  /** quem convocou (dono do turno pra memória/uso). */
  userId: string;
  /** mensagem que convocou (objetivo preferencial). */
  mensagemId?: string | null;
  /** PR-A3: quem pediu. "humano" (default) NUNCA é barrado pelo teto; "autonomo" (heartbeat/programa, fatias 6–8) é. */
  origem?: "humano" | "autonomo";
  /** #396 (B): posição na cadeia de agentes (0 = chamado por humano) — lib/canal/encadear. */
  cadeia?: number;
  /** #396 (B): o agente que passou a bola pra este. */
  chamadoPor?: string | null;
  /** #396 (B): quem já falou nesta cadeia (não chama de volta). */
  jaNaCadeia?: string[];
};

export type MsgRow = {
  id: string; canalId: string; autorTipo: string; autorId: string; texto: string; mencoes: string[]; createdAt: Date;
};
export type CanalRow = { id: string; ownerId: string; titulo: string; acesso: string; membros: string[]; agentes: string[] };

export type TurnoPrisma = {
  canal: { findUnique(a: { where: { id: string } }): Promise<CanalRow | null> };
  canalMensagem: {
    findMany(a: { where: { canalId: string }; orderBy: { createdAt: "desc" }; take: number }): Promise<MsgRow[]>;
    create(a: { data: { canalId: string; autorTipo: string; autorId: string; texto: string; mencoes: string[] } }): Promise<MsgRow>;
  };
  agentProfile: { findMany(a?: unknown): Promise<{ agentKey: string; tipo: string; nome: string; avatarUrl: string | null; bio: string | null; ativo: boolean; ordem: number }[]> };
  mentorTemplate: { findMany(a?: unknown): Promise<{ slug: string; name: string; course: string; emoji: string; personaText: string; order: number }[]> };
  user: { findMany(a: { where: { id: { in: string[] } }; select: { id: true; name: true } }): Promise<{ id: string; name: string | null }[]> };
  agentUsage: Parameters<typeof registrarUso>[0]["agentUsage"];
};

export type GerarArgs = {
  agente: AgentView;
  objective: string;
  history: { role: "user" | "assistant"; text: string }[];
  canal: CanalRow;
  userId: string;
  /** a cada fase do harness (route, plan, gather, …): vira o estado mostrado na tela ("pesquisando"). */
  onFase?: (fase: string) => void;
};
export type Gerar = (args: GerarArgs) => Promise<string>;

export type TurnoDeps = {
  prisma: TurnoPrisma;
  gerar?: Gerar;          // default = harness (import tardio)
  publicar?: Publicar;    // default = Pusher
  /** #396 (B): dispara o turno do próximo agente da cadeia (a fila injeta; sem isto, não encadeia). */
  encadear?: (job: TurnoInput & { mensagemId: string }) => Promise<unknown> | unknown;
};

export type TurnoResult =
  | { ok: true; mensagem: MensagemWire; encadeado?: string | null }
  | { ok: false; motivo: "canal" | "gate" | "agente" | "vazio" | "erro" | "teto"; erro?: string };

// ───────────────────────────── helpers PUROS (exportados p/ teste) ─────────────────────────────

/** Histórico pro harness: eu (o agente) = assistant; humanos e OUTROS agentes = user, rotulados. */
export function montarHistorico(msgs: MsgRow[], agentKey: string, nomes: Map<string, string>): GerarArgs["history"] {
  return msgs.map((m) => {
    if (m.autorTipo === "agente" && m.autorId === agentKey) return { role: "assistant" as const, text: m.texto };
    // #423: "Martinez entrou no escritório" é aviso do canal, não fala da pessoa
    if (m.autorTipo === "sistema") return { role: "user" as const, text: `[aviso do canal]: ${m.texto}` };
    const nome = nomes.get(m.autorId) ?? (m.autorTipo === "agente" ? m.autorId : "Alguém");
    const rotulo = m.autorTipo === "agente" ? `[agente ${nome}]` : nome;
    return { role: "user" as const, text: `${rotulo}: ${m.texto}` };
  });
}

/** Objetivo do turno: a mensagem que convocou (sem os @), senão a última humana que me menciona, senão a última humana. */
export function montarObjetivo(msgs: MsgRow[], agentKey: string, mensagemId: string | null | undefined, aliases: Map<string, string>): string {
  const porId = mensagemId ? msgs.find((m) => m.id === mensagemId) : null;
  const humanas = msgs.filter((m) => m.autorTipo === "humano");
  const meMenciona = [...humanas].reverse().find((m) => (m.mencoes ?? []).includes(agentKey));
  const alvo = porId ?? meMenciona ?? humanas[humanas.length - 1];
  if (!alvo) return "";
  const limpo = semMencoes(alvo.texto, aliases);
  return limpo || alvo.texto.trim();
}

/** Bloco de contexto do canal (vai no systemContext do harness). */
export function blocoCanal(
  canal: CanalRow, agente: AgentView, colegas: AgentView[], humanos: string[],
  /** #396 (B): quem passou a bola e se este turno ainda pode passar adiante. */
  opts: {
    chamadoPor?: Pick<AgentView, "agentKey" | "nome"> | null; podePassar?: boolean;
    /** #468: agentes que SAÍRAM da conversa — a IA não deve marcá-los com @ (eles não voltam por outra agente). */
    fora?: Pick<AgentView, "agentKey" | "nome">[];
  } = {},
): string {
  const saiu = new Set((opts.fora ?? []).map((f) => f.agentKey));
  const outros = colegas.filter((c) => c.agentKey !== agente.agentKey && !saiu.has(c.agentKey)).map((c) => `@${c.agentKey} (${c.nome})`);
  const passa = opts.podePassar !== false;
  return [
    "=== CANAL DE COWORKING ===",
    `Canal: "${canal.titulo}". Você é ${agente.nome} e foi convocado(a) por @${agente.agentKey}.`,
    humanos.length ? `Pessoas no canal: ${humanos.join(", ")}.` : "",
    outros.length ? `Outros agentes no canal: ${outros.join(", ")}.` : "",
    opts.fora?.length
      ? `Saíram da conversa (NÃO marque com @; só voltam se a pessoa chamar): ${opts.fora.map((f) => `${f.nome}`).join(", ")}.`
      : "",
    // nicho: cada agente responde a parte da área dele; o resto ele passa (o colega responde sozinho em seguida)
    passa
      ? "Fique no SEU nicho: responda só a parte da sua área. Se o pedido (ou parte dele) for da área de um colega, diga isso em UMA linha e marque UM colega com @chave — ele responde em seguida, sem a pessoa precisar chamar."
      : "Não chame outros agentes agora: resolva com o que é da sua área e diga o que fica faltando.",
    opts.chamadoPor
      ? `Você foi chamado(a) por @${opts.chamadoPor.agentKey} (${opts.chamadoPor.nome}) para a parte da sua área: responda essa parte e feche com 1 a 3 próximos passos curtos.`
      : "",
    "Formato: conversa de canal — responda em 1ª pessoa, como " + agente.nome + ", direto ao ponto, em poucos parágrafos curtos (sem cabeçalhos). Fale só do que te pediram; não repita a pergunta; não se apresente.",
  ].filter(Boolean).join("\n");
}

// ───────────────────────────── gerar (default = harness) ─────────────────────────────

const gerarComHarness: Gerar = async ({ agente, objective, history, canal, userId, onFase }) => {
  const [{ buildHarnessDeps, renderStructuredAnswer }, { runTrajectory }, { gatewayLigado }] = await Promise.all([
    import("@/lib/agent/aura-harness"),
    import("@/lib/agent/trajectory"),
    import("@/lib/llm/chaves"),
  ]);
  // Identidade: persona do roster (preâmbulo + prompt) OU mentor do catálogo (BASE + personaText).
  let identidade = "";
  let wing: string | undefined;
  if (agente.tipo === "mentor") {
    const { resolveMentor } = await import("@/lib/agent/mentors-server");
    const m = await resolveMentor(agente.agentKey, userId).catch(() => null);
    identidade = m?.context ?? "";
    wing = m?.wing.label;
  }
  if (!identidade) {
    const { PERSONAS, buildPersona } = await import("@/lib/ai/personas");
    identidade = PERSONAS[agente.agentKey] ? buildPersona(agente.agentKey) : `Você é ${agente.nome}. ${agente.bio}`;
  }
  const systemContext = [identidade, (agente as any).__blocoCanal ?? ""].filter(Boolean).join("\n\n");
  // O harness foi escrito "em Aura"; aqui a voz é do agente convocado. Troca a identidade nos
  // prompts de geração SEM tocar no harness (regra: o harness só muda no incremento de uso).
  const assinatura = `\nIDENTIDADE DESTE TURNO: você é ${agente.nome} (não a Aura). Mantenha a voz e o nome de ${agente.nome} em toda a resposta.`;
  const transformarSystem = (system: string) => system.replace(/Você é a Aura/g, `Você é ${agente.nome}`) + assinatura;
  const hctx: any = {
    userId,
    activeTab: "escritorio",
    plan: "free",
    execMode: "auto",
    currentGoal: objective.slice(0, 200),
    mentor: agente.tipo === "mentor" ? agente.agentKey : undefined,
    wing,
    canalId: canal.id,
  };
  // C5/C6: o turno do canal é o ÚNICO opt-in ao gateway nesta fatia (e só com GATEWAY_URL); o ledger
  // leva agentKey/surface/scopeId e cada fase (plan/reason/draft) grava sua linha.
  const deps = buildHarnessDeps(hctx, {
    systemContext, history, transformarSystem,
    // o harness já emite cada fase em step.detail; aqui só repassamos pro estado visível no canal
    onStep: (s) => onFase?.(String(s?.detail ?? "")),
    rota: gatewayLigado() ? "gateway" : "vertex",
    ledger: { agentKey: agente.agentKey, mentorSlug: agente.tipo === "mentor" ? agente.agentKey : null, surface: "canal", scopeId: canal.id, userId: userId ?? null },
  });
  const answer = await runTrajectory(objective, hctx, deps);
  return renderStructuredAnswer(answer).trim();
};

// ───────────────────────────── o turno ─────────────────────────────

export async function executarTurno(input: TurnoInput, deps: TurnoDeps): Promise<TurnoResult> {
  const { prisma } = deps;
  const gerar = deps.gerar ?? gerarComHarness;
  const publicar = deps.publicar ?? publicarPusher;

  const canal = await prisma.canal.findUnique({ where: { id: input.canalId } });
  if (!canal) return { ok: false, motivo: "canal" };
  if (!podeEscrever(canal, input.userId)) return { ok: false, motivo: "gate" };

  // identidade dos agentes (roster + banco + profile)
  const [mentores, profiles] = await Promise.all([
    prisma.mentorTemplate.findMany().catch(() => []),
    prisma.agentProfile.findMany().catch(() => []),
  ]);
  const roster = mergeProfiles(rosterComMentores(mentores), profiles);
  const agente = roster.find((a) => a.agentKey === input.agentKey && a.ativo && a.conversacional);
  if (!agente) return { ok: false, motivo: "agente" };

  // PR-A3 · teto por agente — ler ≠ agir: só freia com AGENT_TETO_ENFORCE=1 E origem "autonomo" (handoff §5 A3).
  if ((input.origem ?? "humano") === "autonomo" && process.env.AGENT_TETO_ENFORCE === "1") {
    const { foraPorTeto } = await import("@/lib/llm/teto");
    const t = await foraPorTeto(prisma as any, agente.agentKey).catch(() => ({ fora: false, usado: 0, teto: null }));
    if (t.fora) {
      const { messageForError } = await import("@/lib/agent/errors");
      await publicar(canal.id, EV_MENSAGEM, {
        id: `efemera-${Date.now()}`, canalId: canal.id, autorTipo: "agente", autorId: agente.agentKey, texto: messageForError("agent_budget_exhausted"), mencoes: [],
        createdAt: new Date().toISOString(), autorNome: agente.nome, autorAvatar: agente.avatarUrl, efemera: true,
      } satisfies MensagemWire & { efemera: true });
      return { ok: false, motivo: "teto" };
    }
  }

  const desc = await prisma.canalMensagem.findMany({ where: { canalId: canal.id }, orderBy: { createdAt: "desc" }, take: N_CONTEXTO });
  const msgs = [...desc].reverse();
  const humanoIds = [...new Set(msgs.filter((m) => m.autorTipo === "humano").map((m) => m.autorId))];
  const humanos = humanoIds.length ? await prisma.user.findMany({ where: { id: { in: humanoIds } }, select: { id: true, name: true } }).catch(() => []) : [];
  const nomes = new Map<string, string>();
  for (const h of humanos) nomes.set(h.id, h.name || "Alguém");
  for (const a of roster) nomes.set(a.agentKey, a.nome);

  const aliases = montarAliases(roster.map((a) => ({ agentKey: a.agentKey, nome: a.nome })));
  const objective = montarObjetivo(msgs, agente.agentKey, input.mensagemId, aliases);
  if (!objective) return { ok: false, motivo: "vazio" };
  const history = montarHistorico(msgs, agente.agentKey, nomes);
  const colegas = roster.filter((a) => canal.agentes.includes(a.agentKey));
  // #396 (B): quem pode receber a bola — os agentes do canal + as personas da plataforma (ativos e que conversam)
  const ativos = roster.filter((a) => a.ativo && a.conversacional);
  // #468: quem SAIU da conversa ("Téo saiu da conversa") não recebe a bola — só volta se uma PESSOA chamar.
  // Antes, outra agente marcava "@teo" no texto e ele voltava sozinho, sem a linha "voltou".
  const resumo = msgs.map((m) => ({ autorTipo: m.autorTipo, autorId: m.autorId, texto: m.texto }));
  const fora = roster.filter((a) => a.agentKey !== agente.agentKey && estaForaDaConversa(resumo, a.agentKey));
  const permitidos = [...new Set([...canal.agentes, ...agentesDasSalas(ativos)])]
    .filter((k) => ativos.some((a) => a.agentKey === k) && !fora.some((f) => f.agentKey === k));
  const cadeia = input.cadeia ?? 0;
  const chamadoPor = input.chamadoPor ? roster.find((a) => a.agentKey === input.chamadoPor) ?? null : null;
  const bloco = blocoCanal(canal, agente, colegas, [...nomes].filter(([k]) => humanoIds.includes(k)).map(([, v]) => v), { chamadoPor, podePassar: podePassar(cadeia), fora });
  const agenteComCanal = Object.assign(Object.create(null), agente, { __blocoCanal: bloco }) as AgentView;

  await publicar(canal.id, EV_DIGITANDO, { agentKey: agente.agentKey, estado: "digitando" });
  // Estado em palavras: só publica quando MUDA (o harness emite várias vezes a mesma fase).
  let atual: EstadoAgente = "digitando";
  let fim: EstadoAgente = "ocioso";
  const onFase = (fase: string) => {
    const e = estadoDeFase(fase);
    if (e === atual) return;
    atual = e;
    void Promise.resolve(publicar(canal.id, EV_DIGITANDO, { agentKey: agente.agentKey, estado: e })).catch(() => undefined);
  };
  try {
    // G6 (Fatia 7): nunca persistir imagem remota/HTML vindo do modelo (texto limpo sai idêntico).
    const texto = limparSaidaAgente((await gerar({ agente: agenteComCanal, objective, history, canal, userId: input.userId, onFase })).trim());
    if (!texto) throw new Error("resposta vazia");
    const row = await prisma.canalMensagem.create({ data: { canalId: canal.id, autorTipo: "agente", autorId: agente.agentKey, texto, mencoes: [] } });
    const wire: MensagemWire = {
      id: row.id, canalId: row.canalId, autorTipo: "agente", autorId: agente.agentKey, texto: row.texto, mencoes: [],
      createdAt: new Date(row.createdAt).toISOString(), autorNome: agente.nome, autorAvatar: agente.avatarUrl,
    };
    await publicar(canal.id, EV_MENSAGEM, wire);
    void registrarUso(prisma, agente.agentKey, input.userId);
    // #396 (B): a resposta marcou um colega → ele responde sozinho em seguida (limite e regras em lib/canal/encadear).
    // Roda como "autonomo" pro teto de uso valer; um erro aqui nunca derruba a resposta que já saiu.
    const proximo = deps.encadear
      ? proximoDaCadeia({ texto: row.texto, aliases, permitidos, eu: agente.agentKey, cadeia, jaNaCadeia: input.jaNaCadeia })
      : null;
    if (proximo && deps.encadear) {
      try {
        await deps.encadear({
          canalId: canal.id, agentKey: proximo, userId: input.userId, mensagemId: row.id, origem: "autonomo",
          cadeia: cadeia + 1, chamadoPor: agente.agentKey, jaNaCadeia: [...(input.jaNaCadeia ?? []), agente.agentKey],
        });
      } catch (e) {
        console.warn("[canal] encadear falhou:", (e as Error)?.message);
      }
    }
    return { ok: true, mensagem: wire, encadeado: proximo };
  } catch (e) {
    const erro = String((e as Error)?.message ?? e);
    // C6 (lei 5): budget da virtual key estourou → chave própria do catálogo, nunca "erro genérico".
    const teto = (e as any)?.classe === "teto";
    if (teto) fim = "descanso"; // chegou ao limite: a tela mostra "em descanso" em vez de voltar a ocioso
    console.error("[canal] turno do agente falhou:", agente.agentKey, teto ? "teto diário (virtual key)" : erro);
    // Silêncio é pior que erro: o agente "fala" uma mensagem EFÊMERA (não persiste, some no
    // reload) com a frase amigável do catálogo de erros — nunca string à mão, nunca o stack.
    try {
      const { messageForError } = await import("@/lib/agent/errors");
      await publicar(canal.id, EV_MENSAGEM, {
        id: `efemera-${Date.now()}`, canalId: canal.id, autorTipo: "agente", autorId: agente.agentKey, texto: messageForError(teto ? "agent_budget_exhausted" : erro), mencoes: [],
        createdAt: new Date().toISOString(), autorNome: agente.nome, autorAvatar: agente.avatarUrl, efemera: true,
      } satisfies MensagemWire & { efemera: true });
    } catch { /* best-effort */ }
    return { ok: false, motivo: "erro", erro };
  } finally {
    await publicar(canal.id, EV_DIGITANDO, { agentKey: agente.agentKey, estado: fim });
  }
}
