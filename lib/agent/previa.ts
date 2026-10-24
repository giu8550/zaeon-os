/**
 * A PRÉVIA do rascunho (out/2026): o rascunho da Aura é um JSON estruturado ({nucleo, desenvolvimento?, …}) gerado
 * em stream; daqui sai o texto do `nucleo` JÁ ESCRITO, a partir do JSON ainda incompleto — pra o chat mostrar a
 * resposta nascendo em vez de esperar o turno inteiro. PURO.
 */

/** o valor (parcial) da chave string `chave` no topo de um JSON incompleto, já desescapado; "" se ela ainda não começou */
export function extrairCampoParcial(json: string, chave: string): string {
  const m = new RegExp(`"${chave}"\\s*:\\s*"`).exec(json);
  if (!m) return "";
  let i = m.index + m[0].length, out = "";
  while (i < json.length) {
    const c = json[i]!;
    if (c === '"') return out;          // a string fechou
    if (c !== "\\") { out += c; i++; continue; }
    const n = json[i + 1];
    if (n === undefined) return out;   // escape partido no fim do pedaço: espera o próximo
    if (n === "u") {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) return out;  // \uXXXX incompleto
      out += String.fromCharCode(parseInt(hex, 16)); i += 6; continue;
    }
    out += ({ n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" } as Record<string, string>)[n] ?? n;
    i += 2;
  }
  return out;
}

/** o texto da prévia: o `nucleo` (e, quando ele já fechou, o começo do `desenvolvimento`) */
export function previaDoRascunho(json: string): string {
  const nucleo = extrairCampoParcial(json, "nucleo");
  const fechou = nucleo && new RegExp(`"nucleo"\\s*:\\s*"(?:[^"\\\\]|\\\\.)*"`).test(json);
  const dev = fechou ? extrairCampoParcial(json, "desenvolvimento") : "";
  return dev ? `${nucleo}\n\n${dev}` : nucleo;
}

/**
 * Quem MANDA a prévia pro fio: recebe o texto acumulado e emite só o TRECHO NOVO, no máximo a cada `intervaloMs`.
 * Um texto que não continua o já mandado (o 2º rascunho de uma revisão) não é mandado — a resposta final corrige.
 * O que ficou retido pelo intervalo sai no próximo pedaço (o trecho é sempre "tudo depois do já mandado").
 */
export function criarEmissorPrevia(emitir: (pedaco: string) => void, intervaloMs = 120, agora: () => number = Date.now) {
  let enviada = "", proxima = 0;
  return (texto: string) => {
    const t = agora();
    if (t < proxima || texto.length <= enviada.length || !texto.startsWith(enviada)) return;
    emitir(texto.slice(enviada.length));
    enviada = texto; proxima = t + intervaloMs;
  };
}
