/**
 * lib/canais/politica.ts — a GOVERNANÇA de envio dos canais do mundo real (F0).
 *
 * Generaliza `lib/whatsapp/policy.ts` (que já roda em produção) pro resto das redes, REUSANDO a parte
 * de fuso dele (`localParts`/`inQuietHours`) em vez de reimplementar Intl. Módulo PURO: recebe o
 * estado do canal e o relógio, devolve ALLOW/DENY com motivo. Nenhum IO, nenhum Prisma.
 *
 * Decisões encarnadas aqui:
 *   • Quiet hours valem pra DM/resposta, NÃO pra publicar. Mandar mensagem a alguém às 3 h incomoda;
 *     um post num feed às 3 h não incomoda ninguém — e travar isso só empurraria a fila pro dia
 *     seguinte sem benefício. (No WhatsApp o quiet hours continua valendo, via policy.ts.)
 *   • O teto diário é NOSSO, não da plataforma: é a trava que impede um bug de virar spam. Conta por
 *     dia-BRT, no mesmo padrão de `AgentChannel.diaContagem`.
 *   • Erro recente pausa o canal (`pausadoAte`) — mesma ideia da pausa pós-falha do Octa: canal fora
 *     não pode custar uma tentativa em cada ciclo.
 *   • Aprovação humana é o DEFAULT. `autoPublicar` é opt-in POR CANAL e nunca global.
 */
import { inQuietHours, localParts, DEFAULT_QUIET, DEFAULT_TZ, type QuietHours } from "@/lib/whatsapp/policy";
import { podeNaRede, estadoPublica, type Capacidade, type ClasseErroCanal, type EstadoCanal, type Rede } from "@/lib/canais/tipos";

export { DEFAULT_QUIET, DEFAULT_TZ, type QuietHours };

/** Teto diário conservador por rede (governança local). O admin pode baixar; subir é decisão do dono. */
export const TETO_DIA_PADRAO: Record<Rede, number> = {
  whatsapp: 20,   // igual ao default de AgentChannel.limiteDia
  instagram: 3,
  x: 5,
  linkedin: 2,
};

/** Dia-BRT (YYYY-MM-DD) a que a contagem se refere — mesma convenção de `AgentChannel.diaContagem`. */
export const diaBrt = (agora: Date, tz: string = DEFAULT_TZ): string => localParts(agora, tz).dateKey;

/** Capacidades que FALAM COM ALGUÉM (respeitam janela de silêncio). Publicar num feed não entra. */
const INCOMODA: ReadonlySet<Capacidade> = new Set<Capacidade>(["dm", "responder"]);
export const respeitaQuietHours = (cap: Capacidade): boolean => INCOMODA.has(cap);

/** O estado do canal, como a política precisa ver (espelha as colunas de `CanalSocial`). */
export type EstadoEnvio = {
  rede: Rede;
  estado: EstadoCanal;
  limiteDia: number;
  enviadosHoje: number;
  /** Dia a que `enviadosHoje` se refere; diferente de hoje = a contagem zerou. */
  diaContagem?: string | null;
  pausadoAte?: Date | string | null;
  quietHours?: unknown;
};

export type Veredito = { ok: true; restamHoje: number } | { ok: false; classe: ClasseErroCanal; detalhe: string };

const comoData = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Quantos envios restam hoje (a contagem zera quando `diaContagem` não é hoje). */
export function restamHoje(e: EstadoEnvio, agora: Date, tz: string = DEFAULT_TZ): number {
  const usados = e.diaContagem && e.diaContagem === diaBrt(agora, tz) ? Math.max(0, e.enviadosHoje) : 0;
  return Math.max(0, e.limiteDia - usados);
}

/**
 * Pode enviar AGORA? Ordem das checagens é deliberada: o que é erro de CONTRATO vem primeiro (não
 * depende do relógio nem do estado), depois o que exige humano (auth/pausa), e só no fim o que passa
 * com o tempo (teto/quiet) — assim o motivo devolvido é sempre o mais acionável.
 */
export function podeEnviar(e: EstadoEnvio, cap: Capacidade, agora: Date, tz: string = DEFAULT_TZ): Veredito {
  if (!podeNaRede(e.rede, cap)) {
    return { ok: false, classe: "capacidade", detalhe: `${e.rede} não faz "${cap}" pela API` };
  }
  if (e.estado === "pausado") return { ok: false, classe: "pausado", detalhe: `canal ${e.rede} pausado (kill-switch)` };
  if (e.estado === "precisa_autorizar") return { ok: false, classe: "auth", detalhe: `${e.rede} precisa reautorizar` };
  if (!estadoPublica(e.estado)) return { ok: false, classe: "auth", detalhe: `canal ${e.rede} em "${e.estado}"` };

  const pausa = comoData(e.pausadoAte);
  if (pausa && pausa > agora) {
    return { ok: false, classe: "rate_limit", detalhe: `em pausa até ${pausa.toISOString()} (erro recente)` };
  }

  const restam = restamHoje(e, agora, tz);
  if (restam <= 0) return { ok: false, classe: "teto_dia", detalhe: `teto de ${e.limiteDia}/dia atingido em ${e.rede}` };

  if (respeitaQuietHours(cap) && inQuietHours(e.quietHours ?? DEFAULT_QUIET, agora)) {
    return { ok: false, classe: "quiet_hours", detalhe: "janela de silêncio (22h→7h BRT)" };
  }
  return { ok: true, restamHoje: restam };
}

/**
 * Sai agora ou espera aprovação? Aprovação humana é o default (§4.2 do plano): o conteúdo público é
 * irreversível. `autoPublicar` é por canal, e nem ele dispensa a política acima.
 */
export function precisaAprovacao(canal: { autoPublicar?: boolean | null }, env: Record<string, string | undefined> = process.env): boolean {
  if (aprovacaoForcada(env)) return true; // trava global vence o opt-in do canal
  return !canal.autoPublicar;
}

/** A trava global está puxada? (`CANAIS_AUTO_PUBLICAR=0` → nada publica sem gente, nem canal com opt-in.) */
export function aprovacaoForcada(env: Record<string, string | undefined> = process.env): boolean {
  return /^(0|off|false|nao|não|no)$/i.test(String(env.CANAIS_AUTO_PUBLICAR ?? "").trim());
}

/** Os canais externos estão ligados? `CANAIS_EXTERNOS=0` = volta a ser só WhatsApp, como hoje. */
export function canaisExternosLigados(env: Record<string, string | undefined> = process.env): boolean {
  const f = String(env.CANAIS_EXTERNOS ?? "").trim();
  return !(f && /^(0|off|false|nao|não|no)$/i.test(f));
}

/** Pausa sugerida depois de um erro, por classe (backoff grosseiro e previsível, em ms). */
export function pausaAposErro(classe: ClasseErroCanal): number {
  switch (classe) {
    case "rate_limit": return 30 * 60_000;   // a plataforma reclamou: meia hora longe
    case "rede":
    case "timeout": return 5 * 60_000;
    case "conteudo_recusado": return 60 * 60_000;
    case "auth":
    case "escopo": return 0;                 // não passa com o tempo: precisa de humano
    default: return 10 * 60_000;
  }
}
