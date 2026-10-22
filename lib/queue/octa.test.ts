import { describe, it, expect, vi, beforeEach } from "vitest";
import { iniciarTurno, processarTurno, aprovarTurno, listarEventos, reapTurnosPresos, ErroTurno, type DepsTurno, type TurnosDb } from "./octa";
import type { ChamarModelo, RespostaModelo } from "@/lib/octa/agente";

// ───────────── banco em memória (o recorte do Prisma que lib/queue/octa usa) ─────────────
let n = 0;
const novoId = () => (++n).toString(16).padStart(24, "0");
const casa = (row: any, where: any): boolean => Object.entries(where ?? {}).every(([k, v]: [string, any]) => {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("in" in v) return v.in.includes(row[k]);
    if ("lt" in v) return row[k] < v.lt;
    if ("gt" in v) return row[k] > v.gt;
    if ("gte" in v) return row[k] >= v.gte;
  }
  return row[k] === v;
});
const ordena = (rows: any[], orderBy: any) => {
  if (!orderBy) return rows;
  const [k, dir] = Object.entries(orderBy)[0] as [string, string];
  return [...rows].sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (dir === "desc" ? -1 : 1));
};
/** `unico`: campos que juntos não podem repetir (como @@unique do Prisma → erro P2002). */
function tabela(agora: () => Date, unico?: string[]) {
  const rows: any[] = [];
  const carimbo = (data: any) => ({ updatedAt: agora(), ...data });
  return {
    rows,
    async create({ data }: any) {
      if (unico && rows.some((x) => unico.every((k) => x[k] === data[k]))) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      const r = { id: novoId(), createdAt: agora(), em: agora(), ...carimbo(data) }; rows.push(r); return { ...r }; },
    async findUnique({ where }: any) { const r = rows.find((x) => x.id === where.id); return r ? { ...r } : null; },
    async findFirst({ where, orderBy }: any) { const r = ordena(rows.filter((x) => casa(x, where)), orderBy)[0]; return r ? { ...r } : null; },
    async findMany({ where, orderBy, take }: any) { return ordena(rows.filter((x) => casa(x, where)), orderBy).slice(0, take ?? Infinity).map((x) => ({ ...x })); },
    async update({ where, data }: any) { const r = rows.find((x) => x.id === where.id); Object.assign(r, carimbo(data)); return { ...r }; },
    async updateMany({ where, data }: any) { const alvo = rows.filter((x) => casa(x, where)); alvo.forEach((r) => Object.assign(r, data)); /* sem @updatedAt implícito: quem precisa manda explícito */ return { count: alvo.length }; },
    async delete({ where }: any) { const i = rows.findIndex((x) => x.id === where.id); return rows.splice(i, 1)[0]; },
  };
}
function bancoFalso(agora: () => Date) {
  return { octaProjeto: tabela(agora), octaPublicacao: tabela(agora), octaTurno: tabela(agora), octaEvento: tabela(agora, ["turnoId", "seq"]) };
}

// ───────────── dublês ─────────────
const call = (id: string, name: string, args: object) => ({ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } });
const roteiro = (passos: RespostaModelo[]): ChamarModelo => { let i = 0; return async () => passos[Math.min(i++, passos.length - 1)]; };

/** Octokit de mentira do GitHub do aluno: registra commits; `quebrar` faz toda request lançar com o token na mensagem. */
function octokitFalso(opts: { quebrar?: boolean } = {}) {
  const commits: any[] = [];
  const falha = () => { const e: any = new Error("Bad credentials: Authorization: token ghu_SEGREDO123"); e.status = 500; e.request = { headers: { authorization: "token ghu_SEGREDO123" } }; throw e; };
  const ok = {
    commits,
    async request(rota: string, params: any = {}) {
      if (opts.quebrar) falha();
      if (rota === "GET /user") return { data: { login: "aluna" } };
      if (rota === "GET /repos/{owner}/{repo}") { const e: any = new Error("Not Found"); e.status = 404; throw e; }
      if (rota === "POST /user/repos") return { data: { full_name: `aluna/${params.name}`, default_branch: "main", html_url: "", private: false } };
      if (rota.includes("/git/ref") && rota.startsWith("GET")) return { data: { object: { sha: "c0" } } };
      if (rota.includes("/git/commits/") && rota.startsWith("GET")) return { data: { tree: { sha: "t0" } } };
      if (rota.includes("/git/trees/") && rota.startsWith("GET")) return { data: { tree: [] } };
      if (rota.includes("/git/trees") && rota.startsWith("POST")) return { data: { sha: "t1" } };
      if (rota.includes("/git/commits") && rota.startsWith("POST")) { commits.push(params); return { data: { sha: "c1" } }; }
      if (rota.includes("/git/refs") && rota.startsWith("PATCH")) return { data: {} };
      if (rota.includes("/pages")) return { data: { html_url: "https://aluna.github.io/site/" } };
      return { data: {} };
    },
  };
  return ok;
}

