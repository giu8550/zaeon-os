/**
 * TrafegoCeu — o TRÂNSITO dos céus da Zaeon (lib/cyber/trafego): carros e motos voando pelos ANÉIS de voo, saindo e
 * entrando nos buracos negros dos fios cósmicos. LEVE de propósito (são dezenas no céu ao mesmo tempo): os corpos
 * são INSTANCIADOS (1 malha pros carros, 1 pras motos, na cor de cada um), as luzes são PONTOS (o farol branco na
 * frente, o propulsor na cor atrás) e os RASTROS de luz são segmentos — ~6 desenhos pro céu inteiro. As faixas dos
 * anéis aparecem como trilhas de pontinhos. Referencial: o LOCAL da ilha (o grupo vai dentro do hub).
 */
import * as THREE from "three";
import { ANEIS_VOO, VEICULOS_CEU, estadoDoVeiculo, naViagem, type Viagem } from "@/lib/cyber/trafego";

/** os veículos do céu um pouco MAIORES que os de verdade: de 100+ m, o tamanho real virava um pontinho */
const ESCALA = 1.6;

export type TrafegoCeuHandle = { group: THREE.Group; atualizar(tRelogio: number): void; dispose(): void };

/** o carro de longe: o casco sextavado baixo (a planta do CarroHex) + a cabine — ~60 triângulos */
function geoCarro(): THREE.BufferGeometry {
  const s = new THREE.Shape(); [[0, 2.4], [1.2, 0.9], [1.25, -1.1], [0, -1.8], [-1.25, -1.1], [-1.2, 0.9]].forEach(([x, z], i) => (i ? s.lineTo(x!, -z!) : s.moveTo(x!, -z!))); s.closePath();
  const casco = new THREE.ExtrudeGeometry(s, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1 }); casco.rotateX(-Math.PI / 2); casco.translate(0, 0.25, 0);
  const cabine = new THREE.SphereGeometry(0.85, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2); cabine.scale(1, 0.6, 1.5); cabine.translate(0, 0.95, -0.1);
  const g = mergeSimples([casco, cabine]); casco.dispose(); cabine.dispose(); return g;
}
/** a moto de longe: o corpo alongado + o piloto */
function geoMoto(): THREE.BufferGeometry {
  const corpo = new THREE.CapsuleGeometry(0.32, 1.9, 2, 6); corpo.rotateX(Math.PI / 2); corpo.translate(0, 0.45, 0);
  const piloto = new THREE.CapsuleGeometry(0.22, 0.5, 2, 5); piloto.rotateX(-0.5); piloto.translate(0, 1.0, -0.15);
  const g = mergeSimples([corpo, piloto]); corpo.dispose(); piloto.dispose(); return g;
}
function mergeSimples(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const ps: number[] = [], ns: number[] = [];
  for (const g0 of gs) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); ps.push(...(g.attributes.position!.array as Float32Array)); ns.push(...(g.attributes.normal!.array as Float32Array)); if (g !== g0) g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.Float32BufferAttribute(ps, 3)); out.setAttribute("normal", new THREE.Float32BufferAttribute(ns, 3)); return out;
}

