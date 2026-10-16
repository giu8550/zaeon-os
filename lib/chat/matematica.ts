/**
 * lib/chat/matematica.ts — onde está a matemática num texto de resposta. PURO, seguro em streaming.
 *
 * Blocos (podem ocupar várias linhas):  $$ … $$ · \[ … \] · ```grafico {json} ```
 * Inline (dentro de uma linha):          $ … $ · \( … \)
 *
 * Regras do `$` inline (as do remark-math/pandoc, pra não confundir com dinheiro):
 * o `$` de abertura não pode ser seguido de espaço, o de fechamento não pode ser precedido de
 * espaço nem seguido de dígito, e `R$`/`US$` nunca abrem. Delimitador sem par = texto (enquanto
 * o streaming não fecha, nada "pisca").
 */
export type Bloco =
  | { tipo: "texto"; conteudo: string }
  | { tipo: "formula"; conteudo: string }          // display ($$ / \[)
  | { tipo: "grafico"; conteudo: string };         // JSON cru do ```grafico (validado no componente)

export type PedacoInline = { tipo: "texto"; conteudo: string } | { tipo: "formula"; conteudo: string };

/** Separa o texto em blocos de display/gráfico e texto comum. */
export function segmentarBlocos(texto: string): Bloco[] {
  const s = String(texto ?? "");
  const out: Bloco[] = [];
  const re = /(\$\$)([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|```(?:grafico|gráfico|plot)[ \t]*\n([\s\S]*?)```/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > ultimo) out.push({ tipo: "texto", conteudo: s.slice(ultimo, m.index) });
    if (m[4] !== undefined) out.push({ tipo: "grafico", conteudo: m[4].trim() });
    else out.push({ tipo: "formula", conteudo: String(m[2] ?? m[3]).trim() });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < s.length) out.push({ tipo: "texto", conteudo: s.slice(ultimo) });
  return out.filter((b) => b.tipo !== "texto" || b.conteudo.length > 0);
}

/** Separa uma LINHA em texto e fórmulas inline. */
export function segmentarInline(linha: string): PedacoInline[] {
  const s = String(linha ?? "");
  const out: PedacoInline[] = [];
  let buf = "";
  let i = 0;
  const empurraTexto = () => { if (buf) { out.push({ tipo: "texto", conteudo: buf }); buf = ""; } };
  while (i < s.length) {
    // \( … \)
    if (s.startsWith("\\(", i)) {
      const fim = s.indexOf("\\)", i + 2);
      if (fim > i + 2) { empurraTexto(); out.push({ tipo: "formula", conteudo: s.slice(i + 2, fim).trim() }); i = fim + 2; continue; }
    }
    if (s[i] === "\\" && s[i + 1] === "$") { buf += "$"; i += 2; continue; }   // \$ = cifrão literal
    if (s[i] === "$" && s[i + 1] !== "$") {
      const antes = s.slice(Math.max(0, i - 2), i);
      const abre = !/\s/.test(s[i + 1] ?? " ") && !/(?:R|US|U\$S)$/i.test(antes.trim()) && !/[A-Za-z]$/.test(antes);
      if (abre) {
        let j = i + 1;
        let fim = -1;
        while (j < s.length) {
          if (s[j] === "\\") { j += 2; continue; }
          if (s[j] === "$") {
            if (!/\s/.test(s[j - 1]) && !/\d/.test(s[j + 1] ?? "")) { fim = j; }
            break;
          }
          j++;
        }
        // "$5 e $10" já não fecha (o 2º $ vem depois de espaço); "$3$" é fórmula de verdade (catetos $3$ e $4$)
        const conteudo = fim > 0 ? s.slice(i + 1, fim) : "";
        if (fim > 0 && conteudo.trim()) {
          empurraTexto(); out.push({ tipo: "formula", conteudo }); i = fim + 1; continue;
        }
      }
    }
    buf += s[i]; i++;
  }
  empurraTexto();
  return out;
}

/** O texto tem fórmula ou gráfico? (o modo revista desenha em canvas e não comporta). */
export function temMatematica(texto: string): boolean {
  const s = String(texto ?? "");
  if (segmentarBlocos(s).some((b) => b.tipo !== "texto")) return true;
  return s.split("\n").some((l) => segmentarInline(l).some((p) => p.tipo === "formula"));
}
