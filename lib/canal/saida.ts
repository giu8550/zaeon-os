/**
 * lib/canal/saida.ts — limparSaidaAgente (Fatia 7, G5/G6). PURO.
 *
 * Todo texto de agente passa aqui ANTES de persistir (chore e turno do canal). Proíbe imagem
 * remota na saída — `![x](https://evil/p.png)` é o canal clássico de exfiltração (o cliente busca a
 * URL com o dado na query) — e qualquer HTML. Mantém o que o RichText renderiza (`**`, `*`, quebras).
 * Texto sem imagem/HTML/esquema perigoso sai IGUAL (o turno do canal não muda). Link markdown com
 * `javascript:`/`data:`/`vbscript:`/`file:` vira só o rótulo; link normal fica como está.
 */
const ESQUEMA_PERIGOSO = /^\s*(?:javascript|data|vbscript|file):/i;
/** URL entre parênteses, tolerando 1 nível de parênteses dentro (`javascript:alert(1)`). */
const URL_P = String.raw`\(((?:[^()]|\([^()]*\))*)\)`;
const IMG_MD = new RegExp(String.raw`!\[[^\]]*\]` + URL_P, "g");
const LINK_MD = new RegExp(String.raw`\[([^\]]*)\]` + URL_P, "g");

export function limparSaidaAgente(texto: string): string {
  const original = String(texto ?? "");
  let t = original;
  // 1) imagem markdown (inclusive referência) — some inteira, nunca vira link clicável
  t = t.replace(IMG_MD, "");
  t = t.replace(/!\[[^\]]*\]\[[^\]]*\]/g, "");
  // 2) <img …> e qualquer tag HTML (inclui <script>…</script> com o conteúdo)
  t = t.replace(/<\s*(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  t = t.replace(/<\/?[a-z][^>]*>/gi, "");
  t = t.replace(/<!--[\s\S]*?-->/g, "");
  // 3) links markdown com esquema perigoso → só o rótulo (link normal fica intacto)
  t = t.replace(LINK_MD, (m, rotulo: string, url: string) => (ESQUEMA_PERIGOSO.test(url) ? rotulo : m));
  // 4) esquemas perigosos soltos no texto
  t = t.replace(/\b(?:javascript|vbscript):\S*/gi, "");
  t = t.replace(/\bdata:[a-z]+\/[a-z0-9.+-]+[;,][^\s)]*/gi, "");
  if (t === original) return original; // nada removido → byte a byte igual
  // 5) espaços que a remoção deixou (sem mexer nas quebras de linha)
  t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
  return t.trim();
}
