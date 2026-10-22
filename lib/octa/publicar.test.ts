import { describe, it, expect, vi, afterEach } from "vitest";
import { publicarProjeto, LIMITES } from "./publicar";
import type { ProjetosDb } from "./projetos";

const ID = "a".repeat(24);
const SEGREDO = "ghu_SEGREDO123";
const AGORA = new Date("2026-10-21T15:00:00Z"); // 12:00 em Fortaleza

type Pub = { userId: string; projetoId: string; ok: boolean; repoNovo: boolean; em: Date };

// dublê em memória no formato dos delegates do Prisma que a lib usa
function dbFalso(projeto: Partial<any> = {}, pubs: Pub[] = []) {
  const projetos: any[] = [{
    id: ID, userId: "u1", nome: "Confeitaria", slug: "confeitaria",
    arquivos: { "index.html": "<h1>oi</h1>", "estilo.css": "h1{}" }, designId: null,
    permissao: "auto", avisoPublicoAceito: true,
    repoFullName: null, repoCriadoPeloOcta: false, pagesUrl: null, ...projeto,
  }];
  const db: ProjetosDb = {
    octaProjeto: {
      create: async () => { throw new Error("não usado"); },
      findFirst: async ({ where }: any) => projetos.find((p) => p.id === where.id && p.userId === where.userId) ?? null,
      findMany: async () => projetos,
      update: async ({ where, data }: any) => { const p = projetos.find((x) => x.id === where.id); Object.assign(p, data); return p; },
      delete: async () => { throw new Error("não usado"); },
    },
    octaPublicacao: {
      findMany: async ({ where }: any) => pubs.filter((p) => p.userId === where.userId && p.ok === where.ok && p.em >= where.em.gte),
      create: async ({ data }: any) => { pubs.push(data); return data; },
    },
  };
  return { db, projetos, pubs };
}

type Chamada = { rota: string; params: any };

// octokit dublê: grava as chamadas e responde como a API do GitHub
function octoFalso(o: { existentes?: string[]; pages409?: { status: string } ; falhar?: (rota: string, params: any) => any } = {}) {
  const chamadas: Chamada[] = [];
  const existentes = new Set(o.existentes ?? []);
  let n = 0;
  const request = async (rota: string, params: any = {}) => {
    chamadas.push({ rota, params });
    const erro = o.falhar?.(rota, params);
    if (erro) throw erro;
    const full = `${params.owner}/${params.repo}`;
    switch (rota) {
      case "GET /user": return { data: { login: "aluno" } };
      case "GET /repos/{owner}/{repo}":
        if (existentes.has(full)) return { data: { full_name: full } };
        throw Object.assign(new Error("Not Found"), { status: 404 });
      case "POST /user/repos":
        existentes.add(`aluno/${params.name}`);
        return { data: { full_name: `aluno/${params.name}`, default_branch: "main", html_url: `https://github.com/aluno/${params.name}` } };
      case "GET /repos/{owner}/{repo}/git/ref/{ref}": return { data: { object: { sha: "c0" } } };
      case "GET /repos/{owner}/{repo}/git/commits/{commit_sha}": return { data: { tree: { sha: "t0" } } };
      case "POST /repos/{owner}/{repo}/git/blobs": return { data: { sha: `b${++n}` } };
      case "POST /repos/{owner}/{repo}/git/trees": return { data: { sha: "t1" } };
      case "POST /repos/{owner}/{repo}/git/commits": return { data: { sha: "c1" } };
      case "PATCH /repos/{owner}/{repo}/git/refs/{ref}": return { data: {} };
      case "POST /repos/{owner}/{repo}/pages":
        if (o.pages409) throw Object.assign(new Error("Conflict"), { status: 409 });
        return { data: { html_url: `https://aluno.github.io/${params.repo}/`, status: null } };
      case "GET /repos/{owner}/{repo}/pages":
        return { data: { html_url: `https://aluno.github.io/${params.repo}/`, status: o.pages409?.status ?? "building" } };
      default: throw new Error(`rota inesperada: ${rota}`);
    }
  };
  return { octokit: { request }, chamadas };
}

const P = { userId: "u1", email: "a@b.c", projetoId: ID };
const deps = (db: ProjetosDb, octokit: any) => ({ db, octokitDoAluno: async () => octokit, agora: () => AGORA });
const escritas = (cs: Chamada[]) => cs.filter((c) => !c.rota.startsWith("GET "));
const hoje = (ok: boolean, repoNovo: boolean): Pub => ({ userId: "u1", projetoId: "x", ok, repoNovo, em: new Date("2026-10-21T12:00:00Z") });

afterEach(() => vi.restoreAllMocks());

