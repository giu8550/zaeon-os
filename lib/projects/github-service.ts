/**
 * GitHub service — real Octokit operations for the Projetos agentic IDE.
 *
 * This is the `executeAction()` the route delegates to AFTER the server-side
 * gates (auth, eligibility, approval, autonomy) have passed. It also exposes the
 * read helpers that turn a real repository into the IDE's file tree, replacing
 * the in-memory mock in ProjectsContent.
 *
 * Risk discipline (see lib/projects/github-actions.ts — the single source of
 * truth): this module NEVER decides whether an action is allowed. It only runs
 * actions the caller already cleared. Irreversible ops still reach here only
 * after explicit human approval upstream.
 *
 * Octokit is typed as `any` because the dependency is loaded dynamically by
 * github-client.ts to keep the build green before `npm i octokit`.
 */

import { getInstallationOctokit, GitHubNotConfiguredError } from "./github-client";
import type { Language } from "@/app/agentic-modules/codelab/useCodeRunner";

type AnyOctokit = any;

// ─── File-tree contract (matches FileNode in ProjectsContent.tsx) ─────────────

export interface RepoFileMeta {
  path: string;
  lang: Language;
  /** Monaco language id for syntax highlighting. */
  monaco: string;
  /** Blob size in bytes (from the git tree). */
  size?: number;
}

export interface RepoFile extends RepoFileMeta {
  body: string;
  /** Blob sha — needed to update the file via the contents API. */
  sha?: string;
}

/** Map a file extension to the runner Language + a Monaco language id. */
export function mapPathToLang(path: string): { lang: Language; monaco: string } {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "py": return { lang: "python", monaco: "python" };
    case "js": case "jsx": case "mjs": case "cjs": return { lang: "javascript", monaco: "javascript" };
    case "ts": return { lang: "typescript", monaco: "typescript" };
    case "tsx": return { lang: "typescript", monaco: "typescript" };
    case "html": case "htm": return { lang: "html", monaco: "html" };
    case "css": return { lang: "other", monaco: "css" };
    case "json": return { lang: "other", monaco: "json" };
    case "md": case "markdown": return { lang: "other", monaco: "markdown" };
    case "yml": case "yaml": return { lang: "other", monaco: "yaml" };
    case "sh": case "bash": return { lang: "other", monaco: "shell" };
    case "sql": return { lang: "other", monaco: "sql" };
    default: return { lang: "other", monaco: "plaintext" };
  }
}

// ─── Repo coordinates ─────────────────────────────────────────────────────────

export interface RepoRef {
  /** "owner/name" */
  repo: string;
  /** Branch or sha. Defaults to the repo's default branch when omitted. */
  ref?: string;
}

function splitRepo(full: string): { owner: string; repo: string } {
  const [owner, repo] = String(full || "").split("/");
  if (!owner || !repo) {
    throw new Error(`Repositório inválido: "${full}". Use o formato "owner/nome".`);
  }
  return { owner, repo };
}

// ─── Read helpers (workspace = cloned repo) ───────────────────────────────────

/** List repositories accessible to this installation. */
export async function listRepos(octokit: AnyOctokit): Promise<{ fullName: string; defaultBranch: string; private: boolean }[]> {
  const map = (r: any) => ({ fullName: r.full_name, defaultBranch: r.default_branch, private: r.private });
  try {
    // installation token
    const res = await octokit.request("GET /installation/repositories", { per_page: 100 });
    return (res.data.repositories ?? []).map(map);
  } catch {
    // user-to-server token (conta pessoal do aluno)
    const res = await octokit.request("GET /user/repos", { per_page: 100, sort: "updated", affiliation: "owner,collaborator,organization_member" });
    return (res.data ?? []).map(map);
  }
}

/**
 * Create a new repository (private by default; `isPrivate: false` = public). With a GitHub App INSTALLATION token this works for an
 * ORG installation (needs Administration:write); creating in a PERSONAL account
 * needs a user OAuth token (POST /user/repos is user-to-server) → surfaced clearly.
 */
