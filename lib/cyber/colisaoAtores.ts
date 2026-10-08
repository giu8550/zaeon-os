/**
 * Cyberespaço — COLISÃO ENTRE AVATARES (PURO). Ninguém atravessa ninguém: o meu avatar é empurrado pra fora dos outros
 * (jogadores, personagens como a Nina, as IAs da frota) e quem anda num roteiro de relógio (personagens, IAs) DESVIA de
 * quem está no caminho — um deslocamento suave pro lado (o roteiro de verdade não muda: todos os clientes continuam
 * vendo o mesmo lugar, só o corpo contorna quem está ali).
 */
export type P2 = { x: number; z: number };
/** o raio do corpo (m) e a distância mínima entre dois corpos */
export const RAIO_CORPO = 0.42, ENTRE_CORPOS = 2 * RAIO_CORPO;

/** os colisores (círculos) dos outros corpos no MEU nível (± `faixa` m de altura) */
export function colisoresDeCorpos(outros: Iterable<P2 & { y: number }>, meuY: number, faixa = 1.4): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (const o of outros) if (Math.abs(o.y - meuY) < faixa) out.push({ x: o.x, z: o.z, r: ENTRE_CORPOS });
  return out;
}

/** quanto um corpo em `p` precisa ser empurrado pra sair de cima dos `obstaculos` (soma dos empurrões; 0 se livre) */
export function empurrao(p: P2, obstaculos: readonly P2[], minimo = ENTRE_CORPOS): P2 {
  let x = 0, z = 0;
  for (const o of obstaculos) {
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
    if (d >= minimo) continue;
    if (d < 1e-4) { x += minimo; continue; }   // em cima: sai pro lado (determinístico)
    const k = (minimo - d) / d; x += dx * k; z += dz * k;
  }
  return { x, z };
}

/** o DESVIO suave de quem anda em roteiro: vai até o empurrão necessário (rápido) e volta a zero devagar */
export function desviar(atual: P2, alvo: P2, dt: number): P2 {
  const ida = Math.hypot(alvo.x, alvo.z) > Math.hypot(atual.x, atual.z), k = Math.min(1, dt * (ida ? 12 : 2.5));
  return { x: atual.x + (alvo.x - atual.x) * k, z: atual.z + (alvo.z - atual.z) * k };
}
