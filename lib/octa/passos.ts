/**
 * lib/octa/passos.ts — os eventos de um turno (GET /api/octa/turnos/[id]/eventos) viram PASSOS legíveis na janela
 * do agente, como no Claude Code: cada tool é uma linha ("Escolhendo o estilo", "Montando a página"…) que começa
 * rodando e termina ✓/✗, com os arquivos que gravou embaixo. PURO (roda no navegador) — e os textos fixos
 * (erros do turno, da publicação, pedido de aprovação) moram aqui também.
 */

export type TipoEvento = "pensando" | "tool" | "arquivo" | "resultado" | "aprovacao" | "fim" | "erro";
export type EventoTurno = { seq: number; tipo: TipoEvento; dados: Record<string, unknown> };
export type ArquivoPasso = { path: string; acao: "gravado" | "apagado" };

export type Passo =
  | { tipo: "pensando"; chave: string }
  | {
    tipo: "tool"; chave: string; tool: string; rotulo: string; path?: string;
    estado: "rodando" | "aguardando" | "ok" | "falhou"; resumo?: string; motivo?: string; arquivos: ArquivoPasso[];
  }
  | { tipo: "erro"; chave: string; texto: string };

type PassoTool = Extract<Passo, { tipo: "tool" }>;

const ROTULOS: Record<string, string> = {
  octa_design_escolher: "Escolhendo o estilo",
  octa_pagina_montar: "Montando a página",
  octa_escrever: "Escrevendo",
  octa_ler: "Lendo",
  octa_listar: "Listando os arquivos",
  octa_buscar: "Buscando no projeto",
  octa_arte: "Gerando a arte",
  octa_apagar: "Apagando",
  octa_publicar: "Publicando no GitHub",
};
export const rotuloDaTool = (tool: string) => ROTULOS[tool] ?? tool;

const MOTIVOS: Record<string, string> = {
  recusado_pelo_aluno: "você recusou",
  marca_no_conteudo: "usou o nome da marca do estilo — reescrevendo",
  tool_fora_do_fluxo: "ferramenta indisponível aqui",
  MODE_FORBIDS_MUTATION: "modo Revisar não edita",
  OUTSIDE_FILE_LOCK: "fora dos arquivos liberados",
  needs_approval: "precisa da sua aprovação",
  PATH_NOT_ALLOWED: "caminho inválido",
  MUTATION_WITHOUT_PATH: "escrita sem arquivo",
  not_found: "não encontrado",
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** Os passos do turno. `terminado` = não há mais o que esperar (sem indicador "pensando"). */
export function passosDoTurno(eventos: readonly EventoTurno[], terminado: boolean): Passo[] {
  const passos: Passo[] = [];
  const ultimaTool = (tool?: string, estados?: PassoTool["estado"][]): PassoTool | undefined => {
    for (let i = passos.length - 1; i >= 0; i--) {
      const p = passos[i];
      if (p.tipo !== "tool") continue;
      if ((!tool || p.tool === tool) && (!estados || estados.includes(p.estado))) return p;
    }
    return undefined;
  };
  const novaTool = (e: EventoTurno, tool: string, estado: PassoTool["estado"]): PassoTool => {
    const p: PassoTool = { tipo: "tool", chave: `t${e.seq}`, tool, rotulo: rotuloDaTool(tool), estado, arquivos: [] };
    const path = str(e.dados.path);
    if (path) p.path = path;
    passos.push(p);
    return p;
  };

  for (const e of eventos) {
    const tool = str(e.dados.tool) ?? "";
    if (e.tipo === "tool") {
      const esperando = ultimaTool(tool, ["aguardando"]);
      if (esperando) esperando.estado = "rodando"; // aprovado: o mesmo passo continua
      else novaTool(e, tool, "rodando");
    } else if (e.tipo === "aprovacao") {
      novaTool(e, tool, "aguardando");
    } else if (e.tipo === "resultado") {
      const p = ultimaTool(tool, ["rodando", "aguardando"]) ?? novaTool(e, tool, "rodando");
      const ok = e.dados.ok === true;
      p.estado = ok ? "ok" : "falhou";
      const resumo = str(e.dados.resumo);
      if (ok && resumo) p.resumo = resumo;
      const codigo = str(e.dados.codigo);
      if (!ok) p.motivo = codigo ? MOTIVOS[codigo] ?? codigo : "não deu certo";
    } else if (e.tipo === "arquivo") {
      const path = str(e.dados.path);
      if (!path) continue;
      const acao = e.dados.acao === "apagado" ? "apagado" : "gravado";
      const p = ultimaTool();
      if (p) p.arquivos.push({ path, acao });
    } else if (e.tipo === "erro") {
      passos.push({ tipo: "erro", chave: `e${e.seq}`, texto: textoErroTurno(str(e.dados.codigo) ?? "") });
    }
  }

  const ult = eventos[eventos.length - 1];
  if (!terminado && ult?.tipo === "pensando") passos.push({ tipo: "pensando", chave: `p${ult.seq}` });
  return passos;
}

/** O que o cartão de aprovação diz que o Octa quer fazer ("O Octa quer …"). */
export function pedidoDeAprovacao(tool: string, path?: string): string {
  if (tool === "octa_publicar") return "publicar o site no seu GitHub";
  if (tool === "octa_escrever") return path ? `escrever ${path}` : "escrever um arquivo";
  if (tool === "octa_apagar") return path ? `apagar ${path}` : "apagar um arquivo";
  if (tool === "octa_pagina_montar") return "montar a página (index.html e styles.css)";
  if (tool === "octa_design_escolher") return "gravar o estilo escolhido (DESIGN.md)";
  if (tool === "octa_arte") return path ? `gerar a arte ${path}` : "gerar uma arte";
  return `usar ${tool}`;
}

const ERROS_TURNO: Record<string, string> = {
  falha_modelo: "O modelo falhou neste pedido. Tente de novo.",
  budget: "O orçamento desta sessão acabou. Tente de novo daqui a pouco.",
  projeto_inexistente: "Este projeto não existe mais no servidor.",
  tempo_esgotado: "O pedido demorou demais e foi encerrado. Tente de novo.",
};
export const textoErroTurno = (codigo: string) => ERROS_TURNO[codigo] ?? "O Octa parou com um erro. Tente de novo.";

const ERROS_PUBLICAR: Record<string, string> = {
  github_reconectar: "Conecte (ou reconecte) seu GitHub para publicar.",
  aviso_publico_pendente: "Aceite o aviso de repositório público para publicar.",
  limite_publicacoes: "Você chegou ao limite de 10 publicações por hoje. Amanhã libera de novo.",
  limite_repos: "Você chegou ao limite de 3 repositórios novos por hoje. Amanhã libera de novo.",
  falha_github: "O GitHub não respondeu agora. Tente de novo em alguns minutos.",
  projeto_inexistente: "Este projeto não existe mais no servidor.",
  sem_arquivos_publicaveis: "Ainda não há página para publicar: peça ao Octa para montar a landing (index.html).",
};
export const textoErroPublicar = (codigo: string) => ERROS_PUBLICAR[codigo] ?? "Não deu pra publicar agora. Tente de novo.";
