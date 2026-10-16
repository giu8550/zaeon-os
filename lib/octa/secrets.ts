/**
 * lib/octa/secrets.ts — P2 do Pack Octa (§3). Segredos SEM expor o valor ao modelo.
 *
 *   - O modelo só vê METADADOS (nome, descrição, escopo) e o PLACEHOLDER `{{secret:nome}}`.
 *   - O placeholder é resolvido SÓ no executor (`resolvePlaceholders`), na hora de rodar a ação.
 *   - A saída da ação volta pro modelo REDIGIDA (`redact`): se o valor vazar num log, vira `{{secret:nome}}`.
 *   - Cada resolução gera auditoria (sessão, ação, nome) — NUNCA o valor.
 *   - Valor fica cifrado em repouso (AES-256-GCM com OCTA_VAULT_KEY); `oculto` por padrão.
 *   - Rotação/expiração (lacuna §9.4): `expiraEm` + `rotacionar`; segredo vencido não resolve.
 *
 * Conceito de omaekumiko2-create/kru (MIT, só a ideia; nenhum código).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type SecretMeta = {
  nome: string;
  descricao?: string;
  /** Ações/tools que podem usar este segredo. Vazio = nenhuma (deny-by-default). */
  escopo: string[];
  /** Oculto por padrão: nem o NOME aparece pro modelo até o dono liberar. */
  oculto: boolean;
  criadoEm: string;
  expiraEm?: string;
  versao: number;
};

type Stored = SecretMeta & { cifra: string };

export type AuditEntry = { em: string; sessionId: string; acao: string; nome: string; resultado: "resolvido" | "negado" | "expirado" | "inexistente" };

/** Persistência plugável (memória em dev/teste; Mongo/arquivo em prod). Só guarda cifrado. */
export interface VaultStore {
  get(nome: string): Promise<Stored | null>;
  put(s: Stored): Promise<void>;
  del(nome: string): Promise<void>;
  list(): Promise<Stored[]>;
  audit(e: AuditEntry): Promise<void>;
}

export class MemoryVaultStore implements VaultStore {
  private m = new Map<string, Stored>();
  readonly log: AuditEntry[] = [];
  async get(n: string) { return this.m.get(n) ?? null; }
  async put(s: Stored) { this.m.set(s.nome, s); }
  async del(n: string) { this.m.delete(n); }
  async list() { return [...this.m.values()]; }
  async audit(e: AuditEntry) { this.log.push(e); }
}

const NOME_RE = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
export const PLACEHOLDER_RE = /\{\{secret:([a-z0-9][a-z0-9_.-]{0,63})\}\}/g;

