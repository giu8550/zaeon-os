/**
 * UMA PASSADA nos transparentes de dupla face. O three desenha material `transparent` + `DoubleSide` em DUAS passadas
 * (as costas, depois a frente) e, pra isso, troca o `side` e marca `needsUpdate` a CADA objeto, a cada quadro — o que
 * força a checagem do programa (getParameters/getProgram) e dobra as draw calls. Na Zaeon eram ~73 materiais assim
 * (brilhos, auras, vidros): ~8.600 trocas de programa por segundo.
 * `forceSinglePass` desenha numa passada só. Nos que não escrevem profundidade (o brilho aditivo, os véus) a ordem das
 * faces não muda nada que se veja — a soma é a mesma. Os que escrevem profundidade ficam como estão.
 */
import * as THREE from "three";

const vistos = new WeakSet<THREE.Material>();

/** passa pela cena e acerta os materiais novos (barato: só olha cada material uma vez) — devolve quantos mudou */
export function umaPassadaNosTransparentes(raiz: THREE.Object3D): number {
  let n = 0;
  raiz.traverse((o) => {
    const ms = (o as THREE.Mesh).material; if (!ms) return;
    for (const m of Array.isArray(ms) ? ms : [ms]) {
      if (vistos.has(m)) continue; vistos.add(m);
      if (m.transparent && m.side === THREE.DoubleSide && !m.depthWrite && !m.forceSinglePass) { m.forceSinglePass = true; n++; }
    }
  });
  return n;
}
