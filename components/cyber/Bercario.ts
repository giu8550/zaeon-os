/**
 * Bercario — a CÁPSULA (tubo de ensaio) onde o novato nasce, na linha da muralha da Cidade Zaeon (lib/cyber/onboarding
 * `TUBOS` são as vagas possíveis). O ANEL de cápsulas NÃO aparece: só a cápsula de quem está no tutorial, a que
 * `nascer(i)` mostra — pedestal com aro aceso, vidro, tampa e o LÍQUIDO luminoso com o ser de luz se formando. No
 * nascimento um tubo ANIMADO toma o lugar dela: o líquido escoa (com bolhas), o vidro sobe pra dentro da tampa e a
 * pessoa sai; depois o tubo fecha e enche de novo. Filho do grupo da ilha (coordenadas LOCAIS da Zaeon).
 */
import * as THREE from "three";
import { CIDADE } from "@/lib/cyber/ceu";
import { NASCIMENTO, TUBO, TUBOS, estadoDoTubo } from "@/lib/cyber/onboarding";
import { glowTex } from "./CenaCosmica";

export type BercarioHandle = { group: THREE.Group; nascer(i: number): void; atualizar(dt: number, t: number): void; dispose(): void };

/** quanto tempo o tubo fica aberto depois de alguém sair, e quanto leva pra encher de novo (s) */
const ABERTO = 7, ENCHE = 3;
const P = 0.35, H = TUBO.alt, R = TUBO.r;

