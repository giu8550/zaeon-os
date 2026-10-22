/**
 * scripts/ingerir-bases-area.ts — enche as BASES POR ÁREA dos mentores (lib/rag/areas) com conhecimento público.
 *
 *   docker exec -w /app zaeon_web npx tsx scripts/ingerir-bases-area.ts --seco              # só conta (nada grava)
 *   docker exec -w /app zaeon_web npx tsx scripts/ingerir-bases-area.ts --fontes scielo,wiki,medicina,enem
 *   opções: --por-area 1500  --scielo-jsonl /tmp/scielo.jsonl (gerado por scripts/scielo-para-jsonl.py)  --linhas N (teto lido)
 *
 * Grava pelo MESMO caminho dos PDFs (lib/rag/ingerir `ingerirTexto`): dedupe por hash, trechos, fila de vetores
 * (o worker rag-index gera os embeddings depois; até lá a busca por palavra já acha). Rodar de novo é seguro.
 * Licenças (comercial ok): SciELO pt CC-BY-4.0, Wikipédia CC-BY-SA, rhaymison/medicine-* Apache-2.0, maritaca-ai/enem Apache-2.0.
 * A fonte e a licença vão no fim de cada documento — a citação do chat mostra o título, e o crédito fica no texto.
 */
import { AREAS, AREA_GERAL, classificarArea, idArea, tituloEResumo } from "../lib/rag/areas";

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SECO = args.includes("--seco");
const FONTES = opt("--fontes", "scielo,wiki,medicina,enem").split(",");
const POR_AREA = Number(opt("--por-area", "1500"));
const LINHAS = Number(opt("--linhas", "1000000"));
const DS = "https://datasets-server.huggingface.co";
const UA = { "User-Agent": "ZaeonBot/1.0 (https://zaeon.com.br; bases de estudo)" };

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function json(url: string, tentativas = 5): Promise<any> {
  for (let i = 0; i < tentativas; i++) {
    const r = await fetch(url, { headers: { ...UA, ...(process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {}) } }).catch(() => null);
    if (r?.ok) return r.json();
    await espera(2000 * 2 ** i);
  }
  throw new Error(`falhou: ${url.slice(0, 120)}`);
}
async function linhas(dataset: string, config: string, offset: number, length = 100): Promise<any[]> {
  const d = await json(`${DS}/rows?dataset=${encodeURIComponent(dataset)}&config=${encodeURIComponent(config)}&split=train&offset=${offset}&length=${length}`);
  return (d.rows ?? []).map((r: any) => r.row);
}

