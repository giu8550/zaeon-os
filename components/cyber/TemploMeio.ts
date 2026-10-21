/**
 * TemploMeio — o CAMINHO DO MEIO do Templo Cósmico (layout puro em lib/cyber/temploCosmico; piso e colisão no ceu): o
 * caminho reto atrás da pirâmide (ladeado por obeliscos negros com a fenda vermelha), a ESCADARIA subindo e, lá em cima,
 * o MONUMENTO DA CYBER ROOM — mais sinistro que a pirâmide: o cubo negro de circuitos vermelhos pulsando, a pirâmide
 * invertida flutuando por cima com o olho, os estilhaços orbitando, o anel de varredura e o PORTAL selado virado pra
 * escada (a sala abre depois — o resto do caminho do meio vem com o dono).
 * Referencial da SALA do lounge, y = 0 no pátio (vai dentro do grupo do Templo Cósmico).
 */
import * as THREE from "three";
import { CAMPUS, CYBER, ELEVADOR_TC, ESTACOES_TI, MESA_TI, NUCLEO_CYBER, PONTES, SALAO, TORRE_TI } from "@/lib/cyber/temploCosmico";

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

  const y0 = -SALAO.desce, campus = PONTES.find((p) => p.id === "meio")!, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), um = new THREE.Vector3(1, 1, 1);
  const instanciar = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => { geos.push(geo); if (!mats.includes(mat)) mats.push(mat); const im = new THREE.InstancedMesh(geo, mat, n); group.add(im); return im; };
  const fechar = (...ims: THREE.InstancedMesh[]) => { for (const im of ims) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); } };

  // ── o CAMPUS DE TI: o piso de grade acesa e o CORREDOR do meio (a linha vermelha até a torre) ──
  { const L = campus.a.z - campus.b.z, zc = (campus.a.z + campus.b.z) / 2;
    const grade = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform float uT; varying vec2 vP;
        void main(){ vec2 g = abs(fract(vP / 3.0) - 0.5); float l = smoothstep(0.03, 0.0, min(g.x, g.y)); float pulso = 0.5 + 0.5 * sin(vP.y * 0.12 + uT * 1.5);
          gl_FragColor = vec4(vec3(0.15, 0.55, 1.0) * l * (0.18 + 0.25 * pulso), 1.0); }` });
    const pl = malha(new THREE.PlaneGeometry(CAMPUS.meia * 2 - 1, L), grade); pl.rotation.x = -Math.PI / 2; pl.position.set(campus.a.x, y0 + 0.03, zc);
    const linha = malha(new THREE.PlaneGeometry(0.35, L), aditivo(VERMELHO, 0.55)); linha.rotation.x = -Math.PI / 2; linha.position.set(campus.a.x, y0 + 0.04, zc);
    anim.push((_, t) => { grade.uniforms.uT!.value = t; });
  }
  // ── as ESTAÇÕES (instanciadas): a mesa, 2 monitores, a cadeira — e o ESTUDANTE digitando nas ocupadas ──
  const N = ESTACOES_TI.length, mesaMat = new THREE.MeshStandardMaterial({ color: 0x1a1d26, roughness: 0.4, metalness: 0.6, emissive: 0x0a0e18, emissiveIntensity: 0.6 });
  const telaMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, side: THREE.DoubleSide,
    vertexShader: "varying vec2 vUv; varying float vI; void main(){ vUv = uv; vI = float(gl_InstanceID); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT; varying vec2 vUv; varying float vI; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
      void main(){ float linha = floor(vUv.y * 14.0), comp = h(vec2(linha, vI)) * 0.8 + 0.1, rola = fract(uT * 0.3 + h(vec2(vI, 1.0)));
        float cod = step(vUv.x, comp) * step(0.25, fract(vUv.y * 14.0)) * step(fract(linha / 14.0 + rola), 0.9);
        vec3 fundo = mix(vec3(0.02, 0.05, 0.1), vec3(0.04, 0.12, 0.22), vUv.y), cor = mod(vI, 3.0) < 1.0 ? vec3(0.4, 1.0, 0.6) : (mod(vI, 3.0) < 2.0 ? vec3(0.45, 0.8, 1.0) : vec3(1.0, 0.55, 0.85));
        gl_FragColor = vec4(fundo + cor * cod * 0.8, 1.0); }` });
  const mesas = instanciar(new THREE.BoxGeometry(MESA_TI.larg, 0.08, MESA_TI.prof), mesaMat, N), pes = instanciar(new THREE.BoxGeometry(MESA_TI.larg - 0.3, 0.7, 0.06), mesaMat, N);
  const telas = instanciar(new THREE.PlaneGeometry(0.95, 0.56), telaMat, N * 2), cadeiras = instanciar(new THREE.BoxGeometry(0.62, 0.95, 0.6), new THREE.MeshStandardMaterial({ color: 0x23202e, roughness: 0.7 }), N);
  const ocup = ESTACOES_TI.filter((e) => e.ocupada).length, roupa = new THREE.MeshLambertMaterial({ color: 0xffffff }), pele = new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.7 });
  // (o moletom em Lambert: a camuflagem não troca o material — e a cor por instância vale)
  const torsos = instanciar(new THREE.CapsuleGeometry(0.24, 0.42, 4, 8), roupa, ocup), cabecas = instanciar(new THREE.SphereGeometry(0.15, 12, 10), pele, ocup);
  const cor = new THREE.Color(), CORES_MOLETOM = [0x2b3a67, 0x5a2b67, 0x2b6758, 0x67452b, 0x3d3d48, 0x6b1f2f, 0x1f5f8b];
  const cabecasBase: THREE.Vector3[] = [];
  ESTACOES_TI.forEach((e, i) => {
    mesas.setMatrixAt(i, m4.makeTranslation(e.x, y0 + 0.76, e.z)); pes.setMatrixAt(i, m4.makeTranslation(e.x, y0 + 0.37, e.z - MESA_TI.prof / 2 + 0.1));
    for (const [k, dx] of [[0, -0.55], [1, 0.55]] as const) { q.setFromEuler(new THREE.Euler(0, Math.PI + (k ? -0.18 : 0.18), 0)); telas.setMatrixAt(i * 2 + k, m4.compose(v.set(e.x + dx, y0 + 1.15, e.z - 0.35), q, um)); }
    cadeiras.setMatrixAt(i, m4.makeTranslation(e.x, y0 + 0.48, e.z + 1.0));
  });
  { let k = 0; for (const e of ESTACOES_TI) { if (!e.ocupada) continue;
      torsos.setMatrixAt(k, m4.makeTranslation(e.x, y0 + 1.25, e.z + 0.85)); torsos.setColorAt(k, cor.setHex(CORES_MOLETOM[k % CORES_MOLETOM.length]!));
      const c = new THREE.Vector3(e.x, y0 + 1.78, e.z + 0.78); cabecasBase.push(c); cabecas.setMatrixAt(k, m4.makeTranslation(c.x, c.y, c.z)); k++; } }
  fechar(mesas, pes, telas, cadeiras, torsos, cabecas); alvos.push(mesas);
  // os estudantes DIGITANDO (a cabeça balança de leve, cada um no seu ritmo — atualiza um pedaço por quadro)
  let lote = 0;
  anim.push((_, t) => {
    telaMat.uniforms.uT!.value = t;
    const n = cabecasBase.length, de = (lote * 24) % Math.max(1, n); lote++;
    for (let k = de; k < Math.min(n, de + 24); k++) { const c = cabecasBase[k]!; cabecas.setMatrixAt(k, m4.makeTranslation(c.x, c.y + 0.02 * Math.sin(t * (2 + (k % 5) * 0.3) + k), c.z - 0.03 * Math.max(0, Math.sin(t * 0.7 + k)))); }
    cabecas.instanceMatrix.needsUpdate = true;
  });
  // ── os RACKS DE SERVIDOR nas laterais (as luzinhas piscando) e os TELÕES de código flutuando sobre o corredor ──
  { const zs: number[] = []; for (let z = campus.a.z - 14; z > campus.b.z + 10; z -= 7) zs.push(z);
    const ledMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } },
      vertexShader: "varying vec2 vUv; varying float vI; void main(){ vUv = uv; vI = float(gl_InstanceID); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform float uT; varying vec2 vUv; varying float vI; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
        void main(){ vec2 c = floor(vUv * vec2(6.0, 28.0)); float on = step(0.55, h(c + vI + floor(uT * (2.0 + h(c) * 6.0)))); vec3 cor = h(c + 3.0) < 0.7 ? vec3(0.3, 1.0, 0.5) : vec3(0.3, 0.7, 1.0);
          gl_FragColor = vec4(vec3(0.03, 0.04, 0.06) + cor * on * 0.9, 1.0); }` });
    const racks = instanciar(new THREE.BoxGeometry(1.6, 4.2, 1.1), negro, zs.length * 2), leds = instanciar(new THREE.PlaneGeometry(1.3, 3.8), ledMat, zs.length * 2);
    zs.forEach((z, i) => { for (const [k, s] of [[0, -1], [1, 1]] as const) {
      racks.setMatrixAt(i * 2 + k, m4.makeTranslation(campus.a.x + s * (CAMPUS.meia - 2.4), y0 + 2.1, z));
      q.setFromEuler(new THREE.Euler(0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0)); leds.setMatrixAt(i * 2 + k, m4.compose(v.set(campus.a.x + s * (CAMPUS.meia - 3.21), y0 + 2.1, z), q, um));
    } });
    fechar(racks, leds); alvos.push(racks);
    const codigo = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform float uT; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
        void main(){ vec2 c = floor(vUv * vec2(48.0, 26.0)); float queda = fract(h(vec2(c.x, 1.0)) - uT * (0.15 + 0.2 * h(vec2(c.x, 2.0))) + vUv.y);
          float g = step(0.5, h(c + floor(uT * 3.0))) * pow(queda, 6.0); float borda = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x) * smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
          gl_FragColor = vec4(vec3(0.25, 1.0, 0.55) * (g * 0.9 + 0.05) * borda, 1.0); }` }); mats.push(codigo);
    for (const z of [campus.a.z - 60, campus.a.z - 150]) { const t = malha(new THREE.PlaneGeometry(26, 11), codigo); t.position.set(campus.a.x, y0 + 15, z); t.userData.semLote = true; }
    anim.push((_, t) => { ledMat.uniforms.uT!.value = t; codigo.uniforms.uT!.value = t; });
  }

  // ── a TORRE TECNOLÓGICA: a coluna massiva (circuitos vermelhos, os anéis dos andares acesos subindo) e o ELEVADOR ──
  const circTorre = materialCircuito(); mats.push(circTorre);
  { const T = TORRE_TI, H = CYBER.h - y0;
    const col = malha(new THREE.CylinderGeometry(T.colR - 0.5, T.colR + 1.5, H, o.low ? 24 : 48, 8), circTorre); col.position.set(T.x, y0 + H / 2, T.z); alvos.push(col); col.userData.semLote = true;
    const aneisT: THREE.Mesh[] = [];
    for (let k = 1; k < 12; k++) { const an = malha(new THREE.TorusGeometry(T.colR + 1.2, 0.35, 6, 96), aditivo(VERMELHO, 0.75)); an.rotation.x = Math.PI / 2; an.position.set(T.x, y0 + (k / 12) * H, T.z); an.userData.semLote = true; aneisT.push(an); }
    // o ELEVADOR: o anel no pé e no topo, e a coluna de luz entre eles (a viagem sobe colada na torre)
    const E = ELEVADOR_TC, luz = aditivo(0x66e6ff, 0.16);
    const coluna = malha(new THREE.CylinderGeometry(E.r + 0.4, E.r + 0.6, H + 2, 24, 1, true), luz); coluna.position.set(E.base.x, y0 + (H + 2) / 2, E.base.z); coluna.userData.semLote = true;
    for (const [p, y] of [[E.base, y0 + 0.06], [E.topo, CYBER.h + 0.06]] as const) {
      const an = malha(new THREE.TorusGeometry(E.r, 0.1, 6, 40), aditivo(0x66e6ff, 0.95)); an.rotation.x = Math.PI / 2; an.position.set(p.x, y, p.z);
      const dc = malha(new THREE.CircleGeometry(E.r - 0.1, 32), aditivo(0x66e6ff, 0.2)); dc.rotation.x = -Math.PI / 2; dc.position.set(p.x, y + 0.01, p.z);
    }
    const subindo: THREE.Mesh[] = []; for (let k = 0; k < 6; k++) { const an = malha(new THREE.TorusGeometry(E.r + 0.45, 0.06, 6, 40), aditivo(0xb98cff, 0.8)); an.rotation.x = Math.PI / 2; an.position.set(E.base.x, y0, E.base.z); an.userData.semLote = true; subindo.push(an); }
    anim.push((_, t) => {
      circTorre.uniforms.uT!.value = t;
      aneisT.forEach((an, k) => { (an.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.6 * Math.max(0, Math.sin(t * 1.4 - k * 0.5)); });
      subindo.forEach((an, k) => { an.position.y = y0 + ((t * 9 + (k * H) / 6) % H); });
    });
  }

  // ── o MONUMENTO DA CYBER ROOM ──
  const mg = new THREE.Group(); mg.position.set(CYBER.x, CYBER.h, CYBER.z); group.add(mg);
  const circ = materialCircuito(); mats.push(circ);
  const lado = NUCLEO_CYBER.r * Math.SQRT2 * 0.9, cubo = malha(new THREE.BoxGeometry(lado, lado * 1.5, lado), circ, mg);
  cubo.position.y = (lado * 1.5) / 2; alvos.push(cubo); cubo.userData.semLote = true;   // (de frente pro campus: o portal no meio da face)
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
  const NS = o.low ? 10 : 24, shard = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), negro, NS); geos.push(shard.geometry); shard.frustumCulled = false; mg.add(shard);
  const orb = Array.from({ length: NS }, (_, i) => ({ r: lado * 1.1 + (i % 5) * 2.2, y: 6 + ((i * 37) % 30), v: 0.12 + (i % 4) * 0.05, f: i * 2.4, s: 0.6 + (i % 3) * 0.5 }));
  // o feixe vermelho subindo do olho pro céu
  const feixe = malha(new THREE.CylinderGeometry(0.5, 1.4, 200, 12, 1, true), aditivo(VERMELHO, 0.14), mg); feixe.position.y = lado * 1.5 + 12 + 108;
  for (const x of [inv, varre, shard, feixe, olho, iris]) x.userData.semLote = true;

  const e = new THREE.Euler(), sc = new THREE.Vector3();
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
