/**
 * lib/octa/fortify.ts — P4 do Pack Octa (§6). Fortificação do software que o Octa gera:
 *   implementar → VALIDAR (testes do alvo) → BENCHMARK → JUIZ independente read-only → só então "oficial".
 *
 *   - Execução isolada via `Executor`: o código do candidato é gravável; os INPUTS do avaliador são
 *     read-only e têm integridade checada (sha256 antes/depois). Mexeu no input = FAIL, sem discussão.
 *   - O juiz recebe o registro CONGELADO; não roda comando nem edita nada.
 *   - Nada vira "oficial" sem PASS do juiz. O Octa NÃO declara "pronto" sem isso.
 * Padrão de uw-syfi/vibesys (MIT, só o padrão).
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { congelar } from "@/lib/octa/evals/core";

export type Comando = { nome: string; argv: string[]; timeoutMs?: number };
/** O contrato de um alvo: cada projeto define os próprios checks de correção e o benchmark. */
export type ContratoAlvo = {
  alvo: string;
  correcao: Comando[];
  benchmark?: Comando & { /** teto em ms; acima disso o juiz reprova */ limiteMs?: number };
  /** Diretórios (relativos ao workspace) que o candidato NÃO pode alterar: fixtures, testes do avaliador. */
  inputsSomenteLeitura: string[];
};

export type Execucao = { codigo: number; stdout: string; stderr: string; ms: number };
export interface Executor {
  rodar(c: Comando, cwd: string): Promise<Execucao>;
}

/** Executor local (dev/CI): sem shell, argv direto, timeout duro. NÃO é sandbox — produção usa o de contêiner. */
export class ExecutorLocal implements Executor {
  rodar(c: Comando, cwd: string): Promise<Execucao> {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const p = spawn(c.argv[0], c.argv.slice(1), { cwd, shell: false, env: { PATH: process.env.PATH ?? "" } as unknown as NodeJS.ProcessEnv });
      let stdout = "", stderr = "";
      p.stdout.on("data", (d) => { stdout = (stdout + d).slice(-20_000); });
      p.stderr.on("data", (d) => { stderr = (stderr + d).slice(-20_000); });
      const timer = setTimeout(() => p.kill("SIGKILL"), c.timeoutMs ?? 120_000);
      p.on("error", (e) => { clearTimeout(timer); resolve({ codigo: 127, stdout, stderr: String(e.message), ms: Date.now() - t0 }); });
      p.on("close", (code, sig) => { clearTimeout(timer); resolve({ codigo: code ?? (sig ? 137 : 1), stdout, stderr, ms: Date.now() - t0 }); });
    });
  }
}

/**
 * Executor em contêiner (produção — portão do dono: infra dos contêineres). Monta o workspace do
 * candidato rw e cada input read-only com `:ro`, sem rede, com limite de CPU/memória/pids.
 */
export class ExecutorContainer implements Executor {
  constructor(private imagem: string, private inputs: string[], private base: Executor = new ExecutorLocal()) {}
  argvDocker(c: Comando, cwd: string): string[] {
    const ro = this.inputs.flatMap((d) => ["-v", `${join(cwd, d)}:/work/${d}:ro`]);
    return ["docker", "run", "--rm", "--network", "none", "--cpus", "2", "--memory", "2g", "--pids-limit", "256",
      "-v", `${cwd}:/work:rw`, ...ro, "-w", "/work", this.imagem, ...c.argv];
  }
  rodar(c: Comando, cwd: string) { return this.base.rodar({ ...c, argv: this.argvDocker(c, cwd) }, cwd); }
}

/** sha256 determinístico de uma árvore de arquivos (caminho + conteúdo). */
export async function hashArvore(raiz: string, dirs: string[]): Promise<string> {
  const h = createHash("sha256");
  const visitar = async (abs: string) => {
    const ents = await readdir(abs, { withFileTypes: true }).catch(() => null);
    if (!ents) { h.update(`missing:${relative(raiz, abs)}\n`); return; }
    for (const e of ents.sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(abs, e.name);
      if (e.isDirectory()) await visitar(p);
      else if (e.isFile()) h.update(`${relative(raiz, p)}\0`).update(await readFile(p)).update("\n");
    }
  };
  for (const d of [...dirs].sort()) await visitar(join(raiz, d));
  return h.digest("hex");
}

