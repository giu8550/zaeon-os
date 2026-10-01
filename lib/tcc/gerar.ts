/**
 * Geração do TCC a partir de um TÓPICO ("gerar pesquisa" / POST /api/tcc) — roda SOLTA, no padrão
 * do Studio (lib/studio/text-pipeline.ts): a rota cria o work como "gerando", dispara isto com
 * `void` e responde na hora; o cliente faz poll em GET /api/tcc/:id. No VPS (Node de processo
 * longo) a promise continua mesmo que o aluno troque de aba.
 *
 * Escreve SEÇÃO POR SEÇÃO (uma operação de cada vez, origem "estudos"): o poll vê o documento
 * crescer, e cada pedaço entra no histórico com a sua própria linha.
 */
import { geminiJson } from "@/lib/scholar/gemini";
import { ESBOCO_SYS, esbocoUser, type DraftJson } from "@/lib/research/esboco";
import { aplicarNoTcc, marcarStatus } from "@/lib/tcc/store";
import { chaveTitulo, type OpSecao, type Secao } from "@/lib/tcc/secoes";

type Gen = (sys: string, user: string) => Promise<DraftJson>;
const genPadrao: Gen = (sys, user) =>
  geminiJson<DraftJson>(sys, user, { temperature: 0.4, timeoutMs: Number(process.env.SCHOLAR_GEMINI_TIMEOUT_MS || 30000) });

/** Esboço → corpo por título de seção do esqueleto (sem inventar seções que o esqueleto não tem). */
export function corposDoEsboco(d: DraftJson): Record<string, string> {
  const intro = [
    d.introducao?.trim(),
    d.objetivos?.trim() ? `Objetivos\n\n${d.objetivos.trim()}` : "",
    d.justificativa?.trim() ? `Justificativa\n\n${d.justificativa.trim()}` : "",
    d.palavrasChave?.trim() ? `Palavras-chave: ${d.palavrasChave.trim()}` : "",
  ].filter(Boolean).join("\n\n");
  return {
    [chaveTitulo("INTRODUÇÃO")]: intro,
    [chaveTitulo("METODOLOGIA")]: d.metodologia?.trim() ?? "",
    [chaveTitulo("REFERÊNCIAS")]: d.referencias?.trim() ?? "",
  };
}

/** As operações que preenchem só seções VAZIAS (o aluno pode ter escrito algo no meio do caminho). */
export function opsDoEsboco(secoes: Secao[], d: DraftJson): OpSecao[] {
  const corpos = corposDoEsboco(d);
  return secoes
    .filter((s) => !s.corpo.trim() && corpos[chaveTitulo(s.titulo)]?.trim())
    .map((s) => ({ op: "substituir" as const, secaoId: s.id, corpo: corpos[chaveTitulo(s.titulo)] }));
}

export async function gerarTccEmBackground(workId: string, userId: string, topic: string, gen: Gen = genPadrao): Promise<void> {
  try {
    const d = await gen(ESBOCO_SYS, esbocoUser(topic));
    const titulo = d?.titulo?.trim() ? d.titulo.trim().slice(0, 200) : undefined;
    // Uma seção por vez: o poll do cliente vê o documento crescendo.
    let primeira = true;
    for (;;) {
      let feita = false;
      const r = await aplicarNoTcc(workId, userId, (t) => {
        const prox = opsDoEsboco(t.secoes, d)[0];
        feita = !!prox;
        return prox ? [prox] : [];
      }, "estudos", primeira && titulo ? { titulo } : undefined);
      primeira = false;
      if (!r.ok || !feita) break;
    }
    await marcarStatus(workId, userId, "pronto");
  } catch (e: any) {
    console.warn("[tcc] geração falhou:", e?.message ?? e);
    await marcarStatus(workId, userId, "erro").catch(() => {});
  }
}
