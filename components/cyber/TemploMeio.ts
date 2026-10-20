/**
 * TemploMeio — o CAMINHO DO MEIO do Templo Cósmico (layout puro em lib/cyber/temploCosmico; piso e colisão no ceu): o
 * caminho reto atrás da pirâmide (ladeado por obeliscos negros com a fenda vermelha), a ESCADARIA subindo e, lá em cima,
 * o MONUMENTO DA CYBER ROOM — mais sinistro que a pirâmide: o cubo negro de circuitos vermelhos pulsando, a pirâmide
 * invertida flutuando por cima com o olho, os estilhaços orbitando, o anel de varredura e o PORTAL selado virado pra
 * escada (a sala abre depois — o resto do caminho do meio vem com o dono).
 * Referencial da SALA do lounge, y = 0 no pátio (vai dentro do grupo do Templo Cósmico).
 */
import * as THREE from "three";
import { CYBER, MEIO, NUCLEO_CYBER, PONTES, SALAO } from "@/lib/cyber/temploCosmico";

export type MeioHandle = { group: THREE.Group; alvos: THREE.Object3D[]; atualizar(dt: number, t: number): void; dispose(): void };

const VERMELHO = 0xff2a3a;
const aditivo = (cor: THREE.ColorRepresentation, op: number) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
/** o CIRCUITO: trilhas vermelhas em grade quebrada sobre o negro, com o pulso correndo por elas */
function materialCircuito(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } },
    vertexShader: "varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT; varying vec3 vP; varying vec3 vN;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      void main(){
        vec3 n = abs(vN); vec2 uv = n.x > 0.5 ? vP.zy : n.y > 0.5 ? vP.xz : vP.xy;
        vec2 g = uv * 0.7, c = floor(g), f = fract(g);
        float r = h(c), linha = 0.0;
        if (r < 0.5) linha = smoothstep(0.08, 0.0, abs(f.y - 0.5)); else linha = smoothstep(0.08, 0.0, abs(f.x - 0.5));
        linha *= step(0.3, h(c + 7.0));
        float no = smoothstep(0.16, 0.08, length(f - 0.5)) * step(0.75, h(c + 3.0));
        float pulso = 0.35 + 0.65 * smoothstep(0.7, 1.0, fract(uv.y * 0.05 - uT * 0.25 + r * 0.3));
        float luz = 0.25 + 0.75 * max(0.0, dot(normalize(vN), normalize(vec3(0.4, 0.7, 0.5))));
        vec3 cor = vec3(0.02, 0.01, 0.015) * (0.6 + luz) + vec3(1.0, 0.12, 0.16) * (linha + no) * pulso;
        gl_FragColor = vec4(cor, 1.0);
      }`,
  });
}

export function criarMeio(o: { low: boolean }): MeioHandle {
  const group = new THREE.Group(); group.name = "caminho-do-meio";
  const alvos: THREE.Object3D[] = [], anim: ((dt: number, t: number) => void)[] = [], geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const malha = <G extends THREE.BufferGeometry>(g: G, m: THREE.Material, pai: THREE.Object3D = group) => { geos.push(g); if (!mats.includes(m)) mats.push(m); const x = new THREE.Mesh(g, m); pai.add(x); return x; };
  const negro = new THREE.MeshStandardMaterial({ color: 0x050407, emissive: 0x0a0306, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.9 });

  // ── o caminho reto: a linha vermelha no meio e os OBELISCOS dos dois lados (a fenda acesa) ──
  const reto = PONTES.find((p) => p.id === "meio")!, esc = PONTES.find((p) => p.id === "escadaMeio")!, y0 = -SALAO.desce;
  { const L = reto.a.z - reto.b.z, l = malha(new THREE.PlaneGeometry(0.3, L), aditivo(VERMELHO, 0.6)); l.rotation.x = -Math.PI / 2; l.position.set(reto.a.x, y0 + 0.03, (reto.a.z + reto.b.z) / 2);
    const fendaMat = aditivo(VERMELHO, 0.85);
    for (let z = reto.a.z - 8; z > reto.b.z + 2; z -= 12) for (const s of [-1, 1]) {
      const ob = malha(new THREE.BoxGeometry(1.4, 9, 1.4), negro); ob.position.set(reto.a.x + s * (MEIO.meia + 2.2), y0 + 4.5, z); alvos.push(ob);
      const f = malha(new THREE.PlaneGeometry(0.12, 7), fendaMat); f.position.set(reto.a.x + s * (MEIO.meia + 1.48), y0 + 4.5, z); f.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    anim.push((_, t) => { fendaMat.opacity = 0.55 + 0.35 * Math.sin(t * 1.7); });
  }

  // ── a ESCADARIA: degraus negros com a quina vermelha por cima da rampa ──
  { const dz = esc.b.z - esc.a.z, dy = esc.hb - esc.ha, L = Math.abs(dz), n = Math.round(L / 0.9), passo = L / n;
    const gD = new THREE.BoxGeometry(MEIO.meia * 2, 0.4, passo + 0.02), gQ = new THREE.BoxGeometry(MEIO.meia * 2 - 0.3, 0.04, 0.06); geos.push(gD, gQ);
    const quina = aditivo(VERMELHO, 0.9); mats.push(quina, negro);
    const imD = new THREE.InstancedMesh(gD, negro, n), imQ = new THREE.InstancedMesh(gQ, quina, n), m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, z = esc.a.z + dz * u, y = esc.ha + dy * ((i + 1) / n); imD.setMatrixAt(i, m.makeTranslation(esc.a.x, y - 0.2, z)); imQ.setMatrixAt(i, m.makeTranslation(esc.a.x, y + 0.01, z + passo / 2 * Math.sign(-dz))); }
    for (const im of [imD, imQ]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); group.add(im); }
    alvos.push(imD);
  }

  // ── o MONUMENTO DA CYBER ROOM ──
  const mg = new THREE.Group(); mg.position.set(CYBER.x, CYBER.h, CYBER.z); group.add(mg);
  const circ = materialCircuito(); mats.push(circ);
  const lado = NUCLEO_CYBER.r * Math.SQRT2 * 0.9, cubo = malha(new THREE.BoxGeometry(lado, lado * 1.5, lado), circ, mg);
  cubo.position.y = (lado * 1.5) / 2;   // (de frente pra escada: o portal no meio da face) alvos.push(cubo); cubo.userData.semLote = true;
  // o PORTAL selado (virado pra escada, o +z do monumento): a moldura vermelha e a estática escura no vão
  const portal = new THREE.Group(); portal.position.set(0, 0, lado / 2 + 0.06); mg.add(portal);
  const est = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, transparent: true, side: THREE.DoubleSide,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
      void main(){ float n = h(floor(vUv * vec2(60.0, 120.0)) + floor(uT * 14.0)); float scan = 0.5 + 0.5 * sin(vUv.y * 80.0 - uT * 6.0);
        gl_FragColor = vec4(vec3(0.6, 0.02, 0.05) * (0.25 + 0.5 * n * scan), 0.9); }` }); mats.push(est);
  malha(new THREE.PlaneGeometry(4.4, 8.4), est, portal).position.y = 4.4;
  for (const [w, h, x, y] of [[0.4, 9.2, -2.4, 4.6], [0.4, 9.2, 2.4, 4.6], [5.2, 0.4, 0, 9.2]] as const) { const b = malha(new THREE.BoxGeometry(w, h, 0.3), aditivo(VERMELHO, 0.95), portal); b.position.set(x, y, 0); }
  // a pirâmide INVERTIDA flutuando por cima, com o OLHO vermelho e o anel de varredura
  const inv = new THREE.Group(); inv.position.y = lado * 1.5 + 12; mg.add(inv);
  const pin = malha(new THREE.ConeGeometry(lado * 0.8, 16, 4), negro, inv); pin.rotation.x = Math.PI; pin.rotation.y = Math.PI / 4;
  const arestas = new THREE.LineSegments(new THREE.EdgesGeometry(pin.geometry), new THREE.LineBasicMaterial({ color: VERMELHO, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  arestas.rotation.copy(pin.rotation); inv.add(arestas); geos.push(arestas.geometry); mats.push(arestas.material as THREE.Material);
  const olho = malha(new THREE.SphereGeometry(1.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0xff1a2a }), inv); olho.position.y = -9.5;
  const iris = malha(new THREE.RingGeometry(2.2, 2.6, 40), aditivo(VERMELHO, 0.8), inv); iris.position.y = -9.5;
  const varre = malha(new THREE.TorusGeometry(lado * 0.95, 0.12, 6, 64), aditivo(VERMELHO, 0.8), mg); varre.rotation.x = Math.PI / 2;
  // os ESTILHAÇOS negros orbitando
  const N = o.low ? 10 : 24, shard = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), negro, N); geos.push(shard.geometry); shard.frustumCulled = false; mg.add(shard);
  const orb = Array.from({ length: N }, (_, i) => ({ r: lado * 1.1 + (i % 5) * 2.2, y: 6 + ((i * 37) % 30), v: 0.12 + (i % 4) * 0.05, f: i * 2.4, s: 0.6 + (i % 3) * 0.5 }));
  // o feixe vermelho subindo do olho pro céu
  const feixe = malha(new THREE.CylinderGeometry(0.5, 1.4, 200, 12, 1, true), aditivo(VERMELHO, 0.14), mg); feixe.position.y = lado * 1.5 + 12 + 108;
  for (const x of [inv, varre, shard, feixe, olho, iris]) x.userData.semLote = true;

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  anim.push((_, t) => {
    circ.uniforms.uT!.value = t; (est.uniforms.uT!.value as number) = t;
    inv.rotation.y = t * 0.15; inv.position.y = lado * 1.5 + 12 + Math.sin(t * 0.6) * 1.2;
    iris.lookAt(new THREE.Vector3(0, -9.5, 50)); (iris.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.4 * Math.sin(t * 2.3);
    varre.position.y = ((t * 4) % (lado * 1.5 + 4)); (varre.material as THREE.MeshBasicMaterial).opacity = 0.8 * Math.sin(Math.PI * (varre.position.y / (lado * 1.5 + 4)));
    orb.forEach((s, i) => { const a = s.f + t * s.v; q.setFromEuler(e.set(t * 0.7 + i, t * 0.5, i)); shard.setMatrixAt(i, m4.compose(v.set(Math.cos(a) * s.r, s.y + Math.sin(t * 0.8 + i) * 1.2, Math.sin(a) * s.r), q, sc.setScalar(s.s))); });
    shard.instanceMatrix.needsUpdate = true;
  });

  return {
    group, alvos,
    atualizar(dt, t) { for (const f of anim) f(dt, t); },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); },
  };
}
