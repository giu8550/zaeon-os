/**
 * BLUEPRINT PRÁTICO — a PROVA de um crítico (servidor). O crítico só fecha com um ARTEFATO que o servidor confere (o
 * cliente nunca marca "provado"):
 *  - repositório do GitHub: PÚBLICO, CRIADO depois que o estudo começou (com 30 dias de folga) e com push DEPOIS que o
 *    crítico foi aberto — colar um repositório famoso não passa (vincular a conta do GitHub da pessoa fica pra depois);
 *  - link/demo: responde, por fora da rede interna (lib/estudos/linkVivo);
 *  - a mesma URL não prova dois críticos.
 * Quando a fase inteira está provada, a Zaeon avalia (lib/blueprint/avaliar). Aprovada: a fase avança e a recomposição
 * traz os críticos da fase nova. Reprovada: a recomposição traz críticos NOVOS mirando o parecer (a fase nunca fica
 * presa). Se a chamada da Zaeon falhar, `pedirAvaliacao` tenta de novo (precisaAvaliar).
 */
import { urlSegura } from "@/lib/estudos/board";
import { AVALIAR_SYSTEM, lerAvaliacao, promptAvaliacao } from "./avaliar";
import { aplicarAvaliacao, precisaAvaliar, prontaPraAvaliar, registrarEntrega } from "./fases";
import { repoInfo } from "./github";
import { blueprintDoTurno, blueprintDoUsuario, gravarDoc, type BlueprintDb, type BlueprintView, type GenJson } from "./server";
import type { Avaliacao, Critico, DocBlueprint, Entrega } from "./tipos";

