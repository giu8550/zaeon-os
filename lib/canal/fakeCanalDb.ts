/**
 * lib/canal/fakeCanalDb.ts — SÓ PARA TESTES (#443): imita o `updateMany` do Prisma/Mongo nos canais, com as
 * condições que lib/canal/atomico.ts usa. Os testes de rota usam isto no lugar do banco de verdade.
 *   where: id · NOT { membros: { has } } · membros: { equals } · agentes: { equals } · dmCom: valor
 *   data:  membros: { push } · qualquer outro campo é trocado pelo valor
 */
type Linha = Record<string, unknown> & { id: string };

const iguais = (a: unknown, b: unknown) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

export function casaWhere(c: Linha, where: Record<string, any>): boolean {
  if (where.id !== undefined && c.id !== where.id) return false;
  const nao = where.NOT?.membros?.has;
  if (nao !== undefined && ((c.membros as string[]) ?? []).includes(nao)) return false;
  if (where.membros?.equals !== undefined && !iguais(c.membros, where.membros.equals)) return false;
  if (where.agentes?.equals !== undefined && !iguais(c.agentes, where.agentes.equals)) return false;
  if (where.dmCom !== undefined && (c.dmCom ?? null) !== where.dmCom) return false;
  return true;
}

export function aplicarData(c: Linha, data: Record<string, any>): void {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && !Array.isArray(v) && "push" in v) c[k] = [...((c[k] as unknown[]) ?? []), v.push];
    else c[k] = v;
  }
}

/** updateMany sobre uma lista de canais (as linhas são alteradas no lugar). */
export async function updateManyCanais(linhas: Linha[], a: { where: Record<string, any>; data: Record<string, any> }): Promise<{ count: number }> {
  const alvo = linhas.filter((c) => casaWhere(c, a.where));
  alvo.forEach((c) => aplicarData(c, a.data));
  return { count: alvo.length };
}
