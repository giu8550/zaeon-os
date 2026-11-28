/**
 * lib/eval/loteIa.ts — teste AUTOMÁTICO EM LOTE da IA da Zaeon (voz, imagem, laboratórios), contra o provedor de verdade.
 *
 * Pedido do Martinez (28/11): problema de modelo não se acha testando à mão, um caso por vez, em produção. Aqui cada
 * caso roda `vezes` vezes, a resposta é CONFERIDA por regra (não por olho) e sai um relatório com taxa de acerto,
 * tempo (p50/p95) e o motivo de cada falha.
 *
 * Este arquivo é PURO (sem rede): os casos, as conferências, o executor e o relatório. Quem chama o provedor de verdade
 * é `scripts/eval-ia-lote.ts` (rodado à mão pelo workflow `.github/workflows/eval-ia.yml`, que gasta créditos do HF).
 */
import { readWav, FORMATO_VOZ } from "@/lib/studio/wav";
import { CODELAB_SYSTEM, QUANTUM_SYSTEM, mensagemCodelab, mensagemQuantum, mensagemBiosim, promptBiosim } from "@/lib/agentic/prompts";

export type Area = "labs" | "voz" | "imagem";
export const AREAS: readonly Area[] = ["labs", "voz", "imagem"];

/** o que a conferência devolve: ok, ou o motivo (curto) */
export type Conferencia = { ok: true } | { ok: false; motivo: string };
const ok = (): Conferencia => ({ ok: true });
const falha = (motivo: string): Conferencia => ({ ok: false, motivo });

/** um caso: o que pedir e como conferir a resposta */
export interface Caso<E = unknown, R = unknown> { area: Area; id: string; entrada: E; conferir: (r: R) => Conferencia }

// ─── Laboratórios ────────────────────────────────────────────────────────────

/** o pedido do laboratório com o MESMO prompt que a rota usa (lib/agentic/prompts) */
export type EntradaLab = { lab: "codelab" | "quantum" | "biosim"; system: string; user: string };

