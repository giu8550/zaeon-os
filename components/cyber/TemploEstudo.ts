/**
 * TemploEstudo — os LOUNGES ESTUDANTIS do Templo Cósmico (layout puro em lib/cyber/temploCosmico `ESTUDO`,
 * `ANDARES_ESTUDO`, `CARACOL`; os sofás e pufes das rodas de leitura são móveis do lounge — lib/cyber/ceu `zonaEstudo`,
 * uma roda por andar, onde dá pra sentar): uma ROTUNDA de 3 andares em cada lado do salão — a parede SÓLIDA (as
 * entradas só no térreo, com as janelas acesas por fora), as ESTANTES cheias de livros em todos os andares, as
 * luzinhas penduradas no teto de cada um, as luminárias e as plantas; no meio, o ÁTRIO com a ESCADA EM CARACOL em volta
 * da coluna e, embaixo da cúpula de vidro, o LUSTRE grande descendo. As "caixas de som" (uma por andar) são de onde sai
 * o som calmo de estudo (o engine toca).
 * Referencial da SALA do lounge, y = 0 no pátio (vai dentro do grupo do Templo Cósmico). O caracol e o guarda-corpo do
 * átrio vão num grupo LOCAL (o lounge da direita é o espelho do da esquerda: o caracol gira ao contrário).
 */
import * as THREE from "three";
import { ANDARES_ESTUDO, CARACOL, PLATS, aberturasDe, vaoDoAtrio } from "@/lib/cyber/temploCosmico";

export type EstudoHandle = { group: THREE.Group; alvos: THREE.Object3D[]; caixas: THREE.Object3D[]; atualizar(dt: number, t: number): void; dispose(): void };

const CORES_LIVRO = [0xc94f3d, 0x3d6fc9, 0xe0b04a, 0x4fa36b, 0x8a5bc9, 0xd98a3a, 0x2f8f9a, 0xe8e1d0];
const aditivo = (cor: THREE.ColorRepresentation, op: number) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
/** o ângulo `a` (x = cos a, z = sen a) no CylinderGeometry é θ = π/2 − a: um trecho [ini, fim] de parede cilíndrica */
const trechoCilindro = (r: number, h: number, ini: number, fim: number, seg: number) =>
  new THREE.CylinderGeometry(r, r, h, Math.max(6, Math.round((seg * (fim - ini)) / (Math.PI * 2))), 1, true, Math.PI / 2 - fim, fim - ini);
/** os trechos FECHADOS de um círculo, entre aberturas ({ang, meia}) */
function trechosEntre(abs: { ang: number; meia: number }[]): [number, number][] {
  if (!abs.length) return [[0, Math.PI * 2]];
  const o = [...abs].sort((a, b) => a.ang - b.ang), out: [number, number][] = [];
  for (let i = 0; i < o.length; i++) { const a = o[i]!, b = o[(i + 1) % o.length]!, ini = a.ang + a.meia; let fim = b.ang - b.meia; while (fim <= ini) fim += Math.PI * 2; out.push([ini, fim]); }
  return out;
}