export function criarBercario(pai: THREE.Object3D, o: { low: boolean }): BercarioHandle {
  const g = new THREE.Group(); pai.add(g);
  const pedMat = new THREE.MeshStandardMaterial({ color: 0x182338, roughness: 0.3, metalness: 0.8, emissive: 0x0b1a3c, emissiveIntensity: 0.6 });
  const vidroMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, roughness: 0.05, metalness: 0.2, emissive: 0x1a4a66, emissiveIntensity: 0.35, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const liqMat = new THREE.MeshBasicMaterial({ color: 0x5fffd0, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  const aroMat = new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const texSer = glowTex("rgba(255,255,255,1)", "rgba(120,255,220,0.45)");
  const seg = o.low ? 14 : 22;
  const geos = {
    ped: new THREE.CylinderGeometry(R + 0.3, R + 0.45, P, seg).translate(0, P / 2, 0),
    aro: new THREE.TorusGeometry(R + 0.3, 0.05, 5, seg * 2).rotateX(Math.PI / 2).translate(0, P + 0.01, 0),
    vidro: new THREE.CylinderGeometry(R, R, H, seg, 1, true).translate(0, P + H / 2, 0),
    tampa: new THREE.CylinderGeometry(R + 0.25, R + 0.1, 0.5, seg).translate(0, P + H + 0.25, 0),
    aroT: new THREE.TorusGeometry(R + 0.12, 0.04, 5, seg * 2).rotateX(Math.PI / 2).translate(0, P + H - 0.02, 0),
    liq: new THREE.CylinderGeometry(R * 0.93, R * 0.93, H, seg).translate(0, P + H / 2, 0),
  };
  const N = TUBOS.length, mx = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const local = TUBOS.map((t) => ({ x: t.x - CIDADE.centro.x, z: t.z - CIDADE.centro.z }));
  // (instanciado por vaga, mas TODAS escondidas — escala 0 — até `nascer(i)` mostrar a do novato)
  const lote = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false;
    for (let i = 0; i < N; i++) im.setMatrixAt(i, zero);
    im.instanceMatrix.needsUpdate = true; g.add(im); return im;
  };
  const fixos = [lote(geos.ped, pedMat), lote(geos.aro, aroMat), lote(geos.tampa, pedMat), lote(geos.aroT, aroMat)];
  const vidro = lote(geos.vidro, vidroMat), liq = lote(geos.liq, liqMat);
  // o ser de luz se formando (um ponto por vaga; só o da cápsula mostrada fica no lugar)
  const sp = new Float32Array(N * 3); local.forEach((l, i) => { sp[i * 3] = l.x; sp[i * 3 + 1] = -999; sp[i * 3 + 2] = l.z; });
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const serMat = new THREE.PointsMaterial({ map: texSer, color: 0xbffff0, size: 1.5, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  g.add(new THREE.Points(sg, serMat));

  // o tubo ANIMADO (o de quem está nascendo): vidro + líquido + bolhas próprios
  const ativo = new THREE.Group(); ativo.visible = false; g.add(ativo);
  const vidroA = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, seg, 1, true), vidroMat); ativo.add(vidroA);
  const lgA = new THREE.CylinderGeometry(R * 0.93, R * 0.93, H, seg); lgA.translate(0, H / 2, 0);
  const liqA = new THREE.Mesh(lgA, liqMat); liqA.position.y = P; ativo.add(liqA);
  const NB = o.low ? 10 : 22, bp = new Float32Array(NB * 3), bol = Array.from({ length: NB }, () => ({ u: Math.random(), a: Math.random() * Math.PI * 2, r: Math.random() * R * 0.75, v: 0.15 + Math.random() * 0.25 }));
  const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.BufferAttribute(bp, 3));
  const bolhaMat = new THREE.PointsMaterial({ color: 0xbffff0, size: 0.09, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const bolhas = new THREE.Points(bg, bolhaMat); bolhas.frustumCulled = false; ativo.add(bolhas);

  let atual = -1, t0 = -1, pendente = -1, mostrada = -1;
  /** mostra SÓ a cápsula `i` (a do novato): esconde a anterior */
  const mostrar = (i: number) => {
    if (i === mostrada) return;
    const pos = (k: number) => mx.makeTranslation(local[k]!.x, 0, local[k]!.z);
    for (const im of [...fixos, vidro, liq]) { if (mostrada >= 0) im.setMatrixAt(mostrada, zero); im.setMatrixAt(i, pos(i)); im.instanceMatrix.needsUpdate = true; }
    if (mostrada >= 0) sp[mostrada * 3 + 1] = -999;
    sp[i * 3 + 1] = P + H * 0.5; sg.attributes.position!.needsUpdate = true; mostrada = i;
  };
  const noLote = (i: number, m: THREE.Matrix4) => { vidro.setMatrixAt(i, m); liq.setMatrixAt(i, m); vidro.instanceMatrix.needsUpdate = true; liq.instanceMatrix.needsUpdate = true; };
  const devolver = (i: number) => {   // o tubo volta pro lote
    if (i < 0) return; const l = local[i]!;
    noLote(i, mx.makeTranslation(l.x, 0, l.z)); sp[i * 3 + 1] = P + H * 0.5; sg.attributes.position!.needsUpdate = true;
  };
  return {
    group: g,
    nascer(i) { if (i >= 0 && i < N) pendente = i; },   // começa no próximo quadro (no relógio da cena)
    atualizar(dt, t) {
      if (pendente >= 0) {
        devolver(atual); mostrar(pendente); atual = pendente; pendente = -1; t0 = t;
        noLote(atual, zero); sp[atual * 3 + 1] = -999; sg.attributes.position!.needsUpdate = true;   // o ser de luz desse tubo é a própria pessoa
        ativo.position.set(local[atual]!.x, 0, local[atual]!.z); ativo.visible = true;
      }
      if (atual >= 0) {
        const s = t - t0, fecha = NASCIMENTO.sai + ABERTO;
        let liquido = 0, vid = 1;
        if (s < fecha) { const e = estadoDoTubo(s); liquido = e.liquido; vid = e.vidro; }
        else if (s < fecha + 1.2) vid = 1 - (s - fecha) / 1.2;
        else if (s < fecha + 1.2 + ENCHE) { liquido = (s - fecha - 1.2) / ENCHE; vid = 0; }
        else { devolver(atual); atual = -1; ativo.visible = false; }
        if (atual >= 0) {
          liqA.scale.y = Math.max(0.001, liquido); liqA.visible = liquido > 0.01;
          vidroA.position.y = P + H / 2 + vid * (H - 0.1); vidroA.scale.y = 1 - vid * 0.92;   // sobe pra dentro da tampa
          for (let j = 0; j < NB; j++) {
            const b = bol[j]!; b.u += dt * b.v; if (b.u > 1) b.u = 0;
            bp[j * 3] = Math.cos(b.a + b.u * 3) * b.r; bp[j * 3 + 1] = liquido > 0.02 ? P + b.u * H * liquido : -999; bp[j * 3 + 2] = Math.sin(b.a + b.u * 3) * b.r;
          }
          bg.attributes.position!.needsUpdate = true;
        }
      }
      aroMat.opacity = 0.7 + 0.2 * Math.sin(t * 2); serMat.opacity = 0.5 + 0.15 * Math.sin(t * 1.3); liqMat.opacity = 0.28 + 0.06 * Math.sin(t * 0.9);
    },
    dispose() {
      for (const x of Object.values(geos)) x.dispose();
      for (const x of [sg, bg, lgA, vidroA.geometry]) x.dispose();
      for (const m of [pedMat, vidroMat, liqMat, aroMat, serMat, bolhaMat]) m.dispose();
      texSer.dispose(); g.removeFromParent();
    },
  };
}
