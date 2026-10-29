/**
 * lib/canais/tipos.ts — o CONTRATO dos canais do mundo real (F0 do docs/PLANO_AGENTES_MUNDO_REAL.md).
 *
 * Módulo PURO: só tipos, matrizes declaradas e funções sem IO. Nenhuma rede é tocada aqui — F0 é o
 * contrato, os adapters vêm nas fases F3–F5. Quem implementa um adapter implementa `ChannelAdapter`.
 *
 * DECISÃO DO DONO (2026-10-29) — "Opção A": as redes sociais da Zaeon são UMA CONTA INSTITUCIONAL por
 * rede, e os agentes são VOZES que ASSINAM o post. Não é uma conta por agente (13 mentores + ~10
 * personas × 4 redes = até 92 contas, e criação em massa é o padrão que as plataformas tratam como
 * comportamento inautêntico). Consequências que este arquivo encarna:
 *   • `ESCOPO_DA_REDE`: social = "org" (credencial pertence à rede), WhatsApp = "agente" (chip próprio
 *     por agente via ChipFlow, como já funciona hoje em `AgentChannel`).
 *   • `assinaturaDe()`: atribuição é OBRIGATÓRIA em conteúdo público — quem fala tem nome.
 *
 * A outra assimetria encarnada aqui: os canais NÃO fazem as mesmas coisas. `CAPACIDADES_DA_REDE` é
 * declarada, não presumida — pedir `dm` ao LinkedIn é erro de contrato, pego antes de qualquer rede.
 */

// ───────────────────────────── redes e capacidades ─────────────────────────────

export const REDES = ["whatsapp", "instagram", "x", "linkedin"] as const;
export type Rede = (typeof REDES)[number];
export const ehRede = (v: unknown): v is Rede => typeof v === "string" && (REDES as readonly string[]).includes(v);

export const CAPACIDADES = ["publicar", "responder", "dm"] as const;
export type Capacidade = (typeof CAPACIDADES)[number];

/**
 * O que cada rede REALMENTE faz pela API (§3 do plano). Mudar isto é mudar o contrato — e deve vir
 * com a fonte oficial na mão, não com otimismo:
 *   whatsapp  — conversa 1:1; não tem feed. Já em produção via lib/whatsapp.
 *   instagram — publicar + comentários + DM (DM só na janela de 24 h da plataforma).
 *   x         — publicar + replies + DM.
 *   linkedin  — publicar + comentários. DM praticamente fechado à API: fora do contrato.
 */
export const CAPACIDADES_DA_REDE: Record<Rede, readonly Capacidade[]> = {
  whatsapp: ["dm"],
  instagram: ["publicar", "responder", "dm"],
  x: ["publicar", "responder", "dm"],
  linkedin: ["publicar", "responder"],
};

export const podeNaRede = (rede: Rede, cap: Capacidade): boolean => CAPACIDADES_DA_REDE[rede].includes(cap);

/** Onde a CREDENCIAL vive (Opção A). "org" = uma conta institucional por rede; "agente" = uma por agente. */
export const ESCOPO_DA_REDE: Record<Rede, "org" | "agente"> = {
  whatsapp: "agente",
  instagram: "org",
  x: "org",
  linkedin: "org",
};
export const ehRedeDaOrg = (rede: Rede): boolean => ESCOPO_DA_REDE[rede] === "org";

/** Redes sociais institucionais — as que a F0 modela em `CanalSocial`. WhatsApp fica em `AgentChannel`. */
export const REDES_SOCIAIS = REDES.filter(ehRedeDaOrg) as readonly Rede[];

// ───────────────────────────── estado do canal ─────────────────────────────

/**
 * Espelha a máquina de estados que `AgentChannel` já usa pro WhatsApp, com os nomes do OAuth das
 * redes. `pausado` é o kill-switch por canal (§6 do plano): o conteúdo continua sendo gerado e
 * enfileirado, só não sai.
 */
export const ESTADOS_CANAL = ["nao_conectado", "conectando", "conectado", "precisa_autorizar", "restrito", "pausado", "erro"] as const;
export type EstadoCanal = (typeof ESTADOS_CANAL)[number];
export const ehEstadoCanal = (v: unknown): v is EstadoCanal => typeof v === "string" && (ESTADOS_CANAL as readonly string[]).includes(v);

/** Só `conectado` publica. Os outros têm motivo próprio — a UI mostra qual, o executor não tenta. */
export const estadoPublica = (e: EstadoCanal): boolean => e === "conectado";

// ───────────────────────────── erros ─────────────────────────────

/**
 * Classe de erro de canal — o vocabulário estável que a UI, o log e a fila usam. Mesma ideia do
 * `ClasseErroLlm` de lib/llm/usage: quem decide o que fazer olha a classe, não a string do provedor.
 */
