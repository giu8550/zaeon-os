/**
 * lib/aula-interativa/gerar.ts — o pipeline da AULA (Papermorph, Opção A: no nosso harness, com Gemini).
 *
 *   Papermorph:  PDF → plano do livro → storyboards → narração → animação e quizzes → web book
 *   Aqui:        tema/PDF → PLANO (beats, uma ideia cada) → ROTEIRO (narração com [[marcas]],
 *                cena declarativa, perguntas) → normalizarAula (+1 reparo pelo modelo) →
 *                NARRAÇÃO (Gemini-TTS por beat) → tempos (marcas/legendas) → Aula pronta pro player.
 *
 * Duas chamadas ao modelo (plano e roteiro) em vez de uma: o Papermorph insiste em storyboard
 * ANTES do código, e a diferença aparece — a aula sai com progressão em vez de um texto fatiado.
 * `deps` injeta modelo, TTS e gravação (testes sem rede; produção usa Vertex + .studio).
 */
import { normalizarAula, separarMarcas, type Aula, type TempoBeat } from "@/lib/aula-interativa/contrato";
import { temposDoBeat } from "@/lib/aula-interativa/tempo";

export type PdfAnexo = { base64: string; nome?: string };
export type GerarJsonAula = (system: string, user: string, o?: { temperature?: number; timeoutMs?: number; pdf?: PdfAnexo }) => Promise<any>;
export type Narracao = { audio: Buffer; ext: "mp3" | "wav"; duracao: number };
export type Sintetizar = (texto: string) => Promise<Narracao | null>;
export type GravarAudio = (beatId: string, n: Narracao) => Promise<string>;

export type AulaGerada =
  | { ok: true; aula: Aula; tempos: Record<string, TempoBeat>; semAudio: boolean; problemas: string[] }
  | { ok: false; motivo: string };

// ───────────────────────────── prompts (o método do Papermorph, em PT) ─────────────────────────────

const PRINCIPIOS = [
  "Princípios (do Papermorph, que valeram por um livro inteiro):",
  "- A IMAGEM EXPLICA PELA MUDANÇA: montar, separar, comparar, seguir, contar. A animação é o argumento, não decoração.",
  "- Abra no assunto: quando a cena muda, o tema aparece logo; os rótulos vêm junto das palavras.",
  "- Uma coisa nova por vez. Mesma cor = mesmo significado na aula inteira.",
  "- Seja exato. Aproximação se escreve como aproximação (≈). Não invente número, nome ou fato.",
  "- Ensine o escopo pedido; o que ainda não foi ensinado fica de fora (ou é dito que fica).",
  "- Mostre o ERRO COMUM onde houver um (riscado na tela), e depois o jeito certo.",
].join("\n");

export const SISTEMA_PLANO = [
  "Você planeja uma AULA INTERATIVA curta (5–9 minutos) de um tema, para um aluno brasileiro. Responda SOMENTE JSON.",
  PRINCIPIOS,
  "Formato:",
  '{"titulo":"…","area":"Biologia|Física|…","publico":"…","objetivos":["…"],',
  ' "roteiro":[{"tipo":"intro|licao|checagem|resumo|pratica","titulo":"…","ideia":"o que o aluno vê mudar e por quê","layout":"titulo|passos|comparar|fluxo|formula|destaque|resumo"}]}',
  "Forma obrigatória: intro → 3 a 6 lições (UMA ideia cada) com 1–2 checagens ENTRE elas (só do que já foi ensinado) → resumo (3–4 pontos) → 1–2 práticas finais cobrindo a aula toda.",
  "Escolha o layout pela forma da ideia: passos (processo/receita), comparar (duas coisas lado a lado), fluxo (etapas que se seguem; ciclo se volta ao início), formula (derivação/cálculo, com o erro comum), destaque (um conceito-chave e sua definição).",
].join("\n");