const PAGINA = JSON.stringify([{ id: "h", type: "hero", props: { title: "Bolos da Ana", subtitle: "Feitos em casa" } }]);

describe("lib/queue/octa · turno em job", () => {
  let agora: Date;
  let db: ReturnType<typeof bancoFalso>;
  let gh: ReturnType<typeof octokitFalso>;
  let modelo: ChamarModelo;
  let deps: DepsTurno;
  let projetoId: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    agora = new Date("2026-10-22T12:00:00Z");
    db = bancoFalso(() => agora);
    gh = octokitFalso();
    modelo = roteiro([{ content: "ok" }]);
    deps = {
      db: db as unknown as TurnosDb,
      chamador: async () => modelo,
      octokitDoAluno: async () => gh,
      agora: () => agora,
      fila: null,
    };
    const p = await db.octaProjeto.create({ data: { userId: "u1", nome: "Site", slug: "site", arquivos: { "index.html": "<h1>velho</h1>" }, permissao: "auto", avisoPublicoAceito: true, repoCriadoPeloOcta: false } });
    projetoId = p.id;
  });

  const eventos = (turnoId: string) => db.octaEvento.rows.filter((e) => e.turnoId === turnoId);
  const turno = (id: string) => db.octaTurno.rows.find((t) => t.id === id);
  const novoTurno = async (pedido = "faz a landing") => {
    const t = await db.octaTurno.create({ data: { userId: "u1", email: "a@b.c", projetoId, pedido, status: "rodando", runId: null } });
    return t.id as string;
  };

  it("processarTurno grava eventos com seq 1..n crescente, termina em fim e salva as edições no projeto", async () => {
    modelo = roteiro([
      { content: null, tool_calls: [call("1", "octa_pagina_montar", { secoes: PAGINA, titulo: "Bolos da Ana" })] },
      { content: null, tool_calls: [call("2", "octa_escrever", { path: "sobre.html", conteudo: "<p>sobre</p>" })] },
      { content: "Montei a página." },
    ]);
    const id = await novoTurno();
    await processarTurno(deps, id);

    const evs = eventos(id);
    expect(evs.map((e) => e.seq)).toEqual(evs.map((_, i) => i + 1));
    expect(evs.at(-1)!.tipo).toBe("fim");
    expect(evs.map((e) => e.tipo)).toEqual(expect.arrayContaining(["pensando", "tool", "resultado", "arquivo"]));
    expect(evs.filter((e) => e.tipo === "arquivo").map((e) => e.dados.path)).toEqual(expect.arrayContaining(["index.html", "styles.css", "sobre.html"]));
    expect(turno(id)).toMatchObject({ status: "pronto", resposta: "Montei a página.", estado: null, pendente: null });
    const arquivos = db.octaProjeto.rows[0].arquivos;
    expect(arquivos["sobre.html"]).toBe("<p>sobre</p>");
    expect(arquivos["index.html"]).toMatch(/Bolos da Ana/);
    expect(arquivos["DESIGN.md"]).toBeTruthy(); // DESIGN.md fica no projeto (só não vai pro GitHub)
  });

  it("parado em aprovação → aguardando_aprovacao com estado/pendente no servidor; aprovar termina em pronto e publica uma vez", async () => {
    db.octaProjeto.rows[0].permissao = "antes_de_publicar";
    modelo = roteiro([{ content: null, tool_calls: [call("p1", "octa_publicar", { mensagem: "primeira" })] }]);
    const id = await novoTurno("publica");
    await processarTurno(deps, id);
    expect(turno(id)!.status).toBe("aguardando_aprovacao");
    expect(turno(id)!.pendente).toEqual({ tool: "octa_publicar", args: { mensagem: "primeira" }, toolCallId: "p1" });
    expect(turno(id)!.estado.msgs.length).toBeGreaterThan(0);
    expect(eventos(id).at(-1)).toMatchObject({ tipo: "aprovacao", dados: { tool: "octa_publicar" } });
    expect(gh.commits).toHaveLength(0);

    modelo = roteiro([{ content: "No ar!" }]);
    await aprovarTurno(deps, { userId: "u1", turnoId: id, aprovado: true });
    await vi.waitFor(() => expect(turno(id)!.status).toBe("pronto"));
    expect(gh.commits).toHaveLength(1);
    expect(db.octaPublicacao.rows.filter((r) => r.ok)).toHaveLength(1);
    const evs = eventos(id);
    expect(evs.map((e) => e.seq)).toEqual(evs.map((_, i) => i + 1)); // a retomada continua a numeração
    expect(evs.at(-1)!.tipo).toBe("fim");
    expect(evs.find((e) => e.tipo === "resultado" && e.dados.tool === "octa_publicar")!.dados).toMatchObject({ ok: true });
  });

  it("aprovar duas vezes (ou turno que não está aguardando) → ErroTurno nao_aguardando, publica no máximo uma vez", async () => {
    db.octaProjeto.rows[0].permissao = "antes_de_publicar";
    modelo = roteiro([{ content: null, tool_calls: [call("p1", "octa_publicar", {})] }]);
    const id = await novoTurno("publica");
    await processarTurno(deps, id);
    modelo = roteiro([{ content: "No ar!" }]);
    const a = aprovarTurno(deps, { userId: "u1", turnoId: id, aprovado: true });
    await expect(aprovarTurno(deps, { userId: "u1", turnoId: id, aprovado: true })).rejects.toMatchObject({ codigo: "nao_aguardando" });
    await a;
    await vi.waitFor(() => expect(turno(id)!.status).toBe("pronto"));
    await expect(aprovarTurno(deps, { userId: "u1", turnoId: id, aprovado: true })).rejects.toBeInstanceOf(ErroTurno);
    expect(gh.commits).toHaveLength(1);
  });

  it("aprovação de outro dono → turno_inexistente", async () => {
    db.octaProjeto.rows[0].permissao = "antes_de_publicar";
    modelo = roteiro([{ content: null, tool_calls: [call("p1", "octa_publicar", {})] }]);
    const id = await novoTurno();
    await processarTurno(deps, id);
    await expect(aprovarTurno(deps, { userId: "u2", turnoId: id, aprovado: true })).rejects.toMatchObject({ codigo: "turno_inexistente" });
    expect(turno(id)!.status).toBe("aguardando_aprovacao");
  });

  it("recusar a aprovação: o modelo ouve 'recusado' e o turno termina sem publicar", async () => {
    db.octaProjeto.rows[0].permissao = "antes_de_publicar";
    modelo = roteiro([{ content: null, tool_calls: [call("p1", "octa_publicar", {})] }]);
    const id = await novoTurno();
    await processarTurno(deps, id);
    modelo = roteiro([{ content: "Tudo bem, não publiquei." }]);
    await aprovarTurno(deps, { userId: "u1", turnoId: id, aprovado: false });
    await vi.waitFor(() => expect(turno(id)!.status).toBe("pronto"));
    expect(gh.commits).toHaveLength(0);
    expect(eventos(id).some((e) => e.tipo === "resultado" && e.dados.codigo === "recusado_pelo_aluno")).toBe(true);
  });

  it("octa_publicar no turno passa pela MESMA checagem anti-marca do botão: index.html com a marca → recusa, zero commit", async () => {
    const { designMdComMarcador } = await import("@/lib/octa/design/indice");
    db.octaProjeto.rows[0].arquivos = { "DESIGN.md": designMdComMarcador("nintendo-2001"), "index.html": "<html><body><p>loja no estilo Nintendo</p></body></html>" };
    modelo = roteiro([{ content: null, tool_calls: [call("p1", "octa_publicar", {})] }, { content: "vou reescrever" }]);
    const id = await novoTurno("publica");
    await processarTurno(deps, id);
    expect(gh.commits).toHaveLength(0);
    const res = eventos(id).find((e) => e.tipo === "resultado" && e.dados.tool === "octa_publicar")!;
    expect(res.dados).toMatchObject({ ok: false, codigo: "marca_no_conteudo" });
  });

  it("nenhum evento (nem o estado salvo) contém o token quando o GitHub lança erro com ele", async () => {
    gh = octokitFalso({ quebrar: true });
    modelo = roteiro([
      { content: null, tool_calls: [call("1", "octa_pagina_montar", { secoes: PAGINA, titulo: "Bolos" })] },
      { content: null, tool_calls: [call("2", "octa_publicar", {})] },
      { content: "O GitHub falhou." },
    ]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const id = await novoTurno("publica");
    await processarTurno(deps, id);
    warn.mockRestore();
    expect(turno(id)!.status).toBe("pronto");
    const evs = eventos(id);
    expect(evs.find((e) => e.tipo === "resultado" && e.dados.tool === "octa_publicar")!.dados).toMatchObject({ ok: false, codigo: "falha_github" });
    for (const e of evs) expect(JSON.stringify(e.dados)).not.toContain("SEGREDO123");
    expect(JSON.stringify(db.octaTurno.rows)).not.toContain("SEGREDO123");
  });

  it("modelo falha com mensagem crua → status erro e evento erro com código fixo (sem a mensagem)", async () => {
    modelo = async () => { throw new Error("gateway 500: sk-master-XYZ vazou"); };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const id = await novoTurno();
    await processarTurno(deps, id);
    warn.mockRestore();
    expect(turno(id)!.status).toBe("erro");
    const fim = eventos(id).at(-1)!;
    expect(fim).toMatchObject({ tipo: "erro", dados: { codigo: "falha_modelo" } });
    expect(JSON.stringify(eventos(id))).not.toContain("sk-master");
  });

  it("listarEventos(depois=3) devolve só seq>3; turno de outro dono → null", async () => {
    modelo = roteiro([
      { content: null, tool_calls: [call("1", "octa_escrever", { path: "a.html", conteudo: "a" })] },
      { content: null, tool_calls: [call("2", "octa_escrever", { path: "b.html", conteudo: "b" })] },
      { content: "pronto" },
    ]);
    const id = await novoTurno();
    await processarTurno(deps, id);
    const r = await listarEventos(db as unknown as TurnosDb, { userId: "u1", turnoId: id, depois: 3 });
    expect(r!.eventos.length).toBe(eventos(id).length - 3);
    expect(r!.eventos.every((e) => e.seq > 3)).toBe(true);
    expect(r!.status).toBe("pronto");
    expect(await listarEventos(db as unknown as TurnosDb, { userId: "u2", turnoId: id, depois: 0 })).toBeNull();
  });

  it("sem Redis, iniciarTurno cria o turno e processa inline (landing, permissão do projeto)", async () => {
    modelo = roteiro([{ content: null, tool_calls: [call("1", "octa_escrever", { path: "x.html", conteudo: "x" })] }, { content: "feito" }]);
    const { turnoId } = await iniciarTurno(deps, { userId: "u1", email: "a@b.c", projetoId, pedido: "cria x" });
    expect(turno(turnoId)).toMatchObject({ userId: "u1", projetoId, pedido: "cria x" });
    await vi.waitFor(() => expect(turno(turnoId)!.status).toBe("pronto"));
    expect(db.octaProjeto.rows[0].arquivos["x.html"]).toBe("x");
  });

  it("iniciarTurno: projeto de outro dono → projeto_inexistente; turno ativo no projeto → turno_ativo", async () => {
    await expect(iniciarTurno(deps, { userId: "u2", email: "z@b.c", projetoId, pedido: "oi" })).rejects.toMatchObject({ codigo: "projeto_inexistente" });
    const ativo = await novoTurno();
    await expect(iniciarTurno(deps, { userId: "u1", email: "a@b.c", projetoId, pedido: "outro" })).rejects.toMatchObject({ codigo: "turno_ativo", turnoId: ativo });
    turno(ativo)!.status = "aguardando_aprovacao";
    await expect(iniciarTurno(deps, { userId: "u1", email: "a@b.c", projetoId, pedido: "outro" })).rejects.toMatchObject({ codigo: "turno_ativo" });
  });

  it("turno 'rodando' parado há mais de 10 min não trava o projeto: vira erro (tempo_esgotado) e o novo começa", async () => {
    const preso = await novoTurno();
    agora = new Date(agora.getTime() + 11 * 60_000);
    const { turnoId } = await iniciarTurno(deps, { userId: "u1", email: "a@b.c", projetoId, pedido: "de novo" });
    expect(turnoId).not.toBe(preso);
    expect(turno(preso)!.status).toBe("erro");
    expect(eventos(preso).at(-1)).toMatchObject({ tipo: "erro", dados: { codigo: "tempo_esgotado" } });
    await vi.waitFor(() => expect(turno(turnoId)!.status).toBe("pronto"));
  });

  it("listarEventos colhe o 'rodando' sem sinal de vida (restart no meio): devolve erro tempo_esgotado e destrava", async () => {
    const preso = await novoTurno();
    const r0 = await listarEventos(db as unknown as TurnosDb, { userId: "u1", turnoId: preso, depois: 0 }, agora);
    expect(r0!.status).toBe("rodando"); // ainda fresco: nada muda
    agora = new Date(agora.getTime() + 11 * 60_000);
    const r = await listarEventos(db as unknown as TurnosDb, { userId: "u1", turnoId: preso, depois: 0 }, agora);
    expect(r!.status).toBe("erro");
    expect(r!.eventos.at(-1)).toMatchObject({ tipo: "erro", dados: { codigo: "tempo_esgotado" } });
    expect(turno(preso)!.status).toBe("erro");
    // aguardando_aprovacao não expira por aqui (espera o aluno)
    const espera = await novoTurno();
    turno(espera)!.status = "aguardando_aprovacao";
    agora = new Date(agora.getTime() + 60 * 60_000);
    expect((await listarEventos(db as unknown as TurnosDb, { userId: "u1", turnoId: espera, depois: 0 }, agora))!.status).toBe("aguardando_aprovacao");
  });

  it("listarEventos de outro dono não colhe o turno preso de ninguém", async () => {
    const preso = await novoTurno();
    agora = new Date(agora.getTime() + 11 * 60_000);
    expect(await listarEventos(db as unknown as TurnosDb, { userId: "u2", turnoId: preso, depois: 0 }, agora)).toBeNull();
    expect(turno(preso)!.status).toBe("rodando");
  });

  it("reapTurnosPresos marca só os 'rodando' velhos", async () => {
    const velho = await novoTurno();
    agora = new Date(agora.getTime() + 11 * 60_000);
    const novo = await novoTurno();
    expect(await reapTurnosPresos(db as unknown as TurnosDb, agora)).toBe(1);
    expect(turno(velho)!.status).toBe("erro");
    expect(turno(novo)!.status).toBe("rodando");
  });

  it("processarTurno é idempotente: turno que não está rodando não roda de novo", async () => {
    const id = await novoTurno();
    turno(id)!.status = "pronto";
    const chamador = vi.fn(async () => modelo);
    await processarTurno({ ...deps, chamador }, id);
    expect(chamador).not.toHaveBeenCalled();
    expect(eventos(id)).toHaveLength(0);
  });

  it("processarTurno duas vezes ao mesmo tempo (job stalled devolvido): tools e publicação rodam uma vez só", async () => {
    let chamadas = 0;
    const passos: RespostaModelo[] = [{ content: null, tool_calls: [call("p1", "octa_publicar", {})] }, { content: "No ar!" }];
    deps.chamador = async () => { let i = 0; return async () => { chamadas++; return passos[Math.min(i++, passos.length - 1)]; }; };
    const id = await novoTurno("publica");
    await Promise.all([processarTurno(deps, id), processarTurno(deps, id)]);
    expect(gh.commits).toHaveLength(1);
    expect(chamadas).toBe(2);
    expect(turno(id)).toMatchObject({ status: "pronto", runId: null });
    const evs = eventos(id);
    expect(evs.map((e) => e.seq)).toEqual(evs.map((_, i) => i + 1));
    await processarTurno(deps, id); // re-entrega depois de pronto: nada
    expect(gh.commits).toHaveLength(1);
  });

  it("turno já reivindicado por outra execução (viva ou morta): a 2ª não roda nem grava evento", async () => {
    const id = await novoTurno();
    turno(id)!.runId = "outra-execucao";
    const chamador = vi.fn(async () => modelo);
    await processarTurno({ ...deps, chamador }, id);
    expect(chamador).not.toHaveBeenCalled();
    expect(eventos(id)).toHaveLength(0);
    expect(turno(id)!.status).toBe("rodando"); // fica pro reaper
  });

  it("arquivos ao vivo: cada escrita do turno grava no projeto na hora (3 escritas → 3 gravações + a final)", async () => {
    modelo = roteiro([
      { content: null, tool_calls: [call("1", "octa_escrever", { path: "a.html", conteudo: "<p>a</p>" })] },
      { content: null, tool_calls: [call("2", "octa_escrever", { path: "b.html", conteudo: "<p>b</p>" })] },
      { content: null, tool_calls: [call("3", "octa_escrever", { path: "c.css", conteudo: "p{}" })] },
      { content: "feito" },
    ]);
    const id = await novoTurno();
    const original = db.octaProjeto.update;
    const vistos: string[][] = [];
    const update = vi.spyOn(db.octaProjeto, "update").mockImplementation(async (a: any) => { vistos.push(Object.keys(a.data.arquivos ?? {})); return original.call(db.octaProjeto, a); });
    await processarTurno(deps, id);
    expect(update).toHaveBeenCalledTimes(4);
    expect(vistos[0]).toEqual(expect.arrayContaining(["index.html", "a.html"]));
    expect(vistos[0]).not.toContain("b.html"); // a 1ª gravação já existia antes das outras
    expect(vistos[2]).toEqual(expect.arrayContaining(["a.html", "b.html", "c.css"]));
    // o evento não carrega conteúdo de arquivo
    for (const e of eventos(id).filter((x) => x.tipo === "arquivo")) expect(Object.keys(e.dados).sort()).toEqual(["acao", "path"]);
  });

  it("turno cortado no meio: o que já foi gravado fica no projeto; perdeu o runId → não grava mais", async () => {
    const id = await novoTurno();
    modelo = roteiro([
      { content: null, tool_calls: [call("1", "octa_escrever", { path: "a.html", conteudo: "<p>a</p>" })] },
      { content: null, tool_calls: [call("2", "octa_escrever", { path: "b.html", conteudo: "<p>b</p>" })] },
      { content: "fim" },
    ]);
    const original = db.octaEvento.create;
    db.octaEvento.create = async (a: any) => {
      const r = await original(a);
      // depois do 1º arquivo anunciado, outra execução reivindica o turno
      if (a.data.tipo === "arquivo" && a.data.dados.path === "a.html") turno(id)!.runId = "roubado";
      return r;
    };
    await processarTurno(deps, id);
    const arquivos = db.octaProjeto.rows[0].arquivos;
    expect(arquivos["a.html"]).toBe("<p>a</p>");
    expect(arquivos["b.html"]).toBeUndefined();
  });

  it("execução que já perdeu o runId antes do 1º arquivo não grava nada no projeto", async () => {
    const id = await novoTurno();
    modelo = roteiro([
      { content: null, tool_calls: [call("1", "octa_escrever", { path: "a.html", conteudo: "<p>a</p>" })] },
      { content: "fim" },
    ]);
    const original = db.octaEvento.create;
    db.octaEvento.create = async (a: any) => {
      const r = await original(a);
      if (a.data.tipo === "resultado") turno(id)!.runId = "roubado";
      return r;
    };
    const update = vi.spyOn(db.octaProjeto, "update");
    await processarTurno(deps, id);
    expect(update).not.toHaveBeenCalled();
    expect(db.octaProjeto.rows[0].arquivos["a.html"]).toBeUndefined();
  });

  it("uma tool que muda vários arquivos custa UMA gravação intermediária (mais a final)", async () => {
    modelo = roteiro([
      { content: null, tool_calls: [call("1", "octa_pagina_montar", { secoes: PAGINA, titulo: "Bolos da Ana" })] },
      { content: "ok" },
    ]);
    const id = await novoTurno();
    const update = vi.spyOn(db.octaProjeto, "update");
    await processarTurno(deps, id);
    expect(eventos(id).filter((e) => e.tipo === "arquivo").length).toBeGreaterThanOrEqual(2);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("gravação intermediária que falha (Mongo) não derruba o turno e a final grava", async () => {
    modelo = roteiro([
      { content: null, tool_calls: [call("1", "octa_escrever", { path: "a.html", conteudo: "<p>a</p>" })] },
      { content: "ok" },
    ]);
    const id = await novoTurno();
    const original = db.octaProjeto.update;
    let n = 0;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(db.octaProjeto, "update").mockImplementation(async (a: any) => { if (n++ === 0) throw Object.assign(new Error("mongo caiu SEGREDO"), { code: "X1" }); return original.call(db.octaProjeto, a); });
    await processarTurno(deps, id);
    expect(turno(id)!.status).toBe("pronto");
    expect(db.octaProjeto.rows[0].arquivos["a.html"]).toBe("<p>a</p>");
    expect(JSON.stringify((console.warn as any).mock.calls)).not.toContain("SEGREDO");
  });

  it("execução que perde o turno no meio (outra reivindicou) para de gravar eventos e não publica", async () => {
    const id = await novoTurno("publica");
    modelo = roteiro([
      { content: null, tool_calls: [call("1", "octa_escrever", { path: "a.html", conteudo: "a" })] },
      { content: null, tool_calls: [call("2", "octa_publicar", {})] },
      { content: "fim" },
    ]);
    const original = db.octaEvento.create;
    db.octaEvento.create = async (a: any) => {
      const r = await original(a);
      if (a.data.tipo === "arquivo") turno(id)!.runId = "roubado"; // lock perdido no meio
      return r;
    };
    await processarTurno(deps, id);
    const evs = eventos(id);
    expect(evs.at(-1)!.tipo).toBe("arquivo");
    expect(gh.commits).toHaveLength(0);
    expect(turno(id)!.status).toBe("rodando");
  });

  it("seq duplicado (P2002 do @@unique) aborta a execução em vez de gravar em silêncio", async () => {
    const id = await novoTurno();
    await db.octaEvento.create({ data: { turnoId: id, seq: 1, tipo: "pensando", dados: {} } });
    const findFirst = db.octaEvento.findFirst;
    db.octaEvento.findFirst = async () => null; // execução com visão velha: acha que o próximo seq é 1
    modelo = roteiro([{ content: null, tool_calls: [call("1", "octa_escrever", { path: "a.html", conteudo: "a" })] }, { content: "fim" }]);
    await processarTurno(deps, id);
    db.octaEvento.findFirst = findFirst;
    expect(eventos(id)).toHaveLength(1);
    expect(db.octaProjeto.rows[0].arquivos["a.html"]).toBeUndefined();
  });

  it("aprovar depois de esperar >10 min: o turno volta a rodar com updatedAt novo e o reaper não o colhe", async () => {
    db.octaProjeto.rows[0].permissao = "antes_de_publicar";
    modelo = roteiro([{ content: null, tool_calls: [call("p1", "octa_publicar", {})] }]);
    const id = await novoTurno("publica");
    await processarTurno(deps, id);
    agora = new Date(agora.getTime() + 11 * 60_000);
    const enfileirados: string[] = [];
    await aprovarTurno({ ...deps, fila: { add: async (x) => { enfileirados.push(x); } } }, { userId: "u1", turnoId: id, aprovado: true });
    expect(enfileirados).toEqual([id]);
    expect(turno(id)).toMatchObject({ status: "rodando", runId: null });
    expect(await reapTurnosPresos(db as unknown as TurnosDb, agora)).toBe(0);
    expect(turno(id)!.status).toBe("rodando");
  });
});
