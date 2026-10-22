/**
 * Publicar o projeto do Octa no GitHub DO ALUNO: repositório público na conta dele + commit dos
 * arquivos + GitHub Pages. Um projeto ↔ um repositório: republicar commita no mesmo repo.
 *
 * Regras que esta função garante:
 * - Nunca escreve num repositório que o Octa não criou (nome ocupado → slug-2, slug-3…).
 * - O repositório espelha o projeto: cada publicação remove do repo o que não está no projeto
 *   (inclusive o README.md do auto_init), senão arquivo apagado continuaria no site público.
 * - Só caminhos de site estático vão para o GitHub (caminhoPublicavel): nada de `.github/workflows`,
 *   dotfiles, `..` ou extensão fora da lista. Os pulados voltam em `ignorados` (só os caminhos).
 * - Regra anti-marca: nenhum arquivo de texto publicado menciona a marca de origem do estilo do projeto (marca +
 *   aliases, pelo marcador zaeon-estilo do DESIGN.md) — no FONTE, não só no texto visível: comentários, atributos,
 *   strings de JS; CSS só nos comentários e em `content:` (regra completa em marcaNoFonte, secoes/render.ts).
 *   Vale pro botão Publicar da IDE e pra tool octa_publicar.
 *   Devolve `marca_no_conteudo` + só a palavra; nada do conteúdo.
 * - Repo do Octa apagado pelo aluno (GET 404): o destino é limpo e o caminho é o de repo novo (conta no limite).
 * - Publicar continua só ESTÁTICO: projeto React (tipoProjeto === "react") devolve `tipo_nao_publicavel` antes de
 *   qualquer chamada ao GitHub (nem o octokit é pedido) e não conta no limite do dia.
 * - Limites por aluno por dia (LIMITES); publicação que falha não conta.
 * - O token do aluno só existe dentro do octokit que `octokitDoAluno` devolve. Nada daqui o lê;
 *   erro do GitHub vira um código fixo e o log leva só o status HTTP — a mensagem/objeto do erro
 *   (que pode ecoar header/URL com o token) nunca sai daqui.
 */
import { lerProjeto, contarPublicacoesHoje, gravarDestinoPublicado, registrarPublicacao, type ProjetosDb } from "./projetos";
import { createRepo, commitChanges, habilitarPages, readRepoTree, repoExiste } from "@/lib/projects/github-service";
import { estiloDoProjeto, palavrasDaMarca } from "./design/indice";
import { marcaNoFonte } from "./secoes/render";
import { tipoProjeto } from "./tipoProjeto";

type AnyOctokit = any;

export const LIMITES = { publicacoesDia: 10, reposNovosDia: 3 } as const;

const MENSAGEM_PADRAO = "Publicado pelo Octa (Zaeon)";
const MAX_TENTATIVAS_NOME = 20; // slug, slug-2 … slug-20

export type ErroPublicar =
  | "github_reconectar" | "limite_publicacoes" | "limite_repos" | "aviso_publico_pendente" | "falha_github"
  | "projeto_inexistente" | "sem_arquivos_publicaveis" | "marca_no_conteudo" | "tipo_nao_publicavel";

export type ResultadoPublicar =
  | { ok: true; repoUrl: string; pagesUrl: string; status: "publicando" | "no_ar"; ignorados: string[] }
  | { ok: false; erro: Exclude<ErroPublicar, "marca_no_conteudo"> }
  /** `palavra` = a forma do nome da marca que apareceu (só ela). */
  | { ok: false; erro: "marca_no_conteudo"; palavra: string };

export type DepsPublicar = {
  db: ProjetosDb;
  octokitDoAluno: (email: string) => Promise<AnyOctokit | null>;
  agora?: () => Date;
};

const EXTENSOES_SITE = new Set([
  "html", "htm", "css", "js", "mjs", "json", "svg", "png", "jpg", "jpeg", "gif", "webp", "ico",
  "txt", "md", "xml", "webmanifest", "woff", "woff2",
]);
const MAX_CAMINHO = 200;

/**
 * Caminho que pode virar arquivo do repositório público: relativo, sem `..`, sem segmento que
 * comece com "." (`.github/`, `.env`, dotfiles), sem segmento vazio, sem `\` nem caractere de
 * controle, até 200 caracteres, com extensão de site estático e que não seja DESIGN.md (em qualquer pasta).
 */
