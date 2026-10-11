/**
 * O TUTORIAL DENTRO DO TABLET (a 1ª missão do novato — docs/superpowers/specs/2026-10-11-tutorial-rpg-design.md): o
 * Droid guia o tour clássico, com DESTAQUE nos cards. A pessoa escolhe um tema na conversa nova (as 3 sugestões) → o
 * tema vai pro Marketplace › Estudos, na tela roxa, já pesquisando → ela vê onde salvar as REFERÊNCIAS, os ESTUDOS
 * RELACIONADOS e a BANDEJA → gera a pesquisa sugerida → abre em Pesquisas → salva/exporta até o arquivo estar salvo.
 * Aí o laboratório avisa o cyberespaço (lib/ui/loungeHub MSG_PESQUISA_SALVA) e o Droid interrompe o tablet.
 *
 * Estado só no cliente (o laboratório do tablet, `?tutorial=1`); um store mínimo com assinatura (sem React aqui).
 */
export type IdEtapaLab = "tema" | "pesquisando" | "referencias" | "relacionados" | "bandeja" | "gerar" | "abrir" | "salvar" | "fim";
export type EtapaLab = {
  id: IdEtapaLab;
  /** o que o Droid diz no balão ({tema} = o tema escolhido) */
  fala: string;
  /** onde fica o destaque (o 1º seletor que existir na tela) */
  alvos: string[];
  /** avança quando um destes eventos (window) chega; sem eventos = "Próximo" (só ver) */
  avancaEm: string[];
};

/** eventos que o laboratório dispara (alguns já existiam pro tour antigo) */
export const EVT_TEMA = "zaeon:tutorial:tema";
export const EVT_PESQUISA_SALVA = "zaeon:pesquisa:salva";
export const EVT_OMEGA_RODAR = "zaeon:omega:rodar";
export const EVT_ESTUDOS_VISTA = "zaeon:estudos:vista";

export const ETAPAS_LAB: EtapaLab[] = [
  { id: "tema", alvos: ['[data-tour="sugestoes"]', '[data-tour="composer-estudos"]'], avancaEm: [EVT_TEMA],
    fala: "Escolha uma opção e escreva o tema. Eu estudaria sobre chocolate, morango, o vento, cachoeiras… escolhe coisas fáceis pra começar." },
  { id: "pesquisando", alvos: ['[data-tour="omega"]'], avancaEm: ["zaeon:research:done"],
    fala: "Aqui a gente pesquisa a fundo, com artigos de verdade sobre “{tema}”. Isso leva uns minutos — então guarde o tablet (Esc ou “Guardar tablet”) e continue no cyberespaço: a pesquisa segue rodando." },
  { id: "referencias", alvos: ['[data-tour="salvar-ref"]', '[data-tour="result-tabs"]'], avancaEm: [],
    fala: "Essas são as REFERÊNCIAS — os artigos que sustentam o seu tema. O botão “Salvar” guarda cada uma." },
  { id: "relacionados", alvos: ['[data-tour="relacionados"]'], avancaEm: [],
    fala: "E aqui ficam os ESTUDOS RELACIONADOS: outros caminhos pro mesmo assunto." },
  { id: "bandeja", alvos: ['[data-tour="bandeja"]'], avancaEm: [],
    fala: "Tudo o que você salva aparece nesta BANDEJA. É a sua mochila de fontes." },
  { id: "gerar", alvos: ['[data-tour="gerar"]'], avancaEm: ["zaeon:research:draftdone"],
    fala: "Fase final, obrigatória: gere a pesquisa sugerida a partir dessas fontes." },
  { id: "abrir", alvos: ['[data-tour="iniciar-pesquisa"]'], avancaEm: ["zaeon:research:newdoc"],
    fala: "Ficou pronta! Abra a pesquisa na aba Pesquisas." },
  { id: "salvar", alvos: ['[data-tour="save-research"]', '[data-tour="modal-salvar"]', '[data-tour="salvar-pesquisa"]'], avancaEm: [EVT_PESQUISA_SALVA],
    fala: "Agora salve ou exporte a sua pesquisa. Só termina quando o arquivo estiver salvo de verdade." },
  { id: "fim", alvos: [], avancaEm: [], fala: "" },
];