export async function createRepo(octokit: AnyOctokit, p: { name: string; isPrivate?: boolean; org?: string }): Promise<{ fullName: string; defaultBranch: string; url: string }> {
  const payload = { name: p.name, private: p.isPrivate !== false, auto_init: true };
  try {
    const res = p.org
      ? await octokit.request("POST /orgs/{org}/repos", { org: p.org, ...payload })
      : await octokit.request("POST /user/repos", payload);
    return { fullName: res.data.full_name, defaultBranch: res.data.default_branch, url: res.data.html_url };
  } catch (e: any) {
    const status = e?.status;
    if (status === 403 || status === 404) {
      // status 403 nos dois casos: quem chama (Octa) distingue "falta permissão" de "GitHub fora"
      throw Object.assign(new Error(
        "O GitHub App não tem permissão para criar repositórios nesta conta. " +
        "Para criar: instale o App numa ORG e dê 'Administration: write', ou use a integração OAuth por usuário. " +
        "Por ora, crie o repo no GitHub e selecione-o aqui.",
      ), { status: 403 });
    }
    throw e;
  }
}

/** O repositório existe (e é visível para este token)? 404 = não; outros erros sobem. */
export async function repoExiste(octokit: AnyOctokit, fullName: string): Promise<boolean> {
  const { owner, repo } = splitRepo(fullName);
  try {
    await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
    return true;
  } catch (e: any) {
    if (e?.status === 404) return false;
    throw e;
  }
}

/**
 * Liga o GitHub Pages servindo `branch` na raiz. Se já estava ligado (409), lê o estado atual.
 * Recém-ligado o site ainda não existe por ~1 min: status "publicando" (não é erro).
 */
export async function habilitarPages(
  octokit: AnyOctokit,
  p: { repo: string; branch: string },
): Promise<{ url: string; status: "publicando" | "no_ar" }> {
  const { owner, repo } = splitRepo(p.repo);
  let data: any;
  try {
    data = (await octokit.request("POST /repos/{owner}/{repo}/pages", { owner, repo, source: { branch: p.branch, path: "/" } })).data;
  } catch (e: any) {
    if (e?.status !== 409) throw e;
    data = (await octokit.request("GET /repos/{owner}/{repo}/pages", { owner, repo })).data;
  }
  const url = typeof data?.html_url === "string" && data.html_url ? data.html_url : `https://${owner.toLowerCase()}.github.io/${repo}/`;
  return { url, status: data?.status === "built" ? "no_ar" : "publicando" };
}

async function resolveRef(octokit: AnyOctokit, owner: string, repo: string, ref?: string): Promise<string> {
  if (ref) return ref;
  const res = await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
  return res.data.default_branch;
}

/**
 * Read the full file tree (blobs only) for a ref. Bodies are NOT fetched here —
 * the UI fetches each file on open via readFile(), keeping payloads small.
 */
export async function readRepoTree(octokit: AnyOctokit, { repo, ref }: RepoRef): Promise<RepoFileMeta[]> {
  const { owner, repo: name } = splitRepo(repo);
  const resolved = await resolveRef(octokit, owner, name, ref);
  const res = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
    owner, repo: name, tree_sha: resolved, recursive: "1",
  });
  return (res.data.tree ?? [])
    .filter((n: any) => n.type === "blob")
    .map((n: any) => ({ path: n.path, size: n.size, ...mapPathToLang(n.path) }));
}

/** Read a single file's content (base64-decoded) plus its blob sha. */
export async function readFile(octokit: AnyOctokit, { repo, ref }: RepoRef, path: string): Promise<RepoFile> {
  const { owner, repo: name } = splitRepo(repo);
  const res = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner, repo: name, path, ...(ref ? { ref } : {}),
  });
  const data = res.data;
  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`"${path}" não é um arquivo.`);
  }
  const body = Buffer.from(data.content ?? "", data.encoding || "base64").toString("utf-8");
  return { path, body, sha: data.sha, ...mapPathToLang(path) };
}