const dataCurta = (t: number) => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
export const FOLGA_REPO_MS = 30 * 24 * 3600 * 1000;
const norm = (u: string) => u.toLowerCase().replace(/[#?].*$/, "").replace(/\/+$/, "").replace(/\.git$/, "");
/** quando o estudo começou: o crítico mais antigo (nasceram na 1ª composição) */
export const inicioDoEstudo = (doc: DocBlueprint): number => Math.min(...doc.criticos.map((c) => c.abertoEm).filter((t) => t > 0), Number.MAX_SAFE_INTEGER);

export async function conferirProva(c: Critico, url: string, o: { vivo?: (u: string) => Promise<boolean>; repoInfo?: typeof repoInfo; agora?: number; inicioEstudo?: number; usadas?: string[] } = {}): Promise<{ ok: true; entrega: Entrega } | { ok: false; motivo: string }> {
  const u = urlSegura(url);
  if (!u) return { ok: false, motivo: "link inválido — use um endereço público https://" };
  if ((o.usadas ?? []).some((x) => norm(x) === norm(u))) return { ok: false, motivo: "esse link já provou outro crítico — cada crítico pede o seu artefato" };
  const agora = o.agora ?? Date.now();
  if (c.tipoProva === "repo") {
    const info = await (o.repoInfo ?? repoInfo)(u);
    if (!info) return { ok: false, motivo: "não achei esse repositório no GitHub (use github.com/<dono>/<repo>)" };
    if (!info.publico) return { ok: false, motivo: "o repositório precisa ser público pra Zaeon conferir" };
    if (o.inicioEstudo && o.inicioEstudo < Number.MAX_SAFE_INTEGER && info.criadoEm < o.inicioEstudo - FOLGA_REPO_MS) return { ok: false, motivo: "o repositório precisa ser seu e deste estudo (criado depois que o estudo começou)" };
    if (info.pushedAt <= c.abertoEm) return { ok: false, motivo: "o repositório precisa ter commits depois que o crítico foi aberto" };
    return { ok: true, entrega: { url: u, em: agora, detalhe: `repo público ${info.nome} · último push ${dataCurta(info.pushedAt)}` } };
  }
  const vivo = o.vivo ?? (await import("@/lib/estudos/linkVivo")).vivo;
  if (!(await vivo(u))) return { ok: false, motivo: "o link não respondeu — confira se está no ar e público" };
  return { ok: true, entrega: { url: u, em: agora, detalhe: c.tipoProva === "demo" ? "demo no ar" : "link no ar" } };
}

export type ResultadoProva = { ok: boolean; motivo?: string; view?: BlueprintView; avaliacao?: Avaliacao };
type Deps = { db?: BlueprintDb; gen?: GenJson; recompor?: typeof blueprintDoTurno; agora?: number };

const genPadrao = (userId: string): GenJson => async <T,>(system: string, user: string) => {
  const [{ geminiJson }, { GEMINI_MODEL_FLASH }] = await Promise.all([import("@/lib/scholar/gemini"), import("@/lib/ai/model")]);
  return geminiJson<T>(system, user, { temperature: 0.1, model: GEMINI_MODEL_FLASH, timeoutMs: 60_000, ctx: { agentKey: "zaeon", surface: "estudos", userId, phase: "blueprint-avaliacao" } });
};

/** a Zaeon avalia a fase atual SE ela precisa (todas provadas e sem veredito válido). Grava só se ainda estiver pronta */
async function avaliarSePrecisa(id: string, userId: string, view: BlueprintView, d: Deps): Promise<ResultadoProva> {
  if (!precisaAvaliar(view.doc)) return { ok: true, view };
  const fase = view.doc.fase, agora = d.agora ?? Date.now();
  const lida = lerAvaliacao(await (d.gen ?? genPadrao(userId))<unknown>(AVALIAR_SYSTEM, promptAvaliacao(view.doc, fase)).catch(() => null), fase, agora);
  if (!lida) return { ok: true, view, motivo: "a prova foi aceita; a avaliação da Zaeon falhou — peça a avaliação de novo em instantes" };
  // a Zaeon pode ter recomposto a fase durante a avaliação (críticos novos): aí o veredito não vale mais
  let gravou = false;
  const r = await gravarDoc(id, userId, (doc) => (doc.fase === fase && prontaPraAvaliar(doc) ? ((gravou = true), aplicarAvaliacao(doc, lida)) : doc), d.db);
  if (!r.ok) return { ok: true, view };
  if (!gravou) return { ok: true, view: r.view, motivo: "a fase ganhou críticos novos durante a avaliação — prove-os e a Zaeon avalia de novo" };
  const avaliacao = r.view.doc.avaliacoes[r.view.doc.avaliacoes.length - 1];
  // aprovada: os críticos da fase nova; reprovada: críticos novos mirando o parecer (fire-and-forget — o dono é quem conversa)
  if (avaliacao && r.view.scopeId && r.view.papel === "dono") {
    const prompt = avaliacao.aprovada
      ? `A fase ${fase} foi aprovada. Traga os críticos da fase ${r.view.doc.fase}.`
      : `A Zaeon REPROVOU a fase ${fase}: "${avaliacao.parecer}". Crie 1 ou 2 críticos NOVOS (ids novos) desta fase que corrijam exatamente isso.`;
    void (d.recompor ?? blueprintDoTurno)({ userId, scopeId: r.view.scopeId, sinal: null, forcar: true, history: [], prompt, answerTexto: "", db: d.db }).catch(() => null);
  }
  return { ok: true, view: r.view, avaliacao };
}

export async function provarEAvaliar(i: { id: string; userId: string; criticoId: string; url: string; conferir?: typeof conferirProva } & Deps): Promise<ResultadoProva> {
  const agora = i.agora ?? Date.now();
  const atual = await blueprintDoUsuario(i.id, i.userId, i.db);
  if (!atual) return { ok: false, motivo: "not_found" };
  const c = atual.doc.criticos.find((k) => k.id === i.criticoId);
  if (!c) return { ok: false, motivo: "esse crítico não existe mais — a Zaeon recompôs o blueprint" };
  if (c.status === "provado") return avaliarSePrecisa(i.id, i.userId, atual, { ...i, agora });
  if (c.fase !== atual.doc.fase) return { ok: false, motivo: `esse crítico é da fase ${c.fase}; primeiro feche a fase ${atual.doc.fase}` };
  const usadas = atual.doc.criticos.map((k) => k.entrega?.url).filter((u): u is string => !!u);
  const conf = await (i.conferir ?? conferirProva)(c, i.url, { agora, inicioEstudo: inicioDoEstudo(atual.doc), usadas });
  if (!conf.ok) return { ok: false, motivo: conf.motivo };
  const r = await gravarDoc(i.id, i.userId, (d) => registrarEntrega(d, c.id, conf.entrega), i.db);
  if (!r.ok) return { ok: false, motivo: r.motivo };
  // a conferência demora (GitHub/link): se a Zaeon recompôs no meio e o crítico sumiu ou mudou de fase, a prova não ficou
  if (r.view.doc.criticos.find((k) => k.id === c.id)?.status !== "provado") return { ok: false, view: r.view, motivo: "a Zaeon recompôs o blueprint enquanto conferíamos — confira o crítico e envie de novo" };
  return avaliarSePrecisa(i.id, i.userId, r.view, { ...i, agora });
}

/** "Zaeon, avalia": quando a fase está toda provada e a avaliação anterior falhou (ou houve prova nova depois da reprovação) */
export async function pedirAvaliacao(i: { id: string; userId: string } & Deps): Promise<ResultadoProva> {
  const atual = await blueprintDoUsuario(i.id, i.userId, i.db);
  if (!atual) return { ok: false, motivo: "not_found" };
  if (!precisaAvaliar(atual.doc)) return { ok: false, view: atual, motivo: "a fase ainda tem crítico aberto (ou já tem veredito)" };
  return avaliarSePrecisa(i.id, i.userId, atual, i);
}
