/**
 * TronoFluido — o TRONO biomecânico do lounge (out/2026, pedido do dono, com a imagem de referência): metal negro
 * nervurado, pernas de TENTÁCULO no chão, chifres curvos subindo atrás, braços em bulbo e, no encosto, um painel de
 * FLUIDO CIANO vivo (veias de luz correndo — shader). Senta-se nele com a J (lib/cyber/descanso, lugar "trono").
 *
 * Montado no referencial do móvel (components/cyber/Salas): +z = a FRENTE (pra onde quem senta olha), y = 0 no tablado.
 * A ALMOFADA fica a `ALMOFADA_TRONO` m acima de onde o pé pisa (o tablado tem 0,16 m); o quadril do avatar, mais alto. Os tentáculos da frente deixam um vão
 * livre (±40°) pra pessoa chegar, virar e sentar sem atravessar nada.
 */
import * as THREE from "three";
import { ALMOFADA_TRONO } from "@/lib/cyber/descanso";

const TABLADO = 0.16;
/** o topo do assento no referencial do grupo (y) */
export const ASSENTO_Y = ALMOFADA_TRONO - TABLADO;

/** os materiais do trono, compartilhados por todos (um shader de fluido só: o `uT` anima todos de uma vez) */
export type MatsTrono = { metal: THREE.MeshStandardMaterial; fluido: THREE.ShaderMaterial; brilho: THREE.MeshBasicMaterial; halo: THREE.MeshBasicMaterial; haloPainel: THREE.MeshBasicMaterial };
export function criarMatsTrono(): MatsTrono {
  return {
    metal: new THREE.MeshStandardMaterial({ color: 0x0b0e13, metalness: 0.85, roughness: 0.3, emissive: 0x03080d, emissiveIntensity: 1 }),
    fluido: new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uCor: { value: new THREE.Color(0x2ef2ff) } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      // as VEIAS de fluido: linhas finas que se enroscam e escorrem devagar, com um pulso de brilho
      fragmentShader: `uniform float uT; uniform vec3 uCor; varying vec2 vUv;
        float veia(vec2 p, float k){ float v = sin(p.x * k + sin(p.y * (k * 0.7) + uT * 0.8) * 2.2) * sin(p.y * (k * 1.15) - uT * 0.55 + sin(p.x * (k * 0.6)) * 2.0); return smoothstep(0.82, 0.985, 1.0 - abs(v)); }
        void main(){
          vec2 p = vUv * vec2(1.0, 2.6);
          float l = max(veia(p, 9.0), veia(p + 3.7, 6.0) * 0.8);
          float pulso = 0.8 + 0.2 * sin(uT * 1.7 + vUv.y * 6.0);
          vec3 c = mix(vec3(0.0, 0.035, 0.05), uCor * 1.6, l * pulso) + uCor * 0.06;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
    brilho: new THREE.MeshBasicMaterial({ color: 0x2ef2ff }),
    halo: new THREE.MeshBasicMaterial({ color: 0x2ef2ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    haloPainel: new THREE.MeshBasicMaterial({ color: 0x2ef2ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
}

/** um TENTÁCULO afinando (raio `r0` na base → 15% na ponta) ao longo dos pontos */
function tentaculo(pts: THREE.Vector3[], r0: number, seg: number, rad: number): THREE.TubeGeometry {
  const curva = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(curva, seg, r0, rad, false);
  const pos = geo.attributes.position!, v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const c = curva.getPointAt(i / seg), k = 1 - 0.85 * (i / seg);
    for (let j = 0; j <= rad; j++) { const n = i * (rad + 1) + j; v.fromBufferAttribute(pos, n).sub(c).multiplyScalar(k).add(c); pos.setXYZ(n, v.x, v.y, v.z); }
  }
  pos.needsUpdate = true; geo.computeVertexNormals();
  return geo;
}

/** um PILAR nervurado (o tubo + os anéis em volta — as "costelas") de `y0` a `y1` */
function pilar(pai: THREE.Object3D, mats: MatsTrono, x: number, z: number, y0: number, y1: number, r: number, low: boolean) {
  const h = y1 - y0, c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, h, low ? 8 : 14), mats.metal); c.position.set(x, y0 + h / 2, z); pai.add(c);
  const n = low ? 6 : 14;
  for (let i = 0; i < n; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, r * 0.16, 6, low ? 10 : 16), mats.metal); a.rotation.x = Math.PI / 2; a.position.set(x, y0 + ((i + 0.5) / n) * h, z); pai.add(a); }
}

/** monta o trono no grupo do móvel */
export function montarTrono(p: THREE.Group, mats: MatsTrono, o: { low: boolean }) {
  const low = o.low, S = ASSENTO_Y, add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; };
  // o PEDESTAL (o "barril" entalhado sob o assento) e o ASSENTO
  // (estreitos na FRENTE: as canelas de quem senta descem logo à frente da almofada — antes o pedestal largo as engolia)
  add(new THREE.CylinderGeometry(0.24, 0.2, S - 0.1, low ? 10 : 18), mats.metal, 0, (S - 0.1) / 2, -0.08);
  const assento = add(new THREE.CylinderGeometry(0.52, 0.46, 0.14, low ? 14 : 26), mats.metal, 0, S - 0.07, -0.1); assento.scale.z = 0.8;
  // o ENCOSTO baixo em LEQUE: costelas finas em meia-volta atrás do assento
  const nCost = low ? 12 : 26;
  for (let i = 0; i < nCost; i++) {
    const a = Math.PI * (0.08 + (0.84 * i) / (nCost - 1)), cost = add(new THREE.BoxGeometry(0.035, 0.78, 0.05), mats.metal, Math.cos(a) * 0.55, S + 0.36, -Math.sin(a) * 0.5);
    cost.rotation.y = a - Math.PI / 2; cost.rotation.x = -0.12;
  }
  // os BRAÇOS em bulbo (com o anel de fluido aceso na junta do encosto)
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(0.2, low ? 10 : 16, low ? 8 : 12), mats.metal, sx * 0.6, S + 0.36, 0.0);
    const tubo = add(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 10), mats.metal, sx * 0.6, S + 0.16, 0.12); tubo.rotation.x = 0.4;
    const anel = add(new THREE.TorusGeometry(0.13, 0.03, 6, 20), mats.brilho, sx * 0.47, S + 0.85, -0.42); anel.rotation.y = sx * 0.6;
  }
  // o ENCOSTO alto: os dois pilares nervurados, a moldura e o painel de FLUIDO no meio (com um halo)
  const yB0 = S + 0.75, yB1 = S + 2.55, zB = -0.5;
  for (const sx of [-1, 1]) pilar(p, mats, sx * 0.4, zB, yB0 - 0.2, yB1, 0.13, low);
  add(new THREE.BoxGeometry(0.66, 0.1, 0.12), mats.metal, 0, yB1 + 0.02, zB);
  add(new THREE.BoxGeometry(0.66, 0.08, 0.12), mats.metal, 0, yB0 - 0.02, zB);
  const painel = add(new THREE.PlaneGeometry(0.6, yB1 - yB0), mats.fluido, 0, (yB0 + yB1) / 2, zB + 0.05); painel.userData.semLote = true;
  add(new THREE.BoxGeometry(0.62, yB1 - yB0, 0.06), mats.metal, 0, (yB0 + yB1) / 2, zB - 0.03);   // as costas do painel
  const halo = add(new THREE.PlaneGeometry(0.72, (yB1 - yB0) * 1.04), mats.haloPainel, 0, (yB0 + yB1) / 2, zB + 0.08);   // (justo no painel: maior, lia como um bloco) halo.userData.semLote = true;
  // os CHIFRES: 4 tentáculos curvos subindo atrás do encosto, abrindo pra fora
  const segT = low ? 10 : 22, radT = low ? 6 : 10;
  for (const [sx, abre, alto] of [[-1, 0.55, 3.4], [1, 0.55, 3.4], [-1, 0.95, 2.6], [1, 0.95, 2.6]] as const) {
    const pts = [new THREE.Vector3(sx * 0.45, S + 0.5, -0.55), new THREE.Vector3(sx * (0.6 + abre * 0.3), S + 1.4, -0.7), new THREE.Vector3(sx * (0.7 + abre * 0.55), S + 2.4, -0.62), new THREE.Vector3(sx * (0.6 + abre * 0.5), S + alto, -0.4)];
    p.add(new THREE.Mesh(tentaculo(pts, 0.085, segT, radT), mats.metal));
  }
  // as PERNAS: 8 tentáculos saindo de baixo do assento e se espalhando no chão — o vão da FRENTE (±40°) fica livre
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * 0.27 + (i / 7) * (Math.PI * 2 - Math.PI * 0.54), dx = Math.sin(a), dz = Math.cos(a), alc = 1.05 + (i % 2) * 0.2;   // a = 0 → a frente (+z)
    const pts = [new THREE.Vector3(dx * 0.3, S - 0.15, dz * 0.3), new THREE.Vector3(dx * 0.55, S * 0.45, dz * 0.55), new THREE.Vector3(dx * (alc * 0.85), 0.08, dz * (alc * 0.85)), new THREE.Vector3(dx * alc, 0.03, dz * alc)];
    p.add(new THREE.Mesh(tentaculo(pts, 0.1, segT, radT), mats.metal));
  }
  // a gota de luz no chão, embaixo do pedestal
  const gota = add(new THREE.CircleGeometry(0.25, 20), mats.halo, 0, 0.01, 0.1); gota.rotation.x = -Math.PI / 2; gota.userData.semLote = true;
}

/** o NÚCLEO de fluido no meio da roda de tronos: uma coluna baixa de metal com o fluido girando dentro (vidro) */
export function montarNucleoFluido(p: THREE.Group, mats: MatsTrono, o: { low: boolean }) {
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; p.add(m); return m; };
  add(new THREE.CylinderGeometry(0.75, 0.9, 0.3, o.low ? 12 : 24), mats.metal, 0.15);
  const coluna = add(new THREE.CylinderGeometry(0.42, 0.42, 1.5, o.low ? 12 : 24, 1, true), mats.fluido, 1.05); coluna.userData.semLote = true;
  add(new THREE.CylinderGeometry(0.6, 0.75, 0.16, o.low ? 12 : 24), mats.metal, 1.86);
  const halo = add(new THREE.SphereGeometry(0.95, 16, 12), mats.halo, 1.05); halo.scale.y = 1.3; halo.userData.semLote = true;
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, nerv = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.06), mats.metal); nerv.position.set(Math.cos(a) * 0.45, 1.05, Math.sin(a) * 0.45); p.add(nerv); }
}