async function main() {
  // --seco não toca no banco (dá pra rodar de qualquer máquina só pra ver a distribuição por área)
  const deps = SECO ? null : await (async () => {
    const [{ ragPg }, { enfileirarIndexacao }] = await Promise.all([import("../lib/rag/pg"), import("../lib/queue/rag")]);
    return { db: ragPg(), enfileirar: enfileirarIndexacao };
  })();
  const { ingerirTexto } = await import("../lib/rag/ingerir");
  const placar: Record<string, { novo: number; reaproveitado: number; erro: number }> = {};
  const gravar = async (area: string, fonte: string, d: { chave: string; titulo: string; texto: string }) => {
    const k = `${area} · ${fonte}`;
    placar[k] ??= { novo: 0, reaproveitado: 0, erro: 0 };
    if (SECO) { placar[k].novo++; return; }
    const r = await ingerirTexto(deps!, { ...d, origem: "dataset", criadoPor: `dataset:${fonte}`, permissao: { turmaId: idArea(area) } });
    placar[k][r.status]++;
    if (r.status === "erro") console.warn(`[erro] ${k} ${d.chave}: ${r.erro}`);
  };

  if (FONTES.includes("scielo")) {
    // A API de linhas do HF não serve este dataset (1 parquet de 2,8 GB, um bloco só). Ele é pré-extraído pra JSONL
    // leve ({doc_id, year, titulo, resumo}) por scripts/scielo-para-jsonl.py e lido daqui (--scielo-jsonl).
    const caminho = opt("--scielo-jsonl", "/tmp/scielo.jsonl");
    const { createReadStream } = await import("node:fs");
    const { createInterface } = await import("node:readline");
    const porArea: Record<string, Array<{ pontos: number; titulo: string; resumo: string; id: string; ano: number }>> = {};
    let lidas = 0;
    for await (const l of createInterface({ input: createReadStream(caminho, "utf8"), crlfDelay: Infinity })) {
      if (!l.trim() || lidas >= LINHAS) continue;
      lidas++;
      const row = JSON.parse(l);
      if (String(row.resumo ?? "").length < 400) continue;
      const c = classificarArea(row.titulo, row.resumo);
      if (c) (porArea[c.slug] ??= []).push({ pontos: c.pontos, titulo: row.titulo, resumo: row.resumo, id: String(row.doc_id), ano: row.year });
      if (lidas % 20000 === 0) console.log(`[scielo] lidas ${lidas} — ${Object.entries(porArea).map(([k, v]) => `${k}:${v.length}`).join(" ")}`);
    }
    console.log(`[scielo] lidas ${lidas} — ${Object.entries(porArea).map(([k, v]) => `${k}:${v.length}`).join(" ")}`);
    for (const a of AREAS) {
      const melhores = (porArea[a.slug] ?? []).sort((x, y) => y.pontos - x.pontos).slice(0, POR_AREA);
      for (const m of melhores) {
        await gravar(a.slug, "scielo", { chave: `scielo-${m.id}`, titulo: m.titulo, texto: `${m.resumo}\n\nFonte: SciELO (${m.ano}) — licença CC BY 4.0.` });
      }
    }
  }

  if (FONTES.includes("wiki")) {
    for (const a of AREAS) {
      for (const t of a.wikipedia) {
        const d = await json(`https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&format=json&titles=${encodeURIComponent(t)}`).catch(() => null);
        const pag: any = d && Object.values(d.query?.pages ?? {})[0];
        const texto = String(pag?.extract ?? "").slice(0, 20_000);
        if (texto.length < 500) { console.warn(`[wiki] sem texto: ${t}`); continue; }
        await gravar(a.slug, "wikipedia", { chave: `wiki-pt-${pag.title}`, titulo: `${pag.title} (Wikipédia)`, texto: `${texto}\n\nFonte: Wikipédia em português, verbete "${pag.title}" — licença CC BY-SA 4.0.` });
        await espera(300);
      }
    }
  }

  if (FONTES.includes("medicina")) {
    // "<s> [INST] <<SYS>>…<</SYS>> pergunta [/INST] resposta </s>" → lotes de 20 perguntas e respostas por documento
    const fontes = [
      { ds: "rhaymison/medicine-medical_meadow_wikidoc_pt", areas: ["medicina", "enfermagem"] },
      { ds: "rhaymison/medicine-information-pt", areas: ["farmacia", "medicina"] },
    ];
    for (const f of fontes) {
      const total = (await json(`${DS}/size?dataset=${f.ds}`)).size.dataset.num_rows as number;
      let lote: string[] = [];
      let n = 0;
      const fechar = async () => {
        if (!lote.length) return;
        n++;
        for (const area of f.areas) {
          await gravar(area, f.ds.split("/")[1], { chave: `${f.ds}-${n}`, titulo: `Perguntas e respostas de saúde (${f.ds.split("/")[1]}) — parte ${n}`, texto: `${lote.join("\n\n")}\n\nFonte: ${f.ds} (Hugging Face) — licença Apache-2.0.` });
        }
        lote = [];
      };
      for (let off = 0; off < total; off += 100) {
        for (const row of await linhas(f.ds, "default", off)) {
          const m = /\[\/SYS\]\]?|<<\/SYS>>/.exec(row.input ?? "");
          const corpo = String(row.input ?? "").slice(m ? m.index + m[0].length : 0);
          const [perg, resp] = corpo.split("[/INST]");
          const P = perg?.replace(/<\/?s>|\[INST\]/g, "").trim(), R = resp?.replace(/<\/?s>/g, "").trim();
          if (P && R) lote.push(`**Pergunta:** ${P}\n**Resposta:** ${R}`);
          if (lote.length >= 20) await fechar();
        }
      }
      await fechar();
    }
  }

  if (FONTES.includes("enem")) {
    for (const ano of ["2022", "2023", "2024"]) {
      for (let off = 0; off < 200; off += 100) {
        for (const q of await linhas("maritaca-ai/enem", ano, off)) {
          const alts = Array.isArray(q.alternatives) ? q.alternatives.map((a: string, i: number) => `${"ABCDE"[i]}) ${a}`).join("\n") : "";
          await gravar(AREA_GERAL, "enem", { chave: `enem-${ano}-${q.id}`, titulo: `ENEM ${ano} — ${q.id}`, texto: `${q.question}\n\n${alts}\n\nGabarito: ${q.label}\n\nFonte: maritaca-ai/enem (Hugging Face) — licença Apache-2.0.` });
        }
      }
    }
  }

  console.log(SECO ? "[seco] nada gravado — contagem do que entraria:" : "[fim] resultado:");
  for (const [k, v] of Object.entries(placar).sort()) console.log(`  ${k.padEnd(28)} novos=${v.novo} reaproveitados=${v.reaproveitado} erros=${v.erro}`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
