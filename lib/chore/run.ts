/**
 * lib/chore/run.ts — runChore: plan-then-execute por construção (§3.B).
 *
 *   iniciar → fase LER (as tools de CATALOGO[tipo].ler, em ordem; args montados por CÓDIGO a partir
 *   da linha e do que já foi lido — nunca pelo modelo) → diff_check ANTES da 1ª LLM (igual ao cursor
 *   anterior = pular "sem_mudanca", zero LLM, mas conta a checagem) → fase AGIR (post_internal com
 *   `resultado` + `destino` DA LINHA) → concluir.
 *
 * Freio (§3.8): 90s no total, 30s por passo, ≤ llmMax (≤3) chamadas. Erro de LLM (pool esgotado,
 * rate limit…) sobe para `decidir()` (G4) — quem tem o job do BullMQ aplica (lib/queue/chores.ts).
 */
import { CATALOGO, origemDe } from "@/lib/chore/catalogo";
import { runChoreTool } from "@/lib/chore/permit";
import type { ChoreCtx, ChoreDeps, ChoreToolName, EstadoChore } from "@/lib/chore/tools";
import { cortarPalavras } from "@/lib/chore/tools";
import { concluir, cursorDe, diaDe, falhar, fonteHashDe, iniciar, listar, pular, type ChoreDb, type ChoreRow, type ResultadoChore } from "@/lib/chore/store";
import { decidir, type Decisao } from "@/lib/queue/reenfileirar";
import type { Leitura } from "@/lib/leitor/cliente";
import { PULSO_AGENTE_MS, type EstadoAgente } from "@/lib/canal/estadoAgente";

export const CHORE_TOTAL_MS = 90_000;
export const LINK_ROT_MAX = 20;

export type RunDeps = ChoreDeps & { db: ChoreDb };
export type RunResultado =
  | { status: "done"; resultado: ResultadoChore; chamadasLlm: number; ms: number }
  | { status: "skipped"; chamadasLlm: 0; ms: number }
  | { status: "failed"; motivo: string; chamadasLlm: number; ms: number }
  | { status: "decidir"; decisao: Decisao; erro: unknown; chamadasLlm: number; ms: number };

type Lido = {
  texto?: string; finalUrl?: string; lidoEm?: string; bytes?: number;
  diff?: { mudou: boolean; trechos: string[]; cursor: string };
  resumo?: string; campos?: Record<string, string | null>; classe?: string; confianca?: number | null;
  formatado?: string; traducao?: string; links?: { url: string; resultado: string }[];
};

const PULAR = Symbol("pular");

/** Status HTTP → rótulo do link_rot. */
function rotuloStatus(status: number): string {
  if (status >= 200 && status < 300) return `${status} ok`;
  if (status >= 300 && status < 400) return `${status} redireciona`;
  if (status >= 400 && status < 500) return `${status} quebrado`;
  return `${status} erro no servidor`;
}

/** Args de cada tool, por CÓDIGO (a sequência e as entradas não vêm do modelo nem do conteúdo). */
function argsPara(nome: ChoreToolName, row: ChoreRow, lido: Lido, cursorAnterior: string | null): unknown | typeof PULAR {
  const a = row.alvo ?? {};
  switch (nome) {
    case "fetch_url": {
      const url = row.tipo === "feed_novos" ? a.feedUrl ?? a.url : a.url;
      if (!url) return row.tipo === "extrair_campos" ? PULAR : { url: "" };
      return { url };
    }
    case "diff_check":
      return { anterior: cursorAnterior, atual: lido.texto ?? "" };
    case "summarize_short": {
      const foco = row.tipo === "checar_pagina" && lido.diff?.trechos.length ? `o que mudou: ${lido.diff.trechos.join(" | ").slice(0, 400)}` : row.tipo === "digest" ? "o que os agentes concluíram hoje" : undefined;
      return { texto: lido.texto ?? "", foco };
    }
    case "extract":
      return { texto: lido.texto ?? a.texto ?? "", campos: row.tipo === "feed_novos" ? ["titulos_novos", "datas"] : a.campos ?? [] };
    case "classify":
      return { texto: a.texto ?? "", classes: a.classes ?? [] };
    case "translate_short":
      return { texto: a.texto ?? "", de: a.de, para: a.para ?? "pt-BR" };
    case "format":
      if (row.tipo === "formatar_abnt") return { modo: "abnt", referencia: a.referencia ?? {} };
      if (row.tipo === "link_rot") return { modo: "lista", titulo: "Links do dossiê:", itens: (lido.links ?? []).map((l) => `${l.url} — ${l.resultado}`) };
      if (row.tipo === "extrair_campos") {
        const campos = Object.keys(lido.campos ?? {});
        return { modo: "schema", valor: lido.campos ?? {}, schema: { type: "object", required: campos, properties: Object.fromEntries(campos.map((k) => [k, { type: "string", maxLength: 300 }])) } };
      }
      return PULAR;
    default:
      return PULAR;
  }
}

