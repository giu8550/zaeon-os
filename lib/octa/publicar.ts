/**
 * Publicar o projeto do Octa no GitHub DO ALUNO: repositório público na conta dele + commit dos
 * arquivos + GitHub Pages. Um projeto ↔ um repositório: republicar commita no mesmo repo.
 *
 * Regras que esta função garante:
 * - Nunca escreve num repositório que o Octa não criou (nome ocupado → slug-2, slug-3…).
 * - Limites por aluno por dia (LIMITES); publicação que falha não conta.
 * - O token do aluno só existe dentro do octokit que `octokitDoAluno` devolve. Nada daqui o lê;
 *   erro do GitHub vira um código fixo e o log leva só o status HTTP — a mensagem/objeto do erro
 *   (que pode ecoar header/URL com o token) nunca sai daqui.
 */
import { lerProjeto, contarPublicacoesHoje, gravarDestinoPublicado, registrarPublicacao, type ProjetosDb } from "./projetos";
import { createRepo, commitFiles, habilitarPages, repoExiste } from "@/lib/projects/github-service";

type AnyOctokit = any;

export const LIMITES = { publicacoesDia: 10, reposNovosDia: 3 } as const;

const MENSAGEM_PADRAO = "Publicado pelo Octa (Zaeon)";
const MAX_TENTATIVAS_NOME = 20; // slug, slug-2 … slug-20

export type ErroPublicar =
  | "github_reconectar" | "limite_publicacoes" | "limite_repos" | "aviso_publico_pendente" | "falha_github"
  | "projeto_inexistente";

export type ResultadoPublicar =
  | { ok: true; repoUrl: string; pagesUrl: string; status: "publicando" | "no_ar" }
  | { ok: false; erro: ErroPublicar };

export type DepsPublicar = {
  db: ProjetosDb;
  octokitDoAluno: (email: string) => Promise<AnyOctokit | null>;
  agora?: () => Date;
};

function statusHttp(e: unknown): number | undefined {
  const s = (e as any)?.status;
  return typeof s === "number" ? s : undefined;
}

// Primeiro nome livre na conta do aluno. Repositório que já existe é só pulado (nem lido além do GET).
async function criarRepoLivre(octokit: AnyOctokit, slug: string): Promise<{ fullName: string; branch: string }> {
  const login = (await octokit.request("GET /user")).data?.login;
  if (typeof login !== "string" || !login) throw new Error("login do GitHub indisponível");
  for (let i = 1; i <= MAX_TENTATIVAS_NOME; i++) {
    const nome = i === 1 ? slug : `${slug}-${i}`;
    if (await repoExiste(octokit, `${login}/${nome}`)) continue;
    try {
      const r = await createRepo(octokit, { name: nome, isPrivate: false });
      return { fullName: r.fullName, branch: r.defaultBranch || "main" };
    } catch (e) {
      if (statusHttp(e) === 422) continue; // criado por outro caminho entre o GET e o POST
      throw e;
    }
  }
  throw new Error("sem nome livre para o repositório");
}

export async function publicarProjeto(
  deps: DepsPublicar,
  p: { userId: string; email: string; projetoId: string; mensagem?: string },
): Promise<ResultadoPublicar> {
  const { db } = deps;
  const agora = deps.agora?.() ?? new Date();

  const projeto = await lerProjeto(db, p.userId, p.projetoId);
  if (!projeto) return { ok: false, erro: "projeto_inexistente" };
  if (!projeto.avisoPublicoAceito) return { ok: false, erro: "aviso_publico_pendente" };

  // só o repositório que o próprio Octa criou para este projeto é reaproveitado
  const repoDoOcta = projeto.repoCriadoPeloOcta && projeto.repoFullName ? projeto.repoFullName : null;
  const hoje = await contarPublicacoesHoje(db, p.userId, agora);
  if (hoje.publicacoes >= LIMITES.publicacoesDia) return { ok: false, erro: "limite_publicacoes" };
  if (!repoDoOcta && hoje.reposNovos >= LIMITES.reposNovosDia) return { ok: false, erro: "limite_repos" };

  let octokit: AnyOctokit | null;
  try { octokit = await deps.octokitDoAluno(p.email); } catch { octokit = null; }
  if (!octokit) return { ok: false, erro: "github_reconectar" };

  let repoNovo = false;
  try {
    let fullName: string;
    let branch: string;
    if (repoDoOcta) {
      fullName = repoDoOcta;
      const [owner, repo] = fullName.split("/");
      branch = (await octokit.request("GET /repos/{owner}/{repo}", { owner, repo })).data?.default_branch || "main";
    } else {
      ({ fullName, branch } = await criarRepoLivre(octokit, projeto.slug));
      repoNovo = true;
      // grava já: se o commit falhar, a próxima tentativa reaproveita este repo em vez de abrir slug-2
      await gravarDestinoPublicado(db, p.userId, projeto.id, { repoFullName: fullName, repoCriadoPeloOcta: true, pagesUrl: null });
    }

    const files = Object.entries(projeto.arquivos ?? {}).map(([path, content]) => ({ path, content: String(content) }));
    const mensagem = String(p.mensagem ?? "").trim().slice(0, 200) || MENSAGEM_PADRAO;
    await commitFiles(octokit, { repo: fullName, branch, message: mensagem, files });

    const pages = await habilitarPages(octokit, { repo: fullName, branch });
    await gravarDestinoPublicado(db, p.userId, projeto.id, { pagesUrl: pages.url });
    await registrarPublicacao(db, { userId: p.userId, projetoId: projeto.id, ok: true, repoNovo, em: agora });
    return { ok: true, repoUrl: `https://github.com/${fullName}`, pagesUrl: pages.url, status: pages.status };
  } catch (e) {
    const status = statusHttp(e);
    // 401 = token revogado/vencido no meio do caminho → o aluno reconecta
    const erro: ErroPublicar = status === 401 ? "github_reconectar" : "falha_github";
    if (erro === "falha_github") console.warn("[octa/publicar] falha no GitHub", { status: status ?? null });
    try { await registrarPublicacao(db, { userId: p.userId, projetoId: projeto.id, ok: false, repoNovo, em: agora }); } catch { /* registro é melhor-esforço */ }
    return { ok: false, erro };
  }
}
