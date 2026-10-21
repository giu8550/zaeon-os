/**
 * TemploRasta — o LOUNGE RASTA do Templo Cósmico (layout puro em lib/cyber/temploCosmico; piso e colisão no ceu):
 *  - no disco: o piso com os anéis do reggae (vermelho, amarelo, verde) e a ÁRVORE DA VIDA no meio — o tronco de raízes
 *    entrelaçadas subindo e a copa de folhas acesas balançando;
 *  - a ESCADARIA DAS RAÍZES: a mesma escadaria tortuosa do lounge (num grupo espelhado em torno do salão), mas no lugar
 *    da muralha-veia vermelha, RAÍZES verdes de árvore se enroscando por fora e pendendo pro abismo, com a seiva
 *    (o pulso de luz) correndo rumo à capela;
 *  - lá em cima: a CAPELA MAIOR (pilares finos, o anel tricolor, o halo flutuante e a coluna de luz), o SALÃO DE FESTAS
 *    (cobertura em anel, piso de LED), o LOUNGE PRIVATIVO dos casais (a cápsula de vidro rosada) e a TORRE.
 * Referencial da SALA do lounge, y = 0 no pátio (vai dentro do grupo do Templo Cósmico).
 */
import * as THREE from "three";
import { ESCADARIA, TEMPLO, curvaDaEscadaria } from "@/lib/cyber/templo";
import { CAPELA_RASTA, CASAIS, FESTAS, PILARES_FESTAS, RASTA, portaDosCasais, TEMPLO_RASTA, TORRE_RASTA, X_ESPELHO_RASTA, alturaDaEscadariaRasta } from "@/lib/cyber/temploCosmico";

export type RastaHandle = { group: THREE.Group; alvos: THREE.Object3D[]; atualizar(dt: number, t: number): void; dispose(): void };

