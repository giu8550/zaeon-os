/**
 * PISOS QUE ESCONDEM — a versão "céu aberto" das CÉLULAS E PORTAIS do motor do Black Ops (r_dpvs: só se desenha a célula
 * que se enxerga por algum portal). As salas da Zaeon (e os lugares flutuantes) são PLATAFORMAS: quem está ABAIXO do
 * piso de uma não enxerga o que está em cima dela — o próprio piso tampa. Da capela, ~88 m abaixo, só uma faixa estreita
 * na borda mais próxima apareceria (e só o que é alto).
 *
 * O teste (exato e conservador): com a câmera abaixo do plano do piso, cada pedaço do conteúdo (a caixa dele) está
 * escondido se as linhas de visão até os 8 CANTOS da caixa cruzam o plano DENTRO do disco do piso. A perspectiva leva
 * a caixa num convexo e o disco é convexo — os cantos bastam. Peça por peça (o miolo some, a borda fica), cada uma num
 * invólucro próprio que só a oclusão liga/desliga (as animações e o sistema de regiões mexem no que está dentro).
 */
import * as THREE from "three";

export type PisoOclusor = {
  /** o grupo com TUDO que está em cima do piso (filho do grupo da plataforma, no mesmo referencial) */
  acima: THREE.Object3D;
  /** raio do disco do piso (m) e a altura do topo do piso no referencial da plataforma */
  r: number; topo: number;
};
type Interno = PisoOclusor & { pecas: { inv: THREE.Object3D; caixa: THREE.Box3 }[] | null };

const cantos = Array.from({ length: 8 }, () => new THREE.Vector3());
const camL = new THREE.Vector3(), inv = new THREE.Matrix4();

/** na 1ª vez (DEPOIS do lote estático): cada filho de `acima` ganha um INVÓLUCRO próprio — a oclusão liga/desliga só o
 *  invólucro (o sistema de regiões e as animações mexem no filho, sem conflito) — e a caixa dele no referencial da
 *  plataforma (medida uma vez: o que anima mexe pouco). Peça por peça: o miolo some, a borda (que aparece por cima) fica */
function medir(p: Interno) {
  const plat = p.acima.parent!; plat.updateMatrixWorld(true);
  inv.copy(plat.matrixWorld).invert();
  p.pecas = [...p.acima.children].map((c) => {
    const caixa = new THREE.Box3().setFromObject(c).applyMatrix4(inv);
    const w = new THREE.Group(); w.name = "oclusao"; p.acima.add(w); w.add(c);
    return { inv: w, caixa };
  });
}

/** a câmera (no referencial da plataforma) está abaixo do piso e TODOS os cantos de `caixa` estão tampados pelo disco? */
export function tampado(cam: THREE.Vector3, caixa: THREE.Box3, r: number, topo: number, margem = 0.5): boolean {
  if (caixa.isEmpty() || cam.y > topo - margem || caixa.min.y < topo - 0.05) return false;
  const R2 = (r - margem) ** 2;
  let k = 0;
  for (const x of [caixa.min.x, caixa.max.x]) for (const y of [caixa.min.y, caixa.max.y]) for (const z of [caixa.min.z, caixa.max.z]) cantos[k++]!.set(x, y, z);
  for (const c of cantos) {
    const t = (topo - cam.y) / (c.y - cam.y);   // onde a linha câmera→canto cruza o plano do piso (0..1)
    const cx = cam.x + (c.x - cam.x) * t, cz = cam.z + (c.z - cam.z) * t;
    if (cx * cx + cz * cz > R2) return false;
  }
  return true;
}

export function criarOclusaoDePisos() {
  const pisos: Interno[] = [];
  return {
    adicionar(p: PisoOclusor) { pisos.push({ ...p, pecas: null }); },
    /** a cada quadro (8 cantos por plataforma): esconde o conteúdo das plataformas que a câmera não enxerga. Só mexe no
     *  grupo `acima` (ninguém mais liga/desliga ele — as animações e as regiões cuidam do que está dentro) */
    atualizar(cam: THREE.Vector3) {
      for (const p of pisos) {
        const plat = p.acima.parent; if (!plat) continue;
        if (!p.pecas) medir(p);
        camL.copy(cam); plat.worldToLocal(camL);
        const baixo = camL.y < p.topo - 0.5;
        for (const q of p.pecas!) q.inv.visible = !(baixo && tampado(camL, q.caixa, p.r, p.topo));
      }
    },
    /** quantos pedaços estão escondidos agora (teste/depuração) */
    escondidos() { return pisos.map((p) => `${p.acima.name}: ${p.pecas?.filter((q) => !q.inv.visible).length ?? 0}/${p.pecas?.length ?? 0}`); },
  };
}
