/**
 * lib/agent/progresso.ts — o canal de progresso do harness. Módulo PURO (sem React, sem
 * rede), do mesmo lado do fio que `structured-client.ts`.
 *
 * POR QUE ISTO EXISTE. Um turno `elaborated` são três chamadas de modelo em sequência
 * (plan → reason → draft), cinco se o crítico mandar revisar. O `trajectory.ts` já narra
 * cada fase por `emit`, e o `buildHarnessDeps` já aceita o gancho `onStep` — mas o route
 * nunca o passava, então todo evento morria num `?.()` e o aluno olhava pra tela parada
 * por até um minuto. Este módulo é o fio que faltava entre os dois.
 *
 * O FORMATO. `@@PROGRESS@@{json}\n`. O `\n` é o que torna o evento auto-delimitado: sem
 * ele, um evento partido entre dois chunks do stream não teria como ser reconhecido, e
 * meia-sentinela apareceria como texto na tela.
 */
export const PROGRESS_SENTINEL = "@@PROGRESS@@";

/** O que a fase informa: o nome interno (para o código) e o rótulo humano (para a tela). */
export type Progresso = { fase: string; rotulo: string };

/**
 * Evento ESPECIAL no mesmo canal: quem respondeu de verdade (o modelo que o servidor usou, inclusive um
 * fallback). Não é fase — `faseCorrente` o ignora; o chat lê com `modeloDoTurno` e mostra no selo da resposta.
 */
export const FASE_MODELO = "modelo";

/**
 * As sentinelas que encerram o progresso. Depois de qualquer uma delas vem o payload
 * final, e lá dentro `@@PROGRESS@@` é CONTEÚDO, não protocolo — o aluno pode ter escrito
 * isso na pergunta, e a resposta pode citá-lo de volta.
 */
export const TERMINAIS = ["@@STRUCTURED@@", "@@STUDIO_ACTION@@", "@@RESEARCH_ACTION@@"] as const;

/**
 * Os nomes de fase que o `trajectory.ts` conhece, mais a preparação que acontece antes
 * dele. Existe porque o `detail` do AgentStep é AMBÍGUO: quase sempre é o nome da fase,
 * mas às vezes é um recado humano — "degradado: nenhuma evidência reunida". Sem esta
 * peneira, esse recado ia parar no campo `fase` e viraria dado sujo pra quem ler depois.
 * O recado não se perde: ele continua chegando, com o rótulo certo da fase.
 */
const FASES = new Set([
  "acordar", "memoria", "route", "plan", "gather", "reason", "draft", "critique", "finalize", FASE_MODELO,
]);

/** Lado servidor: um evento pronto pro fio. */
export function serializarProgresso(p: Progresso): string {
  const fase = FASES.has(p.fase) ? p.fase : "";
  return PROGRESS_SENTINEL + JSON.stringify({ fase, rotulo: p.rotulo }) + "\n";
}

function lerEvento(cru: string): Progresso | null {
  try {
    const o = JSON.parse(cru);
    const rotulo = typeof o?.rotulo === "string" ? o.rotulo.trim() : "";
    if (!rotulo) return null;
    return { fase: typeof o?.fase === "string" ? o.fase : "", rotulo };
  } catch {
    return null; // evento malformado não derruba o stream: só não vira fase na tela
  }
}

/**
 * Sentinela partida no fim do chunk ("@@PROG") não pode virar texto visível — na próxima
 * leitura ela se completa. Corta o maior prefixo próprio da sentinela que esteja no fim.
 *
 * Custo conhecido e aceito: um texto que termine em "@@" é segurado por um chunk. É
 * transitório e invisível; o contrário (meia-sentinela na tela) não seria.
 */
function semPrefixoParcial(s: string): string {
  const max = Math.min(s.length, PROGRESS_SENTINEL.length - 1);
  for (let n = max; n > 0; n--) {
    if (s.endsWith(PROGRESS_SENTINEL.slice(0, n))) return s.slice(0, s.length - n);
  }
  return s;
}

/**
 * Lado cliente: separa protocolo de conteúdo.
 *
 * Recebe o acumulado INTEIRO do stream e devolve o texto sem os eventos mais os eventos
 * lidos. É puro e idempotente sobre o acumulado — que é exatamente como os dois chats já
 * trabalham (rederivam tudo a cada chunk), então encaixa sem mudar o modelo deles.
 */
export function separarProgresso(
  acc: string,
  terminais: readonly string[] = TERMINAIS,
): { limpo: string; eventos: Progresso[] } {
  const marcas = terminais.map((t) => acc.indexOf(t)).filter((i) => i >= 0);
  const fim = marcas.length ? Math.min(...marcas) : acc.length;
  const cabeca = acc.slice(0, fim);
  const cauda = acc.slice(fim);
  const fechado = fim < acc.length; // achou terminal → a cabeça já chegou inteira

  const eventos: Progresso[] = [];
  let limpo = "";
  let i = 0;
  for (;;) {
    const j = cabeca.indexOf(PROGRESS_SENTINEL, i);
    if (j < 0) { limpo += cabeca.slice(i); break; }
    limpo += cabeca.slice(i, j);
    const quebra = cabeca.indexOf("\n", j);
    if (quebra < 0) break; // evento ainda chegando (ou truncado): segura, não vaza
    const ev = lerEvento(cabeca.slice(j + PROGRESS_SENTINEL.length, quebra));
    if (ev) eventos.push(ev);
    i = quebra + 1;
  }

  if (!fechado) limpo = semPrefixoParcial(limpo);
  return { limpo: limpo + cauda, eventos };
}

/** A fase corrente é a última que chegou (o evento de modelo não conta). Sem evento nenhum, não há fase. */
export function faseCorrente(eventos: readonly Progresso[]): Progresso | null {
  for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i].fase !== FASE_MODELO) return eventos[i];
  return null;
}

/** Lado servidor: "quem respondeu" pro fio (nome pra tela, já resolvido por lib/chat/modelos). */
export function serializarModelo(nome: string): string {
  return serializarProgresso({ fase: FASE_MODELO, rotulo: nome });
}

/** Lado cliente: o último "quem respondeu" que chegou, ou null. */
export function modeloDoTurno(eventos: readonly Progresso[]): string | null {
  for (let i = eventos.length - 1; i >= 0; i--) if (eventos[i].fase === FASE_MODELO) return eventos[i].rotulo;
  return null;
}
