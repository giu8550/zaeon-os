/**
 * EfeitosMovimento — o que se VÊ do movimento turbinado (lib/cyber/movimento): o RASTRO do dash (fantasmas de luz do
 * corpo, na cor da pessoa, que ficam pra trás e somem) e a ONDA DE CHOQUE do impacto (um anel de luz que se abre no chão
 * no pouso forte e no dash que bate). Pool fixo (12 fantasmas, 4 ondas), aditivo, sem sombra — custo ~zero parado.
 */
import * as THREE from "three";

export type EfeitosMovimentoHandle = {
  /** um fantasma do corpo em `p` (os pés), virado pra `rumo`, na `cor` */
  fantasma(p: THREE.Vector3, rumo: number, cor: THREE.ColorRepresentation): void;
  /** uma onda de choque no chão em `p`, força 0..1 */
  onda(p: THREE.Vector3, forca: number): void;
  atualizar(dt: number): void;
  dispose(): void;
};

const VIDA_FANTASMA = 0.32, VIDA_ONDA = 0.55;

export function criarEfeitosMovimento(cena: THREE.Object3D): EfeitosMovimentoHandle {
  const g = new THREE.Group(); g.name = "efeitos-movimento"; cena.add(g);
  // o fantasma: uma cápsula do tamanho do corpo (o avatar é um ser de luz — a silhueta brilhando basta)
  const geoF = new THREE.CapsuleGeometry(0.32, 1.05, 4, 10); geoF.translate(0, 0.85, 0);
  const fantasmas = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(geoF, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; m.frustumCulled = false; g.add(m); return { m, vida: 0 };
  });
  const geoO = new THREE.RingGeometry(0.82, 1, 56); geoO.rotateX(-Math.PI / 2);
  const ondas = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(geoO, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false; m.frustumCulled = false; g.add(m); return { m, vida: 0, forca: 0 };
  });
  let iF = 0, iO = 0;
  return {
    fantasma(p, rumo, cor) {
      const f = fantasmas[iF++ % fantasmas.length]!;
      f.m.position.copy(p); f.m.rotation.y = rumo; (f.m.material as THREE.MeshBasicMaterial).color.set(cor); f.vida = VIDA_FANTASMA; f.m.visible = true;
    },
    onda(p, forca) {
      const o = ondas[iO++ % ondas.length]!;
      o.m.position.set(p.x, p.y + 0.06, p.z); o.vida = VIDA_ONDA; o.forca = Math.max(0.2, Math.min(1, forca)); o.m.visible = true;
    },
    atualizar(dt) {
      for (const f of fantasmas) {
        if (!f.m.visible) continue;
        f.vida -= dt; if (f.vida <= 0) { f.m.visible = false; continue; }
        const k = f.vida / VIDA_FANTASMA; (f.m.material as THREE.MeshBasicMaterial).opacity = 0.42 * k * k; f.m.scale.set(1 + (1 - k) * 0.25, 1, 1 + (1 - k) * 0.25);
      }
      for (const o of ondas) {
        if (!o.m.visible) continue;
        o.vida -= dt; if (o.vida <= 0) { o.m.visible = false; continue; }
        const u = 1 - o.vida / VIDA_ONDA, r = 0.6 + u * (3 + 7 * o.forca);
        o.m.scale.setScalar(r); (o.m.material as THREE.MeshBasicMaterial).opacity = 0.85 * o.forca * (1 - u) * (1 - u);
      }
    },
    dispose() {
      for (const f of fantasmas) (f.m.material as THREE.Material).dispose();
      for (const o of ondas) (o.m.material as THREE.Material).dispose();
      geoF.dispose(); geoO.dispose(); g.removeFromParent();
    },
  };
}