const VERDE = 0x2fae4a, AMARELO = 0xffd23f, VERMELHO = 0xe63946;
const aditivo = (cor: THREE.ColorRepresentation, op: number) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
/** a SEIVA: o pulso de luz correndo ao longo de `vUv.x` (as raízes e o tronco) */
function materialSeiva(cor: number, n: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCor: { value: new THREE.Color(cor) }, uN: { value: n } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT, uN; uniform vec3 uCor; varying vec2 vUv;
      void main(){
        float p = fract(vUv.x * uN - uT * 0.5), pulso = smoothstep(0.0, 0.05, p) * smoothstep(0.45, 0.08, p);
        float casca = 0.5 + 0.5 * sin(vUv.y * 6.2831 * 3.0 + vUv.x * 40.0);
        vec3 madeira = vec3(0.05, 0.09, 0.04) + vec3(0.03, 0.05, 0.02) * casca;
        gl_FragColor = vec4(madeira + uCor * (0.18 + 1.6 * pulso), 1.0);
      }`,
  });
}

export function criarRasta(o: { low: boolean; paredeMat: THREE.Material }): RastaHandle {
  const group = new THREE.Group(); group.name = "lounge-rasta";
  const alvos: THREE.Object3D[] = [], anim: ((dt: number, t: number) => void)[] = [];
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const malha = <G extends THREE.BufferGeometry>(g: G, m: THREE.Material, pai: THREE.Object3D = group) => { geos.push(g); if (!mats.includes(m)) mats.push(m); const x = new THREE.Mesh(g, m); pai.add(x); return x; };
  const seg = o.low ? 48 : 96, rng = (() => { let a = 1234567; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
  const seiva = materialSeiva(VERDE, 4), seivaD = materialSeiva(AMARELO, 2.5);
  anim.push((_, t) => { seiva.uniforms.uT!.value = t; seivaD.uniforms.uT!.value = t * 1.3; });

  // ── o piso do disco: os anéis do reggae ──
  for (const [r, w, c] of [[RASTA.r - 1.4, 0.5, VERDE], [RASTA.r - 2.4, 0.5, AMARELO], [RASTA.r - 3.4, 0.5, VERMELHO], [22, 0.35, AMARELO], [20.5, 0.35, VERMELHO], [23.5, 0.35, VERDE]] as const) {
    const an = malha(new THREE.RingGeometry(r - w, r, seg), aditivo(c, 0.45)); an.rotation.x = -Math.PI / 2; an.position.set(RASTA.x, 0.03, RASTA.z);
  }

  // ── a ÁRVORE DA VIDA no meio do disco: raízes no chão, o tronco entrelaçado e a copa acesa ──
  { const arv = new THREE.Group(); arv.position.set(RASTA.x, 0, RASTA.z); group.add(arv);
    const ALT = 22, nT = o.low ? 4 : 6;
    for (let k = 0; k < nT; k++) {   // o tronco: fios de raiz subindo em espiral, se apertando
      const pts: THREE.Vector3[] = [], fase = (k / nT) * Math.PI * 2;
      for (let j = 0; j <= 16; j++) { const u = j / 16, r = 3.6 * (1 - u) + 1.1 + 0.5 * Math.sin(u * 9 + k), a = fase + u * Math.PI * 1.6; pts.push(new THREE.Vector3(Math.cos(a) * r, u * ALT, Math.sin(a) * r)); }
      const tr = malha(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 1.0 - 0.1 * (k % 3), 8, false), seiva, arv); alvos.push(tr);
    }
    for (let k = 0; k < (o.low ? 6 : 10); k++) {   // as raízes espalhadas no chão
      const a = (k / 10) * Math.PI * 2 + rng() * 0.3, pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 8; j++) { const u = j / 8, r = 2.5 + u * (9 + rng() * 5); pts.push(new THREE.Vector3(Math.cos(a + Math.sin(u * 4) * 0.25) * r, 0.5 * (1 - u) + 0.15, Math.sin(a + Math.sin(u * 4) * 0.25) * r)); }
      malha(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.55 * (1 - 0.3 * rng()), 6, false), seiva, arv);
    }
    // a copa: folhas acesas (instanciadas) num domo, nas três cores
    const N = o.low ? 110 : 280, folha = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), N);
    geos.push(folha.geometry); mats.push(folha.material as THREE.Material);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), cor = new THREE.Color(), cores = [VERDE, VERDE, VERDE, AMARELO, VERMELHO];
    for (let i = 0; i < N; i++) {
      const a = rng() * Math.PI * 2, ph = rng() * 1.2, r = 6 + rng() * 9;
      v.set(Math.cos(a) * Math.cos(ph) * r * 1.2, ALT + 2 + Math.sin(ph) * r * 0.55, Math.sin(a) * Math.cos(ph) * r * 1.2);
      q.setFromEuler(e.set(rng() * 3, rng() * 3, rng() * 3)); const s = 0.6 + rng() * 0.9; sc.set(s, s * 0.35, s * 1.4);
      folha.setMatrixAt(i, m.compose(v, q, sc)); folha.setColorAt(i, cor.setHex(cores[i % cores.length]!));
    }
    folha.instanceMatrix.needsUpdate = true; if (folha.instanceColor) folha.instanceColor.needsUpdate = true; folha.computeBoundingSphere();
    const copa = new THREE.Group(); copa.add(folha); arv.add(copa); copa.userData.semLote = true; folha.userData.semLote = true;
    const brilho = malha(new THREE.SphereGeometry(13, 16, 10), aditivo(VERDE, 0.06), copa); brilho.position.y = ALT + 4; brilho.scale.y = 0.6;
    anim.push((_, t) => { copa.rotation.y = Math.sin(t * 0.25) * 0.06; copa.rotation.z = Math.sin(t * 0.4) * 0.02; });
  }

  // ── a ESCADARIA DAS RAÍZES: no grupo espelhado em torno do salão (as coordenadas são as da escadaria do lounge) ──
  { const gr = new THREE.Group(); gr.position.x = X_ESPELHO_RASTA; gr.scale.x = -1; group.add(gr);
    const { pts, len } = curvaDaEscadaria(), M = ESCADARIA, T = TEMPLO;
    const fora = (x: number, z: number) => Math.hypot(x, z) > RASTA.r + 0.2 && Math.hypot(x - T.x, z - T.z) > T.r + 0.1;
    const em = (s: number) => {
      let i = 0; while (i < pts.length - 2 && pts[i + 1]!.s < s) i++;
      const a = pts[i]!, b = pts[i + 1]!, u = Math.max(0, Math.min(1, (s - a.s) / Math.max(1e-6, b.s - a.s)));
      const tx = a.tx + (b.tx - a.tx) * u, tz = a.tz + (b.tz - a.tz) * u, n = Math.hypot(tx, tz) || 1;
      return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, tx: tx / n, tz: tz / n };
    };
    let sIni = 0, sFim = len; for (let s = 0; s < len; s += 0.5) { const p = em(s); if (fora(p.x, p.z)) { sIni = s; break; } }
    for (let s = len; s > 0; s -= 0.5) { const p = em(s); if (fora(p.x, p.z)) { sFim = s; break; } }
    // os degraus (madeira escura, a quina verde)
    const PASSO = 0.8, deg: { x: number; z: number; y: number; giro: number }[] = [];
    for (let s = PASSO / 2; s < len; s += PASSO) { const p = em(s); if (!fora(p.x, p.z)) continue; deg.push({ x: p.x, z: p.z, y: alturaDaEscadariaRasta(s), giro: Math.atan2(p.tx, p.tz) }); }
    const madeira = new THREE.MeshStandardMaterial({ color: 0x1a1408, emissive: 0x0c1a08, emissiveIntensity: 0.6, roughness: 0.6, metalness: 0.2 }); mats.push(madeira);
    const gD = new THREE.BoxGeometry(M.meia * 2, 0.5, PASSO + 0.04); gD.translate(0, -0.25, 0); const gQ = new THREE.BoxGeometry(M.meia * 2 - 0.3, 0.04, 0.06); geos.push(gD, gQ);
    const quinaMat = aditivo(VERDE, 0.9); mats.push(quinaMat);
    const imD = new THREE.InstancedMesh(gD, madeira, deg.length), imQ = new THREE.InstancedMesh(gQ, quinaMat, deg.length);
    { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), um = new THREE.Vector3(1, 1, 1);
      deg.forEach((d, i) => { q.setFromEuler(e.set(0, d.giro, 0)); imD.setMatrixAt(i, m.compose(v.set(d.x, d.y + 0.14, d.z), q, um)); const f = new THREE.Vector3(0, 0, -PASSO / 2 + 0.03).applyQuaternion(q); imQ.setMatrixAt(i, m.compose(v.set(d.x + f.x, d.y + 0.16, d.z + f.z), q, um)); });
      for (const im of [imD, imQ]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); gr.add(im); } }
    alvos.push(imD);
    // o guarda-corpo de dentro (o +lat): corrimão aceso + o vidro
    const linha = (lat: number, dy: number, s0: number, s1: number) => { const out: THREE.Vector3[] = []; for (let s = s0; s <= s1; s += 1.5) { const p = em(s); out.push(new THREE.Vector3(p.x + p.tz * lat, alturaDaEscadariaRasta(s) + dy, p.z - p.tx * lat)); } return new THREE.CatmullRomCurve3(out); };
    malha(new THREE.TubeGeometry(linha(M.meia + 0.35, 1.05, sIni, sFim), o.low ? 50 : 120, 0.07, 6, false), aditivo(AMARELO, 0.9), gr);
    { const pos: number[] = [], idx: number[] = [], lat = M.meia + 0.35; let k = 0;
      for (let s = sIni; s <= sFim; s += 1) { const p = em(s), y = alturaDaEscadariaRasta(s), x = p.x + p.tz * lat, z = p.z - p.tx * lat; pos.push(x, y, z, x, y + 1.05, z); if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k); k++; }
      const vg = new THREE.BufferGeometry(); vg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); vg.setIndex(idx); vg.computeVertexNormals(); geos.push(vg); gr.add(new THREE.Mesh(vg, o.paredeMat)); }
    // as RAÍZES do lado de fora (o −lat): grossas, se enroscando ao longo da escada, subindo como uma parede viva
    const nR = o.low ? 4 : 8;
    for (let k = 0; k < nR; k++) {
      const out: THREE.Vector3[] = [], f = 0.18 + 0.07 * k, fase = k * 1.7, A = 3 + (k % 4) * 3.5;
      for (let s = Math.max(0, sIni - 3); s <= Math.min(len, sFim + 3); s += 2) {
        const p = em(s), y = alturaDaEscadariaRasta(Math.min(s, len)), lat = -(M.meia + 0.9 + (k % 3) * 0.7 + 0.5 * Math.sin(s * f + fase));
        out.push(new THREE.Vector3(p.x + p.tz * lat, y - 2 + A * (0.55 + 0.45 * Math.sin(s * f * 0.7 + fase)), p.z - p.tx * lat));
      }
      const r = malha(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(out), o.low ? 70 : 160, 0.45 + 0.25 * (k % 3), 7, false), k % 3 === 2 ? seivaD : seiva, gr); alvos.push(r);
    }
    // as raízes que PENDEM pro abismo (de baixo dos degraus, curvando)
    const nP = o.low ? 6 : 16;
    for (let k = 0; k < nP; k++) {
      const s0 = sIni + ((k + 0.5) / nP) * (sFim - sIni), p = em(s0), y0 = alturaDaEscadariaRasta(s0) - 0.5, lado = k % 2 ? 1 : -1, out: THREE.Vector3[] = [];
      for (let j = 0; j <= 6; j++) { const u = j / 6, lat = lado * (M.meia * 0.6 + u * 3 + Math.sin(u * 5 + k) * 1.2); out.push(new THREE.Vector3(p.x + p.tz * lat, y0 - u * (10 + (k % 4) * 5), p.z - p.tx * lat)); }
      malha(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(out), 16, 0.3 - 0.1 * u01(k), 6, false), seiva, gr);
    }
  }

  // ── a CAPELA MAIOR (na plataforma lá em cima): pilares finos, o anel tricolor, o domo de vidro, o halo e a coluna de luz ──
  { const C = CAPELA_RASTA, cg = new THREE.Group(); cg.position.set(TEMPLO_RASTA.x, TEMPLO_RASTA.h, TEMPLO_RASTA.z); group.add(cg);
    const branco = new THREE.MeshStandardMaterial({ color: 0xe8efe6, emissive: 0x2a3a2a, emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.7 });
    const pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(C.pilarR * 0.55, C.pilarR, C.altura, 10), branco, C.pilares), mm = new THREE.Matrix4();
    for (let i = 0; i < C.pilares; i++) { const a = (i / C.pilares) * Math.PI * 2 + Math.PI / C.pilares; pil.setMatrixAt(i, mm.makeTranslation(Math.cos(a) * C.r, C.altura / 2, Math.sin(a) * C.r)); }
    pil.instanceMatrix.needsUpdate = true; pil.computeBoundingSphere(); cg.add(pil); geos.push(pil.geometry); mats.push(branco); alvos.push(pil);
    // as faixas de luz nos pilares (verde embaixo, amarelo, vermelho no alto)
    for (const [y, c] of [[C.altura * 0.3, VERDE], [C.altura * 0.6, AMARELO], [C.altura * 0.9, VERMELHO]] as const) { const t = malha(new THREE.TorusGeometry(C.r, 0.25, 6, seg * 2), aditivo(c, 0.75), cg); t.rotation.x = Math.PI / 2; t.position.y = y; }
    const domo = malha(new THREE.SphereGeometry(C.r + 1, o.low ? 28 : 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c2414, emissive: 0x1e5a2c, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }), cg);
    domo.position.y = C.altura; domo.scale.y = 0.42;
    const halo = malha(new THREE.TorusGeometry(C.r * 0.7, 0.5, 8, 96), aditivo(AMARELO, 0.85), cg); halo.rotation.x = Math.PI / 2; halo.position.y = C.altura + 16;
    const coluna = malha(new THREE.CylinderGeometry(1.2, 3.5, 120, 16, 1, true), aditivo(VERDE, 0.12), cg); coluna.position.y = C.altura + 70;
    // no piso: a mandala tricolor e o fogo sagrado de luz no meio
    for (const [r, c] of [[9, VERMELHO], [7, AMARELO], [5, VERDE]] as const) { const an = malha(new THREE.RingGeometry(r - 0.5, r, 64), aditivo(c, 0.55), cg); an.rotation.x = -Math.PI / 2; an.position.y = 0.05; }
    const chama = malha(new THREE.ConeGeometry(1.4, 5, 12, 1, true), aditivo(AMARELO, 0.55), cg); chama.position.y = 2.6;
    for (const x of [halo, coluna, chama]) x.userData.semLote = true;
    anim.push((_, t) => { halo.rotation.z = t * 0.2; halo.position.y = C.altura + 16 + Math.sin(t * 0.7) * 0.8; chama.scale.set(1, 0.85 + 0.25 * Math.sin(t * 7) + 0.1 * Math.sin(t * 13), 1); });
  }

  // ── o SALÃO DE FESTAS: a cobertura em anel sobre pilares e o piso de LED pulsando nas três cores ──
  { const fg = new THREE.Group(); fg.position.set(FESTAS.x, FESTAS.h, FESTAS.z); group.add(fg);
    const metal = new THREE.MeshStandardMaterial({ color: 0x1a1a22, emissive: 0x141420, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.8 }); mats.push(metal);
    for (const q of PILARES_FESTAS) { const p = malha(new THREE.CylinderGeometry(0.4, 0.55, 14, 8), metal, fg); p.position.set(q.x - FESTAS.x, 7, q.z - FESTAS.z); }   // (os mesmos da colisão — sem o que ficava no caminho da ponte)
    const teto = malha(new THREE.TorusGeometry(FESTAS.r - 3, 1.4, 8, 64), metal, fg); teto.rotation.x = Math.PI / 2; teto.position.y = 14.5;
    const tela = malha(new THREE.CircleGeometry(FESTAS.r - 3, 48), aditivo(VERMELHO, 0.08), fg); tela.rotation.x = Math.PI / 2; tela.position.y = 14.4;
    const leds = [0, 1, 2, 3, 4, 5].map((k) => { const c = [VERDE, AMARELO, VERMELHO][k % 3]!, an = malha(new THREE.RingGeometry(3 + k * 3, 4.6 + k * 3, 48), aditivo(c, 0.4), fg); an.rotation.x = -Math.PI / 2; an.position.y = 0.04; an.userData.semLote = true; return an; });
    anim.push((_, t) => leds.forEach((an, k) => { (an.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.4 * Math.max(0, Math.sin(t * 3 - k * 0.8)); }));
  }

  // ── o LOUNGE PRIVATIVO dos casais: a cápsula de vidro rosada, o sofá redondo e as luzinhas ──
  { const pg = new THREE.Group(); pg.position.set(CASAIS.x, CASAIS.h, CASAIS.z); group.add(pg);
    // a cúpula com a PORTA onde a ponte chega (antes fechada — e atravessável: agora o vidro bloqueia e a porta é a entrada)
    // (no SphereGeometry: x = −cos φ, z = sen φ → o ângulo `a` é φ = π − a)
    const pd = portaDosCasais();
    malha(new THREE.SphereGeometry(CASAIS.r - 1, 32, 16, Math.PI - pd.ang + pd.meia, Math.PI * 2 - 2 * pd.meia, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a0c22, emissive: 0x5a1846, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }), pg).scale.y = 0.55;
    const sofa = malha(new THREE.TorusGeometry(3.2, 0.7, 10, 40, Math.PI * 1.5), new THREE.MeshStandardMaterial({ color: 0x5a1838, emissive: 0x3a0820, emissiveIntensity: 0.6, roughness: 0.7 }), pg); sofa.rotation.x = Math.PI / 2; sofa.position.y = 0.6;
    const luzes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffb0d8 }), 40), m = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; luzes.setMatrixAt(i, m.makeTranslation(Math.cos(a) * (CASAIS.r - 1.6), 5.2 + Math.sin(a * 3) * 0.3, Math.sin(a) * (CASAIS.r - 1.6))); }
    luzes.instanceMatrix.needsUpdate = true; luzes.computeBoundingSphere(); pg.add(luzes); geos.push(luzes.geometry); mats.push(luzes.material as THREE.Material);
  }

  // ── a TORRE: fina, alta, futurista — anéis acesos subindo e o farol no topo ──
  { const tg = new THREE.Group(); tg.position.set(TORRE_RASTA.x, FESTAS.h, TORRE_RASTA.z); group.add(tg); const A = TORRE_RASTA.alt;
    const corpo = malha(new THREE.CylinderGeometry(1.2, TORRE_RASTA.r, A, 12), new THREE.MeshStandardMaterial({ color: 0xdfe6dc, emissive: 0x1a2a1a, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.8 }), tg); corpo.position.y = A / 2; alvos.push(corpo);
    const aneis: THREE.Mesh[] = [];
    for (let k = 1; k <= 8; k++) { const y = (k / 9) * A, r = TORRE_RASTA.r - (TORRE_RASTA.r - 1.2) * (y / A) + 0.6, an = malha(new THREE.TorusGeometry(r, 0.18, 6, 32), aditivo([VERDE, AMARELO, VERMELHO][k % 3]!, 0.85), tg); an.rotation.x = Math.PI / 2; an.position.y = y; an.userData.semLote = true; aneis.push(an); }
    const farol = malha(new THREE.SphereGeometry(1.6, 16, 10), aditivo(AMARELO, 0.9), tg); farol.position.y = A + 1.5; farol.userData.semLote = true;
    anim.push((_, t) => { aneis.forEach((an, k) => { (an.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.6 * Math.max(0, Math.sin(t * 2.2 - k * 0.6)); }); farol.scale.setScalar(0.85 + 0.25 * Math.sin(t * 3)); });
  }

  return {
    group, alvos,
    atualizar(dt, t) { for (const f of anim) f(dt, t); },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of mats) if (m !== o.paredeMat) m.dispose(); },
  };
}
const u01 = (k: number) => ((k * 37) % 10) / 10;
