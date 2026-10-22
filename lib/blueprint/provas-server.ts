/**
 * BLUEPRINT PRÁTICO — a PROVA de um crítico (servidor). O crítico só fecha com um ARTEFATO que o servidor confere (o
 * cliente nunca marca "provado"): repositório público do GitHub com push DEPOIS que o crítico foi aberto (sem isso,
 * colar um repositório famoso passaria), ou um link/demo que responde. Quando todos os críticos da fase estão provados,
 * a Zaeon avalia (lib/blueprint/avaliar); aprovada, a fase avança e a recomposição traz os críticos da fase nova.
 */
import { isSafePublicHttpUrl } from "@/lib/scholar/ssrf";
import { urlSegura } from "@/lib/estudos/board";
import { AVALIAR_SYSTEM, lerAvaliacao, promptAvaliacao } from "./avaliar";
import { aplicarAvaliacao, prontaPraAvaliar, registrarEntrega } from "./fases";
import { repoInfo } from "./github";
import { blueprintDoTurno, blueprintDoUsuario, gravarDoc, type BlueprintDb, type BlueprintView, type GenJson } from "./server";
import type { Avaliacao, Critico, Entrega } from "./tipos";

const dataCurta = (t: number) => new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export async function conferirProva(c: Critico, url: string, o: { vivo?: (u: string) => Promise<boolean>; repoInfo?: typeof repoInfo; agora?: number } = {}): Promise<{ ok: true; entrega: Entrega } | { ok: false; motivo: string }> {
  const u = urlSegura(url);
  if (!u || !isSafePublicHttpUrl(u)) return { ok: false, motivo: "link inválido — use um endereço público https://" };
  const agora = o.agora ?? Date.now();
  if (c.tipoProva === "repo") {
    const info = await (o.repoInfo ?? repoInfo)(u);
    if (!info) return { ok: false, motivo: "não achei esse repositório no GitHub (use github.com/<dono>/<repo>)" };
    if (!info.publico) return { ok: false, motivo: "o repositório precisa ser público pra Zaeon conferir" };
    if (info.pushedAt <= c.abertoEm) return { ok: false, motivo: "o repositório precisa ter commits depois que o crítico foi aberto" };
    return { ok: true, entrega: { url: u, em: agora, detalhe: `repo público ${info.nome} · último push ${dataCurta(info.pushedAt)}` } };
  }
  const vivo = o.vivo ?? (await import("@/lib/estudos/linkVivo")).vivo;
  if (!(await vivo(u))) return { ok: false, motivo: "o link não respondeu — confira se está no ar e público" };
  return { ok: true, entrega: { url: u, em: agora, detalhe: c.tipoProva === "demo" ? "demo no ar" : "link no ar" } };
}

export type ResultadoProva = { ok: boolean; motivo?: string; view?: BlueprintView; avaliacao?: Avaliacao };

export async function provarEAvaliar(i: {
  id: string; userId: string; criticoId: string; url: string; agora?: number;
  db?: BlueprintDb; gen?: GenJson; conferir?: typeof conferirProva; recompor?: typeof blueprintDoTurno;
}): Promise<ResultadoProva> {
  const agora = i.agora ?? Date.now();
  const atual = await blueprintDoUsuario(i.id, i.userId, i.db);
  if (!atual) return { ok: false, motivo: "not_found" };
  const c = atual.doc.criticos.find((k) => k.id === i.criticoId);
  if (!c) return { ok: false, motivo: "esse crítico não existe mais — a Zaeon recompôs o blueprint" };
  if (c.status === "provado") return { ok: true, view: atual };
  if (c.fase !== atual.doc.fase) return { ok: false, motivo: `esse crítico é da fase ${c.fase}; primeiro feche a fase ${atual.doc.fase}` };
  const conf = await (i.conferir ?? conferirProva)(c, i.url, { agora });
  if (!conf.ok) return { ok: false, motivo: conf.motivo };
  const r = await gravarDoc(i.id, i.userId, (d) => registrarEntrega(d, c.id, conf.entrega), i.db);
  if (!r.ok) return { ok: false, motivo: r.motivo };
  if (!prontaPraAvaliar(r.view.doc)) return { ok: true, view: r.view };
  // a fase inteira provada: a Zaeon avalia
  const fase = r.view.doc.fase;
  const gen = i.gen ?? (async <T,>(system: string, user: string) => {
    const [{ geminiJson }, { GEMINI_MODEL_FLASH }] = await Promise.all([import("@/lib/scholar/gemini"), import("@/lib/ai/model")]);
    return geminiJson<T>(system, user, { temperature: 0.1, model: GEMINI_MODEL_FLASH, timeoutMs: 60_000, ctx: { agentKey: "zaeon", surface: "estudos", userId: i.userId, phase: "blueprint-avaliacao" } });
  });
  const lida = lerAvaliacao(await gen<unknown>(AVALIAR_SYSTEM, promptAvaliacao(r.view.doc, fase)).catch(() => null), fase, agora);
  if (!lida) return { ok: true, view: r.view, motivo: "a prova foi aceita; a avaliação da Zaeon falhou — tente de novo em instantes" };
  const r2 = await gravarDoc(i.id, i.userId, (d) => aplicarAvaliacao(d, lida), i.db);
  if (!r2.ok) return { ok: true, view: r.view };
  const avaliacao = r2.view.doc.avaliacoes[r2.view.doc.avaliacoes.length - 1];
  // aprovada: a Zaeon já traz os críticos da fase nova (fire-and-forget — o dono do blueprint é quem conversa)
  if (avaliacao?.aprovada && r2.view.scopeId && r2.view.papel === "dono") {
    void (i.recompor ?? blueprintDoTurno)({ userId: i.userId, scopeId: r2.view.scopeId, sinal: null, forcar: true, history: [], prompt: `A fase ${fase} foi aprovada. Traga os críticos da fase ${r2.view.doc.fase}.`, answerTexto: "", db: i.db }).catch(() => null);
  }
  return { ok: true, view: r2.view, avaliacao };
}
