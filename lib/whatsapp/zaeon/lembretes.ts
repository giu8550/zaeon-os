/**
 * lib/whatsapp/zaeon/lembretes.ts — a Zaeon APRENDE a rotina pela resposta da pessoa no WhatsApp. "seg a sex 19h",
 * "amanhã 8h revisar cálculo", "todo dia 7:30 ler 10 páginas" viram ZaeonLembrete — e com isso a pessoa sai do
 * modo "sem rotina" (a cada 45 min) e passa pro 3× ao dia + lembretes. Comandos: "meus lembretes" (lista) e
 * "apagar lembretes" (zera). Filtro barato antes do modelo: só chama quando a mensagem fala de hora/dia.
 */
export type LembreteNovo = { texto: string; minutos: number; dias: number[]; data: string | null };

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** fala de horário/dia? (filtro antes do modelo) */
export const pareceRotina = (t: string): boolean =>
  /\b(\d{1,2}\s?(h|hs|horas?)\b|\d{1,2}:\d{2}|\d{1,2}h\d{2}|manh[ãa]|tarde|noite|madrugada|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|seg\b|ter\b|qua\b|qui\b|sex\b|sab\b|dom\b|todo dia|todos os dias|diariamente|amanh[ãa]|hoje)/i.test(t);

export type Comando = "listar" | "apagar" | null;
export function comandoDeLembrete(t: string): Comando {
  const n = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (/^(meus|ver|listar|quais (sao )?(os )?meus) lembretes\??$/.test(n)) return "listar";
  if (/^(apagar|cancelar|limpar|zerar|tirar) (os |meus |todos os )?lembretes!?$/.test(n)) return "apagar";
  return null;
}

/** valida/normaliza o que o modelo devolveu (nunca confia cego) */
export function normalizarLembretes(bruto: unknown, hojeKey: string): LembreteNovo[] {
  const lista = Array.isArray((bruto as any)?.lembretes) ? (bruto as any).lembretes : [];
  const out: LembreteNovo[] = [];
  for (const l of lista.slice(0, 10)) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(l?.hora ?? "").trim());
    if (!m) continue;
    const minutos = Number(m[1]) * 60 + Number(m[2]);
    if (minutos < 0 || minutos >= 1440) continue;
    const texto = String(l?.texto ?? "").trim().slice(0, 140) || "hora de estudar";
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(l?.data ?? "")) && String(l.data) >= hojeKey ? String(l.data) : null;
    const dias = data ? [] : [...new Set((Array.isArray(l?.dias) ? l.dias : []).map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() as number[];
    out.push({ texto, minutos, dias, data });
  }
  return out;
}

/** "seg–sex 19:00 — estudar cálculo" */
export function descreverLembrete(l: Pick<LembreteNovo, "texto" | "minutos" | "dias" | "data">): string {
  const quando = l.data ? l.data.split("-").reverse().slice(0, 2).join("/")
    : l.dias.length === 0 || l.dias.length === 7 ? "todo dia"
    : l.dias.join(",") === "1,2,3,4,5" ? "seg–sex"
    : l.dias.map((d) => DIAS[d]).join(", ");
  return `${quando} ${hhmm(l.minutos)} — ${l.texto}`;
}

type Extrair = (texto: string, hoje: { dataKey: string; diaSemana: string }) => Promise<unknown>;

/** extrai lembretes da mensagem (modelo, JSON). `extrair` injetável nos testes. */
export async function extrairLembretes(texto: string, hoje: { dataKey: string; diaSemana: string }, extrair?: Extrair): Promise<LembreteNovo[]> {
  if (!pareceRotina(texto)) return [];
  const ex = extrair ?? (async (t: string, h: { dataKey: string; diaSemana: string }) => {
    const { gerarJsonRes } = await import("@/lib/llm/envelope");
    const { valor } = await gerarJsonRes<unknown>({
      system: "Extraia da mensagem de um estudante os HORÁRIOS de estudo/lembretes que ele está pedindo ou informando. "
        + "Só o que for explícito. Responda JSON {\"lembretes\":[{\"texto\":\"o que fazer (curto)\",\"hora\":\"HH:MM\",\"dias\":[0..6 (0=domingo)],\"data\":\"YYYY-MM-DD ou null\"}]}. "
        + "\"seg a sex\" = [1,2,3,4,5]; \"todo dia\" = []; \"amanhã\"/\"hoje\"/data específica = preencha data e deixe dias []. Sem horário explícito → não inclua. Nada a extrair → {\"lembretes\":[]}.",
      user: `Hoje é ${h.diaSemana}, ${h.dataKey}.\nMensagem: ${t}`,
      json: true, temperature: 0, pensar: "minimal", timeoutMs: 15_000,
      ctx: { agentKey: "zaeon", surface: "estudos" as const, phase: "lembretes" },
    });
    return valor;
  });
  try { return normalizarLembretes(await ex(texto, hoje), hoje.dataKey); } catch { return []; }
}

/**
 * Antes da resposta normal da Zaeon: comandos de lembrete e rotina dita na mensagem. Devolve um TEXTO a pôr
 * antes da resposta (confirmação) ou, pros comandos, a resposta inteira (`basta`: não precisa do cérebro).
 */
export async function tratarRotinaNaMensagem(userId: string, texto: string, agora: Date = new Date()): Promise<{ prefixo?: string; basta?: string }> {
  const { prisma } = await import("@/src/lib/prisma");
  const cmd = comandoDeLembrete(texto);
  if (cmd === "listar") {
    const ls = await prisma.zaeonLembrete.findMany({ where: { userId, ativo: true }, orderBy: { minutos: "asc" } });
    return { basta: ls.length ? `📌 Seus lembretes:\n${ls.map((l) => `• ${descreverLembrete(l)}`).join("\n")}\n\nPra zerar: *apagar lembretes*.` : "Você ainda não tem lembretes. Me diz quando estuda (ex.: *seg a sex 19h*) que eu anoto. 🙂" };
  }
  if (cmd === "apagar") {
    const r = await prisma.zaeonLembrete.updateMany({ where: { userId, ativo: true }, data: { ativo: false } });
    return { basta: r.count ? `Pronto, apaguei ${r.count} lembrete${r.count > 1 ? "s" : ""}. Quando quiser, me passa os novos horários.` : "Não tinha lembrete nenhum ativo. 🙂" };
  }
  const { localParts, normalizeQuiet } = await import("../policy");
  const link = await prisma.whatsAppLink.findUnique({ where: { userId }, select: { quietHours: true } });
  const lp = localParts(agora, normalizeQuiet(link?.quietHours).tz!);
  const novos = await extrairLembretes(texto, { dataKey: lp.dateKey, diaSemana: ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"][lp.weekday]! });
  if (!novos.length) return {};
  await prisma.zaeonLembrete.createMany({ data: novos.map((l) => ({ userId, texto: l.texto, minutos: l.minutos, dias: l.dias, data: l.data, origem: "whatsapp" })) });
  return { prefixo: `📌 Anotei: ${novos.map(descreverLembrete).join("; ")}.` };
}
