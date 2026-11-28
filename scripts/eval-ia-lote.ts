/**
 * scripts/eval-ia-lote.ts — o TESTE EM LOTE da IA da Zaeon contra o Hugging Face de verdade (#883).
 *
 *   HF_TOKEN=… npx tsx --tsconfig tsconfig.json scripts/eval-ia-lote.ts --areas=labs,voz,imagem --vezes=3
 *
 * Roda cada caso de lib/eval/loteIa `--vezes` vezes, confere a resposta por regra e escreve:
 *  - `eval-ia-lote.md` (o relatório) e `eval-ia-lote.json` (cada pedido);
 *  - o relatório também no resumo do GitHub Actions ($GITHUB_STEP_SUMMARY), quando roda lá.
 * Sai com código 1 se o acerto ficar abaixo do mínimo (90%, ou `--minimo=0.8`).
 *
 * GASTA CRÉDITOS DO HF (área do Martinez): por isso só roda à mão, pelo workflow `eval-ia.yml`.
 * Os laboratórios vão pelo envelope de verdade com LLM_PRIMARIO=hf; o Google é um stub que só conta se foi chamado
 * (chamado = o HF falhou e a queda entrou), e o ledger não grava nada. Nunca imprime o token.
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { AREAS, CASOS_IMAGEM, CASOS_LABS, CASOS_VOZ, aprovado, relatorioMd, rodarLote, type Area, type Resultado } from "@/lib/eval/loteIa";
import { iaDoLaboratorio } from "@/lib/agentic/labIa";
import { gerarVozHf } from "@/lib/voice/hf-voz";
import { gerarImagemHf } from "@/lib/ai/hf-image";

const arg = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1];
const areas = (arg("areas") ?? AREAS.join(",")).split(",").map((s) => s.trim()).filter((a): a is Area => (AREAS as readonly string[]).includes(a));
const vezes = Math.min(20, Math.max(1, Number(arg("vezes") ?? 3) || 3));
const minimo = Math.min(1, Math.max(0, Number(arg("minimo") ?? 0.9) || 0.9));

const linha = (r: Resultado) => console.log(`${r.ok ? "✓" : "✗"} ${r.id} · ${(r.ms / 1000).toFixed(1)} s${r.ok ? "" : ` · ${r.motivo}`}`);

(async () => {
  if (!process.env.HF_TOKEN?.trim()) { console.error("sem HF_TOKEN: nada a testar"); process.exit(1); }
  console.log(`áreas: ${areas.join(", ")} · ${vezes} vez(es) por caso · mínimo ${Math.round(minimo * 100)}%`);
  const env = { ...process.env, LLM_PRIMARIO: "hf" };
  let quedaGoogle = 0;
  const depsLab = {
    env,
    registrar: async () => true,
    vertex: async () => { quedaGoogle++; throw new Error("google (stub do teste): o HF não respondeu e a queda foi acionada"); },
  };
  const rs: Resultado[] = [];

  if (areas.includes("labs")) {
    rs.push(...await rodarLote(CASOS_LABS, (c) => iaDoLaboratorio(c.entrada.lab, c.entrada.system, c.entrada.user,
      { temperature: c.entrada.lab === "codelab" ? 0.4 : c.entrada.lab === "quantum" ? 0.3 : 0.2, maxOutputTokens: c.entrada.lab === "biosim" ? 8192 : c.entrada.lab === "quantum" ? 512 : 1024, userId: null },
      depsLab as never), { vezes, paralelo: 3, aoTerminar: linha }));
  }
  if (areas.includes("voz")) {
    rs.push(...await rodarLote(CASOS_VOZ, (c) => gerarVozHf(c.entrada.texto, { voz: c.entrada.voz, timeoutMs: 30_000 }), { vezes, paralelo: 2, aoTerminar: linha }));
  }
  if (areas.includes("imagem")) {
    rs.push(...await rodarLote(CASOS_IMAGEM, (c) => gerarImagemHf(c.entrada.prompt, { aspectRatio: c.entrada.aspectRatio }), { vezes, paralelo: 2, aoTerminar: linha }));
  }

  const quando = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  let md = relatorioMd(rs, { vezes, minimo, quando });
  if (areas.includes("labs")) md += `\nQueda para o Google nos laboratórios: **${quedaGoogle}** vez(es) (o ideal é 0: o HF respondeu tudo).\n`;
  writeFileSync("eval-ia-lote.md", md);
  writeFileSync("eval-ia-lote.json", JSON.stringify({ quando, vezes, minimo, quedaGoogle, resultados: rs }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log("\n" + md);
  process.exit(aprovado(rs, minimo) ? 0 : 1);
})().catch((e) => { console.error("o teste em lote quebrou:", String(e?.message ?? e).replace(/hf_[A-Za-z0-9]{6,}/g, "hf_***").slice(0, 300)); process.exit(1); });
