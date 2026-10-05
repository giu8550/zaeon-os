/**
 * Nave — o veículo espacial do dono (fica no hangar da Cidade Zaeon). Estilizada no idioma da cena: casco claro com
 * acentos emissivos na cor da armadura (azul), cockpit de cristal, asas enflechadas, dois motores com propulsão que
 * cresce com a velocidade, trem de pouso que recolhe em voo e inclinação nas curvas. Bico aponta pro +Z local
 * (yaw = atan2(vx, vz), igual aos avatares). Física do voo em lib/cyber/voo.ts.
 */
import * as THREE from "three";
import { glowTex } from "./CenaCosmica";
import { liberar } from "./Landmark";

export type NaveHandle = {
  group: THREE.Group;
  /** malhas pro clique (embarcar) */
  alvos: THREE.Object3D[];
  /** `voando`: recolhe o trem e acende os motores; `vel` (0..1) dá o tamanho da propulsão; `curva` inclina */
  atualizar(o: { dt: number; t: number; voando: boolean; vel: number; curva: number }): void;
  dispose(): void;
};

export function criarNave(opts: { cor?: string; low: boolean }): NaveHandle {
  const cor = new THREE.Color(opts.cor ?? "#2f7bff");
  const raiz = new THREE.Group();
  const corpo = new THREE.Group(); raiz.add(corpo);   // inclinação/flutuação aqui; posição/yaw na raiz
  const alvos: THREE.Object3D[] = [];
  const seg = opts.low ? 16 : 28;

  const casco = new THREE.MeshStandardMaterial({ color: 0xdfe8f5, roughness: 0.32, metalness: 0.65, emissive: 0x0b1a33, emissiveIntensity: 0.3 });
  const acento = new THREE.MeshStandardMaterial({ color: cor.clone().multiplyScalar(0.4), emissive: cor, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.4 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x141b2c, roughness: 0.5, metalness: 0.6 });

  // fuselagem torneada (perfil de lathe, eixo Y → deitada no Z)
  const perfil = [[0, -3.2], [0.35, -3.0], [0.75, -2.2], [0.95, -0.8], [0.95, 0.9], [0.8, 2.0], [0.55, 2.6], [0.0, 2.9]].map(([r, y]) => new THREE.Vector2(r!, y!));
  const fus = new THREE.Mesh(new THREE.LatheGeometry(perfil, seg), casco); fus.rotation.x = Math.PI / 2; corpo.add(fus); alvos.push(fus);
  // faixa de acento
  const faixa = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.05, 8, seg), acento); faixa.position.z = 0.2; corpo.add(faixa);
  // cockpit de cristal
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.62, seg, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x9fe8ff, emissive: 0x2a6bd0, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0, transmission: opts.low ? 0 : 0.7, transparent: true, opacity: 0.75 }));
  cockpit.scale.set(1, 0.75, 1.9); cockpit.position.set(0, 0.55, 1.1); corpo.add(cockpit); alvos.push(cockpit);
  // asas enflechadas (extrusão de um trapézio) espelhadas
  const forma = new THREE.Shape(); forma.moveTo(0, 0.9); forma.lineTo(3.4, -0.9); forma.lineTo(3.4, -1.6); forma.lineTo(0, -1.4); forma.closePath();
  const asaGeo = new THREE.ExtrudeGeometry(forma, { depth: 0.12, bevelEnabled: false });
  for (const lado of [1, -1]) {
    const asa = new THREE.Mesh(asaGeo, casco); asa.rotation.x = -Math.PI / 2; asa.scale.x = lado; asa.position.set(lado * 0.7, -0.1, 0); corpo.add(asa); alvos.push(asa);
    const ponta = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.9), acento); ponta.position.set(lado * 4.05, 0.05, 1.25); corpo.add(ponta);
    // motor
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 2.2, seg), escuro); motor.rotation.x = Math.PI / 2; motor.position.set(lado * 1.55, -0.15, -1.6); corpo.add(motor);
    const bocal = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 8, seg), acento); bocal.position.set(lado * 1.55, -0.15, -2.7); corpo.add(bocal);
  }
  // deriva (cauda)
  const deriva = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 1.4), casco); deriva.position.set(0, 0.85, -2.2); deriva.rotation.x = -0.35; corpo.add(deriva);
  // propulsão (sprites + cone aditivo)
  const tex = glowTex("rgba(190,235,255,1)", "rgba(60,140,255,.35)");
  const chamas: { s: THREE.Sprite; c: THREE.Mesh }[] = [];
  for (const lado of [1, -1]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: cor.clone().lerp(new THREE.Color(0xffffff), 0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set(lado * 1.55, -0.15, -2.9); corpo.add(s);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    c.rotation.x = -Math.PI / 2; c.position.set(lado * 1.55, -0.15, -3.2); corpo.add(c);
    chamas.push({ s, c });
  }
  // brilho de sustentação por baixo
  const sust = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: cor, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  sust.scale.set(6, 6, 1); sust.position.y = -0.9; corpo.add(sust);
  // trem de pouso
  const trem = new THREE.Group(); corpo.add(trem);
  for (const [x, z] of [[0, 1.8], [1.2, -1.2], [-1.2, -1.2]] as const) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), escuro); p.position.set(x, -0.95, z); trem.add(p); const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), escuro); pe.position.set(x, -1.35, z); trem.add(pe); }

  raiz.scale.setScalar(1.25);
  let inclina = 0, voo = 0;
  return {
    group: raiz, alvos,
    atualizar({ dt, t, voando, vel, curva }) {
      voo += ((voando ? 1 : 0) - voo) * Math.min(1, dt * 3);
      trem.scale.y = Math.max(0.01, 1 - voo); trem.visible = voo < 0.95;
      corpo.position.y = 1.4 + voo * Math.sin(t * 1.6) * 0.15;   // em solo apoia no trem; em voo, leve flutuar
      inclina += (Math.max(-0.5, Math.min(0.5, -curva * 0.6)) * voo - inclina) * Math.min(1, dt * 4);
      corpo.rotation.z = inclina;
      const p = voo * (0.35 + 0.65 * Math.min(1, vel));
      for (const c of chamas) { const k = 0.8 + p * 2.2; c.s.scale.set(k, k, 1); (c.s.material as THREE.SpriteMaterial).opacity = 0.3 + 0.6 * p; c.c.scale.set(1, 0.3 + p * 2.6, 1); c.c.position.z = -2.9 - (0.15 + p * 1.3); (c.c.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.5 * p; }
      (sust.material as THREE.SpriteMaterial).opacity = 0.15 + 0.35 * voo;
      faixa.rotation.z += dt * 0.2;
    },
    dispose() { liberar(raiz, [tex]); },
  };
}
