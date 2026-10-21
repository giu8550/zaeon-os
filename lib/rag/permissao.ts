// RAG por turma/aluno — regras de permissão (PURO, sem I/O).
// Um trecho é visível sse `turmaIds ∩ turmasDaPessoa ≠ ∅` OU `donoIds ∋ pessoa`.
// Os filtros abaixo são aplicados DENTRO do `$vectorSearch.filter` e do `$search` compound
// (nunca depois). Os ids são strings (hex do ObjectId) para os índices Atlas filtrarem como token.

export type EscopoRag = { userId: string; turmaIds: string[] };

/** Há alguma base para consultar (pessoal ou de turma)? */
export function temBase(_e: EscopoRag, contagem: { pessoais: number; deTurma: number }): boolean {
  return contagem.pessoais > 0 || contagem.deTurma > 0;
}

/** Filtro MQL para `$vectorSearch.filter`. Sem turmas, só o ramo do dono. */
export function filtroVetorial(e: EscopoRag): Record<string, unknown> {
  const dono = { donoIds: { $eq: e.userId } };
  if (e.turmaIds.length === 0) return dono;
  return { $or: [{ turmaIds: { $in: e.turmaIds } }, dono] };
}

/** Cláusulas para o `compound` do `$search` (Atlas Search): ao menos uma precisa casar. */
export function filtroTextual(e: EscopoRag): unknown[] {
  const should: unknown[] = [];
  if (e.turmaIds.length > 0) should.push({ in: { path: "turmaIds", value: e.turmaIds } });
  should.push({ equals: { path: "donoIds", value: e.userId } });
  return [{ compound: { should, minimumShouldMatch: 1 } }];
}

/** Mesma regra, em memória (defesa em profundidade e testes). */
export function podeVer(trecho: { turmaIds: string[]; donoIds: string[] }, e: EscopoRag): boolean {
  return trecho.donoIds.includes(e.userId) || trecho.turmaIds.some((t) => e.turmaIds.includes(t));
}