function absorver(nome: ChoreToolName, dados: any, lido: Lido): void {
  switch (nome) {
    case "fetch_url": { const l = dados as Leitura; lido.texto = l.texto; lido.finalUrl = l.finalUrl; lido.lidoEm = l.lidoEm; lido.bytes = l.bytes; break; }
    case "diff_check": lido.diff = dados; break;
    case "summarize_short": lido.resumo = dados.texto; break;
    case "extract": lido.campos = dados.campos; break;
    case "classify": lido.classe = dados.classe; lido.confianca = dados.confianca; break;
    case "translate_short": lido.traducao = dados.texto; break;
    case "format": if (dados?.ok && typeof dados.saida === "string") lido.formatado = dados.saida; break;
  }
}

/** O texto que a fase agir posta — montado da LEITURA, por tipo. */
function textoDoResultado(row: ChoreRow, lido: Lido): string {
  switch (row.tipo) {
    case "checar_pagina": return lido.resumo ? `A página mudou. ${lido.resumo}` : "";
    case "resumir_link": case "digest": return lido.resumo ?? "";
    case "feed_novos": {
      const c = lido.campos ?? {};
      return [c.titulos_novos ? `Novidades: ${c.titulos_novos}` : null, c.datas ? `Datas: ${c.datas}` : null].filter(Boolean).join("\n");
    }
    case "extrair_campos": return Object.entries(lido.campos ?? {}).map(([k, v]) => `**${k}:** ${v ?? "não encontrado"}`).join("\n");
    case "classificar_anexo": return lido.classe ? `Classificação: **${lido.classe}**${lido.confianca != null ? ` (confiança ${Math.round(lido.confianca * 100)}%)` : ""}` : "";
    case "link_rot": case "formatar_abnt": return lido.formatado ?? "";
    case "traduzir_trecho": return lido.traducao ?? "";
  }
}

/** Material do digest: o que as chores do canal concluíram hoje (rota Vertex — lê o canal). */
async function materialDigest(db: ChoreDb, row: ChoreRow, agora: Date): Promise<string> {
  if (!row.canalId) return "";
  const feitas = await listar(db, { canalId: row.canalId, status: "done", desde: new Date(`${diaDe(agora)}T00:00:00.000Z`), take: 50 });
  return feitas.filter((c) => c.tipo !== "digest" && c.id !== row.id && c.resultado?.texto).map((c) => `- (${c.tipo}) ${cortarPalavras(String(c.resultado!.texto), 80)}`).join("\n");
}

/** Tools que chamam o modelo: enquanto rodam, o canal vê "redigindo" (antes delas, "pesquisando"). */
const TOOLS_LLM = new Set<ChoreToolName>(["summarize_short", "extract", "classify", "translate_short"]);

/**
 * Presença da chore no canal, igual ao turno do agente (#468): "pesquisando" lendo, "redigindo" no
 * modelo, pulso a cada PULSO_AGENTE_MS (a tela apaga quem fica sem aviso) e "ocioso" no fim — também
 * quando a chore falha ou é adiada. Best-effort: aviso que falha nunca derruba a chore.
 */
function presencaNoCanal(row: ChoreRow, deps: RunDeps) {
  const ligado = Boolean(row.canalId && deps.avisarEstado);
  let atual: EstadoAgente = "pesquisando";
  const avisar = (e: EstadoAgente) => {
    if (!ligado) return;
    void Promise.resolve(deps.avisarEstado!(row.canalId!, row.agentKey, e)).catch(() => undefined);
  };
  avisar(atual);
  const pulso = ligado ? setInterval(() => avisar(atual), PULSO_AGENTE_MS) : null;
  return {
    estado(e: EstadoAgente) { if (e !== atual) { atual = e; avisar(e); } },
    parar() { if (pulso) clearInterval(pulso); avisar("ocioso"); },
  };
}

export async function runChore(row: ChoreRow, deps: RunDeps, opts: { tentativa?: number } = {}): Promise<RunResultado> {
  const presenca = presencaNoCanal(row, deps);
  try { return await executarChore(row, deps, opts, presenca); }
  finally { presenca.parar(); }
}

