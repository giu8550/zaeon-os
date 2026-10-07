/**
 * RoboMotos — o ROBÔ do estacionamento que FABRICA uma moto nova quando alguém leva a da vaga (lib/cyber/motos:
 * `Fabrica`). Um drone (corpo claro, visor de luz, 4 rotores-anel embaixo, dois braços com emissores). Fabricando, ele
 * paira em cima da vaga (FABRICA.altura) e desce um FEIXE de luz dos braços até o chão, com um ANEL de varredura subindo
 * pela moto conforme ela se forma (`progresso` 0..1). O engine move o grupo (moverRobo) e diz o que ele está fazendo.
 */
import * as THREE from "three";
import { FABRICA } from "@/lib/cyber/motos";

export type RoboMotosHandle = {
  group: THREE.Group;
  /** `progresso` = a moto sendo fabricada embaixo (0..1) ou null (voando/em casa); `rumo` = pra onde ele vira */
  atualizar(o: { dt: number; t: number; progresso: number | null; rumo: number }): void;
  dispose(): void;
};

export function criarRoboMotos(o: { low: boolean }): RoboMotosHandle {
  const g = new THREE.Group(), corpo = new THREE.Group(); g.add(corpo);
  const seg = o.low ? 10 : 20;
  const casca = new THREE.MeshStandardMaterial({ color: 0xdfe8f5, roughness: 0.3, metalness: 0.5, emissive: 0x24304a, emissiveIntensity: 0.35 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x1a2133, roughness: 0.4, metalness: 0.8 });
  const luz = new THREE.MeshBasicMaterial({ color: 0x7fe8ff });
  const brilho = new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  // corpo: cápsula deitada + "cabeça" com visor
  const tronco = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 6, seg), casca); tronco.rotation.z = Math.PI / 2; corpo.add(tronco);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.06), luz); visor.position.set(0, 0.12, 0.42); corpo.add(visor);
  const faixa = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.025, 6, seg * 2), brilho); faixa.rotation.y = Math.PI / 2; corpo.add(faixa);
  // 4 rotores-anel embaixo (giram)
  const rotores: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.75, 0.45], [0.75, 0.45], [-0.75, -0.45], [0.75, -0.45]] as const) {
    const braco = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.08), escuro); braco.position.set(x * 0.6, -0.12, z * 0.6); braco.rotation.y = Math.atan2(z, x); corpo.add(braco);
    const r = new THREE.Group(); r.position.set(x, -0.18, z); corpo.add(r);
    r.add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 6, seg * 2), escuro).rotateX(Math.PI / 2));
    const pas = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.06), brilho); r.add(pas); rotores.push(pas);
  }
  // os 2 braços com EMISSORES (apontam pra baixo) — daqui sai o feixe
  const emissores: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const ombro = new THREE.Group(); ombro.position.set(s * 0.35, -0.3, 0.1); corpo.add(ombro);
    const ante = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), escuro); ante.position.y = -0.25; ombro.add(ante);
    const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 10), casca); ponta.rotation.x = Math.PI; ponta.position.y = -0.55; ombro.add(ponta);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), luz); e.position.y = -0.66; ombro.add(e); emissores.push(ombro);
  }
  // o FEIXE (cone de luz até o chão) e o ANEL de varredura — no referencial do grupo (o chão fica em −altura)
  const H = FABRICA.altura;
  const feixeMat = new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const feixe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1.7, H - 0.9, seg, 1, true), feixeMat); feixe.position.y = -0.9 - (H - 0.9) / 2; g.add(feixe);
  const anelMat = new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const anel = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.04, 6, seg * 3), anelMat); anel.rotation.x = Math.PI / 2; g.add(anel);
  let fab = 0;
  return {
    group: g,
    atualizar({ dt, t, progresso, rumo }) {
      corpo.position.y = Math.sin(t * 2.3) * 0.08;   // paira
      let d = rumo - corpo.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); corpo.rotation.y += d * Math.min(1, dt * 4);
      for (const [i, r] of rotores.entries()) r.rotation.y = t * (22 + i);
      fab += ((progresso !== null ? 1 : 0) - fab) * Math.min(1, dt * 5);
      for (const [i, e] of emissores.entries()) e.rotation.x = -0.25 * fab + 0.05 * Math.sin(t * 9 + i * 2) * fab;   // os braços "trabalham"
      feixeMat.opacity = fab * (0.16 + 0.06 * Math.sin(t * 17));
      const k = progresso ?? 1;
      anel.position.y = -H + 0.1 + k * 1.7; anelMat.opacity = fab * 0.9; anel.scale.setScalar(1 - 0.25 * k);
    },
    dispose() {
      g.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); });
      for (const m of [casca, escuro, luz, brilho, feixeMat, anelMat]) m.dispose();
      g.removeFromParent();
    },
  };
}
