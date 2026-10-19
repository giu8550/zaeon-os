/**
 * MagiaFx — os EFEITOS da magia cósmica (lib/cyber/magia): o brilho de CARGA na mão enquanto o feitiço prepara, os
 * PROJÉTEIS (o cristal do Estilhaço com o rastro; a esfera da Nova com os anéis girando e o halo), o IMPACTO (o clarão,
 * as faíscas e, na Nova, a onda de choque no chão) e o ESCUDO (o hexágono de luz na frente do corpo). Tudo aditivo e
 * leve (sprites e poucas malhas, um material por tipo), no referencial do MUNDO (o engine passa as posições).
 */
import * as THREE from "three";
import { glowTex } from "./CenaCosmica";
import type { Feitico } from "@/lib/cyber/magia";

type Proj = { g: THREE.Group; nucleo: THREE.Mesh; halo: THREE.Sprite; aneis: THREE.Mesh[]; rastro: THREE.Points; hist: THREE.Vector3[]; f: Feitico };
type Impacto = { g: THREE.Group; flash: THREE.Sprite; onda: THREE.Mesh | null; faiscas: THREE.Points; vel: Float32Array; t: number; dur: number; f: Feitico };
export type FxMagia = {
  /** o brilho na mão (até `ate` s do relógio da cena); `onde` = a posição da mão a cada quadro */
  carga(id: string, f: Feitico, onde: () => THREE.Vector3, ate: number): void;
  /** um projétil novo (devolve o id) e a posição dele a cada quadro; `acabar` some com ele */
  projetil(f: Feitico): string;
  moverProjetil(id: string, p: THREE.Vector3, dir: THREE.Vector3): void;
  acabarProjetil(id: string): void;
  impacto(f: Feitico, p: THREE.Vector3): void;
  /** o escudo de quem (null = some), na frente do corpo */
  escudo(id: string, onde: { pos: THREE.Vector3; rumo: number } | null): void;
  atualizar(dt: number, t: number): void;
  dispose(): void;
};