export function criarTrafegoCeu(o: { low: boolean; starTex: THREE.Texture }): TrafegoCeuHandle {
  const group = new THREE.Group(); group.name = "trafego-ceu";
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const carros = VEICULOS_CEU.filter((v) => v.tipo === "carro"), motos = VEICULOS_CEU.filter((v) => v.tipo === "moto");
  const corpoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.4, emissive: 0x111122, emissiveIntensity: 0.6 }); mats.push(corpoMat);
  // (a COR de cada um também ACENDE — no céu escuro, só a luz da cena deixava todos cinza)
  corpoMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor * 0.55;\n#endif"); };
  const mkInst = (g: THREE.BufferGeometry, lista: typeof VEICULOS_CEU) => {
    geos.push(g); const m = new THREE.InstancedMesh(g, corpoMat, lista.length); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    lista.forEach((v, k) => m.setColorAt(k, new THREE.Color(v.cor))); m.instanceColor!.needsUpdate = true; group.add(m); return m;
  };
  const instCarro = mkInst(geoCarro(), carros), instMoto = mkInst(geoMoto(), motos);
  // as LUZES: 2 pontos por veículo (o farol na frente, o propulsor atrás na cor dele)
  const N = VEICULOS_CEU.length, luzPos = new Float32Array(N * 2 * 3), luzCor = new Float32Array(N * 2 * 3);
  const luzGeo = new THREE.BufferGeometry(); luzGeo.setAttribute("position", new THREE.BufferAttribute(luzPos, 3)); luzGeo.setAttribute("color", new THREE.BufferAttribute(luzCor, 3)); geos.push(luzGeo);
  const luzMat = new THREE.PointsMaterial({ size: 3.2, map: o.starTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(luzMat);
  const luzes = new THREE.Points(luzGeo, luzMat); luzes.frustumCulled = false; group.add(luzes);
  // os RASTROS: um segmento por veículo (do propulsor pra trás), mais forte perto e sumindo na ponta
  const rastPos = new Float32Array(N * 2 * 3), rastCor = new Float32Array(N * 2 * 3);
  const rastGeo = new THREE.BufferGeometry(); rastGeo.setAttribute("position", new THREE.BufferAttribute(rastPos, 3)); rastGeo.setAttribute("color", new THREE.BufferAttribute(rastCor, 3)); geos.push(rastGeo);
  const rastMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(rastMat);
  const rastros = new THREE.LineSegments(rastGeo, rastMat); rastros.frustumCulled = false; group.add(rastros);
  const corDe = VEICULOS_CEU.map((v) => new THREE.Color(v.cor));
  for (let i = 0; i < N; i++) { const c = corDe[i]!; luzCor.set([1, 1, 1], i * 6); luzCor.set([c.r, c.g, c.b], i * 6 + 3); rastCor.set([c.r, c.g, c.b], i * 6); rastCor.set([0, 0, 0], i * 6 + 3); }
  // as FAIXAS dos anéis: pontinhos a cada ~10 m (a rota fica legível de longe)
  for (const a of ANEIS_VOO) {
    const n = Math.round((Math.PI * 2 * a.r) / (o.low ? 18 : 10)), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const ang = (i / n) * Math.PI * 2; pos.set([Math.cos(ang) * a.r, a.y + Math.sin(ang * 3) * a.onda - 1.2, Math.sin(ang) * a.r], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geos.push(g);
    const m = new THREE.PointsMaterial({ size: 1.6, map: o.starTex, color: 0x66d9ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(m);
    const p = new THREE.Points(g, m); p.frustumCulled = false; group.add(p);
  }

  const cache = new Map<string, Viagem>(), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, "YXZ"), pv = new THREE.Vector3(), sv = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let limpa = 0;
  return {
    group,
    atualizar(tRelogio) {
      let ic = 0, im = 0;
      for (let i = 0; i < N; i++) {
        const ve = VEICULOS_CEU[i]!, st = estadoDoVeiculo(ve, tRelogio, cache), inst = ve.tipo === "carro" ? instCarro : instMoto, k = ve.tipo === "carro" ? ic++ : im++;
        if (!st || st.escala <= 0.001) { inst.setMatrixAt(k, zero); luzPos.fill(0, i * 6, i * 6 + 6); rastPos.fill(0, i * 6, i * 6 + 6); luzCor.set([0, 0, 0], i * 6); continue; }
        const p = naViagem(st.v, st.u); e.set(-p.sobe, p.rumo, 0); q.setFromEuler(e);
        const s = st.escala * ESCALA; inst.setMatrixAt(k, mtx.compose(pv.set(p.x, p.y, p.z), q, sv.set(s, s, s)));
        const fx = Math.sin(p.rumo) * Math.cos(p.sobe), fy = Math.sin(p.sobe), fz = Math.cos(p.rumo) * Math.cos(p.sobe), L = ve.tipo === "carro" ? 2.3 : 1.4;
        luzPos.set([p.x + fx * L * s, p.y + 0.5 * s + fy * L * s, p.z + fz * L * s], i * 6); luzPos.set([p.x - fx * L * s, p.y + 0.4 * s - fy * L * s, p.z - fz * L * s], i * 6 + 3);
        luzCor.set([s, s, s], i * 6);
        const comp = ve.vel * 0.22 * s;   // (o rastro: ~1/5 s de voo atrás)
        rastPos.set([p.x - fx * L * s, p.y + 0.4 * s - fy * L * s, p.z - fz * L * s], i * 6); rastPos.set([p.x - fx * (L * s + comp), p.y + 0.4 * s - fy * (L * s + comp), p.z - fz * (L * s + comp)], i * 6 + 3);
      }
      instCarro.instanceMatrix.needsUpdate = true; instMoto.instanceMatrix.needsUpdate = true;
      luzGeo.attributes.position!.needsUpdate = true; luzGeo.attributes.color!.needsUpdate = true; rastGeo.attributes.position!.needsUpdate = true;
      if (++limpa > 600) { limpa = 0; if (cache.size > N * 4) cache.clear(); }   // (as viagens já passadas saem do cache)
    },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); },
  };
}