describe("publicarProjeto", () => {
  it("primeira publicação: repo público slug, commit de todos os arquivos em main, Pages e registro", async () => {
    const { db, projetos, pubs } = dbFalso();
    const { octokit, chamadas } = octoFalso();
    const r = await publicarProjeto(deps(db, octokit), P);
    expect(r).toEqual({ ok: true, repoUrl: "https://github.com/aluno/confeitaria", pagesUrl: "https://aluno.github.io/confeitaria/", status: "publicando" });

    const criar = chamadas.find((c) => c.rota === "POST /user/repos")!;
    expect(criar.params).toMatchObject({ name: "confeitaria", private: false, auto_init: true });
    const blobs = chamadas.filter((c) => c.rota === "POST /repos/{owner}/{repo}/git/blobs").map((c) => c.params.content);
    expect(blobs.sort()).toEqual(["<h1>oi</h1>", "h1{}"]);
    const arvore = chamadas.find((c) => c.rota === "POST /repos/{owner}/{repo}/git/trees")!;
    expect(arvore.params.tree.map((t: any) => t.path).sort()).toEqual(["estilo.css", "index.html"]);
    expect(chamadas.find((c) => c.rota === "POST /repos/{owner}/{repo}/git/commits")!.params.message).toBe("Publicado pelo Octa (Zaeon)");
    expect(chamadas.find((c) => c.rota === "PATCH /repos/{owner}/{repo}/git/refs/{ref}")!.params).toMatchObject({ owner: "aluno", repo: "confeitaria", ref: "heads/main" });
    expect(chamadas.find((c) => c.rota === "POST /repos/{owner}/{repo}/pages")!.params).toMatchObject({ source: { branch: "main", path: "/" } });

    expect(projetos[0]).toMatchObject({ repoFullName: "aluno/confeitaria", repoCriadoPeloOcta: true, pagesUrl: "https://aluno.github.io/confeitaria/" });
    expect(pubs).toEqual([{ userId: "u1", projetoId: ID, ok: true, repoNovo: true, em: AGORA }]);
  });

  it("mensagem do commit pode vir do aluno", async () => {
    const { db } = dbFalso();
    const { octokit, chamadas } = octoFalso();
    await publicarProjeto(deps(db, octokit), { ...P, mensagem: "nova vitrine" });
    expect(chamadas.find((c) => c.rota === "POST /repos/{owner}/{repo}/git/commits")!.params.message).toBe("nova vitrine");
  });

  it("republicar: não cria repositório; commita no repoFullName salvo", async () => {
    const { db, pubs } = dbFalso({ repoFullName: "aluno/confeitaria", repoCriadoPeloOcta: true, pagesUrl: "https://aluno.github.io/confeitaria/" });
    const { octokit, chamadas } = octoFalso({ existentes: ["aluno/confeitaria"], pages409: { status: "built" } });
    const r = await publicarProjeto(deps(db, octokit), P);
    expect(r).toMatchObject({ ok: true, repoUrl: "https://github.com/aluno/confeitaria", status: "no_ar" });
    expect(chamadas.some((c) => c.rota === "POST /user/repos")).toBe(false);
    expect(escritas(chamadas).filter((c) => c.rota.includes("{owner}")).every((c) => c.params.owner === "aluno" && c.params.repo === "confeitaria")).toBe(true);
    expect(pubs[0]).toMatchObject({ ok: true, repoNovo: false });
  });

  it("nome ocupado por repositório que não é do Octa: cria slug-2 e não escreve no antigo", async () => {
    const { db, projetos } = dbFalso();
    const { octokit, chamadas } = octoFalso({ existentes: ["aluno/confeitaria"] });
    const r = await publicarProjeto(deps(db, octokit), P);
    expect(r).toMatchObject({ ok: true, repoUrl: "https://github.com/aluno/confeitaria-2" });
    expect(chamadas.find((c) => c.rota === "POST /user/repos")!.params.name).toBe("confeitaria-2");
    expect(escritas(chamadas).some((c) => c.params.repo === "confeitaria")).toBe(false);
    expect(projetos[0]).toMatchObject({ repoFullName: "aluno/confeitaria-2", repoCriadoPeloOcta: true });
  });

  it("repoFullName salvo que o Octa não criou nunca recebe escrita", async () => {
    const { db, projetos } = dbFalso({ repoFullName: "aluno/confeitaria", repoCriadoPeloOcta: false });
    const { octokit, chamadas } = octoFalso({ existentes: ["aluno/confeitaria"] });
    const r = await publicarProjeto(deps(db, octokit), P);
    expect(r).toMatchObject({ ok: true, repoUrl: "https://github.com/aluno/confeitaria-2" });
    expect(escritas(chamadas).some((c) => c.params.repo === "confeitaria")).toBe(false);
    expect(projetos[0].repoFullName).toBe("aluno/confeitaria-2");
  });

  it("Pages 409: usa a URL do GET; status no_ar se built, senão publicando", async () => {
    for (const [st, esperado] of [["built", "no_ar"], ["building", "publicando"]] as const) {
      const { db } = dbFalso();
      const { octokit, chamadas } = octoFalso({ pages409: { status: st } });
      const r = await publicarProjeto(deps(db, octokit), P);
      expect(r).toEqual({ ok: true, repoUrl: "https://github.com/aluno/confeitaria", pagesUrl: "https://aluno.github.io/confeitaria/", status: esperado });
      expect(chamadas.some((c) => c.rota === "GET /repos/{owner}/{repo}/pages")).toBe(true);
    }
  });

  it("sem avisoPublicoAceito: aviso_publico_pendente e zero chamadas ao GitHub", async () => {
    const { db, pubs } = dbFalso({ avisoPublicoAceito: false });
    const fabrica = vi.fn(async () => octoFalso().octokit);
    const r = await publicarProjeto({ db, octokitDoAluno: fabrica, agora: () => AGORA }, P);
    expect(r).toEqual({ ok: false, erro: "aviso_publico_pendente" });
    expect(fabrica).not.toHaveBeenCalled();
    expect(pubs).toEqual([]);
  });

  it("10 publicações ok hoje: limite_publicacoes (falhas não contam)", async () => {
    const dez = Array.from({ length: LIMITES.publicacoesDia }, () => hoje(true, false));
    const { db } = dbFalso({}, dez);
    const { octokit, chamadas } = octoFalso();
    expect(await publicarProjeto(deps(db, octokit), P)).toEqual({ ok: false, erro: "limite_publicacoes" });
    expect(chamadas).toEqual([]);

    const noveEFalhas = [...dez.slice(1), hoje(false, true), hoje(false, false)];
    const b = dbFalso({}, noveEFalhas);
    expect(await publicarProjeto(deps(b.db, octoFalso().octokit), P)).toMatchObject({ ok: true });
  });

  it("3 repositórios novos hoje e projeto sem repositório: limite_repos", async () => {
    const tres = Array.from({ length: LIMITES.reposNovosDia }, () => hoje(true, true));
    const { db } = dbFalso({}, tres);
    const { octokit, chamadas } = octoFalso();
    expect(await publicarProjeto(deps(db, octokit), P)).toEqual({ ok: false, erro: "limite_repos" });
    expect(chamadas).toEqual([]);
    // com repositório do Octa já salvo, republicar não gasta repo novo
    const b = dbFalso({ repoFullName: "aluno/confeitaria", repoCriadoPeloOcta: true }, [...tres]);
    expect(await publicarProjeto(deps(b.db, octoFalso({ existentes: ["aluno/confeitaria"] }).octokit), P)).toMatchObject({ ok: true });
  });

  it("octokitDoAluno → null: github_reconectar", async () => {
    const { db } = dbFalso();
    expect(await publicarProjeto({ db, octokitDoAluno: async () => null, agora: () => AGORA }, P)).toEqual({ ok: false, erro: "github_reconectar" });
  });

  it("401 no meio da publicação (token revogado): github_reconectar", async () => {
    const { db } = dbFalso();
    const { octokit } = octoFalso({ falhar: (rota) => rota === "POST /repos/{owner}/{repo}/git/blobs" ? Object.assign(new Error("Bad credentials"), { status: 401 }) : undefined });
    expect(await publicarProjeto(deps(db, octokit), P)).toEqual({ ok: false, erro: "github_reconectar" });
  });

  it("projeto inexistente ou de outro dono: projeto_inexistente, sem GitHub", async () => {
    const { db } = dbFalso();
    const fabrica = vi.fn(async () => octoFalso().octokit);
    expect(await publicarProjeto({ db, octokitDoAluno: fabrica, agora: () => AGORA }, { ...P, userId: "u2" })).toEqual({ ok: false, erro: "projeto_inexistente" });
    expect(fabrica).not.toHaveBeenCalled();
  });

  it("falha do GitHub com o token na mensagem: falha_github, token em lugar nenhum, registra ok:false", async () => {
    const logs: string[] = [];
    for (const m of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, m).mockImplementation((...a: any[]) => { logs.push(a.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" ")); });
    }
    const { db, pubs, projetos } = dbFalso();
    const erro = Object.assign(new Error(`Server Error: token ${SEGREDO}`), {
      status: 500, request: { url: "https://api.github.com/x", headers: { authorization: `token ${SEGREDO}` } },
    });
    const { octokit } = octoFalso({ falhar: (rota) => rota === "POST /repos/{owner}/{repo}/git/trees" ? erro : undefined });
    const r = await publicarProjeto(deps(db, octokit), P);
    expect(r).toEqual({ ok: false, erro: "falha_github" });
    expect(JSON.stringify(r)).not.toContain(SEGREDO);
    expect(logs.join("\n")).not.toContain(SEGREDO);
    expect(JSON.stringify(projetos)).not.toContain(SEGREDO);
    expect(JSON.stringify(pubs)).not.toContain(SEGREDO);
    expect(pubs).toEqual([{ userId: "u1", projetoId: ID, ok: false, repoNovo: true, em: AGORA }]);
    // o repositório criado fica salvo: tentar de novo não abre confeitaria-2
    expect(projetos[0]).toMatchObject({ repoFullName: "aluno/confeitaria", repoCriadoPeloOcta: true });
  });

  it("fábrica do octokit que lança: github_reconectar sem vazar a mensagem", async () => {
    const { db } = dbFalso();
    const r = await publicarProjeto({ db, octokitDoAluno: async () => { throw new Error(SEGREDO); }, agora: () => AGORA }, P);
    expect(r).toEqual({ ok: false, erro: "github_reconectar" });
    expect(JSON.stringify(r)).not.toContain(SEGREDO);
  });
});
