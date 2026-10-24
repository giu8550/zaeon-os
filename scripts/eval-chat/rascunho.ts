/**
 * scripts/eval-chat/rascunho.ts — EVAL do caminho completo do chat (out/2026): mede VELOCIDADE e QUALIDADE de variantes
 * do raciocínio/rascunho com as MESMAS perguntas e a MESMA evidência real (busca web + acadêmica de verdade).
 *
 *   docker exec -w /app zaeon_web npx tsx scripts/eval-chat/rascunho.ts            # todas as variantes
 *   npx tsx --env-file=.env scripts/eval-chat/rascunho.ts                           # local (o tsx NÃO lê o .env sozinho)
 *   EVAL_N=4 docker exec … npx tsx scripts/eval-chat/rascunho.ts                    # só as 4 primeiras perguntas
 *
 * Não grava NADA: o ledger é desligado (registrar no-op) e nenhuma conversa/turno é criado.
 * Qualidade: juiz cego por PARES (variante × a atual, ordem sorteada), com pensar alto.
 */
import { buildHarnessDeps } from "@/lib/agent/aura-harness";
import { INTENTS } from "@/lib/agent/contracts";
import { literatureSearchDef, webSearchDef } from "@/lib/agent/runtime";

type Variante = { id: string; raciocinio: boolean; pensarDraft: "low" | "minimal" };
const VARIANTES: Variante[] = [
  { id: "atual (raciocínio + rascunho low)", raciocinio: true, pensarDraft: "low" },
  { id: "sem raciocínio + low", raciocinio: false, pensarDraft: "low" },
  { id: "raciocínio + minimal", raciocinio: true, pensarDraft: "minimal" },
  { id: "sem raciocínio + minimal", raciocinio: false, pensarDraft: "minimal" },
];
const PERGUNTAS = [
  "explique a fundo como funciona a fotossíntese e por que ela é essencial para a vida na Terra",
  "qual a diferença entre mitose e meiose e por que a meiose gera variabilidade genética?",
  "como a política monetária do Banco Central controla a inflação no Brasil?",
  "explique a teoria da relatividade restrita com exemplos do dia a dia",
  "por que os antibióticos não funcionam contra vírus e como surge a resistência bacteriana?",
  "como funciona uma rede neural e o que é backpropagation?",
  "explique o que foi o Iluminismo e qual sua influência na Revolução Francesa",
  "como as vacinas de mRNA ensinam o sistema imunológico a reconhecer um vírus?",
  "quais as causas e consequências do aquecimento global segundo a ciência atual?",
  "explique a lei de Ohm e como ela se aplica a um circuito em série e em paralelo",
  "o que é a mais-valia em Marx e como ela se relaciona com o lucro?",
  "como funciona a sinapse química entre dois neurônios?",
];

const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0; };

