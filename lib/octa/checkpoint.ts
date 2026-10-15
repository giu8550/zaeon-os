/**
 * lib/octa/checkpoint.ts — P7 do Pack Octa (lacuna §9.5). Checkpoint antes de uma série de edições do agente
 * e "desfazer o run inteiro".
 *
 * Snapshot = commit git FORA do histórico (índice temporário + write-tree + commit-tree), guardado em
 * `refs/octa/checkpoints/<runId>`. Não mexe na branch, no índice do usuário nem no stash (o stash é
 * compartilhado entre worktrees). Inclui arquivos não rastreados (respeitando .gitignore).
 * Restaurar = volta o working tree exatamente ao snapshot: arquivos alterados voltam, criados pelo run somem.
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function git(cwd: string, args: string[], env: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, env: { ...process.env, ...env }, maxBuffer: 64 << 20 }, (e, out, err) =>
      e ? reject(new Error(`git ${args[0]}: ${err || e.message}`)) : resolve(out.trim()));
  });
}

const RUN_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
const ref = (runId: string) => {
  if (!RUN_ID_RE.test(runId)) throw new Error(`runId inválido: ${runId}`);
  return `refs/octa/checkpoints/${runId}`;
};

async function comIndiceTemp<T>(fn: (env: Record<string, string>) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "octa-idx-"));
  try { return await fn({ GIT_INDEX_FILE: join(dir, "index") }); } finally { await rm(dir, { recursive: true, force: true }); }
}

/** Fotografa o working tree inteiro (rastreados + não rastreados não ignorados). */
export async function criarCheckpoint(repo: string, runId: string): Promise<string> {
  return comIndiceTemp(async (env) => {
    await git(repo, ["add", "-A", "."], env);
    const tree = await git(repo, ["write-tree"], env);
    const parent = await git(repo, ["rev-parse", "--verify", "-q", "HEAD"]).catch(() => "");
    const commit = await git(repo, ["commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", `octa checkpoint ${runId}`], {
      ...env, GIT_AUTHOR_NAME: "octa", GIT_AUTHOR_EMAIL: "octa@zaeon.local", GIT_COMMITTER_NAME: "octa", GIT_COMMITTER_EMAIL: "octa@zaeon.local",
    });
    await git(repo, ["update-ref", ref(runId), commit]);
    return commit;
  });
}

/** Arquivos que o run mudou desde o checkpoint (pro trace e pro juiz). */
export async function mudancasDesde(repo: string, runId: string): Promise<string[]> {
  return comIndiceTemp(async (env) => {
    await git(repo, ["add", "-A", "."], env);
    const out = await git(repo, ["diff", "--cached", "--name-only", ref(runId)], env);
    return out ? out.split("\n") : [];
  });
}

/** Desfaz o run inteiro: o working tree volta a ser exatamente o snapshot. O índice do usuário é preservado. */
export async function desfazerRun(repo: string, runId: string): Promise<string[]> {
  const mudou = await mudancasDesde(repo, runId);
  const snap = await git(repo, ["rev-parse", "--verify", ref(runId)]);
  const noSnap = new Set((await git(repo, ["ls-tree", "-r", "--name-only", snap])).split("\n").filter(Boolean));
  for (const f of mudou) {
    if (noSnap.has(f)) await git(repo, ["restore", `--source=${snap}`, "--worktree", "--", f]);
    else await rm(join(repo, f), { force: true }); // criado pelo run
  }
  return mudou;
}

export async function descartarCheckpoint(repo: string, runId: string): Promise<void> {
  await git(repo, ["update-ref", "-d", ref(runId)]);
}
