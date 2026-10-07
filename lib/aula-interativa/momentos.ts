/**
 * lib/aula-interativa/momentos.ts — QUANDO cada elemento da cena entra (puro, testável).
 *
 * Elemento com `marca` entra no instante em que a narração diz a palavra marcada (tempos do TTS);
 * sem marca, entra na ordem, espaçado ao longo da fala. O Papermorph tem uma regra que vale
 * copiar: "abra no assunto" — se nada aparece no primeiro 0,8 s, o primeiro elemento é puxado
 * pra 0,4 s (a cena nunca fica vazia enquanto a voz já fala).
 */
import type { Cena, Item, TempoBeat } from "@/lib/aula-interativa/contrato";

/** Chaves dos elementos da cena, na ordem de leitura, com a marca (se houver). */
export function elementos(c: Cena): { chave: string; marca?: string }[] {
  const its = (pre: string, xs: Item[]) => xs.map((x, i) => ({ chave: `${pre}${i}`, marca: x.marca }));
  switch (c.layout) {
    case "titulo": return [{ chave: "titulo" }, ...(c.subtitulo ? [{ chave: "sub", marca: c.marcaSubtitulo }] : [])];
    case "passos": return [...its("i", c.itens), ...(c.destaque ? [{ chave: "dest", marca: c.destaque.marca }] : [])];
    case "comparar": {
      // intercala esquerda/direita: comparar é ver os dois lados crescendo juntos
      const e = its("e", c.esquerda.itens), d = its("d", c.direita.itens);
      const out: { chave: string; marca?: string }[] = [{ chave: "cabE" }, { chave: "cabD" }];
      for (let i = 0; i < Math.max(e.length, d.length); i++) { if (e[i]) out.push(e[i]); if (d[i]) out.push(d[i]); }
      return out;
    }
    case "fluxo": return its("n", c.nos);
    case "formula": return [...its("l", c.linhas), ...(c.erro ? [{ chave: "erro", marca: c.erro.marca }] : [])];
    case "destaque": return [{ chave: "termo" }, { chave: "def", marca: c.marcaDefinicao }, ...its("f", c.fatos ?? [])];
    case "resumo": return its("r", c.itens);
  }
}

/** Instante (s) em que cada chave aparece neste beat. */
export function momentos(c: Cena | undefined, t: TempoBeat): Record<string, number> {
  if (!c) return {};
  const els = elementos(c);
  const out: Record<string, number> = {};
  const semMarca = els.filter((e) => !(e.marca && t.marcas[e.marca] !== undefined)).length || 1;
  const passo = Math.min(3, Math.max(0.6, (t.duracao * 0.7) / semMarca));
  let ultimo = 0;
  els.forEach((e, i) => {
    const m = e.marca !== undefined ? t.marcas[e.marca] : undefined;
    const quando = m !== undefined ? m : i === 0 ? 0.3 : ultimo + passo;
    out[e.chave] = Math.max(0, quando);
    ultimo = out[e.chave];
  });
  // "abra no assunto": nada em cena antes de 0,8 s → o primeiro elemento vem pra 0,4 s. Um título
  // fixo da cena (passos/comparar/fluxo/fórmula) já é o assunto na tela — aí a marca manda.
  const temTitulo = c.layout !== "titulo" && "titulo" in c && !!c.titulo;
  const primeiro = Math.min(...Object.values(out));
  if (!temTitulo && primeiro > 0.8) out[els[0].chave] = 0.4;
  return out;
}

/** Legenda em cena no instante t (a última frase que já começou). */
export function legendaEm(t: TempoBeat, agora: number): string {
  let atual = "";
  for (const [ini, frase] of t.legendas) if (ini <= agora + 0.05) atual = frase;
  return atual;
}

export type Placar = { certas: number; total: number };
/** Placar por prefixo de id ("c-" checagens, "p-" prática), só a primeira tentativa conta. */
export function placar(respostas: Record<string, Placar>, prefixo: string): Placar {
  return Object.entries(respostas)
    .filter(([k]) => k.startsWith(prefixo))
    .reduce((a, [, v]) => ({ certas: a.certas + v.certas, total: a.total + v.total }), { certas: 0, total: 0 });
}