function json(texto: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(String(texto).replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch { return null; }
}

/** CodeLab: JSON com `response` em texto; se pediu para mudar o código, vem `updatedCode` */
export function conferirCodelab(querCodigo: boolean) {
  return (texto: string): Conferencia => {
    const j = json(texto);
    if (!j) return falha("não veio JSON");
    if (typeof j.response !== "string" || j.response.trim().length < 10) return falha("sem 'response'");
    if (querCodigo && (typeof j.updatedCode !== "string" || !j.updatedCode.trim())) return falha("pediu código e não veio 'updatedCode'");
    return ok();
  };
}

export const VIZ_QUANTUM = ["waveFunction", "blochSphere", "energyLevels", "doubleSlit"] as const;
/** QuantumLab: JSON com `vizMode` válido (o esperado, quando o pedido é claro) e `title` */
export function conferirQuantum(esperado: (typeof VIZ_QUANTUM)[number]) {
  return (texto: string): Conferencia => {
    const j = json(texto);
    if (!j) return falha("não veio JSON");
    if (!VIZ_QUANTUM.includes(j.vizMode as never)) return falha(`vizMode inválido (${String(j.vizMode)})`);
    if (typeof j.title !== "string" || !j.title.trim()) return falha("sem 'title'");
    if (j.vizMode !== esperado) return falha(`vizMode ${String(j.vizMode)}, esperado ${esperado}`);
    return ok();
  };
}

/** BioSim: JSON com `intent` (molecule | protein | descriptor) — o esperado para o pedido */
export function conferirBiosim(esperado: "molecule" | "protein" | "descriptor") {
  return (texto: string): Conferencia => {
    const j = json(texto);
    if (!j) return falha("não veio JSON");
    const intent = j.intent ?? "descriptor";
    if (!["molecule", "protein", "descriptor"].includes(String(intent))) return falha(`intent inválido (${String(intent)})`);
    if (intent !== esperado) return falha(`intent ${String(intent)}, esperado ${esperado}`);
    if ((intent === "molecule" || intent === "protein") && (typeof j.query !== "string" || !j.query.trim())) return falha("sem 'query'");
    if (intent === "descriptor" && (!j.descriptor || typeof j.descriptor !== "object")) return falha("sem 'descriptor'");
    return ok();
  };
}

const CODIGO = "function soma(a, b) {\n  return a + b\n}\nconsole.log(soma(2, 3))";
const codelab = (pergunta: string, code: string, language = "javascript"): EntradaLab => ({ lab: "codelab", system: CODELAB_SYSTEM, user: mensagemCodelab(pergunta, code, language) });
const quantum = (pedido: string): EntradaLab => ({ lab: "quantum", system: QUANTUM_SYSTEM, user: mensagemQuantum(pedido) });
const biosim = (sala: string, pedido: string): EntradaLab => ({ lab: "biosim", system: promptBiosim(sala), user: mensagemBiosim(sala, pedido) });

export const CASOS_LABS: Caso<EntradaLab, string>[] = [
  { area: "labs", id: "codelab · explicar", entrada: codelab("explique esse código", CODIGO), conferir: conferirCodelab(false) },
  { area: "labs", id: "codelab · mudar código", entrada: codelab("adicione um comentário em cada linha", CODIGO), conferir: conferirCodelab(true) },
  { area: "labs", id: "codelab · python", entrada: codelab("por que dá erro de indentação?", "def f(x):\nreturn x * 2", "python"), conferir: conferirCodelab(false) },
  { area: "labs", id: "quantum · qubit", entrada: quantum("mostre um qubit em superposição"), conferir: conferirQuantum("blochSphere") },
  { area: "labs", id: "quantum · níveis do hidrogênio", entrada: quantum("níveis de energia do átomo de hidrogênio"), conferir: conferirQuantum("energyLevels") },
  { area: "labs", id: "quantum · fenda dupla", entrada: quantum("experimento da fenda dupla com elétrons"), conferir: conferirQuantum("doubleSlit") },
  { area: "labs", id: "quantum · poço infinito", entrada: quantum("partícula num poço de potencial infinito, n=2"), conferir: conferirQuantum("waveFunction") },
  { area: "labs", id: "biosim · cafeína", entrada: biosim("bio", "cafeína"), conferir: conferirBiosim("molecule") },
  { area: "labs", id: "biosim · hemoglobina", entrada: biosim("med", "estrutura da hemoglobina"), conferir: conferirBiosim("protein") },
  { area: "labs", id: "biosim · célula animal", entrada: biosim("bio", "uma célula animal"), conferir: conferirBiosim("descriptor") },
];

// ─── Voz ─────────────────────────────────────────────────────────────────────

export type EntradaVoz = { texto: string; voz?: string };
const FRASE = "A mitocôndria é a organela que produz a energia da célula, pela respiração celular. ";

/** a voz: WAV no formato da casa (24 kHz mono 16-bit), com duração mínima pelo tamanho do texto */
export function conferirVoz(minSegundos: number) {
  return (audio: Buffer): Conferencia => {
    let wav;
    try { wav = readWav(audio); } catch { return falha("não é WAV"); }
    if (wav.fmt.sampleRate !== FORMATO_VOZ.sampleRate || wav.fmt.channels !== 1 || wav.fmt.bitsPerSample !== 16) return falha(`formato ${wav.fmt.sampleRate} Hz/${wav.fmt.channels} canais/${wav.fmt.bitsPerSample} bits`);
    const s = wav.data.length / (FORMATO_VOZ.sampleRate * 2);
    if (s < minSegundos) return falha(`áudio curto demais (${s.toFixed(1)} s, mínimo ${minSegundos} s)`);
    return ok();
  };
}

export const CASOS_VOZ: Caso<EntradaVoz, Buffer>[] = [
  { area: "voz", id: "voz · frase curta (feminina)", entrada: { texto: "Olá, turma! Vamos começar a aula.", voz: "leda" }, conferir: conferirVoz(1) },
  { area: "voz", id: "voz · masculina (podcast)", entrada: { texto: "E aí, pessoal, bem-vindos ao podcast da Zaeon.", voz: "Charon" }, conferir: conferirVoz(1) },
  { area: "voz", id: "voz · texto longo (aula, vários trechos)", entrada: { texto: FRASE.repeat(8).trim(), voz: "leda" }, conferir: conferirVoz(15) },
  { area: "voz", id: "voz · números e siglas", entrada: { texto: "O DNA tem 3 bilhões de pares de bases; a velocidade da luz é 300 mil km/s.", voz: "leda" }, conferir: conferirVoz(2) },
];

// ─── Imagem ──────────────────────────────────────────────────────────────────

export type EntradaImagem = { prompt: string; aspectRatio?: string };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** a imagem: PNG em base64, com tamanho de imagem de verdade (não um pixel) */
export function conferirImagem(r: { data: string; mimeType: string }): Conferencia {
  if (r.mimeType !== "image/png") return falha(`mime ${r.mimeType}`);
  const b = Buffer.from(r.data || "", "base64");
  if (!b.subarray(0, 4).equals(PNG)) return falha("não é PNG");
  if (b.length < 20_000) return falha(`imagem pequena demais (${b.length} bytes)`);
  return ok();
}

export const CASOS_IMAGEM: Caso<EntradaImagem, { data: string; mimeType: string }>[] = [
  { area: "imagem", id: "imagem · vulcão (didática)", entrada: { prompt: "ilustração didática de um vulcão em corte, mostrando a câmara magmática", aspectRatio: "16:9" }, conferir: conferirImagem },
  { area: "imagem", id: "imagem · coração (anatomia)", entrada: { prompt: "ilustração anatômica do coração humano com as quatro câmaras", aspectRatio: "1:1" }, conferir: conferirImagem },
  { area: "imagem", id: "imagem · cena de vídeo", entrada: { prompt: "um laboratório de química escolar, luz natural, estilo ilustração", aspectRatio: "16:9" }, conferir: conferirImagem },
];

// ─── Executor e relatório ────────────────────────────────────────────────────

export interface Resultado { area: Area; id: string; ok: boolean; ms: number; motivo?: string }

/**
 * Roda cada caso `vezes` vezes, no máximo `paralelo` ao mesmo tempo. `chamar` faz o pedido de verdade; erro lançado
 * conta como falha com a mensagem (curta, sem token). Nunca lança: o relatório mostra tudo.
 */
export async function rodarLote<E, R>(
  casos: Caso<E, R>[],
  chamar: (c: Caso<E, R>) => Promise<R>,
  o: { vezes: number; paralelo?: number; agora?: () => number; aoTerminar?: (r: Resultado) => void },
): Promise<Resultado[]> {
  const agora = o.agora ?? Date.now;
  const fila = casos.flatMap((c) => Array.from({ length: Math.max(1, o.vezes) }, () => c));
  const out: Resultado[] = [];
  let i = 0;
  const trabalhador = async () => {
    while (i < fila.length) {
      const c = fila[i++]!;
      const ini = agora();
      let r: Resultado;
      try {
        const conf = c.conferir(await chamar(c));
        r = { area: c.area, id: c.id, ok: conf.ok, ms: agora() - ini, ...(conf.ok ? {} : { motivo: conf.motivo }) };
      } catch (e) {
        r = { area: c.area, id: c.id, ok: false, ms: agora() - ini, motivo: semSegredo(String((e as Error)?.message ?? e)).slice(0, 160) };
      }
      out.push(r);
      o.aoTerminar?.(r);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(o.paralelo ?? 2, fila.length)) }, trabalhador));
  return out;
}