async function executarChore(row: ChoreRow, deps: RunDeps, opts: { tentativa?: number }, presenca: ReturnType<typeof presencaNoCanal>): Promise<RunResultado> {
  const { db } = deps;
  const ini = deps.agora();
  const prazo = ini + CHORE_TOTAL_MS;
  const ms = () => deps.agora() - ini;
  const cat = CATALOGO[row.tipo];
  if (!cat) { await falhar(db, row.id, "tipo_desconhecido"); return { status: "failed", motivo: "tipo_desconhecido", chamadasLlm: 0, ms: 0 }; }

  // §8.10: só vai ao pool o que é web pelo CATÁLOGO **e** pela linha. Na dúvida, Vertex.
  const doCatalogo = origemDe(row.tipo, row.alvo ?? {});
  const origem = doCatalogo !== "web" ? doCatalogo : row.origemConteudo === "web" ? "web" : row.origemConteudo === "canal" ? "canal" : "anexo";
  const estado: EstadoChore = { llm: 0, llmMax: Math.min(3, cat.llmMax), enqueueFeito: false, postado: false, modelo: null, provedor: null, alvo: null, jsonValido: null };
  const ctx: ChoreCtx = {
    chore: { ...row, origemConteudo: origem }, fase: "ler", deps, estado, prazo, tentativa: opts.tentativa ?? 0,
    signal: AbortSignal.timeout(CHORE_TOTAL_MS),
  };
  const sair = async (motivo: string): Promise<RunResultado> => {
    await falhar(db, row.id, motivo, { ms: ms(), chamadasLlm: estado.llm });
    return { status: "failed", motivo, chamadasLlm: estado.llm, ms: ms() };
  };

  await iniciar(db, row.id);
  try {
    const cursorAnterior = cat.comCursor ? (await cursorDe(db, fonteHashDe(row.tipo, row.alvo)))?.ultimoCursor ?? null : null;
    const lido: Lido = {};
    if (row.tipo === "digest") {
      lido.texto = await materialDigest(db, row, new Date(deps.agora()));
      if (!lido.texto) { await pular(db, row, "sem_mudanca", { ms: ms() }); return { status: "skipped", chamadasLlm: 0, ms: ms() }; }
    }

    // ── fase LER ──
    for (const nome of cat.ler) {
      if (deps.agora() > prazo) return sair("tempo_esgotado");
      if (row.tipo === "link_rot" && nome === "fetch_url") {
        const urls = [...new Set((row.alvo.urls ?? []).filter((u) => typeof u === "string"))].slice(0, LINK_ROT_MAX);
        if (!urls.length) return sair("alvo_sem_urls");
        lido.links = [];
        for (const url of urls) {
          if (deps.agora() > prazo) break;
          const r = await runChoreTool("fetch_url", { url, maxBytes: 2_048, timeoutMs: 8_000 }, "ler", ctx);
          if (!r.ok && r.code === "leitor_offline") return sair("leitor_offline");
          lido.links.push({ url, resultado: r.ok ? rotuloStatus((r.dados as Leitura).status) : r.code === "leitor_dominio_fora_da_lista" ? "fora da lista do Leitor" : r.code === "tool_timeout" ? "não respondeu" : "não consegui abrir" });
        }
        continue;
      }
      const args = argsPara(nome, row, lido, cursorAnterior);
      if (args === PULAR) continue;
      if (TOOLS_LLM.has(nome)) presenca.estado("redigindo");
      const r = await runChoreTool(nome, args, "ler", ctx);
      if (!r.ok) {
        if (r.causa) throw r.causa;                    // erro de LLM → decidir (G4)
        return sair(r.code ?? "tool_error");
      }
      absorver(nome, r.dados, lido);
      // diff vazio = não fala e não gasta (o diff_check vem ANTES da 1ª LLM no catálogo)
      if (nome === "diff_check" && lido.diff && !lido.diff.mudou) {
        await pular(db, row, "sem_mudanca", { cursor: lido.diff.cursor, ms: ms(), chamadasLlm: estado.llm });
        return { status: "skipped", chamadasLlm: 0, ms: ms() };
      }
    }

    // ── fase AGIR (resultado + destino DA LINHA) ──
    ctx.fase = "agir";
    const fonteUrl = lido.finalUrl ?? null;
    const resultado: ResultadoChore = {
      texto: textoDoResultado(row, lido), fonteUrl, lidoEm: lido.lidoEm ?? null, bytes: lido.bytes ?? null,
      modelo: estado.modelo, provedor: estado.provedor, alvo: estado.alvo,
      ...(lido.campos ? { campos: lido.campos } : {}), ...(lido.classe ? { classe: lido.classe } : {}),
      ...(lido.diff ? { diff: { mudou: lido.diff.mudou, trechos: lido.diff.trechos } } : {}),
      ...(lido.links ? { itens: lido.links } : {}),
    };
    if (!resultado.texto) return sair("resultado_vazio");
    for (const nome of cat.agir) {
      const r = await runChoreTool(nome, { texto: resultado.texto, fonteUrl, lidoEm: lido.lidoEm ?? null }, "agir", ctx);
      if (!r.ok) return sair(r.code ?? "tool_error");
      const d = r.dados as { postado?: boolean; mensagemId?: string; silencioso?: boolean } | undefined;
      if (nome === "post_internal" && d) { resultado.postado = Boolean(d.postado); resultado.mensagemId = d.mensagemId ?? null; resultado.silencioso = Boolean(d.silencioso); }
    }
    await concluir(db, row, resultado, { cursor: lido.diff?.cursor ?? null, ms: ms(), chamadasLlm: estado.llm, comCursor: cat.comCursor });
    return { status: "done", resultado, chamadasLlm: estado.llm, ms: ms() };
  } catch (e) {
    return { status: "decidir", decisao: decidir(e, new Date(deps.agora()), row.expiraEm, opts.tentativa ?? 0), erro: e, chamadasLlm: estado.llm, ms: ms() };
  }
}