export const SISTEMA_ROTEIRO = [
  "Você escreve o ROTEIRO de uma aula interativa a partir do plano. Responda SOMENTE JSON.",
  PRINCIPIOS,
  "",
  "NARRAÇÃO (`narracao`, PT-BR, vai virar voz):",
  "- Escreva para o OUVIDO: frases curtas, uma ideia cada; caloroso, nunca infantil; explique o porquê, não só o como.",
  "- Diga a matemática em palavras ('x ao quadrado', 'menos sete meios') — a tela mostra os símbolos.",
  "- Coloque [[marca]] logo ANTES da palavra que faz algo aparecer na tela. Ex.: 'A luz chega. [[clorofila]]A clorofila a absorve.' Nomes únicos no beat, só letras/números.",
  "- Lição: 2 a 5 frases. Checagem/prática: UMA frase curta ('Checagem rápida: qual etapa vem antes?') — a pergunta fica no cartão.",
  "",
  "CENA (`cena`) — o que se vê; cada item com `marca` entra quando a narração a diz:",
  '- {"layout":"titulo","kicker":"Aula · Área","titulo":"…","subtitulo":"…","marcaSubtitulo":"sub"}  (só na intro)',
  '- {"layout":"passos","titulo":"…","itens":[{"texto":"…","marca":"m1","cor":"azul"}],"destaque":{"indice":1,"marca":"m3"}}',
  '- {"layout":"comparar","titulo":"…","esquerda":{"titulo":"…","itens":[…]},"direita":{"titulo":"…","itens":[…]}}',
  '- {"layout":"fluxo","titulo":"…","ciclo":false,"nos":[{"texto":"Etapa","marca":"m1","nota":"detalhe curto"}]}  (2–6 nós)',
  '- {"layout":"formula","titulo":"…","linhas":[{"texto":"explicação curta","latex":"6CO_2 + 6H_2O \\\\to C_6H_{12}O_6 + 6O_2","marca":"m1"}],"erro":{"texto":"o erro comum","latex":"…","porque":"por que está errado","marca":"m2"}}',
  '- {"layout":"destaque","termo":"…","definicao":"…","marcaDefinicao":"def","fatos":[{"texto":"…","marca":"f1"}]}',
  '- {"layout":"resumo","itens":[{"texto":"ponto 1","marca":"r1"}]}  (só no beat resumo, 3–4 itens)',
  "Cores com significado (use com coerência): giz (neutro), tarefa (foco/pergunta), certo, errado, azul, verde, roxo, laranja. Textos curtos — a explicação está na voz.",
  "",
  "PERGUNTA (`pergunta`, obrigatória em checagem e prática) — prefira a que faz o aluno PENSAR na ideia:",
  '- {"tipo":"escolha","enunciado":"…","opcoes":["…","…","…"],"correta":0,"porque":"por que está certa","porqueErrado":[null,"o equívoco desta","o equívoco desta"]}',
  '- {"tipo":"vf","enunciado":"Verdadeiro ou falso?","afirmacoes":[{"texto":"…","verdadeira":true,"porque":"…"}]}',
  '- {"tipo":"lacuna","enunciado":"…","antes":"texto antes da lacuna","depois":"texto depois","aceitas":["resposta","sinônimo"],"porque":"…","dica":"pista para quem errou"}',
  "Toda pergunta verificada: a resposta tem que estar CERTA e ter sido ensinada antes.",
  "",
  'Formato final: {"titulo":"…","area":"…","publico":"…","objetivos":["…"],"beats":[{"id":"intro","tipo":"intro","titulo":"…","narracao":"…","cena":{…}},{"id":"luz","tipo":"licao",…},{"id":"q1","tipo":"checagem",…,"pergunta":{…}},…,{"id":"resumo","tipo":"resumo",…},{"id":"p1","tipo":"pratica",…,"pergunta":{…}}]}',
  "Não inclua o beat de placar final — o player monta sozinho.",
].join("\n");

function entrada(o: { tema: string; contexto?: string; sala?: string; pdf?: PdfAnexo }): string {
  return [
    `Tema da aula: ${o.tema}`,
    o.pdf ? `Base: o PDF anexado${o.pdf.nome ? ` ("${o.pdf.nome}")` : ""}. Ensine a partir DELE (recrie explicações e exemplos com suas palavras; não copie trechos longos).` : "",
    o.contexto ? `Contexto da conversa (o que o aluno já leu):\n${o.contexto.slice(0, 3000)}` : "",
    o.sala === "pesquisa" ? "Sala de Pesquisa: rigor acadêmico, termos técnicos corretos." : "Sala de Estudos: claro e objetivo.",
  ].filter(Boolean).join("\n\n");
}

// ───────────────────────────── padrões de produção ─────────────────────────────