/** tira token do HF e Bearer de qualquer texto que vá para o relatório */
export function semSegredo(s: string): string {
  return s.replace(/hf_[A-Za-z0-9]{6,}/g, "hf_***").replace(/Bearer\s+\S+/gi, "Bearer ***");
}

export function percentil(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const o = [...xs].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.ceil((p / 100) * o.length) - 1)]!;
}

export interface Resumo { area: Area; id: string; total: number; acertos: number; p50: number; p95: number; motivos: string[] }

export function resumir(rs: Resultado[]): Resumo[] {
  const grupos = new Map<string, Resultado[]>();
  for (const r of rs) grupos.set(`${r.area}\u0000${r.id}`, [...(grupos.get(`${r.area}\u0000${r.id}`) ?? []), r]);
  return [...grupos.values()].map((g) => {
    const ms = g.map((r) => r.ms);
    const motivos = [...new Set(g.filter((r) => !r.ok).map((r) => r.motivo ?? "?"))];
    return { area: g[0]!.area, id: g[0]!.id, total: g.length, acertos: g.filter((r) => r.ok).length, p50: percentil(ms, 50), p95: percentil(ms, 95), motivos };
  });
}

/** a taxa de acerto mínima para o lote passar (padrão 90%) */
export const ACERTO_MINIMO = 0.9;

export function aprovado(rs: Resultado[], minimo = ACERTO_MINIMO): boolean {
  return rs.length > 0 && rs.filter((r) => r.ok).length / rs.length >= minimo;
}

const seg = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** relatório em Markdown (vai para o resumo do GitHub Actions e para o arquivo baixável) */
export function relatorioMd(rs: Resultado[], o: { vezes: number; minimo?: number; quando?: string } = { vezes: 1 }): string {
  const minimo = o.minimo ?? ACERTO_MINIMO;
  const total = rs.length, acertos = rs.filter((r) => r.ok).length;
  const pct = (a: number, t: number) => (t ? `${Math.round((a / t) * 100)}%` : "—");
  const linhas = [
    `# Teste em lote da IA da Zaeon${o.quando ? ` (${o.quando})` : ""}`,
    "",
    `**${aprovado(rs, minimo) ? "✅ Passou" : "❌ Não passou"}**: ${acertos} de ${total} pedidos certos (${pct(acertos, total)}; o mínimo é ${Math.round(minimo * 100)}%). Cada caso rodou ${o.vezes} vez(es).`,
    "",
  ];
  for (const area of AREAS) {
    const da = resumir(rs.filter((r) => r.area === area));
    if (!da.length) continue;
    const a = da.reduce((s, x) => s + x.acertos, 0), t = da.reduce((s, x) => s + x.total, 0);
    linhas.push(`## ${area === "labs" ? "Laboratórios" : area === "voz" ? "Voz" : "Imagem"}: ${a}/${t} (${pct(a, t)})`, "", "| Caso | Certos | Tempo p50 | Tempo p95 | Falhas |", "|---|---|---|---|---|");
    for (const x of da) linhas.push(`| ${x.id} | ${x.acertos}/${x.total} | ${seg(x.p50)} | ${seg(x.p95)} | ${x.motivos.map((m) => m.replace(/\|/g, "/")).join("; ") || "—"} |`);
    linhas.push("");
  }
  return linhas.join("\n");
}
