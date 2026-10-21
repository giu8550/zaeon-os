/** Fake Prisma em memória para os testes do RAG (só o que RagDb usa). Não é importado em produção. */
import type { RagDb } from "@/lib/rag/store";

let seq = 0;
const novoId = () => (++seq).toString(16).padStart(24, "0");

/** Matcher mínimo: igualdade, in, not, has, hasSome, isEmpty e OR. */
function casa(row: any, where: Record<string, any> = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Record<string, any>[]).some((w) => casa(row, w));
    const x = row[k];
    if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
      if ("has" in v) return Array.isArray(x) && x.includes(v.has);
      if ("hasSome" in v) return Array.isArray(x) && v.hasSome.some((y: unknown) => x.includes(y));
      if ("isEmpty" in v) return Array.isArray(x) && (x.length === 0) === v.isEmpty;
      if ("in" in v) return v.in.includes(x);
      if ("not" in v) return x !== v.not;
    }
    return x === v;
  });
}

const projetar = (row: any, select?: Record<string, boolean>) => {
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
};

const copia = (v: any) => (Array.isArray(v) ? [...v] : v);

export function fakeDb() {
  const documentos: any[] = [];
  const trechos: any[] = [];
  const db: RagDb & { documentos: any[]; trechos: any[] } = {
    documentos, trechos,
    ragDocumento: {
      async findUnique({ where }: any) {
        const r = documentos.find((d) => ("id" in where ? d.id === where.id : d.hash === where.hash));
        return r ? { ...r } : null;
      },
      async create({ data }: any) {
        if (documentos.some((d) => d.hash === data.hash)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        const agora = new Date();
        const row = { id: novoId(), erro: null, totalTrechos: 0, comVetor: 0, createdAt: agora, updatedAt: agora, ...data };
        documentos.push(row);
        return { ...row };
      },
      async update({ where, data }: any) {
        const r = documentos.find((d) => d.id === where.id);
        if (!r) throw Object.assign(new Error("not found"), { code: "P2025" });
        for (const [k, v] of Object.entries(data)) r[k] = copia(v);
        r.updatedAt = new Date();
        return { ...r };
      },
      async findMany({ where, select }: any) { return documentos.filter((d) => casa(d, where)).map((d) => projetar(d, select)); },
      async delete({ where }: any) {
        const i = documentos.findIndex((d) => d.id === where.id);
        if (i < 0) throw Object.assign(new Error("not found"), { code: "P2025" });
        return documentos.splice(i, 1)[0];
      },
      async count({ where }: any) { return documentos.filter((d) => casa(d, where)).length; },
    },
    ragTrecho: {
      async createMany({ data }: any) {
        for (const d of data) trechos.push({ id: novoId(), createdAt: new Date(), ...d, turmaIds: [...d.turmaIds], donoIds: [...d.donoIds], embedding: [...d.embedding] });
        return { count: data.length };
      },
      async updateMany({ where, data }: any) {
        const alvo = trechos.filter((t) => casa(t, where));
        for (const t of alvo) for (const [k, v] of Object.entries(data)) t[k] = copia(v);
        return { count: alvo.length };
      },
      async findMany({ where, select, orderBy, take }: any) {
        let rs = trechos.filter((t) => casa(t, where));
        if (orderBy?.ordem) rs = [...rs].sort((a, b) => (orderBy.ordem === "asc" ? a.ordem - b.ordem : b.ordem - a.ordem));
        return rs.slice(0, take ?? rs.length).map((t) => projetar(t, select));
      },
      async deleteMany({ where }: any) {
        const antes = trechos.length;
        for (let i = trechos.length - 1; i >= 0; i--) if (casa(trechos[i], where)) trechos.splice(i, 1);
        return { count: antes - trechos.length };
      },
      async update({ where, data }: any) {
        const t = trechos.find((x) => x.id === where.id);
        if (!t) throw Object.assign(new Error("not found"), { code: "P2025" });
        for (const [k, v] of Object.entries(data)) t[k] = copia(v);
        return { ...t };
      },
    },
  };
  return db;
}
