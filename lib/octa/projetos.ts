/**
 * Projeto do Octa no servidor (landing → GitHub Pages): arquivos do site estático, design, permissão
 * e o repositório do aluno. O dono SEMPRE vem da sessão (as rotas passam o userId); aqui toda leitura/escrita
 * filtra por userId, então projeto de outro dono é indistinguível de inexistente (null).
 * `ProjetosDb` é o recorte do Prisma que usamos — injetável para teste.
 */

export type PermissaoOcta = "auto" | "antes_de_publicar" | "antes_de_escrever";
export const PERMISSOES: readonly PermissaoOcta[] = ["auto", "antes_de_publicar", "antes_de_escrever"];

// mesmo teto de /api/octa/agente
export const MAX_ARQUIVOS = 200;
export const MAX_BYTES = 1_500_000;

export type Arquivos = Record<string, string>;

export type Projeto = {
  id: string; userId: string; nome: string; slug: string;
  arquivos: Arquivos; designId: string | null;
  permissao: PermissaoOcta; avisoPublicoAceito: boolean;
  repoFullName: string | null; repoCriadoPeloOcta: boolean; pagesUrl: string | null;
  createdAt?: Date; updatedAt?: Date;
};

export type PatchProjeto = Partial<Pick<Projeto, "designId" | "permissao" | "avisoPublicoAceito">>;

export type ProjetosDb = {
  octaProjeto: {
    create(args: { data: any }): Promise<any>;
    findFirst(args: { where: { id: string; userId: string } }): Promise<any | null>;
    findMany(args: { where: { userId: string }; orderBy?: any }): Promise<any[]>;
    update(args: { where: { id: string }; data: any }): Promise<any>;
    delete(args: { where: { id: string } }): Promise<any>;
  };
  octaPublicacao: {
    findMany(args: { where: { userId: string; ok: boolean; em: { gte: Date } } }): Promise<{ repoNovo: boolean }[]>;
  };
};

const ID_OBJECT = /^[0-9a-f]{24}$/i; // evita P2023 do Prisma (→ 500) com id malformado

export function slugProjeto(nome: string): string {
  const s = String(nome ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "meu-site";
}

export async function criarProjeto(db: ProjetosDb, userId: string, nome: string): Promise<Projeto> {
  const limpo = String(nome ?? "").trim().slice(0, 80) || "Meu site";
  return db.octaProjeto.create({
    data: { userId, nome: limpo, slug: slugProjeto(limpo), arquivos: {}, permissao: "auto" },
  });
}

export async function listarProjetos(db: ProjetosDb, userId: string): Promise<Projeto[]> {
  return db.octaProjeto.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
}

export async function lerProjeto(db: ProjetosDb, userId: string, id: string): Promise<Projeto | null> {
  if (!ID_OBJECT.test(String(id))) return null;
  return db.octaProjeto.findFirst({ where: { id, userId } });
}

export async function salvarArquivos(db: ProjetosDb, userId: string, id: string, arquivos: Arquivos): Promise<Projeto | null> {
  const p = await lerProjeto(db, userId, id);
  if (!p) return null;
  return db.octaProjeto.update({ where: { id: p.id }, data: { arquivos } });
}

export async function atualizarProjeto(db: ProjetosDb, userId: string, id: string, patch: PatchProjeto): Promise<Projeto | null> {
  const p = await lerProjeto(db, userId, id);
  if (!p) return null;
  const data: PatchProjeto = {};
  if (patch.designId !== undefined) data.designId = patch.designId;
  if (patch.permissao !== undefined) data.permissao = patch.permissao;
  if (patch.avisoPublicoAceito !== undefined) data.avisoPublicoAceito = patch.avisoPublicoAceito;
  return db.octaProjeto.update({ where: { id: p.id }, data });
}

export async function apagarProjeto(db: ProjetosDb, userId: string, id: string): Promise<boolean> {
  const p = await lerProjeto(db, userId, id);
  if (!p) return false;
  await db.octaProjeto.delete({ where: { id: p.id } });
  return true;
}

// Fortaleza = UTC−3 o ano todo (sem horário de verão). Início do dia local em UTC.
export function inicioDoDiaFortaleza(agora: Date = new Date()): Date {
  const OFFSET = 3 * 3600_000;
  const local = new Date(agora.getTime() - OFFSET);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + OFFSET);
}

// Só publicações que deram certo contam (falha não gasta o limite).
export async function contarPublicacoesHoje(db: ProjetosDb, userId: string, agora: Date = new Date()): Promise<{ publicacoes: number; reposNovos: number }> {
  const feitas = await db.octaPublicacao.findMany({ where: { userId, ok: true, em: { gte: inicioDoDiaFortaleza(agora) } } });
  return { publicacoes: feitas.length, reposNovos: feitas.filter((x) => x.repoNovo).length };
}

// Valida o mapa de arquivos: null = formato inválido (→ 400); "grande" = passou de 200 arquivos / 1,5 MB (→ 413).
export function lerArquivos(v: unknown): Arquivos | "grande" | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Arquivos = {};
  let bytes = 0;
  for (const [p, c] of Object.entries(v as Record<string, unknown>)) {
    if (typeof c !== "string") return null;
    bytes += c.length + p.length;
    out[p] = c;
  }
  return Object.keys(out).length <= MAX_ARQUIVOS && bytes <= MAX_BYTES ? out : "grande";
}
