import { describe, it, expect } from "vitest";
import { slugProjeto, criarProjeto, lerProjeto, salvarArquivos, atualizarProjeto, contarPublicacoesHoje, type ProjetosDb } from "./projetos";

// dublê em memória no formato dos delegates do Prisma que a lib usa
function dbFalso(pubs: { userId: string; ok: boolean; repoNovo: boolean; em: Date }[] = []): ProjetosDb {
  const projetos: any[] = [];
  return {
    octaProjeto: {
      create: async ({ data }: any) => { const p = { id: "a".repeat(23) + String(projetos.length), ...data }; projetos.push(p); return p; },
      findFirst: async ({ where }: any) => projetos.find((p) => p.id === where.id && p.userId === where.userId) ?? null,
      findMany: async ({ where }: any) => projetos.filter((p) => p.userId === where.userId),
      update: async ({ where, data }: any) => { const p = projetos.find((x) => x.id === where.id); Object.assign(p, data); return p; },
      delete: async ({ where }: any) => { projetos.splice(projetos.findIndex((x) => x.id === where.id), 1); },
    },
    octaPublicacao: {
      findMany: async ({ where }: any) => pubs.filter((p) => p.userId === where.userId && p.ok === where.ok && p.em >= where.em.gte),
    },
  };
}

describe("slugProjeto", () => {
  it("normaliza acentos, pontuação e espaços", () => {
    expect(slugProjeto("Confeitaria da Ana!")).toBe("confeitaria-da-ana");
    expect(slugProjeto("  Pão & Açúcar  ")).toBe("pao-acucar");
  });
  it("limita a 60 e cai em meu-site quando vazio", () => {
    expect(slugProjeto("a".repeat(100))).toHaveLength(60);
    expect(slugProjeto("!!!")).toBe("meu-site");
    expect(slugProjeto("")).toBe("meu-site");
  });
});

describe("projetos", () => {
  it("lerProjeto de outro usuário → null; id malformado → null", async () => {
    const db = dbFalso();
    const p = await criarProjeto(db, "u1", "Confeitaria da Ana!");
    expect(p.slug).toBe("confeitaria-da-ana");
    expect(p.permissao).toBe("auto");
    expect(await lerProjeto(db, "u1", p.id)).toMatchObject({ id: p.id });
    expect(await lerProjeto(db, "u2", p.id)).toBeNull();
    expect(await lerProjeto(db, "u1", "nao-e-objectid")).toBeNull();
  });
  it("salvarArquivos e atualizarProjeto só mexem no que é do dono", async () => {
    const db = dbFalso();
    const p = await criarProjeto(db, "u1", "Site");
    expect(await salvarArquivos(db, "u2", p.id, { "index.html": "x" })).toBeNull();
    expect((await salvarArquivos(db, "u1", p.id, { "index.html": "x" }))?.arquivos).toEqual({ "index.html": "x" });
    expect(await atualizarProjeto(db, "u2", p.id, { permissao: "antes_de_publicar" })).toBeNull();
    expect((await atualizarProjeto(db, "u1", p.id, { permissao: "antes_de_publicar", designId: "d1" }))).toMatchObject({ permissao: "antes_de_publicar", designId: "d1" });
  });
});

describe("contarPublicacoesHoje", () => {
  it("conta só ok:true desde 00:00 de Fortaleza", async () => {
    // 2026-10-21 15:00 UTC = 12:00 em Fortaleza; o dia começou às 03:00 UTC
    const agora = new Date("2026-10-21T15:00:00Z");
    const db = dbFalso([
      { userId: "u1", ok: true, repoNovo: true, em: new Date("2026-10-21T10:00:00Z") },
      { userId: "u1", ok: true, repoNovo: false, em: new Date("2026-10-21T03:00:00Z") },
      { userId: "u1", ok: false, repoNovo: true, em: new Date("2026-10-21T11:00:00Z") },
      { userId: "u1", ok: true, repoNovo: true, em: new Date("2026-10-21T02:59:00Z") }, // ontem em Fortaleza
      { userId: "u2", ok: true, repoNovo: true, em: new Date("2026-10-21T11:00:00Z") },
    ]);
    expect(await contarPublicacoesHoje(db, "u1", agora)).toEqual({ publicacoes: 2, reposNovos: 1 });
  });
});