async function main() {
  const envelope = await import("@/lib/llm/envelope");
  const semLedger = { registrar: (async () => undefined) as any };
  const n = Number(process.env.EVAL_N) || PERGUNTAS.length;
  const perguntas = PERGUNTAS.slice(0, n);
  const tempos: Record<string, { ttft: number[]; total: number[] }> = Object.fromEntries(VARIANTES.map((v) => [v.id, { ttft: [], total: [] }]));
  const respostas: Record<string, string[]> = Object.fromEntries(VARIANTES.map((v) => [v.id, []]));
  let reservas = 0;   // respostas que vieram da reserva (HF), não do Vertex — sujam a comparação

  for (const [qi, objetivo] of perguntas.entries()) {
    // a MESMA evidência real pra todas as variantes
    const [lit, web] = await Promise.all([literatureSearchDef.run({ query: objetivo }, {} as any), webSearchDef.run({ query: objetivo }, {} as any)]);
    const evidence = [...(lit.ok ? lit.findings ?? [] : []), ...(web.ok ? web.findings ?? [] : [])];
    for (const v of VARIANTES) {
      process.env.PENSAR_DRAFT = v.pensarDraft;
      let t0 = 0, primeiro = 0;
      const genJson: any = async (system: string, user: string, o: any) => {
        const req = { system, user, json: true, model: o?.model, temperature: o?.temperature, timeoutMs: o?.timeoutMs, pensar: o?.pensar, prazoPrimeiroMs: o?.prazoPrimeiroMs, ctx: { agentKey: "eval", surface: "estudos" as const, phase: o?.phase } };
        try {
          const { valor, res } = o?.onTexto
            ? await envelope.gerarJsonStreamRes<any>(req, (acc) => { if (!primeiro) primeiro = performance.now() - t0; o.onTexto(acc); }, semLedger)
            : await envelope.gerarJsonRes<any>(req, semLedger);
          if (res.provedor !== "vertex") reservas++;
          return valor;
        } catch (e) {
          // o harness engole o erro (o turno nunca cai) — o eval NÃO: comparar resposta quebrada não mede nada
          console.error(`[eval] FALHA DE MODELO (${o?.phase}): ${String((e as Error)?.message ?? e).slice(0, 200)}`);
          process.exit(2);
        }
      };
      const deps = buildHarnessDeps({} as any, { genJson, onPrevia: () => undefined });
      const st: any = { objective: objetivo, intent: "explicar_conceito", mode: "elaborated", academicMode: "flexible", kind: undefined,
        spec: INTENTS.explicar_conceito, phase: "reason", iter: 1, spent: { tokens: 0, ms: 0 }, budget: { tokens: 1e9, ms: 1e9 }, plan: [], evidence, artifacts: [], memoryWrites: [], traceId: "eval", startedAt: Date.now() };
      t0 = performance.now(); primeiro = 0;
      st.reasoning = v.raciocinio ? await deps.reason(st) : "";
      const draft = await deps.draft(st);
      tempos[v.id]!.ttft.push(Math.round(primeiro)); tempos[v.id]!.total.push(Math.round(performance.now() - t0));
      respostas[v.id]!.push([draft.nucleo, draft.desenvolvimento ?? "", (draft.conceitos ?? []).map((c: any) => (typeof c === "string" ? c : c?.termo ?? c?.nome ?? JSON.stringify(c))).join("; ")].filter(Boolean).join("\n\n"));
    }
    console.error(`[eval] ${qi + 1}/${perguntas.length} ok`);
  }

  // juiz cego por pares: cada variante × a atual, ordem sorteada
  const base = VARIANTES[0]!.id;
  const placar: Record<string, { vence: number; empata: number; perde: number; motivos: string[] }> = {};
  for (const v of VARIANTES.slice(1)) {
    placar[v.id] = { vence: 0, empata: 0, perde: 0, motivos: [] };
    for (const [qi, objetivo] of perguntas.entries()) {
      const trocar = Math.random() < 0.5;
      const [A, B] = trocar ? [respostas[v.id]![qi]!, respostas[base]![qi]!] : [respostas[base]![qi]!, respostas[v.id]![qi]!];
      const { valor } = await envelope.gerarJsonRes<{ melhor?: string; motivo?: string }>({
        system: "Você é um professor universitário exigente avaliando respostas de uma tutora para um aluno. Critérios, nesta ordem: correção (erro factual pesa muito), profundidade adequada ao pedido, clareza didática, uso da evidência. Não premie tamanho por si só. Responda JSON {\"melhor\":\"A\"|\"B\"|\"empate\",\"motivo\":\"1 frase\"}.",
        user: `Pergunta do aluno: ${objetivo}\n\n=== RESPOSTA A ===\n${A}\n\n=== RESPOSTA B ===\n${B}`,
        json: true, temperature: 0, pensar: "high", ctx: { agentKey: "eval", surface: "estudos", phase: "juiz" },
      }, semLedger);
      const m = String(valor?.melhor ?? "empate").trim().toUpperCase();
      const venceuVariante = m === "EMPATE" ? null : (m === "A") === trocar;
      if (venceuVariante === null) placar[v.id]!.empata++; else if (venceuVariante) placar[v.id]!.vence++; else placar[v.id]!.perde++;
      if (venceuVariante === false) placar[v.id]!.motivos.push(String(valor?.motivo ?? "").slice(0, 140));
    }
  }

  console.log(JSON.stringify({
    perguntas: perguntas.length, chamadas_pela_reserva: reservas,
    tempos: Object.fromEntries(Object.entries(tempos).map(([k, t]) => [k, { primeira_palavra_mediana_ms: med(t.ttft), total_mediana_ms: med(t.total) }])),
    qualidade_vs_atual: placar,
  }, null, 1));
  process.exit(0);
}
main().catch((e) => { console.error("FALHOU", String(e?.stack ?? e).slice(0, 500)); process.exit(1); });
