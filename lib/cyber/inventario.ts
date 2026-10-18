/**
 * Cyberespaço — o INVENTÁRIO (PURO). Um sisteminha pra começar: 12 espaços, um item EQUIPADO (a arma na mão) e o
 * catálogo de itens. O 1º item é a ESPADA ESPIRITUAL (nível 7) — todo mundo começa com ela no 1º espaço, equipada.
 * Salvo no navegador por pessoa (`chaveInventario`); tudo que vem de fora passa por `sanitizarInventario`.
 */

export type IdItem = "espada-espiritual" | "rifle-cosmico";
export type Raridade = "comum" | "rara" | "epica" | "lendaria";
export type Item = {
  id: IdItem; nome: string; tipo: "arma"; nivel: number; raridade: Raridade; descricao: string;
  /** a arma: dano base de um golpe (o combo multiplica), alcance (m) e o arco do golpe (rad, meia-abertura) */
  arma: { dano: number; alcance: number; arco: number };
};

export const ITENS: Record<IdItem, Item> = {
  "espada-espiritual": {
    id: "espada-espiritual", nome: "Espada Espiritual", tipo: "arma", nivel: 7, raridade: "epica",
    descricao: "Montante enorme de metal escuro com o núcleo de energia verde-água — pesa como uma porta. Se materializa na mão de quem a chama e se desfaz em luz.",
    arma: { dano: 12, alcance: 4.1, arco: 1.0 },   // (uma montante ENORME, ~3 m: alcance longo)
  },
  "rifle-cosmico": {
    id: "rifle-cosmico", nome: "Rifle Cósmico", tipo: "arma", nivel: 5, raridade: "lendaria",
    descricao: "Rifle de energia azul-neon com veias violeta e cano triplo. Rajada automática, mira livre (botão direito) — esquenta: deixe esfriar. Tecla 1 saca e guarda.",
    arma: { dano: 9, alcance: 90, arco: 0 },   // (os números de verdade estão em lib/cyber/rifle)
  },
};
/** o dano cresce com o nível do item (+6% por nível acima do 1º) */
export const multiplicadorDoNivel = (nivel: number) => 1 + 0.06 * (Math.max(1, nivel) - 1);

export const ESPACOS = 12;
export type Inventario = { espacos: (IdItem | null)[]; equipado: IdItem | null };
export const ehItem = (v: unknown): v is IdItem => typeof v === "string" && v in ITENS;

/** os itens que só o FUNDADOR tem (a espada e os golpes são do personagem do dono, out/2026; o rifle, em teste — ainda
 *  não está pronto pra todos) */
export const ITENS_DO_FUNDADOR: readonly IdItem[] = ["espada-espiritual", "rifle-cosmico"];
/** os itens que chegam sozinhos no inventário (no 1º espaço livre de quem ainda não tem): de todos e só do fundador */
export const ITENS_DE_TODOS: readonly IdItem[] = [];
export const ITENS_NOVOS_DO_FUNDADOR: readonly IdItem[] = ["rifle-cosmico"];
/** quem nunca abriu o inventário: o fundador com a espada no 1º espaço, já equipada (e o rifle no 2º); todo o resto, vazio */
export function inventarioInicial(fundador = true): Inventario {
  const espacos: (IdItem | null)[] = Array.from({ length: ESPACOS }, () => null);
  if (!fundador) return comItensDeTodos({ espacos, equipado: null });
  espacos[0] = "espada-espiritual";
  return comItensDeTodos({ espacos, equipado: "espada-espiritual" }, true);
}
/** garante os itens que chegam sozinhos (quem salvou o inventário antes deles existirem ganha no 1º espaço livre) */
export function comItensDeTodos(inv: Inventario, fundador = false): Inventario {
  let espacos = inv.espacos;
  for (const id of [...ITENS_DE_TODOS, ...(fundador ? ITENS_NOVOS_DO_FUNDADOR : [])]) {
    if (espacos.includes(id)) continue;
    const i = espacos.indexOf(null); if (i < 0) continue;
    espacos = espacos.slice(); espacos[i] = id;
  }
  return espacos === inv.espacos ? inv : { ...inv, espacos };
}
/** tira o que a pessoa não pode ter (os itens do fundador, de quem não é) */
export function itensPermitidos(inv: Inventario, fundador: boolean): Inventario {
  inv = comItensDeTodos(inv, fundador);
  if (fundador) return inv;
  const espacos = inv.espacos.map((x) => (x && ITENS_DO_FUNDADOR.includes(x) ? null : x));
  return { espacos, equipado: inv.equipado && espacos.includes(inv.equipado) ? inv.equipado : null };
}
/** limpa o que veio do navegador (item desconhecido some; o equipado precisa estar nos espaços) */
export function sanitizarInventario(v: unknown): Inventario {
  const o = (v ?? {}) as Record<string, unknown>;
  if (!Array.isArray(o.espacos)) return inventarioInicial();
  const espacos = Array.from({ length: ESPACOS }, (_, i) => { const x = (o.espacos as unknown[])[i]; return ehItem(x) ? x : null; });
  const equipado = ehItem(o.equipado) && espacos.includes(o.equipado) ? o.equipado : null;
  return { espacos, equipado };
}
export const equipar = (inv: Inventario, id: IdItem | null): Inventario => (id === null || inv.espacos.includes(id) ? { ...inv, equipado: id } : inv);
export const chaveInventario = (usuario: string) => `zaeon_inventario_${usuario}`;