/** Gemini (Vertex) com JSON forçado; aceita o PDF como `inlineData` (o Gemini lê PDF nativo). */
export const gerarJsonVertex: GerarJsonAula = async (system, user, o = {}) => {
  const { getGeminiModel, extractText } = await import("@/lib/scholar/gemini");
  const model = getGeminiModel(system, { temperature: o.temperature ?? 0.4 });
  const parts: any[] = [];
  if (o.pdf) parts.push({ inlineData: { mimeType: "application/pdf", data: o.pdf.base64 } });
  parts.push({ text: user });
  const ms = o.timeoutMs ?? 90_000;
  const res: any = await Promise.race([
    model.generateContent({ contents: [{ role: "user", parts }] }),
    new Promise((_, rej) => setTimeout(() => rej(new Error(`Gemini timeout (${ms}ms)`)), ms)),
  ]);
  const limpo = extractText(res).replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  if (!limpo) throw new Error("Gemini não devolveu o roteiro");
  return JSON.parse(limpo);
};

async function emParalelo<T, R>(itens: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(itens.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) { const k = i++; out[k] = await f(itens[k]); }
  }));
  return out;
}

// ───────────────────────────── o pipeline ─────────────────────────────

export async function gerarAula(
  o: { tema: string; contexto?: string; sala?: string; pdf?: PdfAnexo },
  deps: { gerarJson?: GerarJsonAula; sintetizar?: Sintetizar; gravarAudio?: GravarAudio; paralelo?: number } = {},
): Promise<AulaGerada> {
  const tema = (o.tema || "").trim();
  if (!tema && !o.pdf) return { ok: false, motivo: "Sem tema nem PDF pra aula." };
  const gerarJson = deps.gerarJson ?? gerarJsonVertex;
  const base = entrada({ ...o, tema: tema || o.pdf?.nome || "o conteúdo do PDF" });

  // 1) plano (storyboard antes do roteiro)
  let plano: any;
  try {
    plano = await gerarJson(SISTEMA_PLANO, base, { temperature: 0.4, pdf: o.pdf, timeoutMs: 60_000 });
  } catch (e: any) {
    return { ok: false, motivo: `Não consegui planejar a aula: ${String(e?.message || e).slice(0, 160)}` };
  }

  // 2) roteiro completo a partir do plano
  const pedirRoteiro = (extra = "") => gerarJson(
    SISTEMA_ROTEIRO,
    `${base}\n\nPLANO aprovado:\n${JSON.stringify(plano).slice(0, 6000)}${extra}`,
    { temperature: 0.5, pdf: o.pdf, timeoutMs: 120_000 },
  );
  let bruto: any;
  try { bruto = await pedirRoteiro(); } catch (e: any) {
    return { ok: false, motivo: `Não consegui escrever o roteiro: ${String(e?.message || e).slice(0, 160)}` };
  }
  let { aula, problemas } = normalizarAula(bruto, plano?.titulo || tema);

  // 3) um reparo pelo modelo se faltou ESTRUTURA (o mecânico o normalizador já consertou)
  if (problemas.length) {
    try {
      const corrigido = await pedirRoteiro(`\n\nSeu roteiro anterior tinha estes problemas — corrija e devolva o roteiro INTEIRO:\n- ${problemas.join("\n- ")}\n\nRoteiro anterior:\n${JSON.stringify(bruto).slice(0, 9000)}`);
      const r2 = normalizarAula(corrigido, plano?.titulo || tema);
      if (r2.problemas.length <= problemas.length) ({ aula, problemas } = r2);
    } catch { /* fica com o que tinha */ }
  }
  if (aula.beats.filter((b) => b.tipo === "licao" && b.cena).length < 2) {
    return { ok: false, motivo: `Roteiro insuficiente: ${problemas.join("; ")}` };
  }

  // 4) narração por beat (Gemini-TTS); beat sem áudio toca no relógio estimado, com legenda
  const tempos: Record<string, TempoBeat> = {};
  let comAudio = 0;
  await emParalelo(aula.beats, deps.paralelo ?? 3, async (b) => {
    const { limpa } = separarMarcas(b.narracao);
    let n: Narracao | null = null;
    if (limpa && deps.sintetizar) n = await deps.sintetizar(limpa).catch(() => null);
    let ref: string | undefined;
    if (n && deps.gravarAudio) ref = await deps.gravarAudio(b.id, n).catch(() => undefined);
    if (ref) comAudio++;
    tempos[b.id] = temposDoBeat(b.narracao, ref ? n!.duracao : undefined, ref);
  });

  return { ok: true, aula, tempos, semAudio: comAudio === 0, problemas };
}
