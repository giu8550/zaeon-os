/**
 * Cyberespaço — RECADO do dono pro QG do Andrei (PURO). O texto chega pelo servidor (lib/lounge3d, rota /recado);
 * aqui: onde o holograma fica (ao lado da tela de trabalho da base do QG), a quebra de linhas e o "há quanto tempo".
 */

/** o holograma no referencial da BASE do QG (o mesmo de BaseEstudo): à direita de quem trabalha, além da asa do
 *  monitor vertical, girado pra ser lido de onde ele fica (0, −0.15) e também de quem entra pelo portão */
export const HOLO_NA_BASE = { x: 3.1, z: -0.6, giro: -0.7 } as const;

/** quebra o texto em linhas que cabem em `largura` (medida por `medir`); a última leva "…" se sobrar texto */
export function linhasDoRecado(texto: string, medir: (s: string) => number, largura: number, maxLinhas: number): string[] {
  const out: string[] = [];
  for (const par of texto.split(/\n/)) {
    let linha = "";
    for (const palavra of par.split(/\s+/).filter(Boolean)) {
      // palavra maior que a linha inteira: corta em pedaços
      let p = palavra;
      while (medir(p) > largura) { let k = p.length - 1; while (k > 1 && medir(p.slice(0, k)) > largura) k--; if (linha) { out.push(linha); linha = ""; } out.push(p.slice(0, k)); p = p.slice(k); }
      const tent = linha ? `${linha} ${p}` : p;
      if (medir(tent) <= largura) linha = tent; else { out.push(linha); linha = p; }
    }
    out.push(linha);
  }
  while (out.length && !out[out.length - 1]) out.pop();
  if (out.length <= maxLinhas) return out;
  const corte = out.slice(0, maxLinhas);
  let ult = corte[maxLinhas - 1]!;
  while (ult && medir(`${ult}…`) > largura) ult = ult.slice(0, -1);
  corte[maxLinhas - 1] = `${ult.trimEnd()}…`;
  return corte;
}

/** "agora", "há 5 min", "há 2 h", "há 3 dias" */
export function tempoDoRecado(ts: number, agora: number): string {
  const s = Math.max(0, (agora - ts) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400); return d === 1 ? "há 1 dia" : `há ${d} dias`;
}
