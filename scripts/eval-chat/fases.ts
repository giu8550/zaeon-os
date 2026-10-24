/**
 * scripts/eval-chat/fases.ts — o BENCHMARK POR FASE do chat da Aura, medido onde importa (prod):
 *   docker exec -w /app zaeon_web npx tsx scripts/eval-chat/fases.ts
 * embedding · cache (SQL) · índice/voto do roteador kNN · classify por modelo · coleta (busca acadêmica e web) ·
 * rascunho em stream (1ª palavra e total, pensar low × minimal). Não grava nada: ledger desligado (registrar no-op),
 * cache consultado num escopo de teste vazio. Leva ~3 min (o índice kNN monta em lotes pausados pela cota do embedding).
 */
const ms = (t: number) => Math.round(performance.now() - t);
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const dormir = (n: number) => new Promise((r) => setTimeout(r, n));
async function main() {
  const env = await import("@/lib/llm/envelope");
  const { embedVertex } = await import("@/lib/rag/embed");
  const { ragPg } = await import("@/lib/rag/pg");
  const c = await import("@/lib/rag/cacheRespostas");
  const k = await import("@/lib/agent/roteadorKnn");
  const deps = { registrar: (async () => undefined) as any };
  const ctx = { agentKey: "bench", surface: "estudos" as const, phase: "bench" };
  const R: Record<string, unknown> = {};
  const Q = ["o que é mitose?", "oi, tudo bem?", "faz um mapa mental sobre a guerra fria", "quanto é 15% de 300?", "me passa fontes sobre burnout em professores", "explica a lei de ohm"];

  // 1) embedding da pergunta
  const te: number[] = []; const vets: number[][] = [];
  for (const q of Q) { const t = performance.now(); vets.push((await embedVertex([q], "pergunta"))[0]!); te.push(ms(t)); await dormir(1200); }
  R.embed_ms = { mediana: med(te), todos: te };

  // 2) cache: consulta SQL (escopo de teste vazio = o custo de um "não achei")
  const db = ragPg(); const tc: number[] = [];
  for (const v of vets) { const t = performance.now(); await c.consultarCache(db, { pergunta: "x", vetor: v, escopo: "teste|bench" }); tc.push(ms(t)); }
  R.cache_sql_ms = { mediana: med(tc), todos: tc };

  // 3) kNN: montar índice (1×/processo) + votar
  let t = performance.now(); const ind = await k.indiceKnn(embedVertex as any); R.knn_indice_ms = ms(t);
  R.knn = Q.map((q, i) => { const t0 = performance.now(); const v = k.votar(vets[i]!, ind); return { q, intent: v?.intent, c: +(v?.confianca ?? 0).toFixed(2), m: +(v?.margem ?? 0).toFixed(2), decide: k.confiante(v), voto_ms: +(performance.now() - t0).toFixed(2) }; });

  // 4) classificação por modelo (o que o kNN substitui), pensar minimal
  const tcl: number[] = [];
  for (const q of Q.slice(0, 4)) {
    t = performance.now();
    await env.gerarJsonRes({ system: "Classifique a intenção do aluno em uma de: conversa, duvida_rapida, explicar_conceito, gerar_artefato, criar_trabalho, pesquisar_fontes, revisar, buscar_livro. Responda JSON {\"intent\":\"...\"}.", user: q, json: true, pensar: "minimal", ctx }, deps);
    tcl.push(ms(t));
  }
  R.classify_llm_ms = { mediana: med(tcl), todos: tcl };

  // 4b) coleta: as ferramentas do gather (a mais lenta segura o turno inteiro)
  const rt = await import("@/lib/agent/runtime");
  for (const def of [rt.literatureSearchDef, rt.webSearchDef]) {
    const ts: number[] = [];
    for (const q of ["mitose", "lei de ohm", "burnout em professores"]) { t = performance.now(); await def.run({ query: q }, {} as any); ts.push(ms(t)); }
    R[`coleta_${def.name}_ms`] = { mediana: med(ts), todos: ts };
  }

  // 5) rascunho em stream: 1º token e total, low vs minimal
  for (const nivel of ["low", "minimal"] as const) {
    const ttft: number[] = [], tot: number[] = [];
    for (const q of ["o que é mitose?", "explica a lei de ohm", "por que o céu é azul?"]) {
      t = performance.now(); let primeiro = 0;
      await env.gerarJsonStreamRes({ system: "Você é a Aura, tutora. Responda em JSON {\"nucleo\":\"...\",\"desenvolvimento\":\"...\"} em PT-BR, ~150 palavras.", user: q, json: true, pensar: nivel, ctx }, () => { if (!primeiro) primeiro = ms(t); }, deps);
      ttft.push(primeiro); tot.push(ms(t));
    }
    R[`draft_${nivel}`] = { ttft_mediana: med(ttft), total_mediana: med(tot), ttft, tot };
  }
  console.log(JSON.stringify(R, null, 1)); process.exit(0);
}
main().catch((e) => { console.error("FALHOU:", String(e?.stack ?? e).slice(0, 600)); process.exit(1); });