export function criarLoungesEstudo(o: { low: boolean; paredeMat: THREE.Material }): EstudoHandle {
  const group = new THREE.Group(); group.name = "lounges-estudo";
  const alvos: THREE.Object3D[] = [], caixas: THREE.Object3D[] = [], geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const malha = <G extends THREE.BufferGeometry>(g: G, m: THREE.Material, pai: THREE.Object3D) => { geos.push(g); if (!mats.includes(m)) mats.push(m); const x = new THREE.Mesh(g, m); pai.add(x); return x; };
  const A = ANDARES_ESTUDO, C = CARACOL, seg = o.low ? 48 : 96;
  const madeira = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.75, metalness: 0.05 });
  const tapete = new THREE.MeshStandardMaterial({ color: 0x2a2440, emissive: 0x161028, emissiveIntensity: 0.4, roughness: 0.95, side: THREE.DoubleSide });
  const forro = new THREE.MeshStandardMaterial({ color: 0x4a3222, emissive: 0x1c0f06, emissiveIntensity: 0.6, roughness: 0.8, side: THREE.DoubleSide });
  const parede = new THREE.MeshStandardMaterial({ color: 0x2b2130, emissive: 0x0e0812, emissiveIntensity: 0.5, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide });
  const latao = new THREE.MeshStandardMaterial({ color: 0xc9a25a, emissive: 0x3a2808, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8dce6, roughness: 0.3, metalness: 0.8 });
  const quente = new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), vaso = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 });
  const folha = new THREE.MeshStandardMaterial({ color: 0x2f8a4a, emissive: 0x0c2a14, emissiveIntensity: 0.5, roughness: 0.8 });
  const vidro = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.14, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const sanca = aditivo(0xffc070, 0.55), friso = aditivo(0xffc070, 0.7);
  // as JANELAS (por fora): a faixa quente acesa com os caixilhos — de longe, a rotunda é uma lanterna de 3 andares
  const janela = new THREE.ShaderMaterial({
    side: THREE.FrontSide,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `varying vec2 vUv;
      void main(){ float c = step(0.14, fract(vUv.x * 64.0)) * step(0.1, vUv.y) * step(vUv.y, 0.9), m = step(0.48, abs(vUv.y - 0.5)) + step(fract(vUv.x * 64.0), 0.14);
        vec3 luz = mix(vec3(1.0, 0.72, 0.42), vec3(1.0, 0.86, 0.6), vUv.y);
        gl_FragColor = vec4(mix(vec3(0.08, 0.05, 0.06), luz * 0.95, c * (1.0 - clamp(m, 0.0, 1.0))), 1.0); }`,
  });
  mats.push(janela);
  const luzes: THREE.InstancedMesh[] = [], lustres: THREE.Object3D[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), um = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), eixoY = new THREE.Vector3(0, 1, 0), cor = new THREE.Color();
  const inst = (g: THREE.BufferGeometry, m: THREE.Material, n: number, pai: THREE.Object3D) => { geos.push(g); if (!mats.includes(m)) mats.push(m); const im = new THREE.InstancedMesh(g, m, n); pai.add(im); return im; };
  const fechar = (im: THREE.InstancedMesh) => { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); };

  for (const p of PLATS.filter((x) => x.id === "estudoL" || x.id === "estudoR")) {
    const g = new THREE.Group(); g.position.set(p.x, p.h, p.z); group.add(g);
    const gl = new THREE.Group(); gl.scale.x = p.id === "estudoR" ? -1 : 1; g.add(gl);   // (o referencial LOCAL: o caracol)
    const R = p.r, abs = aberturasDe(p), livre = (a: number, folga: number) => abs.every((ab) => { let d = a - ab.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) > ab.meia + folga; });

    // ── os PISOS: o térreo (o tapete na laje do Templo) e as lajes dos andares de cima, com o buraco do átrio ──
    const tp0 = malha(new THREE.RingGeometry(C.r + 0.4, R - 3, seg), tapete, g); tp0.rotation.x = -Math.PI / 2; tp0.position.y = 0.04;
    for (let k = 0; k < A.n; k++) { const an = malha(new THREE.RingGeometry(R - 3, R - 2.4, seg), madeira, g); an.rotation.x = -Math.PI / 2; an.position.y = k * A.pe + 0.05; }
    for (let k = 1; k < A.n; k++) {
      const y = k * A.pe;
      const topo = malha(new THREE.RingGeometry(C.r, R + 0.3, seg), tapete, g); topo.rotation.x = -Math.PI / 2; topo.position.y = y + 0.02; alvos.push(topo);
      const teto = malha(new THREE.RingGeometry(C.r, R + 0.3, seg), forro, g); teto.rotation.x = Math.PI / 2; teto.position.y = y - 0.6;
      const borda = malha(new THREE.CylinderGeometry(C.r, C.r, 0.62, 48, 1, true), latao, g); borda.position.y = y - 0.29;
    }
    // ── a PAREDE sólida: o térreo com as entradas (nas posições de sempre) e, acima do lintel, fechada até a cúpula ──
    const RP = R + 0.35, LINTEL = 4.4;
    for (const [ini, fim] of trechosEntre(abs)) { const w = malha(trechoCilindro(RP, LINTEL, ini, fim, seg), parede, g); w.position.y = LINTEL / 2; }
    const alta = malha(new THREE.CylinderGeometry(RP, RP, A.teto - LINTEL, seg, 1, true), parede, g); alta.position.y = LINTEL + (A.teto - LINTEL) / 2;
    for (const ab of abs) {   // os PORTAIS: os batentes acesos e o lintel
      for (const s of [-1, 1]) { const a = ab.ang + s * ab.meia, b = malha(new THREE.BoxGeometry(0.35, LINTEL, 0.35), friso, g); b.position.set(Math.cos(a) * RP, LINTEL / 2, Math.sin(a) * RP); }
      const l = malha(new THREE.TorusGeometry(RP, 0.16, 4, 24, ab.meia * 2), friso, g); l.rotation.set(Math.PI / 2, 0, ab.ang - ab.meia); l.position.y = LINTEL;
    }
    // as JANELAS por fora (uma faixa por andar) e as cornijas acesas marcando cada laje
    for (let k = 0; k < A.n; k++) { const jh = k === 0 ? 1.6 : 2.6, w = malha(new THREE.CylinderGeometry(RP + 0.08, RP + 0.08, jh, seg, 1, true), janela, g); w.position.y = k === 0 ? 5.7 : k * A.pe + 3.2; }
    for (let k = 1; k <= A.n; k++) { const c = malha(new THREE.TorusGeometry(RP + 0.2, 0.14, 4, seg * 2), friso, g); c.rotation.x = Math.PI / 2; c.position.y = k === A.n ? A.teto : k * A.pe; }
    // por dentro: a SANCA de luz quente em cima de cada andar (a luz batendo no forro)
    for (let k = 0; k < A.n; k++) { const s = malha(new THREE.TorusGeometry(R - 0.1, 0.08, 4, seg * 2), sanca, g); s.rotation.x = Math.PI / 2; s.position.y = k === A.n - 1 ? A.teto - 0.4 : (k + 1) * A.pe - 0.9; }
    // ── a CÚPULA de vidro e o aro ──
    const domo = malha(new THREE.SphereGeometry(RP, seg, 12, 0, Math.PI * 2, 0, Math.PI / 2), vidro, g); domo.scale.y = 0.32; domo.position.y = A.teto;
    const aro = malha(new THREE.TorusGeometry(RP, 0.3, 6, seg * 2), latao, g); aro.rotation.x = Math.PI / 2; aro.position.y = A.teto;

    // ── as ESTANTES em todos os andares (no térreo, menos onde as entradas encostam), cheias de livros ──
    const prat: { a: number; y: number }[] = [];
    for (let k = 0; k < A.n; k++) for (let a = 0; a < Math.PI * 2; a += 2.6 / (R - 1.6)) if (k > 0 || livre(a, 0.12)) prat.push({ a, y: k * A.pe });
    const HE = 3.1, im = inst(new THREE.BoxGeometry(2.4, HE, 0.45), madeira, prat.length, g); alvos.push(im);
    const porEstante = o.low ? 12 : 32, livros = inst(new THREE.BoxGeometry(0.11, 0.42, 0.3), new THREE.MeshLambertMaterial({ color: 0xffffff }), prat.length * porEstante, g);
    let k = 0;
    prat.forEach(({ a, y }, i) => {
      const r = R - 1.6, rot = Math.atan2(-Math.cos(a), -Math.sin(a));   // (de frente pro meio)
      q.setFromAxisAngle(eixoY, rot); im.setMatrixAt(i, m4.compose(v.set(Math.cos(a) * r, y + HE / 2, Math.sin(a) * r), q, um));
      for (let j = 0; j < porEstante; j++) {
        const prateleira = j % 4, lx = -1.05 + ((j / 4) | 0) * (2.1 / Math.ceil(porEstante / 4)), alt = 0.42 + prateleira * 0.72;
        const off = new THREE.Vector3(lx, alt, 0.08).applyQuaternion(q);
        livros.setMatrixAt(k, m4.compose(v.set(Math.cos(a) * r + off.x, y + off.y, Math.sin(a) * r + off.z), q, um.set(1, 0.8 + ((j * 37) % 5) * 0.06, 1))); um.set(1, 1, 1);
        livros.setColorAt(k, cor.setHex(CORES_LIVRO[(i * 7 + j * 3) % CORES_LIVRO.length]!)); k++;
      }
    });
    fechar(im); fechar(livros);

    // ── os LUSTRES de cada andar: as luzinhas quentes penduradas no teto (como antes), agora em todos os andares ──
    const NL = o.low ? 40 : 90, pend = inst(new THREE.SphereGeometry(0.11, 8, 6), quente, NL * A.n, g);
    for (let a = 0; a < A.n; a++) {
      const teto = a === A.n - 1 ? A.teto : (a + 1) * A.pe - 0.6;
      for (let i = 0; i < NL; i++) { const ang = (i / NL) * Math.PI * 2 * 3.7 + a, r = C.r + 2 + (i / NL) * (R - C.r - 6); pend.setMatrixAt(a * NL + i, m4.makeTranslation(Math.cos(ang) * r, teto - 0.6 - ((i * 13) % 7) * 0.25, Math.sin(ang) * r)); }
    }
    fechar(pend); luzes.push(pend);
    // as LUMINÁRIAS de pé (junto das rodas de leitura) e as PLANTAS, em cada andar
    for (let a = 0; a < A.n; a++) {
      const y = a * A.pe;
      for (const [lx, lz] of [[-20, 6], [20, 6], [-8, 21], [8, 21], [-7, 3], [7, 3]] as const) {
        const pe = malha(new THREE.CylinderGeometry(0.05, 0.05, 2.1, 6), metal, g); pe.position.set(lx, y + 1.05, lz);
        const cup = malha(new THREE.ConeGeometry(0.42, 0.45, 16, 1, true), quente, g); cup.position.set(lx, y + 2.15, lz); cup.rotation.x = Math.PI;
      }
      for (const [lx, lz] of [[-22, 12], [22, 12], [-15, 20], [15, 20], [0, 24], [-3, -23]] as const) {
        const vs = malha(new THREE.CylinderGeometry(0.5, 0.38, 0.8, 12), vaso, g); vs.position.set(lx, y + 0.4, lz);
        const fl = malha(new THREE.IcosahedronGeometry(0.9, 1), folha, g); fl.position.set(lx, y + 1.35, lz); fl.scale.set(1, 1.3, 1);
      }
      const cx = new THREE.Object3D(); cx.position.set(0, y + 3.5, 0); g.add(cx); caixas.push(cx);   // (o som calmo de estudo, um por andar)
    }

    // ── o ÁTRIO: a COLUNA, a ESCADA EM CARACOL (uma volta por andar), o corrimão e o guarda-corpo de cada andar ──
    const col = malha(new THREE.CylinderGeometry(C.col, C.col, A.teto, 32), latao, gl); col.position.y = A.teto / 2;
    for (let a = 0; a < A.n; a++) { const an = malha(new THREE.TorusGeometry(C.col + 0.05, 0.07, 4, 32), friso, gl); an.rotation.x = Math.PI / 2; an.position.y = a * A.pe + 2.4; }
    const N = 36, voltas = A.n - 1, rise = A.pe / N, mid = (C.col + C.r) / 2, largD = ((2 * Math.PI * mid) / N) * 1.12;
    const deg = inst(new THREE.BoxGeometry(C.r - C.col - 0.05, 0.16, largD), madeira, N * voltas, gl), qn = inst(new THREE.BoxGeometry(0.12, 0.05, largD * 0.9), friso, N * voltas, gl);
    const bal = inst(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), latao, (N / 2) * voltas, gl);
    for (let i = 0; i < N * voltas; i++) {
      const th = C.boca + ((i + 0.5) / N) * Math.PI * 2, yt = (i + 1) * rise, c = Math.cos(th), s = Math.sin(th);
      q.setFromAxisAngle(eixoY, -th);
      deg.setMatrixAt(i, m4.compose(v.set(c * mid, yt - 0.08, s * mid), q, um));
      qn.setMatrixAt(i, m4.compose(v.set(c * (C.r - 0.1), yt + 0.01, s * (C.r - 0.1)), q, um));
      if (i % 2 === 0) bal.setMatrixAt(i / 2, m4.compose(v.set(c * (C.r - 0.12), yt + 0.5, s * (C.r - 0.12)), q.identity(), um));
    }
    fechar(deg); fechar(qn); fechar(bal); alvos.push(deg);
    // o FORRO por baixo do caracol (a fita helicoidal) e a lateral de fora — a escada tem corpo, não flutua
    {
      const M = 72 * voltas, pos: number[] = [], idx: number[] = [], total = voltas * A.pe;
      for (let j = 0; j <= M; j++) {
        const t = j / M, th = C.boca + t * voltas * Math.PI * 2, y = t * total, c = Math.cos(th), s = Math.sin(th);
        pos.push(c * C.col, y - 0.3, s * C.col, c * C.r, y - 0.3, s * C.r, c * C.r, y + 0.2, s * C.r);
        if (j < M) { const b = j * 3; idx.push(b, b + 1, b + 3, b + 1, b + 4, b + 3, b + 1, b + 2, b + 4, b + 2, b + 5, b + 4); }
      }
      const gh = new THREE.BufferGeometry(); gh.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); gh.setIndex(idx); gh.computeVertexNormals();
      malha(gh, forro, gl);
      class Helice extends THREE.Curve<THREE.Vector3> { constructor() { super(); } getPoint(t: number, alvo = new THREE.Vector3()) { const th = C.boca + t * voltas * Math.PI * 2; return alvo.set(Math.cos(th) * (C.r - 0.12), t * total + 1.0, Math.sin(th) * (C.r - 0.12)); } }
      malha(new THREE.TubeGeometry(new Helice(), 60 * voltas, 0.05, 6, false), latao, gl);
    }
    // o GUARDA-CORPO do átrio em cada andar (vidro + corrimão de latão), aberto só no vão do caracol
    for (let a = 0; a < A.n; a++) {
      const [de, ate] = vaoDoAtrio(a), ini = ate, fim = de + Math.PI * 2, rr = C.r + C.grade;
      const w = malha(trechoCilindro(rr, 1.1, ini, fim, 64), o.paredeMat, gl); w.position.y = a * A.pe + 0.55;
      const tr = malha(new THREE.TorusGeometry(rr, 0.05, 4, 64, fim - ini), latao, gl); tr.rotation.set(Math.PI / 2, 0, ini); tr.position.y = a * A.pe + 1.12;
    }
    // ── o LUSTRE GRANDE embaixo da cúpula: a coroa de latão e os fios de luz descendo pelo átrio ──
    const lus = new THREE.Group(); lus.position.y = A.teto - 0.6; lus.userData.semLote = true; gl.add(lus); lustres.push(lus);
    for (const [r, t] of [[4.2, 0.09], [2.6, 0.07]] as const) { const c = malha(new THREE.TorusGeometry(r, t, 6, 64), latao, lus); c.rotation.x = Math.PI / 2; }
    const NF = o.low ? 16 : 32, GF = 7, gotas = inst(new THREE.SphereGeometry(0.09, 8, 6), quente, NF * GF, lus), fios = inst(new THREE.CylinderGeometry(0.008, 0.008, 1, 3), sanca, NF, lus);
    for (let i = 0; i < NF; i++) {
      const a = (i / NF) * Math.PI * 2, r = i % 2 ? 4.2 : 2.6, len = 2.2 + ((i * 7) % 5) * 0.55, c = Math.cos(a) * r, s = Math.sin(a) * r;
      fios.setMatrixAt(i, m4.compose(v.set(c, -len / 2, s), q.identity(), um.set(1, len, 1))); um.set(1, 1, 1);
      for (let j = 0; j < GF; j++) gotas.setMatrixAt(i * GF + j, m4.makeTranslation(c, -((j + 1) / GF) * len, s));
    }
    fechar(gotas); fechar(fios); luzes.push(gotas);
    const nucleo = malha(new THREE.SphereGeometry(0.7, 16, 12), quente, lus); nucleo.position.y = -1.2;
  }
  return {
    group, alvos, caixas,
    atualizar(dt, t) {
      for (const l of luzes) l.material instanceof THREE.MeshBasicMaterial && l.material.color.setHSL(0.09, 0.9, 0.78 + 0.05 * Math.sin(t * 0.8));
      for (const l of lustres) l.rotation.y += dt * 0.05;
    },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of [...mats, madeira, tapete, forro, parede, latao, metal, quente, vaso, folha, vidro, sanca, friso]) if (m !== o.paredeMat) m.dispose(); },
  };
}