export type EstadoTutorialLab = { ativo: boolean; etapa: IdEtapaLab; tema: string };
let estado: EstadoTutorialLab = { ativo: false, etapa: "tema", tema: "" };
const ouvintes = new Set<() => void>();
const avisar = () => { for (const f of ouvintes) f(); };
export const lerTutorialLab = () => estado;
export function assinarTutorialLab(f: () => void): () => void { ouvintes.add(f); return () => ouvintes.delete(f); }
export function iniciarTutorialLab() { estado = { ativo: true, etapa: "tema", tema: "" }; avisar(); }
export function encerrarTutorialLab() { estado = { ...estado, ativo: false, etapa: "fim" }; avisar(); }
export const etapaDe = (id: IdEtapaLab) => ETAPAS_LAB.find((e) => e.id === id)!;
/** a próxima etapa (e o tema, quando a pessoa escolheu) */
export function avancarTutorialLab(o: { tema?: string } = {}) {
  if (!estado.ativo) return;
  const i = ETAPAS_LAB.findIndex((e) => e.id === estado.etapa), prox = ETAPAS_LAB[Math.min(ETAPAS_LAB.length - 1, i + 1)]!;
  estado = { ...estado, etapa: prox.id, tema: o.tema ?? estado.tema };
  avisar();
}
/** pula pra etapa `id` se ela está À FRENTE (nunca volta): a pessoa fez uma ação de uma etapa mais adiante — ex.: gerou
 *  a pesquisa enquanto o Droid ainda mostrava as referências (o botão "Gerar" já está na tela). Sem isso o tour ficava
 *  esperando uma ação que já tinha acontecido (bug de out/2026: "gerei a pesquisa mas não reconheceu") */
export function avancarAte(id: IdEtapaLab) {
  if (!estado.ativo) return;
  const i = ETAPAS_LAB.findIndex((e) => e.id === estado.etapa), j = ETAPAS_LAB.findIndex((e) => e.id === id);
  if (j > i) { estado = { ...estado, etapa: id }; avisar(); }
}
/** as AÇÕES que valem em qualquer etapa (depois do tema): o evento → a etapa que vem DEPOIS dela */
export const SALTOS_LAB: Record<string, IdEtapaLab> = {
  "zaeon:research:done": "referencias",       // a pesquisa na tela roxa terminou
  "zaeon:research:draftdone": "abrir",        // a pesquisa sugerida foi gerada
  "zaeon:research:newdoc": "salvar",          // abriu em Pesquisas
};
/** no tutorial, escolher o tema NÃO manda a mensagem pro chat: ela vira a pesquisa na tela roxa */
export const temaNoTutorial = () => estado.ativo && estado.etapa === "tema";

/** as 3 SUGESTÕES da conversa nova (vale pra todo mundo, não só no tutorial) */
export const SUGESTOES_CONVERSA = ["Quero estudar sobre: ", "Me ensina a ", "Faz isso aqui pra mim: "] as const;
/** o tema de uma mensagem (sem o começo da sugestão; sem pontuação nas pontas) */
export function temaDoTexto(t: string): string {
  let s = t.trim();
  for (const p of SUGESTOES_CONVERSA) { const q = p.trim().replace(/:$/, ""); if (s.toLowerCase().startsWith(q.toLowerCase())) { s = s.slice(q.length); break; } }
  return s.replace(/^[\s:,.–—-]+/, "").replace(/[\s.!?…]+$/, "").trim();
}
/** a fala com o tema no lugar */
export const falaDaEtapa = (e: EtapaLab, tema: string) => e.fala.replace("{tema}", tema || "o seu tema");
/** páginas de uma pesquisa (≈ 300 palavras por página ABNT; mínimo 1) — vira o livro do inventário */
export const PALAVRAS_POR_PAGINA = 300;
export const paginasDe = (palavras: number) => Math.max(1, Math.ceil(palavras / PALAVRAS_POR_PAGINA));
export const contarPalavras = (texto: string) => (texto.match(/[\p{L}\p{N}]+/gu) ?? []).length;