// ─── Write helpers ────────────────────────────────────────────────────────────

export async function createBranch(octokit: AnyOctokit, p: { repo: string; name: string; from?: string }): Promise<{ ref: string; sha: string }> {
  const { owner, repo } = splitRepo(p.repo);
  const base = await resolveRef(octokit, owner, repo, p.from);
  const baseRef = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", { owner, repo, ref: `heads/${base}` });
  const sha = baseRef.data.object.sha;
  const created = await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
    owner, repo, ref: `refs/heads/${p.name}`, sha,
  });
  return { ref: created.data.ref, sha };
}

/**
 * Multi-file commit to a working branch via the git data API
 * (blobs → tree → commit → update ref). The route guards that `branch` is NOT
 * the default branch unless the caller cleared `push_default`.
 */
export async function commitFiles(
  octokit: AnyOctokit,
  p: { repo: string; branch: string; message: string; files: { path: string; content: string }[] },
): Promise<{ commitSha: string; branch: string }> {
  const { owner, repo } = splitRepo(p.repo);
  if (!p.files?.length) throw new Error("Nenhum arquivo para commitar.");

  const refData = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", { owner, repo, ref: `heads/${p.branch}` });
  const latestCommitSha = refData.data.object.sha;
  const commitData = await octokit.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", { owner, repo, commit_sha: latestCommitSha });
  const baseTreeSha = commitData.data.tree.sha;

  const blobs = await Promise.all(
    p.files.map((f) =>
      octokit.request("POST /repos/{owner}/{repo}/git/blobs", { owner, repo, content: f.content, encoding: "utf-8" })
        .then((r: any) => ({ path: f.path, mode: "100644", type: "blob", sha: r.data.sha })),
    ),
  );

  const tree = await octokit.request("POST /repos/{owner}/{repo}/git/trees", { owner, repo, base_tree: baseTreeSha, tree: blobs });
  const commit = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
    owner, repo, message: p.message, tree: tree.data.sha, parents: [latestCommitSha],
  });
  await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", { owner, repo, ref: `heads/${p.branch}`, sha: commit.data.sha });
  return { commitSha: commit.data.sha, branch: p.branch };
}

/**
 * Generalized commit via the git data API: upserts (create/update) AND deletes in
 * a single atomic commit. Deletions are expressed as tree entries with sha:null.
 */
export async function commitChanges(
  octokit: AnyOctokit,
  p: { repo: string; branch: string; message: string; upserts?: { path: string; content: string }[]; deletes?: string[] },
): Promise<{ commitSha: string; branch: string }> {
  const { owner, repo } = splitRepo(p.repo);
  const upserts = p.upserts ?? [];
  const deletes = p.deletes ?? [];
  if (!upserts.length && !deletes.length) throw new Error("Nada para alterar (sem upserts nem deletes).");

  const refData = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", { owner, repo, ref: `heads/${p.branch}` });
  const latestCommitSha = refData.data.object.sha;
  const commitData = await octokit.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", { owner, repo, commit_sha: latestCommitSha });
  const baseTreeSha = commitData.data.tree.sha;

  const upsertEntries = await Promise.all(
    upserts.map((f) =>
      octokit.request("POST /repos/{owner}/{repo}/git/blobs", { owner, repo, content: f.content, encoding: "utf-8" })
        .then((r: any) => ({ path: f.path, mode: "100644", type: "blob", sha: r.data.sha })),
    ),
  );
  // sha:null removes the path relative to base_tree.
  const deleteEntries = deletes.map((path) => ({ path, mode: "100644", type: "blob", sha: null }));

  const tree = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
    owner, repo, base_tree: baseTreeSha, tree: [...upsertEntries, ...deleteEntries],
  });
  const commit = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
    owner, repo, message: p.message, tree: tree.data.sha, parents: [latestCommitSha],
  });
  await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", { owner, repo, ref: `heads/${p.branch}`, sha: commit.data.sha });
  return { commitSha: commit.data.sha, branch: p.branch };
}

