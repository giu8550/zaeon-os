/**
 * O TUTORIAL DENTRO DO TABLET (a 1ª missão do novato — docs/superpowers/specs/2026-10-11-tutorial-rpg-design.md): o
 * Droid guia, com DESTAQUE nos cards, SÓ o caminho de gerar a pesquisa (pedido do dono, out/2026: "não precisa mostrar a
 * sala de estudos toda a primeira vez"): a pessoa escolhe um tema na conversa nova (as 3 sugestões) → o tema vai pro
 * Marketplace › Estudos, na tela roxa, já pesquisando → gera a pesquisa sugerida → abre em Pesquisas (o Droid mostra o
 * chat de lá) → salva/exporta até o arquivo estar salvo. Aí o laboratório avisa o cyberespaço (lib/ui/loungeHub
 * MSG_PESQUISA_SALVA) e o Droid interrompe o tablet. O resto da sala (referências, bandeja, citações…) é o TOUR DA SALA
 * (lib/onboarding/tourSala), na 1ª vez que a pessoa abre o laboratório FORA do tutorial.
 *
 * Estado só no cliente (o laboratório do tablet, `?tutorial=1`); um store mínimo com assinatura (sem React aqui).
 */
export type IdEtapaLab = "tema" | "pesquisando" | "gerar" | "abrir" | "chat-pesquisa" | "salvar" | "fim";
export type EtapaLab = {
  id: IdEtapaLab;
  /** o que o Droid diz no balão ({tema} = o tema escolhido) */
  fala: string;
  /** onde fica o destaque (o 1º seletor que existir na tela) */
  alvos: string[];
  /** avança quando um destes eventos (window) chega; sem eventos = "Próximo" (só ver) */
  avancaEm: string[];
  /** o que o balão NÃO pode cobrir além do alvo (ex.: o modal de salvar inteiro) */
  evitar?: string[];
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
  { id: "gerar", alvos: ['[data-tour="gerar"]'], avancaEm: ["zaeon:research:draftdone"],
    fala: "A pesquisa chegou! Agora o passo que importa: gere a pesquisa sugerida a partir desses artigos." },
  { id: "abrir", alvos: ['[data-tour="iniciar-pesquisa"]'], avancaEm: ["zaeon:research:newdoc"],
    fala: "Ficou pronta! Abra a pesquisa na aba Pesquisas." },
  // a SALA DE PESQUISA: o Droid apresenta o CHAT dela (a pasta "Conversa") — dá pra voltar depois e continuar
  { id: "chat-pesquisa", alvos: ['[data-tour="pasta-conversa"]', '[data-tour="pesquisa"]'], avancaEm: [],
    fala: "Esta é a Sala de Pesquisa. Na pasta Conversa, o chat te ajuda a aprofundar a pesquisa com a IA — volte aqui depois pra continuar essa pesquisa se quiser. Hoje você só deve entregar pra mim." },
  // o balão NÃO cobre o botão Salvar nem o modal (bug de out/2026: "fica bloqueando o caminho de salvarmos")
  { id: "salvar", alvos: ['[data-tour="save-research"]', '[data-tour="modal-salvar"]', '[data-tour="salvar-pesquisa"]'], evitar: ['[data-tour="modal-salvar"]'], avancaEm: [EVT_PESQUISA_SALVA],
    fala: "Agora clique em Salvar, preencha os dados e exporte em ABNT. A missão termina quando o arquivo estiver salvo de verdade." },
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
  "zaeon:research:done": "gerar",             // a pesquisa na tela roxa terminou
  "zaeon:research:draftdone": "abrir",        // a pesquisa sugerida foi gerada
  "zaeon:research:newdoc": "chat-pesquisa",   // abriu em Pesquisas (o Droid apresenta o chat de lá)
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

/** uma caixa na tela (px) */
export type Caixa = { x: number; y: number; w: number; h: number };
/** a caixa que cobre todas (null se nenhuma) */
export function uniaoDe(cs: (Caixa | null | undefined)[]): Caixa | null {
  const v = cs.filter((c): c is Caixa => !!c);
  if (!v.length) return null;
  const x = Math.min(...v.map((c) => c.x)), y = Math.min(...v.map((c) => c.y));
  return { x, y, w: Math.max(...v.map((c) => c.x + c.w)) - x, h: Math.max(...v.map((c) => c.y + c.h)) - y };
}
/** onde fica o BALÃO do Droid (canto superior esquerdo e largura, px) pra NÃO cobrir o que a pessoa precisa clicar:
 *  embaixo do destaque, em cima, à direita, à esquerda, no canto mais livre e, sem espaço (um modal no meio da tela),
 *  MAIS ESTREITO no vão do lado. Sem destaque, no pé da tela.
 *  `minW`: o mais estreito que ele pode ficar. #618: o cartão dos tours não encolhe (minW = a largura dele) — espremido
 *  num vão de ~300 px, o botão de seguir saía da tela; sem vão largo, ele fica num canto POR CIMA do destaque. */
export function posicaoDoBalao(evitar: Caixa | null, W: number, H: number, b: { w: number; h: number }, m = 16, minW = 250): { left: number; top: number; w: number } {
  const B = 12, MIN = Math.min(minW, b.w), lim = (v: number, a: number, z: number) => Math.max(a, Math.min(z, v));
  if (!evitar) return { left: lim((W - b.w) / 2, B, W - b.w - B), top: lim(H - b.h - 24, B, H - b.h - B), w: b.w };
  const sobre = (l: number, t: number, w: number, h: number) => {
    const ox = Math.min(l + w, evitar.x + evitar.w + m) - Math.max(l, evitar.x - m), oy = Math.min(t + h, evitar.y + evitar.h + m) - Math.max(t, evitar.y - m);
    return ox > 0 && oy > 0 ? ox * oy : 0;
  };
  const cabe = (l: number, t: number, w: number, h: number) => l >= B - 0.5 && t >= B - 0.5 && l + w <= W - B + 0.5 && t + h <= H - B + 0.5;
  const cx = lim(evitar.x + evitar.w / 2 - b.w / 2, B, W - b.w - B), cy = lim(evitar.y + evitar.h / 2 - b.h / 2, B, H - b.h - B);
  const opcoes: [number, number][] = [
    [cx, evitar.y + evitar.h + m], [cx, evitar.y - m - b.h], [evitar.x + evitar.w + m, cy], [evitar.x - m - b.w, cy],
    [B, B], [W - b.w - B, B], [B, H - b.h - B], [W - b.w - B, H - b.h - B],
  ];
  const cabem = opcoes.filter(([l, t]) => cabe(l, t, b.w, b.h));
  const livre = cabem.find(([l, t]) => sobre(l, t, b.w, b.h) === 0);
  if (livre) return { left: livre[0], top: livre[1], w: b.w };
  // o vão do lado do que não pode cobrir: o balão fica mais estreito (e mais alto) e cabe ali
  const vaos = [{ l: B, w: evitar.x - m - B }, { l: evitar.x + evitar.w + m, w: W - B - (evitar.x + evitar.w + m) }].sort((p, q) => q.w - p.w);
  const vao = vaos[0]!;
  if (vao.w >= MIN) { const w = Math.min(b.w, vao.w), h = Math.min(H - 2 * B, b.h * (b.w / w)); return { left: vao.l, top: lim(H / 2 - h / 2, B, H - h - B), w }; }
  const [l, t] = [...cabem].sort((p, q) => sobre(p[0], p[1], b.w, b.h) - sobre(q[0], q[1], b.w, b.h))[0] ?? [B, H - b.h - B];
  return { left: l, top: t, w: b.w };
}