export type RegistroFortificacao = {
  alvo: string;
  runId: string;
  correcao: Array<{ nome: string } & Execucao>;
  benchmark?: { nome: string; ms: number; limiteMs?: number; codigo: number };
  integridade: { antes: string; depois: string; ok: boolean };
};
export type VereditoJuiz = { pass: boolean; motivo: string };
export type JuizFortificacao = (r: Readonly<RegistroFortificacao>) => Promise<VereditoJuiz> | VereditoJuiz;

export const juizPadrao: JuizFortificacao = (r) => {
  if (!r.integridade.ok) return { pass: false, motivo: "inputs do avaliador foram alterados (integridade)" };
  const quebrou = r.correcao.find((c) => c.codigo !== 0);
  if (quebrou) return { pass: false, motivo: `correção falhou: ${quebrou.nome} (código ${quebrou.codigo})` };
  if (r.benchmark && r.benchmark.codigo !== 0) return { pass: false, motivo: `benchmark falhou (código ${r.benchmark.codigo})` };
  if (r.benchmark?.limiteMs && r.benchmark.ms > r.benchmark.limiteMs) return { pass: false, motivo: `benchmark ${r.benchmark.ms}ms > limite ${r.benchmark.limiteMs}ms` };
  return { pass: true, motivo: "correção ok, benchmark dentro do limite, inputs íntegros" };
};

export type ResultadoFortificacao = { registro: RegistroFortificacao; veredito: VereditoJuiz; oficial: string | null };

/**
 * Roda o loop no workspace do candidato. Só grava o resultado "oficial" (em `.octa/oficial/<runId>.json`,
 * e chama `aoOficializar` pra commit/audit) se o juiz aprovar.
 */
export async function fortificar(
  workspace: string,
  contrato: ContratoAlvo,
  opts: { executor?: Executor; juiz?: JuizFortificacao; runId?: string; aoOficializar?: (path: string, r: ResultadoFortificacao) => Promise<void> } = {},
): Promise<ResultadoFortificacao> {
  const ex = opts.executor ?? new ExecutorLocal();
  const runId = opts.runId ?? `${Date.now().toString(36)}`;
  const antes = await hashArvore(workspace, contrato.inputsSomenteLeitura);

  const correcao: RegistroFortificacao["correcao"] = [];
  for (const c of contrato.correcao) {
    const r = await ex.rodar(c, workspace);
    correcao.push({ nome: c.nome, ...r });
    if (r.codigo !== 0) break; // não faz benchmark de candidato quebrado
  }
  let benchmark: RegistroFortificacao["benchmark"];
  if (contrato.benchmark && correcao.every((c) => c.codigo === 0)) {
    const b = await ex.rodar(contrato.benchmark, workspace);
    benchmark = { nome: contrato.benchmark.nome, ms: b.ms, limiteMs: contrato.benchmark.limiteMs, codigo: b.codigo };
  }
  const depois = await hashArvore(workspace, contrato.inputsSomenteLeitura);
  const registro: RegistroFortificacao = { alvo: contrato.alvo, runId, correcao, benchmark, integridade: { antes, depois, ok: antes === depois } };

  const veredito: VereditoJuiz = await (async () => (opts.juiz ?? juizPadrao)(congelar(structuredClone(registro))))()
    .catch((e) => ({ pass: false, motivo: `juiz falhou: ${e?.message ?? e}` }));

  let oficial: string | null = null;
  const res: ResultadoFortificacao = { registro, veredito, oficial };
  if (veredito.pass) {
    const dir = join(workspace, ".octa", "oficial");
    await mkdir(dir, { recursive: true });
    oficial = join(dir, `${runId}.json`);
    res.oficial = oficial;
    await writeFile(oficial, JSON.stringify({ registro, veredito }, null, 2));
    await opts.aoOficializar?.(oficial, res);
  }
  return res;
}