export async function deleteFile(octokit: AnyOctokit, p: { repo: string; branch: string; path: string; message?: string }): Promise<{ commitSha: string }> {
  const r = await commitChanges(octokit, { repo: p.repo, branch: p.branch, message: p.message || `chore: remove ${p.path}`, deletes: [p.path] });
  return { commitSha: r.commitSha };
}

export async function renameFile(octokit: AnyOctokit, p: { repo: string; branch: string; from: string; to: string; message?: string }): Promise<{ commitSha: string }> {
  // Read the current content from the working branch, then move it atomically.
  const src = await readFile(octokit, { repo: p.repo, ref: p.branch }, p.from);
  const r = await commitChanges(octokit, {
    repo: p.repo, branch: p.branch, message: p.message || `chore: rename ${p.from} → ${p.to}`,
    upserts: [{ path: p.to, content: src.body }], deletes: [p.from],
  });
  return { commitSha: r.commitSha };
}

export async function openPR(octokit: AnyOctokit, p: { repo: string; head: string; base?: string; title: string; body?: string }): Promise<{ number: number; url: string }> {
  const { owner, repo } = splitRepo(p.repo);
  const base = p.base || (await resolveRef(octokit, owner, repo));
  const res = await octokit.request("POST /repos/{owner}/{repo}/pulls", { owner, repo, head: p.head, base, title: p.title, body: p.body ?? "" });
  return { number: res.data.number, url: res.data.html_url };
}

export async function commentPR(octokit: AnyOctokit, p: { repo: string; prNumber: number; body: string }): Promise<{ id: number }> {
  const { owner, repo } = splitRepo(p.repo);
  const res = await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", { owner, repo, issue_number: p.prNumber, body: p.body });
  return { id: res.data.id };
}

export async function createIssue(octokit: AnyOctokit, p: { repo: string; title: string; body?: string }): Promise<{ number: number; url: string }> {
  const { owner, repo } = splitRepo(p.repo);
  const res = await octokit.request("POST /repos/{owner}/{repo}/issues", { owner, repo, title: p.title, body: p.body ?? "" });
  return { number: res.data.number, url: res.data.html_url };
}

export async function editIssue(octokit: AnyOctokit, p: { repo: string; number: number; title?: string; body?: string; state?: "open" | "closed" }): Promise<{ number: number }> {
  const { owner, repo } = splitRepo(p.repo);
  await octokit.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
    owner, repo, issue_number: p.number,
    ...(p.title ? { title: p.title } : {}), ...(p.body ? { body: p.body } : {}), ...(p.state ? { state: p.state } : {}),
  });
  return { number: p.number };
}

export async function mergePR(octokit: AnyOctokit, p: { repo: string; prNumber: number; method?: "merge" | "squash" | "rebase" }): Promise<{ merged: boolean; sha?: string }> {
  const { owner, repo } = splitRepo(p.repo);
  const res = await octokit.request("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", { owner, repo, pull_number: p.prNumber, merge_method: p.method || "squash" });
  return { merged: !!res.data.merged, sha: res.data.sha };
}

export async function deleteBranch(octokit: AnyOctokit, p: { repo: string; name: string }): Promise<{ deleted: boolean }> {
  const { owner, repo } = splitRepo(p.repo);
  await octokit.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", { owner, repo, ref: `heads/${p.name}` });
  return { deleted: true };
}

// ─── Dispatcher ────────────────────────────────────────────────────────────────

export interface ExecuteParams {
  /** "owner/name" — required by every action except list_repos. */
  repo?: string;
  ref?: string;
  path?: string;
  /** rename destination path */
  to?: string;
  // repo / commit / branch
  org?: string;
  isPrivate?: boolean;
  branch?: string;
  from?: string;
  name?: string;
  message?: string;
  files?: { path: string; content: string }[];
  // pr / issue
  head?: string;
  base?: string;
  title?: string;
  body?: string;
  prNumber?: number;
  number?: number;
  state?: "open" | "closed";
  method?: "merge" | "squash" | "rebase";
}

