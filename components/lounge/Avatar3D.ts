/**
 * Avatar3D — o AVATAR isolado da sala 3D (docs/HANDOFF_LOUNGE_COWORK_3D.md). MVP = cientista
 * procedural (cápsulas/esferas: jaleco branco, gola/crachá na cor do perfil, calça/sapatos escuros,
 * cabelo, olhos) — porte do `makeScientist()` do protótipo. Leve, sem asset externo.
 *
 * É a ÚNICA peça que sabe como o personagem é feito: trocar por Ready Player Me (GLB) + Mixamo, ou
 * por sprite "baked", é reimplementar `criarAvatar` mantendo o contrato {group, animar, olharPara}
 * — a cena não muda.
 */
import * as THREE from "three";

export type AvatarKind = "cientista";
export type Avatar3DHandle = {
  group: THREE.Group;
  /** Ciclo de caminhada/idle; `moving` liga as pernas e o quique. */
  animar(moving: boolean, dt: number): void;
  /** Vira suave pra direção (rad) — menor arco. */
  olharPara(facing: number): void;
  /** Anel no chão marcando "Você". */
  marcarComoEu(): void;
  dispose(): void;
};

const mat = (c: number | string, rough = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 });
function cap(len: number, r: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m); mesh.castShadow = true; return mesh;
}

export function criarAvatar(accent: string, _kind: AvatarKind = "cientista"): Avatar3DHandle {
  const g = new THREE.Group();
  const coat = mat(0xf0f3fb, 0.85), pants = mat(0x3a4262, 0.8), skin = mat(0xe8b48c, 0.65), hair = mat(0x2b2420, 0.55), shoe = mat(0x20283c, 0.5), acc = mat(accent, 0.4);
  const parts: Record<string, THREE.Group> = {};
  const hipY = 0.92;
  for (const [k, x] of [["legL", -0.11], ["legR", 0.11]] as const) {
    const grp = new THREE.Group(); grp.position.set(x, hipY, 0);
    const L = 0.4, r = 0.095; const leg = cap(L, r, pants); leg.position.y = -(L / 2 + r); grp.add(leg);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.085, 0.25), shoe); sh.castShadow = true; sh.position.set(0, -(L + 2 * r) + 0.02, 0.045); grp.add(sh);
    g.add(grp); parts[k] = grp;
  }
  const torso = cap(0.4, 0.165, coat); torso.position.y = 1.16; g.add(torso);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.28, 0.42, 18, 1, true), coat); skirt.castShadow = true; skirt.position.y = 0.8; g.add(skirt);
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.02), mat(0xdfe6f2, 0.7)); lapel.position.set(0, 1.1, 0.16); g.add(lapel);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 20, Math.PI), acc); collar.rotation.x = Math.PI / 2; collar.position.set(0, 1.36, 0.03); g.add(collar);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.085, 0.02), acc); badge.position.set(0.09, 1.2, 0.16); g.add(badge);
  for (const [k, x] of [["armL", -0.205], ["armR", 0.205]] as const) {
    const grp = new THREE.Group(); grp.position.set(x, 1.38, 0);
    const L = 0.34, r = 0.062; const arm = cap(L, r, coat); arm.position.y = -(L / 2 + r); grp.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), skin); hand.castShadow = true; hand.position.y = -(L + 2 * r) + 0.02; grp.add(hand);
    g.add(grp); parts[k] = grp;
  }
  const neck = cap(0.05, 0.05, skin); neck.position.y = 1.47; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 16), skin); head.castShadow = true; head.position.y = 1.6; g.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), hair); hairCap.position.y = 1.615; g.add(hairCap);
  const eyeMat = mat(0x20222e, 0.3);
  for (const ex of [-0.05, 0.05]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeMat); e.position.set(ex, 1.6, 0.125); g.add(e); }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });

  let anim = Math.random() * 6.28, faceTarget = 0, ring: THREE.Mesh | null = null;
  return {
    group: g,
    animar(moving, dt) {
      anim += moving ? dt * 9 : dt * 1.5;
      const s = Math.sin(anim), amt = moving ? 1 : 0.06;
      parts.legL!.rotation.x = 0.5 * s * amt; parts.legR!.rotation.x = -0.5 * s * amt;
      parts.armL!.rotation.x = -0.42 * s * amt; parts.armR!.rotation.x = 0.42 * s * amt;
      g.position.y = moving ? Math.abs(Math.sin(anim)) * 0.045 : 0;
      let d = faceTarget - g.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      g.rotation.y += d * 0.2;
      if (ring) (ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.3 * Math.sin(performance.now() * 0.004);
    },
    olharPara(f) { faceTarget = f; },
    marcarComoEu() {
      if (ring) return;
      ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.37, 40), new THREE.MeshBasicMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    },
    dispose() {
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); const mm = m.material as THREE.Material | THREE.Material[]; (Array.isArray(mm) ? mm : [mm]).forEach((x) => x?.dispose()); } });
      g.removeFromParent();
    },
  };
}

/** Molécula procedural (1º tipo de artefato): 4 átomos + ligações, na posição dada. */
export function criarMolecula(): THREE.Group {
  const g = new THREE.Group();
  const nodes: [number, number, number, number, number][] = [[0, 0.9, 0, 0x4aa3ff, 0.12], [0.35, 1.15, 0, 0xe8f4ff, 0.15], [-0.3, 1.1, 0.1, 0x4aa3ff, 0.12], [0.15, 1.45, 0, 0xffbe54, 0.1]];
  const cm = mat(0x8fb6e8, 0.4);
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[0]!, b = nodes[i]!;
    const va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
    const len = va.distanceTo(vb); const bond = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 8), cm);
    bond.position.copy(va.clone().add(vb).multiplyScalar(0.5));
    bond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()); g.add(bond);
  }
  for (const n of nodes) { const s = new THREE.Mesh(new THREE.SphereGeometry(n[4], 16, 14), mat(n[3], 0.3)); s.castShadow = true; s.position.set(n[0], n[1], n[2]); g.add(s); }
  return g;
}
