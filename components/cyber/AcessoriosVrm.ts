/**
 * AcessoriosVrm — os acessórios dos personagens que o VRoid não tem, feitos em código no mesmo DESENHO anime (cel
 * shading + contorno de tinta — components/cyber/AvatarAnime) e presos aos OSSOS do VRM, então acompanham a pose:
 *  - "foneNoPescoco": o fone over-ear branco descansando em volta do pescoço (o da Nina no card): o arco passa por trás
 *    da nuca e as conchas ficam dos lados, apoiadas nas clavículas;
 *  - "presilhaLapis": a presilha amarela em forma de LÁPIS na franja (Nina);
 *  - "oculosRedondos": os óculos de aro fino dourado, redondos (Aura);
 *  - "presilhaEstrela": a presilha de ESTRELA prateada na franja (Aura).
 * As medidas são em metros, no espaço dos ossos do VRM (VRM 1.0: em repouso, eixos alinhados ao mundo, +Z = frente).
 */
import * as THREE from "three";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import { tintaFixa, toon } from "./AvatarAnime";
import type { AcessorioVrm } from "@/lib/cyber/estiloAvatar";

export type AcessoriosHandle = { dispose(): void };

const TINTA = 0.004;
/** uma malha desenhada: o material toon + o contorno (casca invertida) */
function desenhada(g: THREE.BufferGeometry, cor: THREE.ColorRepresentation, mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const m = toon(cor, { brilho: 0.25 }), t = tintaFixa(TINTA);
  mats.push(m, t); geos.push(g);
  const grupo = new THREE.Group(), corpo = new THREE.Mesh(g, m), traco = new THREE.Mesh(g, t);
  corpo.frustumCulled = traco.frustumCulled = false; traco.raycast = () => {};
  grupo.add(corpo, traco);
  return grupo;
}

/** o fone em volta do pescoço (no osso do pescoço): arco atrás, conchas dos lados, um pouco abaixo do queixo */
function fone(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), R = 0.105;   // largo: passa POR FORA do capuz do moletom
  // o arco: meia volta por TRÁS do pescoço (de um lado ao outro), deitado e um pouco inclinado pra frente
  const arco = desenhada(new THREE.TorusGeometry(R, 0.009, 8, 32, Math.PI), 0xf4f4f6, mats, geos);
  arco.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI); g.add(arco);
  for (const lado of [-1, 1]) {
    const concha = desenhada(new THREE.CylinderGeometry(0.042, 0.038, 0.032, 20), 0xf4f4f6, mats, geos);
    concha.rotation.z = Math.PI / 2; concha.position.set(lado * (R + 0.004), -0.012, 0.012);
    concha.rotation.y = lado * 0.35;   // viradas um pouco pra frente, como quando o fone está no pescoço
    const almofada = desenhada(new THREE.TorusGeometry(0.03, 0.009, 6, 20), 0x3a3d48, mats, geos);
    almofada.rotation.y = Math.PI / 2; almofada.position.set(-lado * 0.016, 0, 0); concha.add(almofada);
    g.add(concha);
  }
  g.position.set(0, 0.05, 0.025);   // um pouco à frente e acima: apoiado sobre a gola, visível de frente
  return g;
}

/** a presilha de lápis (no osso da cabeça): amarela com a ponta de madeira e o grafite, na franja do lado esquerdo dela */
function presilha(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const corpo = desenhada(new THREE.CylinderGeometry(0.0065, 0.0065, 0.05, 6), 0xffcf3a, mats, geos); g.add(corpo);
  const madeira = desenhada(new THREE.ConeGeometry(0.0065, 0.014, 6), 0xf3d2a2, mats, geos); madeira.position.y = 0.032; g.add(madeira);
  const grafite = desenhada(new THREE.ConeGeometry(0.0025, 0.006, 6), 0x2a2a2a, mats, geos); grafite.position.y = 0.0405; g.add(grafite);
  const borracha = desenhada(new THREE.CylinderGeometry(0.0066, 0.0066, 0.008, 6), 0xf28aa8, mats, geos); borracha.position.y = -0.029; g.add(borracha);
  g.rotation.z = -1.0;   // deitada na diagonal sobre a franja
  g.position.set(0.055, 0.135, 0.085);
  return g;
}

/** os óculos redondos de aro fino dourado (no osso da cabeça), na altura dos olhos */
function oculos(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), OURO = 0xd8b45a, R = 0.0185, X = 0.031;
  for (const lado of [-1, 1]) {
    const aro = desenhada(new THREE.TorusGeometry(R, 0.0022, 6, 28), OURO, mats, geos); aro.position.set(lado * X, 0, 0); g.add(aro);
    const haste = desenhada(new THREE.CylinderGeometry(0.0018, 0.0018, 0.1, 5), OURO, mats, geos);
    haste.rotation.x = Math.PI / 2; haste.position.set(lado * (X + R + 0.004), 0.004, -0.05); g.add(haste);
  }
  const ponte = desenhada(new THREE.TorusGeometry(0.008, 0.0018, 5, 12, Math.PI), OURO, mats, geos); ponte.position.set(0, 0.004, 0); g.add(ponte);
  g.position.set(0, 0.079, 0.1);
  return g;
}

/** a presilha de estrela prateada (no osso da cabeça), na franja do lado direito dela */
function estrela(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const sh = new THREE.Shape(), n = 5, R = 0.019, r = 0.008;
  for (let k = 0; k < n * 2; k++) { const a = (k / (n * 2)) * Math.PI * 2 + Math.PI / 2, rr = k % 2 ? r : R; if (k) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false }).translate(0, 0, -0.002);
  const g = desenhada(geo, 0xdfe6f2, mats, geos);
  g.rotation.set(-0.3, -0.5, 0.3); g.position.set(-0.072, 0.118, 0.082);
  return g;
}

/** veste os acessórios no VRM (cada um no seu osso); `dispose()` tira e solta tudo */
export function vestirAcessorios(vrm: VRM, lista: readonly AcessorioVrm[]): AcessoriosHandle {
  const mats: THREE.Material[] = [], geos: THREE.BufferGeometry[] = [], postos: THREE.Object3D[] = [];
  const osso = (n: VRMHumanBoneName) => vrm.humanoid.getRawBoneNode(n);
  for (const a of lista) {
    const pai = a === "foneNoPescoco" ? osso("neck") ?? osso("upperChest") : osso("head");
    if (!pai) continue;
    const obj = a === "foneNoPescoco" ? fone(mats, geos) : a === "oculosRedondos" ? oculos(mats, geos) : a === "presilhaEstrela" ? estrela(mats, geos) : presilha(mats, geos);
    pai.add(obj); postos.push(obj);
  }
  return {
    dispose() {
      for (const o of postos) o.removeFromParent();
      for (const m of mats) m.dispose();
      for (const g of geos) g.dispose();
    },
  };
}
