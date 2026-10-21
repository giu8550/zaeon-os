/** Colisão simples do cyberespaço: colisores circulares no plano XZ, sem física pesada. PURO. */
export type Colisor = { x: number; z: number; r: number };
export type P2 = { x: number; z: number };

export const dentroDeAlgum = (p: P2, cs: Colisor[]) => cs.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r);

/**
 * Se `p` caiu dentro de um colisor, devolve o ponto na BORDA (projeção radial). Aplicado a cada passo, isso
 * faz o personagem ESCORREGAR na tangente em vez de travar seco. Também vale pro destino do clique-pra-andar.
 */
export function empurrarParaFora(p: P2, cs: Colisor[]): P2 {
  let x = p.x, z = p.z;
  // (até 4 passadas: sair de um círculo pode cair dentro de outro já visto — numa fileira de círculos encostados, quem
  //  chegava reto entre dois ESCORREGAVA pro outro lado. Quase sempre a 2ª passada já não mexe em nada)
  for (let passada = 0; passada < 4; passada++) {
    let mexeu = false;
    for (const c of cs) {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
      if (d >= c.r) continue;
      mexeu = true;
      if (d < 1e-4) { x = c.x + c.r; z = c.z; continue; }
      x = c.x + (dx / d) * c.r; z = c.z + (dz / d) * c.r;
    }
    if (!mexeu) break;
  }
  return { x, z };
}