export function criarFxMagia(cena: THREE.Scene, o: { low: boolean }): FxMagia {
  const raiz = new THREE.Group(); raiz.name = "magia-fx"; cena.add(raiz);
  const tex = glowTex("rgba(255,255,255,1)", "rgba(140,200,255,0.25)"), texEstrela = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(30, 4, 4, 56); g.fillRect(4, 30, 56, 4);   // a cruz da estrela
    return new THREE.CanvasTexture(c);
  })();
  const add = (cor: number, op = 1) => new THREE.SpriteMaterial({ map: tex, color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  const geoCristal = new THREE.OctahedronGeometry(1, 0), geoEsfera = new THREE.IcosahedronGeometry(1, 2), geoAnel = new THREE.TorusGeometry(1, 0.06, 6, 40), geoOnda = new THREE.RingGeometry(0.85, 1, 64);
  const geoHex = new THREE.CircleGeometry(1, 6);
  const projs = new Map<string, Proj>(), cargas = new Map<string, { s: THREE.Sprite; s2: THREE.Sprite; onde: () => THREE.Vector3; ate: number; f: Feitico }>();
  const impactos: Impacto[] = [], escudos = new Map<string, { g: THREE.Group; on: boolean; k: number }>();
  let n = 0;
  const N_RASTRO = o.low ? 10 : 22;

  return {
    carga(id, f, onde, ate) {
      let c = cargas.get(id);
      if (!c) { const s = new THREE.Sprite(add(f.brilho, 0.9)), s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: texEstrela, color: f.cor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); raiz.add(s, s2); c = { s, s2, onde, ate, f }; cargas.set(id, c); }
      c.onde = onde; c.ate = ate; c.f = f; (c.s.material as THREE.SpriteMaterial).color.setHex(f.brilho); (c.s2.material as THREE.SpriteMaterial).color.setHex(f.cor);
    },
    projetil(f) {
      const id = `p${++n}`, g = new THREE.Group(); raiz.add(g);
      const nucleo = new THREE.Mesh(f.explosao || f.bala ? geoEsfera : geoCristal, new THREE.MeshBasicMaterial({ color: f.cor, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      // (a BALA: uma esfera esticada no rumo — redonda de qualquer ângulo, o traçante de um projétil; o cristal da magia,
      // visto de trás, era um losango)
      if (f.bala) nucleo.scale.set(f.raio * 0.42, f.raio * 0.42, f.raio * 3.2);
      else { nucleo.scale.setScalar(f.raio * (f.explosao ? 0.75 : 0.9)); if (!f.explosao) nucleo.scale.z *= 2.4; }
      g.add(nucleo);
      const halo = new THREE.Sprite(add(f.brilho, 0.85)); halo.scale.setScalar(f.raio * (f.bala ? 2.6 : 6)); g.add(halo);
      const aneis: THREE.Mesh[] = [];
      if (f.explosao) for (let i = 0; i < 3; i++) { const a = new THREE.Mesh(geoAnel, new THREE.MeshBasicMaterial({ color: f.brilho, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); a.scale.setScalar(f.raio * (1.3 + i * 0.25)); a.rotation.set(i * 1.1, i * 0.7, 0); g.add(a); aneis.push(a); }
      const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N_RASTRO * 3), 3));
      const rastro = new THREE.Points(rg, new THREE.PointsMaterial({ map: tex, color: f.brilho, size: f.raio * (f.bala ? 1.1 : 2.4), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
      rastro.frustumCulled = false; raiz.add(rastro);
      projs.set(id, { g, nucleo, halo, aneis, rastro, hist: [], f });
      return id;
    },
    moverProjetil(id, p, dir) {
      const pr = projs.get(id); if (!pr) return;
      pr.g.position.copy(p); pr.nucleo.lookAt(p.x + dir.x, p.y + dir.y, p.z + dir.z);
      pr.hist.unshift(p.clone()); if (pr.hist.length > N_RASTRO) pr.hist.pop();
      const a = pr.rastro.geometry.attributes.position!.array as Float32Array;
      for (let i = 0; i < N_RASTRO; i++) { const h = pr.hist[Math.min(i, pr.hist.length - 1)]!; a[i * 3] = h.x; a[i * 3 + 1] = h.y; a[i * 3 + 2] = h.z; }
      pr.rastro.geometry.attributes.position!.needsUpdate = true;
    },
    acabarProjetil(id) {
      const pr = projs.get(id); if (!pr) return; projs.delete(id);
      pr.g.removeFromParent(); pr.rastro.removeFromParent(); pr.rastro.geometry.dispose(); (pr.rastro.material as THREE.Material).dispose();
      (pr.nucleo.material as THREE.Material).dispose(); (pr.halo.material as THREE.Material).dispose(); for (const a of pr.aneis) (a.material as THREE.Material).dispose();
    },
    impacto(f, p) {
      const g = new THREE.Group(); g.position.copy(p); raiz.add(g);
      const flash = new THREE.Sprite(add(f.brilho, 1)); flash.scale.setScalar(0.5); g.add(flash);
      let onda: THREE.Mesh | null = null;
      if (f.explosao) { onda = new THREE.Mesh(geoOnda, new THREE.MeshBasicMaterial({ color: f.brilho, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); onda.rotation.x = -Math.PI / 2; onda.position.y = -0.9; g.add(onda); }
      const N = o.low ? 14 : 36, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, v = (f.explosao ? 9 : 5) * (0.4 + Math.random() * 0.6); vel[i * 3] = Math.cos(a) * Math.cos(b) * v; vel[i * 3 + 1] = Math.abs(Math.sin(b)) * v * 0.8; vel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * v; }
      const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const faiscas = new THREE.Points(fg, new THREE.PointsMaterial({ map: texEstrela, color: f.cor, size: f.explosao ? 0.5 : 0.32, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      faiscas.frustumCulled = false; g.add(faiscas);
      impactos.push({ g, flash, onda, faiscas, vel, t: 0, dur: f.explosao ? 0.9 : 0.5, f });
    },
    escudo(id, onde) {
      let e = escudos.get(id);
      if (onde && !e) {
        const g = new THREE.Group(); raiz.add(g);
        const hex = new THREE.Mesh(geoHex, new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); hex.scale.setScalar(1.05); g.add(hex);
        const borda = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.05, 6), new THREE.MeshBasicMaterial({ color: 0xd8f8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); g.add(borda);
        for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.4, 6), (borda.material as THREE.Material)); const a = (i / 6) * Math.PI * 2; m.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0); g.add(m); }
        e = { g, on: true, k: 0 }; escudos.set(id, e);
      }
      if (!e) return;
      e.on = !!onde;
      if (onde) { e.g.position.set(onde.pos.x + Math.sin(onde.rumo) * 0.75, onde.pos.y + 1.25, onde.pos.z + Math.cos(onde.rumo) * 0.75); e.g.rotation.set(0, onde.rumo, 0); }
    },
    atualizar(dt, t) {
      for (const [id, c] of cargas) {
        const vivo = t < c.ate, p = c.onde(), pulso = 0.85 + 0.25 * Math.sin(t * 22);
        c.s.position.copy(p); c.s2.position.copy(p);
        const k = vivo ? Math.min(1, (c.s.userData.k ?? 0) + dt * 4) : Math.max(0, (c.s.userData.k ?? 0) - dt * 6); c.s.userData.k = k;
        c.s.scale.setScalar((c.f.explosao ? 1.4 : 0.8) * k * pulso); c.s2.scale.setScalar((c.f.explosao ? 1.1 : 0.6) * k * (1.2 - pulso * 0.3)); c.s2.material.rotation += dt * 4;
        if (!vivo && k <= 0) { c.s.removeFromParent(); c.s2.removeFromParent(); (c.s.material as THREE.Material).dispose(); (c.s2.material as THREE.Material).dispose(); cargas.delete(id); }
      }
      for (const pr of projs.values()) { pr.nucleo.rotateZ(dt * 8); for (const [i, a] of pr.aneis.entries()) { a.rotation.x += dt * (2 + i); a.rotation.y += dt * (1.3 + i * 0.7); } pr.halo.material.opacity = 0.7 + 0.25 * Math.sin(t * 30); }
      for (let i = impactos.length - 1; i >= 0; i--) {
        const im = impactos[i]!; im.t += dt; const u = im.t / im.dur;
        im.flash.scale.setScalar((im.f.explosao ? 6 : 2.4) * Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5)); im.flash.material.opacity = Math.max(0, 1 - u);
        if (im.onda) { im.onda.scale.setScalar(0.5 + u * im.f.explosao * 1.2); (im.onda.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - u)); }
        const a = im.faiscas.geometry.attributes.position!.array as Float32Array;
        for (let j = 0; j < a.length; j += 3) { a[j]! += im.vel[j]! * dt; a[j + 1]! += im.vel[j + 1]! * dt; a[j + 2]! += im.vel[j + 2]! * dt; im.vel[j + 1]! -= 9 * dt; }
        im.faiscas.geometry.attributes.position!.needsUpdate = true; (im.faiscas.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - u);
        if (u >= 1) { im.g.removeFromParent(); im.faiscas.geometry.dispose(); (im.faiscas.material as THREE.Material).dispose(); (im.flash.material as THREE.Material).dispose(); if (im.onda) (im.onda.material as THREE.Material).dispose(); impactos.splice(i, 1); }
      }
      for (const [id, e] of escudos) {
        e.k += ((e.on ? 1 : 0) - e.k) * Math.min(1, dt * 10); e.g.scale.setScalar(Math.max(0.001, e.k) * (1 + 0.03 * Math.sin(t * 9)));
        e.g.children[0]!.rotation.z += dt * 0.6;
        if (!e.on && e.k < 0.02) { e.g.removeFromParent(); e.g.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh && m.geometry !== geoHex) m.geometry.dispose(); }); escudos.delete(id); }
      }
    },
    dispose() {
      for (const id of [...projs.keys()]) this.acabarProjetil(id);
      raiz.traverse((x) => { const m = x as THREE.Mesh; (m.material as THREE.Material | undefined)?.dispose?.(); });
      for (const g of [geoCristal, geoEsfera, geoAnel, geoOnda, geoHex]) g.dispose(); tex.dispose(); texEstrela.dispose(); raiz.removeFromParent();
    },
  };
}