export const CLASSES_ERRO_CANAL = [
  "auth",               // token inválido/expirado → precisa_autorizar
  "escopo",             // o token não tem o escopo (ex.: publicar sem w_member_social)
  "capacidade",         // a rede não faz isso (ex.: dm no LinkedIn) — erro de contrato, não de rede
  "rate_limit",         // a plataforma recusou por volume
  "teto_dia",           // o NOSSO teto diário (governança local, não da plataforma)
  "quiet_hours",        // janela de silêncio
  "pausado",            // kill-switch
  "pii_bloqueada",      // noPiiExterno recusou o conteúdo
  "conteudo_recusado",  // a plataforma recusou o conteúdo
  "rede",               // falha de transporte
  "timeout",
  "desconhecido",
] as const;
export type ClasseErroCanal = (typeof CLASSES_ERRO_CANAL)[number];

/** Vale repetir depois? (teto/quiet/rate passam com o tempo; auth/escopo/capacidade exigem humano.) */
const TRANSITORIOS = new Set<ClasseErroCanal>(["rate_limit", "teto_dia", "quiet_hours", "pausado", "rede", "timeout"]);
export const erroTransitorio = (c: ClasseErroCanal): boolean => TRANSITORIOS.has(c);

// ───────────────────────────── conteúdo ─────────────────────────────

/** Limite de caracteres por rede (conteúdo público). X é o apertado; serve de piso do rascunho. */
export const LIMITE_TEXTO: Record<Rede, number> = {
  whatsapp: 4_096,
  instagram: 2_200,
  x: 280,
  linkedin: 3_000,
};

export type Publicacao = {
  /** Qual agente FALA (Opção A: ele assina; a conta é da Zaeon). */
  agentKey: string;
  rede: Rede;
  texto: string;
  /** URLs de mídia já hospedada (a plataforma busca; não subimos binário aqui). */
  midia?: string[];
  /** Link de origem, quando o post nasce de uma fonte (chore `publicar_externo`). */
  fonteUrl?: string;
};

export type ResultadoPublicacao =
  | { ok: true; idExterno: string; urlExterna?: string }
  | { ok: false; classe: ClasseErroCanal; detalhe: string };

/**
 * A assinatura do agente no conteúdo público. Atribuição é obrigatória na Opção A: a conta é da
 * Zaeon, mas o leitor tem direito de saber qual voz está falando — e isso também nos mantém do lado
 * certo das regras de automação das plataformas.
 */
export function assinaturaDe(a: { nome: string; area?: string | null }): string {
  const nome = a.nome.trim();
  const area = a.area?.trim();
  return area ? `— ${nome}, ${area} · Zaeon` : `— ${nome} · Zaeon`;
}

/** Junta texto + assinatura respeitando o limite da rede (corta o TEXTO, nunca a assinatura). */
export function comAssinatura(texto: string, assinatura: string, rede: Rede): string {
  const limite = LIMITE_TEXTO[rede];
  const sufixo = `\n\n${assinatura}`;
  const espaco = limite - sufixo.length;
  if (espaco <= 0) return assinatura.slice(0, limite);        // rede apertada demais: a atribuição vence
  const corpo = texto.trim();
  return (corpo.length <= espaco ? corpo : `${corpo.slice(0, Math.max(0, espaco - 1)).trimEnd()}…`) + sufixo;
}

// ───────────────────────────── o adapter ─────────────────────────────

/** Contexto que o adapter recebe. O SEGREDO nunca vem no objeto: vem o NOME da env (padrão Connector.authRef). */
export type CtxCanal = {
  rede: Rede;
  /** Nome da env/secret com o token — o adapter resolve na hora de chamar. Nunca o valor em si. */
  tokenRef: string | null;
  contaExterna: string | null;
  /** Injetável pra testar sem rede. */
  fetchImpl?: typeof fetch;
};

/**
 * O que um canal implementa. Os métodos são OPCIONAIS de propósito: a rede só expõe o que sabe
 * fazer, e `capacidades` tem que bater com `CAPACIDADES_DA_REDE[rede]` (checado em teste).
 */
export interface ChannelAdapter {
  rede: Rede;
  capacidades: readonly Capacidade[];
  publicar?(p: Publicacao, ctx: CtxCanal): Promise<ResultadoPublicacao>;
  responder?(p: Publicacao & { idPai: string }, ctx: CtxCanal): Promise<ResultadoPublicacao>;
  dm?(p: Publicacao & { destino: string }, ctx: CtxCanal): Promise<ResultadoPublicacao>;
  /** Round-trip real e barato (ex.: /me) pro botão "Testar conexão" do admin. */
  testar(ctx: CtxCanal): Promise<{ ok: boolean; detalhe?: string }>;
}

/** O adapter faz jus ao que promete? Usado no registro (F3+) e no teste do contrato. */
export function adapterCoerente(a: ChannelAdapter): boolean {
  const esperado = CAPACIDADES_DA_REDE[a.rede];
  if (a.capacidades.length !== esperado.length || !a.capacidades.every((c) => esperado.includes(c))) return false;
  if (a.capacidades.includes("publicar") && !a.publicar) return false;
  if (a.capacidades.includes("responder") && !a.responder) return false;
  if (a.capacidades.includes("dm") && !a.dm) return false;
  return true;
}
