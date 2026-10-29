/**
 * lib/canais/painel.ts — o VIEW-MODEL do painel de canais do admin (F1). PURO.
 *
 * Mesma divisão de trabalho do PoolPainel: a lógica mora aqui e é testada; o `.tsx` é casca fina.
 * Nada de Prisma/fetch — a rota lê as linhas e passa; aqui a gente só deriva o que a tela mostra.
 *
 * A HONESTIDADE QUE ESTE ARQUIVO IMPÕE (Opção A): "matriz agentes × 4 redes" seria MENTIRA na tela.
 * Instagram/X/LinkedIn são UMA conta institucional — renderizar 23 células iguais faria o admin
 * pensar que cada agente tem conexão própria. Então o painel tem duas partes:
 *   • `contas`  — as 3 redes institucionais, UM estado cada (a verdade da Opção A);
 *   • `whatsapp` — a tabela POR AGENTE, que é o único canal realmente por agente (chip ChipFlow).
 * E `vozes` lista quem pode assinar um post — sem prometer conexão nenhuma.
 */
import {
  CAPACIDADES_DA_REDE, LIMITE_TEXTO, REDES_SOCIAIS, ehEstadoCanal, estadoPublica,
  type Capacidade, type EstadoCanal, type Rede,
} from "@/lib/canais/tipos";
import { TETO_DIA_PADRAO, diaBrt, restamHoje, type EstadoEnvio } from "@/lib/canais/politica";

/** Linha de `CanalSocial` como a rota entrega (só o que a tela usa). */
export type LinhaCanalSocial = {
  rede: string;
  estado?: string | null;
  capacidades?: string[] | null;
  tokenRef?: string | null;
  tokenExpiraEm?: Date | string | null;
  contaExterna?: string | null;
  limiteDia?: number | null;
  enviadosHoje?: number | null;
  diaContagem?: string | null;
  pausadoAte?: Date | string | null;
  autoPublicar?: boolean | null;
  ultimoEnvioEm?: Date | string | null;
  ultimoErro?: string | null;
};

/** Linha de `AgentChannel` (tipo "whatsapp") como a rota entrega. */
export type LinhaCanalAgente = {
  agentKey: string;
  tipo: string;
  estado?: string | null;
  numero?: string | null;
  limiteDia?: number | null;
  enviadosHoje?: number | null;
  diaContagem?: string | null;
  ultimoEnvioEm?: Date | string | null;
  ultimoErro?: string | null;
};

export type VozView = { agentKey: string; nome: string; tipo: string; area: string | null };

/** Severidade pra UI escolher cor e pra ordenação: o que precisa de gente primeiro. */
export type Severidade = "ok" | "atencao" | "parado";

export type ContaView = {
  rede: Rede;
  estado: EstadoCanal;
  severidade: Severidade;
  /** Capacidades DECLARADAS da rede (o que ela faz pela API). */
  capacidadesDaRede: readonly Capacidade[];
  /** Capacidades que ESTE canal tem hoje (⊆ acima). Vazio quando não conectado. */
  capacidadesAtivas: Capacidade[];
  /** Capacidade prometida que a rede não faz — erro de configuração, não de runtime. */
  capacidadesInvalidas: string[];
  limiteDia: number;
  usadoHoje: number;
  restamHoje: number;
  limiteTexto: number;
  autoPublicar: boolean;
  temCredencial: boolean;
  tokenRef: string | null;
  contaExterna: string | null;
  pausadoAte: string | null;
  ultimoEnvioEm: string | null;
  ultimoErro: string | null;
  /** Frase pronta pro admin: o que está acontecendo e o que fazer. */
  resumo: string;
};

export type WhatsAppView = {
  agentKey: string;
  nome: string;
  estado: string;
  severidade: Severidade;
  numero: string | null;
  limiteDia: number;
  usadoHoje: number;
  ultimoEnvioEm: string | null;
  ultimoErro: string | null;
};

export type PainelCanais = {
  /** A camada externa está ligada? (`CANAIS_EXTERNOS`) */
  externosLigados: boolean;
  /** Trava global de aprovação (`CANAIS_AUTO_PUBLICAR=0`) — vence o opt-in de cada canal. */
  aprovacaoForcada: boolean;
  contas: ContaView[];
  whatsapp: WhatsAppView[];
  vozes: VozView[];
  /** Quantas redes institucionais estão realmente publicando agora. */
  prontas: number;
};

const iso = (v: Date | string | null | undefined): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const estadoDe = (v: unknown): EstadoCanal => (ehEstadoCanal(v) ? v : "nao_conectado");

/** Severidade pelo estado: só `conectado` é ok; o que exige humano é "parado". */
export function severidadeDoEstado(e: EstadoCanal | string): Severidade {
  if (e === "conectado" || e === "vinculado") return "ok";          // "vinculado" = vocabulário do AgentChannel
  if (e === "erro" || e === "precisa_autorizar" || e === "restrito") return "parado";
  return "atencao";                                                  // nao_conectado | conectando | pausado | pausado_na_origem
}

