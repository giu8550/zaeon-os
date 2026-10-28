/**
 * lib/chat/codigo.ts — cores leves pro bloco de código do chat (#634). PURO, sem lib.
 *
 * Não é um parser de linguagem: separa comentário, texto entre aspas, número e palavra-chave comum — o bastante
 * pro código se destacar do texto da resposta. O comentário depende da linguagem (`#` no Python/shell, `--` no SQL,
 * `//` e `/* *\/` no resto); sem linguagem, `#` só conta no começo da linha (o Python que veio sem rótulo).
 */
export type PedacoCodigo = { tipo: "texto" | "comentario" | "string" | "numero" | "palavra"; t: string };

const COM_CERQUILHA = new Set(["python", "py", "bash", "sh", "shell", "zsh", "r", "ruby", "rb", "yaml", "yml", "toml", "perl", "dockerfile", "makefile", "powershell", "ps1"]);
const COM_TRACOS = new Set(["sql", "lua", "haskell", "hs"]);
/** rótulos que são texto, não código: só a caixa, sem cores */
const SEM_CORES = new Set(["text", "txt", "plain", "plaintext", "md", "markdown", "saida", "saída", "output", "console"]);

const PALAVRAS = new Set((
  "if else elif for while do return def function class import from export default const let var async await try " +
  "except catch finally throw throws raise new in of not and or is None True False null true false undefined nil " +
  "with as public private protected static void int float double char long string bool boolean lambda yield break " +
  "continue pass this self struct enum interface type package fn mut use match case switch extends implements " +
  "select where insert update delete create table into values join on group by order limit begin end then local"
).split(" "));

export function colorirCodigo(codigo: string, lang = ""): PedacoCodigo[] {
  const l = lang.toLowerCase();
  if (SEM_CORES.has(l)) return [{ tipo: "texto", t: codigo }];
  const comentario = COM_CERQUILHA.has(l) ? "#[^\\n]*"
    : COM_TRACOS.has(l) ? "--[^\\n]*"
    : l ? "\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*"
    : "\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*|(?<=^|\\n)[ \\t]*#[^\\n]*";
  const re = new RegExp(
    `(${comentario})|("(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\.|[^\`\\\\])*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_]\\w*)`,
    "g",
  );
  const out: PedacoCodigo[] = [];
  const poe = (tipo: PedacoCodigo["tipo"], t: string) => {
    const u = out[out.length - 1];
    if (u && u.tipo === tipo) u.t += t; else out.push({ tipo, t });
  };
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(codigo))) {
    if (m.index > ultimo) poe("texto", codigo.slice(ultimo, m.index));
    if (m[1] !== undefined) poe("comentario", m[1]);
    else if (m[2] !== undefined) poe("string", m[2]);
    else if (m[3] !== undefined) poe("numero", m[3]);
    else poe(PALAVRAS.has(m[4]) ? "palavra" : "texto", m[4]);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < codigo.length) poe("texto", codigo.slice(ultimo));
  return out;
}