export function caminhoPublicavel(caminho: string): boolean {
  if (typeof caminho !== "string" || !caminho || caminho.length > MAX_CAMINHO) return false;
  if (/[\\\x00-\x1f\x7f]/.test(caminho)) return false;
  const segmentos = caminho.split("/");
  if (segmentos.some((s) => !s || s.startsWith("."))) return false; // pega "/x", "a//b", "..", ".env"
  // DESIGN.md nunca vai pro repo público: carrega o nome da marca de origem e o marcador zaeon-estilo
  if (segmentos[segmentos.length - 1].toLowerCase() === "design.md") return false;
  const ext = segmentos[segmentos.length - 1].split(".");
  return ext.length > 1 && EXTENSOES_SITE.has(ext[ext.length - 1].toLowerCase());
}

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
  // app React não vira GitHub Pages nesta fase (precisaria de build): pára aqui, antes de tocar no GitHub
  if (tipoProjeto(projeto.arquivos) === "react") return { ok: false, erro: "tipo_nao_publicavel" };
  if (!projeto.avisoPublicoAceito) return { ok: false, erro: "aviso_publico_pendente" };

  const files: { path: string; content: string }[] = [];
  const ignorados: string[] = [];
  for (const [path, content] of Object.entries(projeto.arquivos ?? {})) {
    if (caminhoPublicavel(path)) files.push({ path, content: String(content) });
    else ignorados.push(path);
  }
  if (!files.length) return { ok: false, erro: "sem_arquivos_publicaveis" };

  const marcas = palavrasDaMarca(estiloDoProjeto(projeto.arquivos)?.estilo);
  if (marcas.length) {
    for (const f of files) {
      const palavra = marcaNoFonte(f.path, f.content, marcas); // fonte inteiro, não só o texto visível
      if (palavra) return { ok: false, erro: "marca_no_conteudo", palavra };
    }
  }

  // só o repositório que o próprio Octa criou para este projeto é reaproveitado
  let repoDoOcta = projeto.repoCriadoPeloOcta && projeto.repoFullName ? projeto.repoFullName : null;
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
    let existente: { branch: string } | null = null;
    if (repoDoOcta) {
      const [owner, repo] = repoDoOcta.split("/");
      try {
        existente = { branch: (await octokit.request("GET /repos/{owner}/{repo}", { owner, repo })).data?.default_branch || "main" };
      } catch (e) {
        if (statusHttp(e) !== 404) throw e;
        // o aluno apagou o repo: esquece o destino e segue como projeto novo (o nome livre é procurado de novo)
        await gravarDestinoPublicado(db, p.userId, projeto.id, { repoFullName: null, repoCriadoPeloOcta: false, pagesUrl: null });
        repoDoOcta = null;
        if (hoje.reposNovos >= LIMITES.reposNovosDia) return { ok: false, erro: "limite_repos" };
      }
    }
    if (repoDoOcta && existente) {
      fullName = repoDoOcta;
      branch = existente.branch;
    } else {
      ({ fullName, branch } = await criarRepoLivre(octokit, projeto.slug));
      repoNovo = true;
      // grava já: se o commit falhar, a próxima tentativa reaproveita este repo em vez de abrir slug-2
      await gravarDestinoPublicado(db, p.userId, projeto.id, { repoFullName: fullName, repoCriadoPeloOcta: true, pagesUrl: null });
    }

    const mensagem = String(p.mensagem ?? "").trim().slice(0, 200) || MENSAGEM_PADRAO;
    // espelho: o que está no repo e não está no que publicamos agora sai no mesmo commit
    const publicados = new Set(files.map((f) => f.path));
    const noRepo = await readRepoTree(octokit, { repo: fullName, ref: branch });
    const deletes = noRepo.map((f) => f.path).filter((path) => !publicados.has(path));
    await commitChanges(octokit, { repo: fullName, branch, message: mensagem, upserts: files, deletes });

    const pages = await habilitarPages(octokit, { repo: fullName, branch });
    await gravarDestinoPublicado(db, p.userId, projeto.id, { pagesUrl: pages.url });
    await registrarPublicacao(db, { userId: p.userId, projetoId: projeto.id, ok: true, repoNovo, em: agora });
    return { ok: true, repoUrl: `https://github.com/${fullName}`, pagesUrl: pages.url, status: pages.status, ignorados };
  } catch (e) {
    const status = statusHttp(e);
    // 401 = token revogado/vencido no meio do caminho → o aluno reconecta
    const erro: ErroPublicar = status === 401 ? "github_reconectar" : "falha_github";
    if (erro === "falha_github") console.warn("[octa/publicar] falha no GitHub", { status: status ?? null });
    try { await registrarPublicacao(db, { userId: p.userId, projetoId: projeto.id, ok: false, repoNovo, em: agora }); } catch { /* registro é melhor-esforço */ }
    return { ok: false, erro };
  }
}