/** A frase que o admin lê. Fala do que FAZER, não do que é. */
export function resumoDaConta(c: Omit<ContaView, "resumo">): string {
  if (c.capacidadesInvalidas.length) return `configuração inválida: ${c.rede} não faz ${c.capacidadesInvalidas.join(", ")} pela API`;
  switch (c.estado) {
    case "nao_conectado": return c.temCredencial ? "credencial registrada, falta autorizar a conta" : "sem credencial — registre o secret e autorize";
    case "conectando": return "autorização em andamento";
    case "precisa_autorizar": return "token expirado ou revogado — reautorize";
    case "restrito": return "a plataforma restringiu a conta — verifique lá";
    case "pausado": return "pausado no kill-switch (o conteúdo continua sendo enfileirado)";
    case "erro": return c.ultimoErro ? `erro: ${c.ultimoErro}` : "erro no último envio";
    case "conectado":
      if (c.restamHoje <= 0) return `teto de ${c.limiteDia}/dia atingido — volta amanhã`;
      return c.autoPublicar
        ? `publicando automaticamente · ${c.restamHoje} de ${c.limiteDia} restantes hoje`
        : `pronto · ${c.restamHoje} de ${c.limiteDia} restantes hoje · aguarda aprovação humana`;
  }
}

/** Monta a view de uma rede institucional. `linha` ausente = a rede nunca foi configurada. */
export function contaView(rede: Rede, linha: LinhaCanalSocial | undefined, agora: Date): ContaView {
  const estado = estadoDe(linha?.estado);
  const daRede = CAPACIDADES_DA_REDE[rede];
  const declaradas = linha?.capacidades ?? [];
  const capacidadesAtivas = estadoPublica(estado)
    ? (declaradas.filter((c) => (daRede as readonly string[]).includes(c)) as Capacidade[])
    : [];
  const limiteDia = linha?.limiteDia ?? TETO_DIA_PADRAO[rede];
  const envio: EstadoEnvio = {
    rede, estado, limiteDia,
    enviadosHoje: linha?.enviadosHoje ?? 0,
    diaContagem: linha?.diaContagem ?? null,
  };
  const restam = restamHoje(envio, agora);
  const base: Omit<ContaView, "resumo"> = {
    rede,
    estado,
    severidade: severidadeDoEstado(estado),
    capacidadesDaRede: daRede,
    capacidadesAtivas,
    capacidadesInvalidas: declaradas.filter((c) => !(daRede as readonly string[]).includes(c)),
    limiteDia,
    usadoHoje: Math.max(0, limiteDia - restam),
    restamHoje: restam,
    limiteTexto: LIMITE_TEXTO[rede],
    autoPublicar: !!linha?.autoPublicar,
    temCredencial: !!linha?.tokenRef?.trim(),
    tokenRef: linha?.tokenRef?.trim() || null,
    contaExterna: linha?.contaExterna?.trim() || null,
    pausadoAte: iso(linha?.pausadoAte),
    ultimoEnvioEm: iso(linha?.ultimoEnvioEm),
    ultimoErro: linha?.ultimoErro?.trim() || null,
  };
  return { ...base, resumo: resumoDaConta(base) };
}

/** Ordem na tela: o que precisa de gente primeiro (parado → atenção → ok), depois alfabética. */
const PESO: Record<Severidade, number> = { parado: 0, atencao: 1, ok: 2 };

export function montarPainel(input: {
  sociais: LinhaCanalSocial[];
  agentes: LinhaCanalAgente[];
  vozes: VozView[];
  externosLigados: boolean;
  aprovacaoForcada: boolean;
  agora?: Date;
}): PainelCanais {
  const agora = input.agora ?? new Date();
  const porRede = new Map(input.sociais.map((l) => [String(l.rede), l]));
  const contas = REDES_SOCIAIS.map((r) => contaView(r, porRede.get(r), agora))
    .sort((a, b) => PESO[a.severidade] - PESO[b.severidade] || a.rede.localeCompare(b.rede));

  const nomeDe = new Map(input.vozes.map((v) => [v.agentKey, v.nome]));
  const whatsapp = input.agentes
    .filter((a) => a.tipo === "whatsapp")
    .map((a): WhatsAppView => {
      const limiteDia = a.limiteDia ?? TETO_DIA_PADRAO.whatsapp;
      // `diaContagem` é gravado em dia-BRT (convenção do AgentChannel): de ontem = a contagem zerou.
      const mesmoDia = !!a.diaContagem && a.diaContagem === diaBrt(agora);
      return {
        agentKey: a.agentKey,
        nome: nomeDe.get(a.agentKey) ?? a.agentKey,
        estado: a.estado ?? "nao_vinculado",
        severidade: severidadeDoEstado(a.estado ?? "nao_vinculado"),
        numero: a.numero?.trim() || null,
        limiteDia,
        usadoHoje: mesmoDia ? Math.max(0, a.enviadosHoje ?? 0) : 0,
        ultimoEnvioEm: iso(a.ultimoEnvioEm),
        ultimoErro: a.ultimoErro?.trim() || null,
      };
    })
    .sort((a, b) => PESO[a.severidade] - PESO[b.severidade] || a.nome.localeCompare(b.nome));

  return {
    externosLigados: input.externosLigados,
    aprovacaoForcada: input.aprovacaoForcada,
    contas,
    whatsapp,
    vozes: [...input.vozes].sort((a, b) => a.nome.localeCompare(b.nome)),
    prontas: contas.filter((c) => c.estado === "conectado" && c.restamHoje > 0).length,
  };
}
