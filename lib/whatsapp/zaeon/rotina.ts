/**
 * lib/whatsapp/zaeon/rotina.ts — QUANDO a Zaeon fala no WhatsApp (puro, testado). A regra do produto:
 *   • com ROTINA (lembretes ou agenda): 3× ao dia (manhã · tarde · noite) + na hora de cada lembrete;
 *   • SEM rotina: a Zaeon não sabe quando a pessoa estuda — puxa conversa a cada 45 min (acordada) até descobrir.
 * Ociosidade não é bem vista: a Zaeon é proativa. Mas nunca no "não incomodar" e no máximo UMA mensagem
 * proativa por pessoa por tick (prioridade: lembrete > momento do dia > descoberta). Não é um agendamento por
 * conversa: é o tick do worker que olha o relógio e decide (dedupe por chave em WhatsAppMessage).
 */
export type Momento = "manha" | "tarde" | "noite";
export type Lembrete = { id: string; texto: string; minutos: number; dias: number[]; data?: string | null; ativo: boolean };
export type Acao =
  | { tipo: "lembrete"; lembrete: Lembrete; chave: string }
  | { tipo: "momento"; momento: Momento; chave: string }
  | { tipo: "descoberta"; chave: string; tentativa: number };

export const HORARIOS_PADRAO: Record<Momento, number> = { manha: 8 * 60, tarde: 13 * 60 + 30, noite: 20 * 60 };
export const SEM_ROTINA_A_CADA_MIN = 45;
/** quanto tempo depois do horário ainda vale mandar o "momento" (o tick pode atrasar; depois disso, pula) */
export const JANELA_MOMENTO_MIN = 150;
/** lembrete sai se o tick cair até X min depois da hora dele */
export const JANELA_LEMBRETE_MIN = 20;

/** "08:00,13:30,20:00" (ZAEON_HORARIOS) → minutos do dia de manhã/tarde/noite */
export function horariosDoEnv(v: string | undefined): Record<Momento, number> {
  const partes = (v ?? "").split(",").map((s) => /^(\d{1,2}):(\d{2})$/.exec(s.trim())).filter(Boolean) as RegExpExecArray[];
  if (partes.length !== 3) return HORARIOS_PADRAO;
  const [m, t, n] = partes.map((p) => Number(p[1]) * 60 + Number(p[2]));
  return [m, t, n].every((x) => x! >= 0 && x! < 1440) ? { manha: m!, tarde: t!, noite: n! } : HORARIOS_PADRAO;
}

/** a pessoa tem rotina se tem lembrete ativo OU agenda de aulas — senão a Zaeon não sabe quando ela estuda */
export const temRotina = (o: { lembretesAtivos: number; itensDeAgenda: number }) => o.lembretesAtivos > 0 || o.itensDeAgenda > 0;

/** lembrete vale HOJE? (dias vazio = todo dia; `data` = uma vez só) — `dia` 0=dom..6=sáb */
export function lembreteHoje(l: Lembrete, dia: number, dataKey: string): boolean {
  if (!l.ativo) return false;
  if (l.data) return l.data === dataKey;
  return l.dias.length === 0 || l.dias.includes(dia);
}

/** o "bucket" de 45 min do dia — a chave da descoberta (no máx. 1 por bucket) */
export const bucketDescoberta = (minutoDoDia: number, cada = SEM_ROTINA_A_CADA_MIN) => Math.floor(minutoDoDia / cada);

/**
 * O que mandar AGORA pra uma pessoa (no máx. 1 ação). `minutoDoDia`/`dia`/`dataKey` já no fuso dela;
 * `quieto` = está no "não incomodar"; `enviadas` = chaves já mandadas (dedupe); `ultimoProativoMin` = há
 * quantos minutos saiu a última mensagem proativa (null = nunca); `respondeuDesde` = a pessoa respondeu
 * depois da última proativa (aí a descoberta pode esperar a conversa andar).
 */
export function oQueMandar(o: {
  minutoDoDia: number; dia: number; dataKey: string; quieto: boolean;
  lembretes: Lembrete[]; itensDeAgenda: number; enviadas: Set<string>;
  ultimoProativoMin: number | null; descobertasHoje: number;
  horarios?: Record<Momento, number>; cadaMin?: number;
}): Acao | null {
  if (o.quieto) return null;
  const horarios = o.horarios ?? HORARIOS_PADRAO;
  const cada = o.cadaMin ?? SEM_ROTINA_A_CADA_MIN;

  // 1) lembrete na hora dele
  for (const l of o.lembretes) {
    if (!lembreteHoje(l, o.dia, o.dataKey)) continue;
    const atraso = o.minutoDoDia - l.minutos;
    const chave = `zaeon:lembrete:${l.id}:${o.dataKey}`;
    if (atraso >= 0 && atraso <= JANELA_LEMBRETE_MIN && !o.enviadas.has(chave)) return { tipo: "lembrete", lembrete: l, chave };
  }

  const rotina = temRotina({ lembretesAtivos: o.lembretes.filter((l) => l.ativo).length, itensDeAgenda: o.itensDeAgenda });
  if (rotina) {
    // 2) os 3 momentos do dia (o mais recente que ainda está na janela)
    for (const m of ["noite", "tarde", "manha"] as const) {
      const atraso = o.minutoDoDia - horarios[m];
      const chave = `zaeon:${m}:${o.dataKey}`;
      if (atraso >= 0 && atraso <= JANELA_MOMENTO_MIN && !o.enviadas.has(chave)) return { tipo: "momento", momento: m, chave };
    }
    return null;
  }

  // 3) SEM rotina: a cada 45 min, acordada, puxa conversa pra descobrir a rotina
  if (o.ultimoProativoMin !== null && o.ultimoProativoMin < cada) return null;
  const chave = `zaeon:descoberta:${o.dataKey}:${bucketDescoberta(o.minutoDoDia, cada)}`;
  if (o.enviadas.has(chave)) return null;
  return { tipo: "descoberta", chave, tentativa: o.descobertasHoje + 1 };
}