function chave(raw: string | undefined): Buffer {
  const k = Buffer.from(raw ?? "", "base64");
  if (k.length !== 32) throw new Error("OCTA_VAULT_KEY ausente ou inválida (precisa de 32 bytes em base64)");
  return k;
}
function cifrar(valor: string, k: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([c.update(valor, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
function decifrar(blob: string, k: Buffer): string {
  const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export class SecretVault {
  private k: Buffer;
  constructor(private store: VaultStore, keyB64: string | undefined = process.env.OCTA_VAULT_KEY, private agora: () => Date = () => new Date()) {
    this.k = chave(keyB64);
  }

  async definir(nome: string, valor: string, meta: { descricao?: string; escopo?: string[]; oculto?: boolean; ttlDias?: number } = {}): Promise<SecretMeta> {
    if (!NOME_RE.test(nome)) throw new Error(`nome de segredo inválido: ${nome}`);
    const antigo = await this.store.get(nome);
    const now = this.agora();
    const s: Stored = {
      nome,
      descricao: meta.descricao ?? antigo?.descricao,
      escopo: meta.escopo ?? antigo?.escopo ?? [],
      oculto: meta.oculto ?? antigo?.oculto ?? true,
      criadoEm: now.toISOString(),
      expiraEm: meta.ttlDias ? new Date(now.getTime() + meta.ttlDias * 86_400_000).toISOString() : undefined,
      versao: (antigo?.versao ?? 0) + 1,
      cifra: cifrar(valor, this.k),
    };
    await this.store.put(s);
    return semCifra(s);
  }

  /** Rotação: troca o valor mantendo metadados; a versão sobe. */
  async rotacionar(nome: string, novoValor: string, ttlDias?: number): Promise<SecretMeta> {
    if (!(await this.store.get(nome))) throw new Error(`segredo inexistente: ${nome}`);
    return this.definir(nome, novoValor, { ttlDias });
  }

  async revogar(nome: string): Promise<void> { await this.store.del(nome); }

  /** Liga/desliga a visibilidade do NOME pro modelo (ação explícita do dono). */
  async definirVisibilidade(nome: string, visivel: boolean): Promise<void> {
    const s = await this.store.get(nome);
    if (s) await this.store.put({ ...s, oculto: !visivel });
  }

  /** O que o MODELO pode ver: só metadados dos não-ocultos. Nunca o valor. */
  async catalogoParaModelo(): Promise<Array<Pick<SecretMeta, "nome" | "descricao" | "escopo"> & { placeholder: string }>> {
    return (await this.store.list())
      .filter((s) => !s.oculto)
      .map((s) => ({ nome: s.nome, descricao: s.descricao, escopo: s.escopo, placeholder: `{{secret:${s.nome}}}` }));
  }

  /** Metadados completos (painel do dono). */
  async listarMeta(): Promise<SecretMeta[]> { return (await this.store.list()).map(semCifra); }

  /**
   * Resolve `{{secret:nome}}` NO EXECUTOR. Exige que `acao` esteja no escopo do segredo e que não tenha vencido.
   * Devolve o texto resolvido + os valores usados (pra `redact` da saída). Placeholder negado = erro (não roda).
   */
  async resolvePlaceholders(texto: string, ctx: { sessionId: string; acao: string }): Promise<{ texto: string; valores: Map<string, string> }> {
    const valores = new Map<string, string>();
    const nomes = [...new Set([...texto.matchAll(PLACEHOLDER_RE)].map((m) => m[1]))];
    for (const nome of nomes) {
      const s = await this.store.get(nome);
      const em = this.agora().toISOString();
      let resultado: AuditEntry["resultado"] = "resolvido";
      if (!s) resultado = "inexistente";
      else if (s.expiraEm && s.expiraEm <= em) resultado = "expirado";
      else if (!s.escopo.includes(ctx.acao)) resultado = "negado";
      await this.store.audit({ em, sessionId: ctx.sessionId, acao: ctx.acao, nome, resultado });
      if (resultado !== "resolvido") throw new SecretError(nome, resultado);
      valores.set(nome, decifrar(s!.cifra, this.k));
    }
    const out = texto.replace(PLACEHOLDER_RE, (_, n: string) => valores.get(n)!);
    return { texto: out, valores };
  }
}

export class SecretError extends Error {
  constructor(public nome: string, public motivo: "negado" | "expirado" | "inexistente") {
    super(`segredo ${nome}: ${motivo}`);
  }
}

function semCifra({ cifra: _c, ...meta }: Stored): SecretMeta { return meta; }

/** Troca qualquer ocorrência de um valor resolvido de volta pelo placeholder antes de a saída ir ao modelo. */
export function redact(saida: string, valores: Map<string, string>): string {
  let s = saida;
  // valores maiores primeiro (um segredo pode conter outro)
  for (const [nome, v] of [...valores].sort((a, b) => b[1].length - a[1].length)) {
    if (v.length < 4) continue; // valor curtíssimo redigiria texto aleatório
    s = s.split(v).join(`{{secret:${nome}}}`);
  }
  return s;
}

/** Persistência em Mongo (Prisma). Precisa de `prisma db push` (models OctaSecret/OctaSecretAudit). */
export class PrismaVaultStore implements VaultStore {
  private db = async () => (await import("@/src/lib/prisma")).prisma;
  private toStored(r: any): Stored {
    return { nome: r.nome, descricao: r.descricao ?? undefined, escopo: r.escopo, oculto: r.oculto, criadoEm: r.criadoEm.toISOString(), expiraEm: r.expiraEm?.toISOString(), versao: r.versao, cifra: r.cifra };
  }
  async get(nome: string) { const r = await (await this.db()).octaSecret.findUnique({ where: { nome } }); return r ? this.toStored(r) : null; }
  async put(s: Stored) {
    const data = { descricao: s.descricao ?? null, escopo: s.escopo, oculto: s.oculto, criadoEm: new Date(s.criadoEm), expiraEm: s.expiraEm ? new Date(s.expiraEm) : null, versao: s.versao, cifra: s.cifra };
    await (await this.db()).octaSecret.upsert({ where: { nome: s.nome }, create: { nome: s.nome, ...data }, update: data });
  }
  async del(nome: string) { await (await this.db()).octaSecret.deleteMany({ where: { nome } }); }
  async list() { return (await (await this.db()).octaSecret.findMany()).map((r: any) => this.toStored(r)); }
  async audit(e: AuditEntry) { await (await this.db()).octaSecretAudit.create({ data: { ...e, em: new Date(e.em) } }); }
}
