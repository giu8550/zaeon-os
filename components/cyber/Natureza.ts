/**
 * Natureza — a vida do campus da Universidade (realidade "melhorada"): árvores de copa folhosa, pomar com frutas,
 * coníferas, sebes, gramado com tufos, canteiros de flores, caminhos de pedra, bancos e postes de luz; e as
 * PLANTAÇÕES do pátio externo — trigo, milho, horta em canteiros elevados, girassóis e jardins — com cerca, espantalho e
 * colmeias. Tudo instanciado; as plantas balançam com o vento (shader: deslocamento pela altura, sem custo de CPU).
 * Layout (e colisão das árvores/sebes) em lib/cyber/universidade.ts — CAMPOS, ARVORES, SEBES. `low` rareia tudo.
 */
import * as THREE from "three";
import { ARVORES, CAMPOS, FONTES, PATIOS, SEBES, TORRES, UNIVERSIDADE, type Campo } from "@/lib/cyber/universidade";
import { glowTex } from "./CenaCosmica";

export function criarNatureza(raiz: THREE.Group, o: { low: boolean; starTex: THREE.Texture; texturas: THREE.Texture[] }): { atualizar(dt: number, t: number): void } {
  const { low, texturas } = o, dens = low ? 1.7 : 1;
  const mx = new THREE.Matrix4(), mq = new THREE.Quaternion(), ms = new THREE.Vector3(), mp = new THREE.Vector3(), eu = new THREE.Euler(), cor = new THREE.Color();
  let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const livre = (x: number, z: number, f = 1) => TORRES.every((t) => Math.hypot(x - t.x, z - t.z) > t.r + f);

  // VENTO: as plantas balançam pela altura (o topo mexe, a base fica) — um uniforme de tempo compartilhado
  const tempo = { value: 0 };
  const balancar = <M extends THREE.Material>(m: M, amp: number): M => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTempo = tempo;
      sh.vertexShader = "uniform float uTempo;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 wp = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          float alto = clamp(position.y + 0.5, 0.0, 1.0);
          float onda = sin(uTempo * 1.7 + wp.x * 0.35 + wp.z * 0.21) + 0.4 * sin(uTempo * 3.1 + wp.z * 0.6);
          transformed.x += onda * ${amp.toFixed(3)} * alto * alto;
          transformed.z += onda * ${(amp * 0.5).toFixed(3)} * alto * alto;
        #endif`);
    };
    return m;
  };
  /** InstancedMesh a partir de uma lista de [x, y, z, sx, sy, sz, rx, ry, rz, cor] */
  const instancias = (geo: THREE.BufferGeometry, mat: THREE.Material, lista: number[][]) => {
    if (!lista.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, lista.length);
    lista.forEach((c, i) => { mq.setFromEuler(eu.set(c[6] ?? 0, c[7] ?? 0, c[8] ?? 0)); im.setMatrixAt(i, mx.compose(mp.set(c[0]!, c[1]!, c[2]!), mq, ms.set(c[3]!, c[4]!, c[5]!))); if (c[9] !== undefined) im.setColorAt(i, cor.setHex(c[9])); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); raiz.add(im); return im;
  };
  const caixa = new THREE.BoxGeometry(1, 1, 1), esfera = new THREE.IcosahedronGeometry(1, 1), cone = new THREE.ConeGeometry(1, 1, 6), cil = new THREE.CylinderGeometry(1, 1, 1, 6);
  const folha = (emissivo: number, i = 0.22) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true, emissive: emissivo, emissiveIntensity: i });
  const VERDES = [0x2f7a3a, 0x3d8f45, 0x4fa64c, 0x2a6b48, 0x5aa83f], madeiraT = new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.9, emissive: 0x1a0f08, emissiveIntensity: 0.4 });
  const solo = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1, emissive: 0x1a1008, emissiveIntensity: 0.35 });
  const pedraCaminho = new THREE.MeshStandardMaterial({ color: 0x5a6378, roughness: 0.9, emissive: 0x1a2236, emissiveIntensity: 0.45 });

  // ── ÁRVORES ──
  const troncosL: number[][] = [], copasL: number[][] = [], frutasL: number[][] = [], conesL: number[][] = [];
  for (const a of ARVORES) {
    if (a.tipo === "conifera") {
      troncosL.push([a.x, a.h * 0.12, a.z, 0.35, a.h * 0.24, 0.35]);
      for (let k = 0; k < 3; k++) conesL.push([a.x, a.h * (0.38 + k * 0.2), a.z, a.h * (0.3 - k * 0.07), a.h * 0.38, a.h * (0.3 - k * 0.07), 0, r() * 6, 0, [0x1f5a3a, 0x24663f, 0x2a7046][k]!]);
      continue;
    }
    const fruta = a.tipo === "fruta", tr = fruta ? 0.18 : 0.3;
    troncosL.push([a.x, a.h * 0.3, a.z, tr, a.h * 0.6, tr, (r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.08]);
    const R = a.h * (fruta ? 0.3 : 0.26), n = fruta ? 3 : 5;
    copasL.push([a.x, a.h * 0.78, a.z, R * 1.15, R * 0.95, R * 1.15, 0, r() * 6, 0, VERDES[Math.floor(r() * VERDES.length)]!]);
    for (let k = 0; k < n; k++) { const ang = (k / n) * Math.PI * 2 + r(), d = R * 0.75; copasL.push([a.x + Math.cos(ang) * d, a.h * (0.62 + r() * 0.2), a.z + Math.sin(ang) * d, R * (0.6 + r() * 0.25), R * (0.55 + r() * 0.2), R * (0.6 + r() * 0.25), 0, r() * 6, 0, VERDES[Math.floor(r() * VERDES.length)]!]); }
    if (fruta) for (let k = 0; k < (low ? 5 : 10); k++) { const ang = r() * 6.28, el = (r() - 0.3) * 1.2; frutasL.push([a.x + Math.cos(ang) * R * 1.05 * Math.cos(el), a.h * 0.75 + Math.sin(el) * R, a.z + Math.sin(ang) * R * 1.05 * Math.cos(el), 0.11, 0.11, 0.11, 0, 0, 0, [0xff6a2a, 0xffb02a, 0xe8302a][k % 3]!]); }
  }
  instancias(cil, madeiraT, troncosL);
  instancias(esfera, balancar(folha(0x0e2a12), 0.12), copasL);
  instancias(new THREE.ConeGeometry(1, 1, 7), balancar(folha(0x0a2214), 0.08), conesL);
  instancias(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: 0x401a08, emissiveIntensity: 0.5 }), frutasL);

  // ── SEBES (baixas, aparadas) com florzinhas em cima ──
  const sebesL: number[][] = [], florSebe: number[][] = [];
  for (const sb of SEBES) {
    sebesL.push([(sb.x0 + sb.x1) / 2, sb.alt / 2, (sb.z0 + sb.z1) / 2, sb.x1 - sb.x0, sb.alt, sb.z1 - sb.z0, 0, 0, 0, VERDES[3]!]);
    const L = Math.max(sb.x1 - sb.x0, sb.z1 - sb.z0), ao = sb.x1 - sb.x0 > sb.z1 - sb.z0;
    for (let d = 0.5; d < L; d += low ? 2.2 : 1.1) florSebe.push([ao ? sb.x0 + d : (sb.x0 + sb.x1) / 2 + (r() - 0.5) * 0.4, sb.alt + 0.05, ao ? (sb.z0 + sb.z1) / 2 + (r() - 0.5) * 0.4 : sb.z0 + d, 0.09, 0.09, 0.09, 0, 0, 0, [0xff8ad8, 0xffffff, 0xb98cff, 0xffd36b][Math.floor(r() * 4)]!]);
  }
  instancias(caixa, folha(0x0e2a12, 0.25), sebesL);
  instancias(esfera, new THREE.MeshBasicMaterial({ color: 0xffffff }), florSebe);

  // ── PÁTIOS: caminhos de pedra em cruz até a fonte, tufos de grama, canteiro redondo em volta da fonte, bancos, postes ──
  const caminhos: number[][] = [], tufos: number[][] = [], flores: number[][] = [], bancos: number[][] = [], postes: { x: number; z: number; h: number }[] = [];
  for (const p of PATIOS) {
    const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
    caminhos.push([cx, 0.07, cz, 3.2, 0.04, p.z1 - p.z0 - 2], [cx, 0.07, cz - 8, p.x1 - p.x0 - 2, 0.04, 3.2]);
    for (let k = 0; k < (low ? 500 : 1400); k++) { const x = p.x0 + 3.5 + r() * (p.x1 - p.x0 - 7), z = p.z0 + 3.5 + r() * (p.z1 - p.z0 - 7); if (Math.abs(x - cx) < 2 || Math.abs(z - (cz - 8)) < 2) continue; tufos.push([x, 0.18, z, 0.05 + r() * 0.04, 0.3 + r() * 0.25, 0.05 + r() * 0.04, (r() - 0.5) * 0.4, r() * 6, (r() - 0.5) * 0.4, VERDES[Math.floor(r() * VERDES.length)]!]); }
    for (const z of [p.z0 + 20, p.z1 - 20]) for (const sx of [-1, 1]) { bancos.push([cx + sx * 2.6, 0.45, z, 0.6, 0.12, 2.2], [cx + sx * 2.9, 0.75, z, 0.08, 0.5, 2.2]); }
    for (let z = p.z0 + 8; z < p.z1 - 4; z += 16) postes.push({ x: cx + 2.2, z, h: 4.2 });
  }
  for (const f of FONTES) for (let k = 0; k < (low ? 60 : 160); k++) { const ang = r() * 6.28, d = f.r + 1.2 + r() * 2.2; flores.push([f.x + Math.cos(ang) * d, 0.22, f.z + Math.sin(ang) * d, 0.1, 0.1, 0.1, 0, 0, 0, [0xff6ad5, 0xffffff, 0xb98cff, 0xffd36b, 0xff7a5a][Math.floor(r() * 5)]!]); }
  instancias(caixa, pedraCaminho, caminhos);
  instancias(cone, balancar(folha(0x0e2a12, 0.3), 0.06), tufos);
  instancias(caixa, madeiraT, bancos);

  // ── PLANTAÇÕES do pátio externo ──
  const hastes: number[][] = [], espigas: number[][] = [], milhoF: number[][] = [], milhoE: number[][] = [], canteiros: number[][] = [], hortalicas: number[][] = [], girHaste: number[][] = [], girFlor: number[][] = [], girMiolo: number[][] = [], cercaP: number[][] = [], cercaT: number[][] = [];
  const cercar = (c: Campo) => {
    const lados: [number, number, number, number][] = [[c.x0, c.z0, c.x1, c.z0], [c.x0, c.z1, c.x1, c.z1], [c.x0, c.z0, c.x0, c.z1], [c.x1, c.z0, c.x1, c.z1]];
    for (const [ax, az, bx, bz] of lados) {
      const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, giro = Math.atan2(-uz, ux);
      for (let d = 0; d <= L; d += 2.5) { if (L > 30 && Math.abs(d - L / 2) < 2) continue; cercaP.push([ax + ux * d, 0.5, az + uz * d, 0.08, 1, 0.08]); }
      for (const y of [0.45, 0.85]) { const meio = L / 2; for (const [s0, s1] of [[0, meio - 2], [meio + 2, L]]) if (s1 - s0 > 0.5) cercaT.push([ax + ux * (s0 + s1) / 2, y, az + uz * (s0 + s1) / 2, s1 - s0, 0.06, 0.05, 0, giro, 0]); }
    }
  };
  for (const c of CAMPOS) {
    const lx = c.x1 - c.x0, lz = c.z1 - c.z0;
    if (c.tipo === "gramado") continue;
    if (c.tipo !== "flores") { const s = new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), solo); s.rotation.x = -Math.PI / 2; s.position.set((c.x0 + c.x1) / 2, 0.06, (c.z0 + c.z1) / 2); raiz.add(s); cercar(c); }
    if (c.tipo === "trigo") {
      const e = 0.55 * dens; for (let x = c.x0 + 0.5; x < c.x1 - 0.3; x += e) for (let z = c.z0 + 0.5; z < c.z1 - 0.3; z += e) {
        const xx = x + (r() - 0.5) * 0.3, zz = z + (r() - 0.5) * 0.3, h = 0.85 + r() * 0.3; if (!livre(xx, zz, 0.8)) continue;
        hastes.push([xx, h / 2, zz, 0.035, h, 0.035, (r() - 0.5) * 0.15, 0, (r() - 0.5) * 0.15, [0xc8b25a, 0xd8c070, 0xb8a04a][Math.floor(r() * 3)]!]);
        espigas.push([xx, h + 0.08, zz, 0.07, 0.2, 0.07, 0, r() * 6, 0, [0xe8c860, 0xf0d070, 0xd8b048][Math.floor(r() * 3)]!]);
      }
    } else if (c.tipo === "milho") {
      for (let x = c.x0 + 0.8; x < c.x1 - 0.4; x += 1.1 * dens) for (let z = c.z0 + 0.6; z < c.z1 - 0.4; z += 0.75 * dens) {
        const h = 1.9 + r() * 0.5; if (!livre(x, z, 0.8)) continue;
        hastes.push([x, h / 2, z, 0.07, h, 0.07, 0, 0, 0, 0x5a8f3a]);
        for (let k = 0; k < 2; k++) milhoF.push([x, h * (0.45 + k * 0.2), z, 0.9, 0.04, 0.12, 0, r() * 6, -0.5 - r() * 0.3, 0x4f9a3a]);
        milhoE.push([x + 0.09, h * 0.55, z, 0.09, 0.32, 0.09, 0, 0, 0.25, 0xf2c94a]);
        espigas.push([x, h + 0.15, z, 0.05, 0.3, 0.05, 0, 0, 0, 0xd8c070]);
      }
    } else if (c.tipo === "horta") {
      // canteiros elevados correndo no comprido, com corredores; cada canteiro uma cultura
      const culturas = [{ cor: 0x3f9a4a, s: 0.24 }, { cor: 0x8fd06a, s: 0.18 }, { cor: 0x2f7a3a, s: 0.3 }, { cor: 0x6ab84a, s: 0.16 }];
      let k = 0; for (let x = c.x0 + 1.2; x < c.x1 - 1; x += 2.1, k++) {
        canteiros.push([x, 0.15, (c.z0 + c.z1) / 2, 1.3, 0.3, lz - 2]);
        const cu = culturas[k % culturas.length]!;
        for (let z = c.z0 + 1.5; z < c.z1 - 1.5; z += 0.55 * dens) for (const dx of [-0.32, 0.32]) {
          if (!livre(x, z, 0.8)) continue;
          if (k % 4 === 3) { hortalicas.push([x + dx, 0.42, z, 0.04, 0.25, 0.04, 0, 0, 0, 0x6ab84a]); hortalicas.push([x + dx, 0.32, z, 0.05, 0.05, 0.05, 0, 0, 0, 0xff8a2a]); }   // cenouras
          else hortalicas.push([x + dx, 0.3 + cu.s * 0.5, z, cu.s, cu.s * 0.8, cu.s, 0, r() * 6, 0, cu.cor]);
        }
      }
    } else if (c.tipo === "girassol") {
      for (let x = c.x0 + 0.7; x < c.x1 - 0.4; x += 1.0 * dens) for (let z = c.z0 + 0.7; z < c.z1 - 0.4; z += 1.0 * dens) {
        const xx = x + (r() - 0.5) * 0.3, zz = z + (r() - 0.5) * 0.3, h = 1.5 + r() * 0.6; if (!livre(xx, zz, 0.8)) continue;
        girHaste.push([xx, h / 2, zz, 0.05, h, 0.05, 0, 0, 0, 0x4f8a3a]);
        girFlor.push([xx, h + 0.05, zz - 0.06, 0.3, 0.04, 0.3, Math.PI / 2 - 0.25, 0, 0, 0xffc928]);
        girMiolo.push([xx, h + 0.06, zz - 0.09, 0.15, 0.05, 0.15, Math.PI / 2 - 0.25, 0, 0, 0x4a2a12]);
      }
    } else if (c.tipo === "flores") {
      for (let k = 0; k < (low ? 500 : 1500); k++) {
        const x = c.x0 + r() * lx, z = c.z0 + r() * lz; if (!livre(x, z, 0.8)) continue;
        if (r() < 0.25) tufos.push([x, 0.25, z, 0.25, 0.4, 0.25, 0, r() * 6, 0, VERDES[Math.floor(r() * VERDES.length)]!]);
        flores.push([x, 0.25 + r() * 0.3, z, 0.08 + r() * 0.05, 0.08, 0.08 + r() * 0.05, 0, 0, 0, [0xff6ad5, 0xffffff, 0xb98cff, 0xffd36b, 0xff7a5a, 0x7fb4ff][Math.floor(r() * 6)]!]);
      }
    }
  }
  instancias(caixa, balancar(folha(0x1a1408, 0.3), 0.12), hastes);
  instancias(caixa, balancar(folha(0x2a1e08, 0.35), 0.14), espigas);
  instancias(caixa, balancar(folha(0x0e2a12, 0.25), 0.1), milhoF);
  instancias(caixa, balancar(folha(0x3a2a08, 0.4), 0.1), milhoE);
  instancias(caixa, madeiraT, canteiros);
  instancias(esfera, balancar(folha(0x0e2a12, 0.25), 0.03), hortalicas);
  instancias(caixa, balancar(folha(0x0e2a12, 0.25), 0.1), girHaste);
  instancias(cil, balancar(folha(0x4a3008, 0.5), 0.1), girFlor);
  instancias(cil, balancar(folha(0x1a0e04, 0.3), 0.1), girMiolo);
  instancias(esfera, balancar(new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.04), flores);
  instancias(caixa, madeiraT, [...cercaP, ...cercaT]);

  // ── detalhes: espantalho no trigo, colmeias no pomar, carrinho de mão na horta ──
  const trigo = CAMPOS.find((c) => c.tipo === "trigo")!, ex = (trigo.x0 + trigo.x1) / 2, ez = (trigo.z0 + trigo.z1) / 2;
  instancias(caixa, madeiraT, [[ex, 1.1, ez, 0.1, 2.2, 0.1], [ex, 1.7, ez, 1.6, 0.08, 0.08]]);
  instancias(caixa, new THREE.MeshStandardMaterial({ color: 0x8a3a2a, roughness: 0.9 }), [[ex, 1.45, ez, 0.5, 0.6, 0.3]]);
  instancias(esfera, new THREE.MeshStandardMaterial({ color: 0xd8c070, roughness: 0.9 }), [[ex, 2.1, ez, 0.22, 0.24, 0.22]]);
  instancias(cone, new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 }), [[ex, 2.38, ez, 0.4, 0.3, 0.4]]);
  const n = UNIVERSIDADE.interna.meia + UNIVERSIDADE.interna.esp + 2;
  instancias(caixa, new THREE.MeshStandardMaterial({ color: 0xe8d8a0, roughness: 0.8, emissive: 0x2a2008, emissiveIntensity: 0.4 }), [-30, -24, 24, 30].map((x) => [x, 0.45, n, 0.7, 0.9, 0.6]));

  // ── POSTES DE LUZ: avenida do portão + pátios (luz quente) ──
  for (let z = -UNIVERSIDADE.externa.meia - 56; z < -UNIVERSIDADE.externa.meia - 4; z += 13) for (const x of [-6.5, 6.5]) postes.push({ x, z, h: 4.6 });
  instancias(cil, new THREE.MeshStandardMaterial({ color: 0x1a2236, roughness: 0.5, metalness: 0.6 }), postes.map((p) => [p.x, p.h / 2, p.z, 0.07, p.h, 0.07]));
  const texLuz = glowTex("rgba(255,230,180,1)", "rgba(255,170,80,.3)"); texturas.push(texLuz);
  const luzes = postes.map((p) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLuz, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.position.set(p.x, p.h + 0.2, p.z); s.scale.setScalar(1.8); raiz.add(s); return s; });

  return {
    atualizar(dt, t) {
      tempo.value = t;
      luzes.forEach((l, i) => { l.material.opacity = 0.85 + 0.12 * Math.sin(t * 0.7 + i); });
    },
  };
}
