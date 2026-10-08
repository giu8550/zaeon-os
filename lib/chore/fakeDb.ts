/** Fake Prisma em memória para os testes da chore (só o que ChoreDb usa). Não é importado em produção. */
import type { ChoreDb } from "@/lib/chore/store";

let seq = 0;
const novoId = () => (++seq).toString(16).padStart(24, "0");

function casa(row: any, where: Record<string, any>): boolean {
  return Object.entries(where).every(([k, v]) => {
    const x = row[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("gte" in v) return x >= v.gte;
      if ("lt" in v) return x < v.lt;
      if ("in" in v) return v.in.includes(x);
    }
    return x === v;
  });
}

export function fakeDb() {
  const chores: any[] = [];
  const cursores: any[] = [];
  const db: ChoreDb & { chores: any[]; cursores: any[] } = {
    chores, cursores,
    agentChore: {
      async create({ data }: any) {
        if (chores.some((c) => c.jobId === data.jobId)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        const agora = new Date();
        const row = { id: novoId(), resultado: null, cursor: null, motivo: null, chamadasLlm: 0, ms: 0, createdAt: agora, updatedAt: agora, ...data };
        chores.push(row);
        return { ...row };
      },
      async findUnique({ where }: any) { const r = chores.find((c) => ("id" in where ? c.id === where.id : c.jobId === where.jobId)); return r ? { ...r } : null; },
      async update({ where, data }: any) { const r = chores.find((c) => c.id === where.id); if (!r) throw new Error("not found"); Object.assign(r, data, { updatedAt: new Date() }); return { ...r }; },
      async findMany({ where, take }: any) { return chores.filter((c) => casa(c, where)).slice(0, take ?? 1000).map((c) => ({ ...c })); },
      async count({ where }: any) { return chores.filter((c) => casa(c, where)).length; },
      updateMany: async ({ where, data }: any) => { const alvo = chores.filter((c) => casa(c, where)); alvo.forEach((c) => Object.assign(c, data)); return { count: alvo.length }; },
    } as any,
    choreCursor: {
      async findUnique({ where }) { return cursores.find((c) => c.fonteHash === where.fonteHash) ?? null; },
      async upsert({ where, create, update }) {
        const r = cursores.find((c) => c.fonteHash === where.fonteHash);
        if (!r) { const n = { id: novoId(), ...create }; cursores.push(n); return n; }
        for (const [k, v] of Object.entries(update)) r[k] = v && typeof v === "object" && "increment" in (v as any) ? (r[k] ?? 0) + (v as any).increment : v;
        return r;
      },
    },
  };
  return db;
}
