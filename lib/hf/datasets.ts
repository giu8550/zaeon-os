/**
 * lib/hf/datasets.ts — escrever arquivos num dataset PRIVADO do Hugging Face (API de commit do Hub, sem SDK).
 *
 *   commitArquivo({ repo: "nkcompany/zaeon-feedback-chat", caminho: "data/2026-10-22.jsonl", conteudo, mensagem })
 *
 * Env: HF_DATASETS_TOKEN (fine-grained, escrita só nos repos da org) e HF_DATASETS_ORG (ex.: "nkcompany").
 * Arquivos pequenos (JSONL de lote) vão inline em base64 — o endpoint aceita sem LFS até alguns MB.
 */
type Env = Record<string, string | undefined>;

export const HF_HUB = "https://huggingface.co";

export function datasetsLigados(env: Env = process.env): boolean {
  return Boolean(env.HF_DATASETS_TOKEN?.trim() && env.HF_DATASETS_ORG?.trim());
}

/** "zaeon-feedback-chat" → "nkcompany/zaeon-feedback-chat". */
export function repoDaOrg(nome: string, env: Env = process.env): string {
  return `${env.HF_DATASETS_ORG!.trim()}/${nome}`;
}

/** Corpo NDJSON do commit: cabeçalho + um arquivo inline (base64). PURO. */
export function corpoDoCommit(caminho: string, conteudo: string, mensagem: string): string {
  return [
    JSON.stringify({ key: "header", value: { summary: mensagem.slice(0, 200), description: "" } }),
    JSON.stringify({ key: "file", value: { path: caminho, content: Buffer.from(conteudo, "utf8").toString("base64"), encoding: "base64" } }),
  ].join("\n");
}

export async function commitArquivo(
  o: { repo: string; caminho: string; conteudo: string; mensagem: string },
  deps: { fetchImpl?: typeof fetch; env?: Env } = {},
): Promise<{ ok: true; commit?: string } | { ok: false; status: number; erro: string }> {
  const env = deps.env ?? process.env;
  const r = await (deps.fetchImpl ?? fetch)(`${HF_HUB}/api/datasets/${o.repo}/commit/main`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.HF_DATASETS_TOKEN!.trim()}`, "Content-Type": "application/x-ndjson" },
    body: corpoDoCommit(o.caminho, o.conteudo, o.mensagem),
    signal: AbortSignal.timeout(60_000),
  });
  const texto = await r.text();
  if (!r.ok) return { ok: false, status: r.status, erro: texto.slice(0, 300) };
  let commit: string | undefined;
  try { commit = JSON.parse(texto)?.commitOid; } catch { /* corpo sem JSON: ok mesmo assim */ }
  return { ok: true, commit };
}