/**
 * Run a cleared action against GitHub. The caller (route) is responsible for
 * gate enforcement; here we only map id → Octokit call.
 *
 * @throws GitHubNotConfiguredError when env/SDK are missing.
 */
export async function executeAction(
  octokit: AnyOctokit,
  actionId: string,
  params: ExecuteParams,
): Promise<{ actionId: string; result: unknown }> {
  const need = <T,>(v: T | undefined, label: string): T => {
    if (v === undefined || v === null || v === "") throw new Error(`Parâmetro obrigatório ausente: ${label}`);
    return v;
  };

  let result: unknown;
  switch (actionId) {
    case "list_repos": result = await listRepos(octokit); break;
    case "read_tree": result = await readRepoTree(octokit, { repo: need(params.repo, "repo"), ref: params.ref }); break;
    case "read_file": result = await readFile(octokit, { repo: need(params.repo, "repo"), ref: params.ref }, need(params.path, "path")); break;
    case "read_diff": throw new Error("read_diff ainda não implementado (Fase 2)."); // PR diff comparison
    case "list_issues": {
      const { owner, repo } = splitRepo(need(params.repo, "repo"));
      const res = await octokit.request("GET /repos/{owner}/{repo}/issues", { owner, repo, state: params.state || "open", per_page: 50 });
      result = (res.data ?? []).map((i: any) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url }));
      break;
    }
    case "create_repo": result = await createRepo(octokit, { name: need(params.name, "name"), isPrivate: params.isPrivate, org: params.org }); break;
    case "create_branch": result = await createBranch(octokit, { repo: need(params.repo, "repo"), name: need(params.name, "name"), from: params.from }); break;
    case "commit": result = await commitFiles(octokit, { repo: need(params.repo, "repo"), branch: need(params.branch, "branch"), message: need(params.message, "message"), files: need(params.files, "files") }); break;
    case "delete_file": result = await deleteFile(octokit, { repo: need(params.repo, "repo"), branch: need(params.branch, "branch"), path: need(params.path, "path"), message: params.message }); break;
    case "rename_file": result = await renameFile(octokit, { repo: need(params.repo, "repo"), branch: need(params.branch, "branch"), from: need(params.path, "path"), to: need(params.to, "to"), message: params.message }); break;
    case "open_pr": result = await openPR(octokit, { repo: need(params.repo, "repo"), head: need(params.head, "head"), base: params.base, title: need(params.title, "title"), body: params.body }); break;
    case "comment_pr": result = await commentPR(octokit, { repo: need(params.repo, "repo"), prNumber: need(params.prNumber, "prNumber"), body: need(params.body, "body") }); break;
    case "create_issue": result = await createIssue(octokit, { repo: need(params.repo, "repo"), title: need(params.title, "title"), body: params.body }); break;
    case "edit_issue": result = await editIssue(octokit, { repo: need(params.repo, "repo"), number: need(params.number, "number"), title: params.title, body: params.body, state: params.state }); break;
    case "merge_pr": result = await mergePR(octokit, { repo: need(params.repo, "repo"), prNumber: need(params.prNumber, "prNumber"), method: params.method }); break;
    case "delete_branch": result = await deleteBranch(octokit, { repo: need(params.repo, "repo"), name: need(params.name, "name") }); break;
    case "push_default": result = await commitFiles(octokit, { repo: need(params.repo, "repo"), branch: need(params.branch, "branch"), message: need(params.message, "message"), files: need(params.files, "files") }); break;
    case "force_push": throw new Error("force_push ainda não implementado (Fase 2 — requer reescrita de ref via git data API).");
    default: throw new Error(`Ação sem implementação de execução: ${actionId}`);
  }

  return { actionId, result };
}

export { GitHubNotConfiguredError };
