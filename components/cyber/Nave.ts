/**
 * Nave — o veículo do dono (fica no hangar da Zaeon), no visual "alien" clássico: DISCO VOADOR metálico com cúpula
 * de vidro (um piloto de luz lá dentro), anel de luzes na borda que gira devagar com uma onda de brilho LENTA (sem
 * estrobo), núcleo luminoso por baixo com um feixe suave quando paira, e três pernas de pouso que recolhem em voo.
 * Inclina nas curvas e flutua de leve. Contrato igual ao anterior (group/alvos/atualizar/dispose) — física do voo em
 * lib/cyber/voo.ts; a origem do group é o ponto de apoio no chão.
 */
import * as THREE from "three";
import { glowTex } from "./CenaCosmica";
import { liberar } from "./Landmark";

export type NaveHandle = {
  group: THREE.Group;
  /** malhas pro clique (embarcar) */
  alvos: THREE.Object3D[];
  /** `voando`: recolhe as pernas e acende o núcleo; `vel` (0..1) acelera o giro das luzes; `curva` inclina */
  atualizar(o: { dt: number; t: number; voando: boolean; vel: number; curva: number }): void;
  dispose(): void;
};

const ALIEN = new THREE.Color(0x8bffcf);   // verde-ciano "alienígena" das luzes
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function criarNave(opts: { cor?: string; low: boolean }): NaveHandle {
  const cor = new THREE.Color(opts.cor ?? "#2f7bff");
  const raiz = new THREE.Group();
  const corpo = new THREE.Group(); raiz.add(corpo);   // inclinação/flutuação aqui; posição/yaw na raiz
  const alvos: THREE.Object3D[] = [];
  const seg = opts.low ? 28 : 48, parado = reducedMotion();

  // casco: perfil de disco (lathe em torno do Y) — barriga funda, aba fina, dorso abaulado
  // metal "fosco claro": sem mapa de ambiente na cena, metalness alto fica preto
  const metal = new THREE.MeshStandardMaterial({ color: 0xcfd9e0, roughness: 0.35, metalness: 0.4, emissive: 0x24464c, emissiveIntensity: 0.45 });
  const perfil = [[0, -0.6], [1.1, -0.62], [2.4, -0.42], [3.5, -0.1], [3.75, 0.02], [3.55, 0.18], [2.4, 0.46], [1.4, 0.62], [0, 0.66]].map(([r, y]) => new THREE.Vector2(r!, y!));
  const casco = new THREE.Mesh(new THREE.LatheGeometry(perfil, seg), metal); corpo.add(casco); alvos.push(casco);
  // friso luminoso na aba
  const friso = new THREE.Mesh(new THREE.TorusGeometry(3.62, 0.05, 6, seg), new THREE.MeshBasicMaterial({ color: ALIEN, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  friso.rotation.x = Math.PI / 2; friso.position.y = 0.06; corpo.add(friso);

  // cúpula de vidro com o piloto de luz (tinta da armadura do dono)
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(1.3, seg, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x1d5f6a, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }));
  cupula.scale.y = 0.8; cupula.position.y = 0.6; corpo.add(cupula); alvos.push(cupula);
  const piloto = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 4, 10), new THREE.MeshStandardMaterial({ color: 0x07131c, emissive: cor, emissiveIntensity: 1.4, roughness: 0.4 }));
  piloto.position.y = 1.05; corpo.add(piloto);

  // anel de luzes na borda (giram devagar; brilho em onda lenta)
  const NL = opts.low ? 12 : 18, aro = new THREE.Group(); corpo.add(aro);
  const luzes: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < NL; i++) {
    const a = (i / NL) * Math.PI * 2, mat = new THREE.MeshBasicMaterial({ color: ALIEN.clone().lerp(new THREE.Color(0xffffff), 0.2), transparent: true, opacity: 0.8 });
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat); l.position.set(Math.cos(a) * 3.55, -0.04, Math.sin(a) * 3.55); aro.add(l); luzes.push(mat);
  }

  // por baixo: núcleo luminoso + anel + feixe suave (só quando paira devagar)
  const tex = glowTex("rgba(200,255,230,1)", "rgba(90,255,190,.3)");
  const nucleo = new THREE.Mesh(new THREE.CircleGeometry(0.9, seg), new THREE.MeshBasicMaterial({ color: ALIEN, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  nucleo.rotation.x = Math.PI / 2; nucleo.position.y = -0.61; corpo.add(nucleo);
  const anelBaixo = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.06, 6, seg), new THREE.MeshBasicMaterial({ color: ALIEN, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  anelBaixo.rotation.x = Math.PI / 2; anelBaixo.position.y = -0.5; corpo.add(anelBaixo);
  const brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  brilho.scale.set(7, 7, 1); brilho.position.y = -0.9; corpo.add(brilho);
  const feixeMat = new THREE.MeshBasicMaterial({ color: ALIEN, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const feixe = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4, seg, 1, true), feixeMat); feixe.position.y = -2.6; feixe.visible = false; corpo.add(feixe);

  // pernas de pouso (recolhem em voo)
  const trem = new THREE.Group(); corpo.add(trem);
  const escuro = new THREE.MeshStandardMaterial({ color: 0x1a2328, roughness: 0.5, metalness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2, x = Math.cos(a) * 1.9, z = Math.sin(a) * 1.9;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.75, 8), escuro); p.position.set(x, -0.62, z); p.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); trem.add(p);
    const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.06, 12), escuro); pe.position.set(x * 1.08, -0.98, z * 1.08); trem.add(pe);
  }

  raiz.scale.setScalar(1.25);
  let inclina = 0, voo = 0, giro = 0;
  return {
    group: raiz, alvos,
    atualizar({ dt, t, voando, vel, curva }) {
      voo += ((voando ? 1 : 0) - voo) * Math.min(1, dt * 3);
      trem.scale.y = Math.max(0.01, 1 - voo); trem.visible = voo < 0.95;
      corpo.position.y = 1.0 + voo * Math.sin(t * 1.3) * 0.15;   // em solo apoia nas pernas; em voo, leve flutuar
      inclina += (Math.max(-0.35, Math.min(0.35, -curva * 0.5)) * voo - inclina) * Math.min(1, dt * 4);
      corpo.rotation.z = inclina;
      // luzes da borda: giram (mais rápido com velocidade) e o brilho passa em onda LENTA ao redor
      giro += dt * (parado ? 0.05 : 0.35 + 0.9 * Math.min(1, vel)) * (0.4 + 0.6 * voo);
      aro.rotation.y = giro;
      luzes.forEach((m, i) => { m.opacity = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.5 - (i / luzes.length) * Math.PI * 2)) * (0.5 + 0.5 * voo); });
      (nucleo.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.5 * voo;
      (brilho.material as THREE.SpriteMaterial).opacity = 0.12 + 0.3 * voo;
      // feixe só pairando devagar (efeito "abdução" suave)
      feixeMat.opacity += ((voando && vel < 0.15 ? 0.12 : 0) - feixeMat.opacity) * Math.min(1, dt * 2);
      feixe.visible = feixeMat.opacity > 0.005;
    },
    dispose() { liberar(raiz, [tex]); },
  };
}
