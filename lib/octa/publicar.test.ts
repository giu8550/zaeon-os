import { describe, it, expect, vi, afterEach } from "vitest";
import { publicarProjeto, caminhoPublicavel, LIMITES } from "./publicar";
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
// `arvores`: o que já está no repo (por "owner/repo"); repo novo nasce com o README.md do auto_init.
// Cada commit aplica a árvore enviada (sha null = apaga), como o git data API com base_tree.
function octoFalso(o: { existentes?: string[]; arvores?: Record<string, string[]>; pages409?: { status: string } ; falhar?: (rota: string, params: any) => any } = {}) {
  const chamadas: Chamada[] = [];
  const existentes = new Set(o.existentes ?? []);
  const arvores = new Map<string, Set<string>>(Object.entries(o.arvores ?? {}).map(([k, v]) => [k, new Set(v)]));
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
        arvores.set(`aluno/${params.name}`, new Set(["README.md"]));
        return { data: { full_name: `aluno/${params.name}`, default_branch: "main", html_url: `https://github.com/aluno/${params.name}` } };
      case "GET /repos/{owner}/{repo}/git/ref/{ref}": return { data: { object: { sha: "c0" } } };
      case "GET /repos/{owner}/{repo}/git/commits/{commit_sha}": return { data: { tree: { sha: "t0" } } };
      case "POST /repos/{owner}/{repo}/git/blobs": return { data: { sha: `b${++n}` } };
      case "GET /repos/{owner}/{repo}/git/trees/{tree_sha}":
        return { data: { tree: [...(arvores.get(full) ?? [])].map((path) => ({ path, type: "blob", size: 1 })) } };
      case "POST /repos/{owner}/{repo}/git/trees": {
        const a = arvores.get(full) ?? new Set<string>();
        for (const t of params.tree) { if (t.sha === null) a.delete(t.path); else a.add(t.path); }
        arvores.set(full, a);
        return { data: { sha: "t1" } };
      }
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
  return { octokit: { request }, chamadas, arvores };
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
    expect(r).toEqual({ ok: true, repoUrl: "https://github.com/aluno/confeitaria", pagesUrl: "https://aluno.github.io/confeitaria/", status: "publicando", ignorados: [] });

    const criar = chamadas.find((c) => c.rota === "POST /user/repos")!;
    expect(criar.params).toMatchObject({ name: "confeitaria", private: false, auto_init: true });
    const blobs = chamadas.filter((c) => c.rota === "POST /repos/{owner}/{repo}/git/blobs").map((c) => c.params.content);
    expect(blobs.sort()).toEqual(["<h1>oi</h1>", "h1{}"]);
    const arvore = chamadas.find((c) => c.rota === "POST /repos/{owner}/{repo}/git/trees")!;
    expect(arvore.params.tree.filter((t: any) => t.sha).map((t: any) => t.path).sort()).toEqual(["estilo.css", "index.html"]);
    // o repo espelha o projeto: o README.md do auto_init sai (o projeto não tem um)
    expect(arvore.params.tree.filter((t: any) => t.sha === null).map((t: any) => t.path)).toEqual(["README.md"]);
    expect(chamadas.find((c) => c.rota === "POST /repos/{owner}/{repo}/git/commits")!.params.message).toBe("Publicado pelo Octa (Zaeon)");
    expect(chamadas.find((c) => c.rota === "PATCH /repos/{owner}/{repo}/git/refs/{ref}")!.params).toMatchObject({ owner: "aluno", repo: "confeitaria", ref: "heads/main" });
    expect(chamadas.find((c) => c.rota === "POST /repos/{owner}/{repo}/pages")!.params).toMatchObject({ source: { branch: "main", path: "/" } });

    expect(projetos[0]).toMatchObject({ repoFullName: "aluno/confeitaria", repoCriadoPeloOcta: true, pagesUrl: "https://aluno.github.io/confeitaria/" });
    expect(pubs).toEqual([{ userId: "u1", projetoId: ID, ok: true, repoNovo: true, em: AGORA }]);
  });

  it("projeto React: tipo_nao_publicavel antes de qualquer chamada ao GitHub (nem o octokit é pedido)", async () => {
    for (const arquivos of [
      { "index.html": "<div id=root></div>", "src/App.jsx": "export default () => null" }, // misto: index.html + App.jsx
      { "index.html": "", "package.json": JSON.stringify({ dependencies: { react: "^18.3.1" } }), "src/main.jsx": "" },
    ]) {
      const { db, pubs } = dbFalso({ arquivos });
      const { octokit, chamadas } = octoFalso();
      const octokitDoAluno = vi.fn(async () => octokit);
      const r = await publicarProjeto({ db, octokitDoAluno, agora: () => AGORA }, P);
      expect(r).toEqual({ ok: false, erro: "tipo_nao_publicavel" });
      expect(octokitDoAluno).not.toHaveBeenCalled();
      expect(chamadas).toHaveLength(0);
      expect(pubs).toHaveLength(0); // não conta no limite do dia
    }
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

  it("repo do Octa apagado pelo aluno (GET 404): limpa o destino e cria de novo, contando como repo novo", async () => {
    const { db, projetos, pubs } = dbFalso({ repoFullName: "aluno/confeitaria", repoCriadoPeloOcta: true, pagesUrl: "https://aluno.github.io/confeitaria/" });
    const { octokit, chamadas } = octoFalso(); // não existe mais
    const r = await publicarProjeto(deps(db, octokit), P);
    expect(r).toMatchObject({ ok: true, repoUrl: "https://github.com/aluno/confeitaria" });
    expect(chamadas.find((c) => c.rota === "POST /user/repos")!.params.name).toBe("confeitaria");
    expect(projetos[0]).toMatchObject({ repoFullName: "aluno/confeitaria", repoCriadoPeloOcta: true });
    expect(pubs[0]).toMatchObject({ ok: true, repoNovo: true });
  });

  it("repo do Octa apagado e já 3 repos novos hoje: limite_repos, destino limpo, nenhuma escrita", async () => {
    const { db, projetos } = dbFalso({ repoFullName: "aluno/confeitaria", repoCriadoPeloOcta: true, pagesUrl: "https://aluno.github.io/confeitaria/" }, [hoje(true, true), hoje(true, true), hoje(true, true)]);
    const { octokit, chamadas } = octoFalso();
    expect(await publicarProjeto(deps(db, octokit), P)).toEqual({ ok: false, erro: "limite_repos" });
    expect(escritas(chamadas)).toHaveLength(0);
    expect(projetos[0]).toMatchObject({ repoFullName: null, repoCriadoPeloOcta: false, pagesUrl: null });
  });

  it("repo do Octa com outro erro no GET (500): falha_github, destino mantido", async () => {
    const { db, projetos } = dbFalso({ repoFullName: "aluno/confeitaria", repoCriadoPeloOcta: true });
    const { octokit, chamadas } = octoFalso({ falhar: (rota) => (rota === "GET /repos/{owner}/{repo}" ? Object.assign(new Error("boom"), { status: 500 }) : null) });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await publicarProjeto(deps(db, octokit), P)).toEqual({ ok: false, erro: "falha_github" });
    expect(chamadas.some((c) => c.rota === "POST /user/repos")).toBe(false);
    expect(projetos[0].repoFullName).toBe("aluno/confeitaria");
  });

  it("anti-marca: .html publicado com o nome da marca do estilo → marca_no_conteudo com só a palavra, zero GitHub", async () => {
    const design = "<!-- zaeon-estilo: linear.app -->\n# Design System Inspired by Linear\n";
    const { db, pubs } = dbFalso({ arquivos: { "DESIGN.md": design, "index.html": "<html><body><h1>Feito no estilo Linear</h1></body></html>", "styles.css": "a{background:linear-gradient(red,blue)}" } });
    const { octokit, chamadas } = octoFalso();
    const fabrica = vi.fn(async () => octokit);
    const r = await publicarProjeto({ db, octokitDoAluno: fabrica, agora: () => AGORA }, P);
    expect(r).toEqual({ ok: false, erro: "marca_no_conteudo", palavra: "Linear" });
    expect(fabrica).not.toHaveBeenCalled();
    expect(chamadas).toHaveLength(0);
    expect(pubs).toHaveLength(0);
  });

  it("anti-marca usa os aliases e varre todo .html (sub-pasta); CSS com linear-gradient e estilo sem marcador passam", async () => {
    const verge = "<!-- zaeon-estilo: theverge -->\n# x\n";
    const { db } = dbFalso({ arquivos: { "DESIGN.md": verge, "index.html": "<h1>oi</h1>", "blog/post.html": "<body><p>como no TheVerge</p></body>" } });
    expect(await publicarProjeto(deps(db, octoFalso().octokit), P)).toEqual({ ok: false, erro: "marca_no_conteudo", palavra: "TheVerge" });

    const ok = dbFalso({ arquivos: { "DESIGN.md": "<!-- zaeon-estilo: linear.app -->\n# x\n", "index.html": "<body><p>cresce linearmente</p></body>", "styles.css": "a{background:linear-gradient(red,blue)}" } });
    expect(await publicarProjeto(deps(ok.db, octoFalso().octokit), P)).toMatchObject({ ok: true });
    const semMarcador = dbFalso({ arquivos: { "DESIGN.md": "# meu estilo\n", "index.html": "<body>Linear</body>" } });
    expect(await publicarProjeto(deps(semMarcador.db, octoFalso().octokit), P)).toMatchObject({ ok: true });
  });

  it("anti-marca varre o FONTE inteiro: comentário HTML, alt, CSS/JS com a marca bloqueiam; linear-gradient/easing não", async () => {
    const bugatti = "<!-- zaeon-estilo: bugatti -->\n# x\n";
    const caso = async (arquivos: Record<string, string>, design = bugatti) => {
      const { db, pubs } = dbFalso({ arquivos: { "DESIGN.md": design, ...arquivos } });
      const { octokit, chamadas } = octoFalso();
      const r = await publicarProjeto(deps(db, octokit), P);
      if (!r.ok) { expect(chamadas).toHaveLength(0); expect(pubs).toHaveLength(0); }
      return r;
    };
    const bloqueado = { ok: false, erro: "marca_no_conteudo", palavra: "Bugatti" };
    expect(await caso({ "index.html": "<html><body><p>oi</p>\n<!-- Footer (Estilo Bugatti) -->\n<footer>fim</footer></body></html>" })).toEqual(bloqueado);
    expect(await caso({ "index.html": '<html><body><img src="a.png" alt="Bugatti"></body></html>' })).toEqual(bloqueado);
    expect(await caso({ "index.html": "<html><head><style>/* paleta bugatti */ h1{color:red}</style></head><body>oi</body></html>" })).toEqual(bloqueado);
    expect(await caso({ "index.html": "<h1>oi</h1>", "styles.css": "/* tipo Bugatti */\nh1{color:red}" })).toEqual(bloqueado);
    expect(await caso({ "index.html": "<h1>oi</h1>", "app.js": "// carrossel estilo Bugatti\nconst x = 1;" })).toEqual(bloqueado);
    expect(await caso({ "index.html": "<h1>oi</h1>", "app.js": "document.title = 'Bugatti';" })).toEqual(bloqueado);
    expect(await caso({ "index.html": "<h1>oi</h1>", "manifest.webmanifest": '{"name":"Bugatti"}' })).toEqual(bloqueado);
    expect(await caso({ "index.html": "<h1>oi</h1>", "README.md": "Feito no estilo Bugatti" })).toEqual(bloqueado);

    // linear.app: funções/palavras-chave de CSS que colidem com a marca não contam
    const linear = "<!-- zaeon-estilo: linear.app -->\n# x\n";
    const limpo = await caso({
      "index.html": '<html><head><style>.h{background:linear-gradient(90deg,red,blue);transition:all .2s linear}</style></head><body><div style="background:linear-gradient(red,blue)">oi</div><script>el.animate([], { easing: "linear" }); const g = "repeating-linear-gradient(red, blue)";</script></body></html>',
      "styles.css": "a{background:linear-gradient(red,blue);transition:opacity 1s linear;animation-timing-function:linear}",
      "app.js": "el.style.transitionTimingFunction = 'linear';",
    }, linear);
    expect(limpo).toMatchObject({ ok: true });
    expect(await caso({ "index.html": "<h1>oi</h1>", "styles.css": "/* inspirado no Linear */ a{}" }, linear)).toEqual({ ok: false, erro: "marca_no_conteudo", palavra: "Linear" });
  });

  it("republicar sem um arquivo: o segundo commit apaga o que saiu do projeto", async () => {
    const { db, projetos } = dbFalso({ arquivos: { "index.html": "<h1>oi</h1>", "a.css": "h1{}" } });
    const { octokit, chamadas, arvores } = octoFalso();
    expect(await publicarProjeto(deps(db, octokit), P)).toMatchObject({ ok: true });
    expect([...arvores.get("aluno/confeitaria")!].sort()).toEqual(["a.css", "index.html"]);

    projetos[0].arquivos = { "index.html": "<h1>tchau</h1>" };
    chamadas.length = 0;
    expect(await publicarProjeto(deps(db, octokit), P)).toMatchObject({ ok: true });
    const arvore = chamadas.find((c) => c.rota === "POST /repos/{owner}/{repo}/git/trees")!;
    expect(arvore.params.tree).toContainEqual({ path: "a.css", mode: "100644", type: "blob", sha: null });
    expect([...arvores.get("aluno/confeitaria")!]).toEqual(["index.html"]);
  });

  it("README.md do projeto é mantido no repo", async () => {
    const { db } = dbFalso({ arquivos: { "index.html": "x", "README.md": "# meu site" } });
    const { octokit, arvores } = octoFalso();
    await publicarProjeto(deps(db, octokit), P);
    expect([...arvores.get("aluno/confeitaria")!].sort()).toEqual(["README.md", "index.html"]);
  });

  it("caminhos perigosos nunca chegam ao octokit e voltam em ignorados", async () => {
    const perigosos = [".github/workflows/x.yml", "../x.html", "/etc/x", "a/.env", ".env", "a//b.html", "a\\b.html", "x.sh", "semext", "a/" + "b".repeat(200) + ".html"];
    const arquivos: Record<string, string> = { "index.html": "ok", "img/logo.svg": "<svg/>" };
    for (const c of perigosos) arquivos[c] = "on: push";
    const { db } = dbFalso({ arquivos });
    const { octokit, chamadas } = octoFalso();
    const r = await publicarProjeto(deps(db, octokit), P);
    expect(r).toMatchObject({ ok: true });
    expect((r as any).ignorados.sort()).toEqual([...perigosos].sort());
    const tocados = JSON.stringify(chamadas);
    for (const c of [".github", "../x.html", "/etc/x", ".env", "on: push", "x.sh"]) expect(tocados).not.toContain(c);
    const arvore = chamadas.find((c) => c.rota === "POST /repos/{owner}/{repo}/git/trees")!;
    expect(arvore.params.tree.filter((t: any) => t.sha).map((t: any) => t.path).sort()).toEqual(["img/logo.svg", "index.html"]);
  });

  it("projeto só com caminhos não publicáveis: sem_arquivos_publicaveis, zero GitHub", async () => {
    const { db } = dbFalso({ arquivos: { ".github/workflows/x.yml": "on: push" } });
    const fabrica = vi.fn(async () => octoFalso().octokit);
    expect(await publicarProjeto({ db, octokitDoAluno: fabrica, agora: () => AGORA }, P)).toEqual({ ok: false, erro: "sem_arquivos_publicaveis" });
    expect(fabrica).not.toHaveBeenCalled();
  });

  it("caminhoPublicavel: lista de extensões e regras de segmento", () => {
    for (const ok of ["index.html", "css/a.css", "js/app.mjs", "img/a.JPG", "fonts/x.woff2", "site.webmanifest", "sobre/index.htm"]) expect(caminhoPublicavel(ok)).toBe(true);
    for (const ruim of ["", ".github/workflows/x.yml", "../x.html", "/etc/x", "a/.env", "a/../b.html", "a/b.exe", "x.php", "a\u0000.html", "DESIGN.md", "docs/design.md", "a/b/Design.MD"]) expect(caminhoPublicavel(ruim)).toBe(false);
  });

  it("Pages 409: usa a URL do GET; status no_ar se built, senão publicando", async () => {
    for (const [st, esperado] of [["built", "no_ar"], ["building", "publicando"]] as const) {
      const { db } = dbFalso();
      const { octokit, chamadas } = octoFalso({ pages409: { status: st } });
      const r = await publicarProjeto(deps(db, octokit), P);
      expect(r).toEqual({ ok: true, repoUrl: "https://github.com/aluno/confeitaria", pagesUrl: "https://aluno.github.io/confeitaria/", status: esperado, ignorados: [] });
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
