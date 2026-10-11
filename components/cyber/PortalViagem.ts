/**
 * PortalViagem — o PORTAL de teleporte do dono (tecla M — lib/cyber/viagemNave): o MESMO efeito do portal do Droid
 * (components/cyber/Droid — miolo em redemoinho, 3 aros, o anel de RUNAS, a ONDA DE CHOQUE, o CLARÃO, a COLUNA de luz e
 * as FAGULHAS), mas sozinho, pra pessoa: na SAÍDA as fagulhas são sugadas pra dentro (ela entra); na CHEGADA explodem pra
 * fora (ela sai). `abrir(modo, pos, rumo)` toca uma vez (`dur` s) e some.
 */
import * as THREE from "three";
import { glowTex } from "./CenaCosmica";

export type PortalViagemHandle = { group: THREE.Group; abrir(modo: "entra" | "sai", pos: THREE.Vector3, rumo: number): void; ativo(): boolean; atualizar(dt: number, t: number): void; dispose(): void };

const s3 = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
const fx = (lin: number, a: number, b: number) => Math.max(0, Math.min(1, (lin - a) / (b - a)));
const sino = (lin: number, a: number, m: number, b: number) => (lin < m ? s3(fx(lin, a, m)) : 1 - s3(fx(lin, m, b)));

export function criarPortalViagem(o: { low: boolean; dur?: number }): PortalViagemHandle {
  const g = new THREE.Group(); g.visible = false;
  const mats: THREE.Material[] = [], geos: THREE.BufferGeometry[] = [], texs: THREE.Texture[] = [];
  const M = <T extends THREE.Material>(m: T) => { mats.push(m); return m; };
  const G = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const aditivo = (c: number, op = 1) => M(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const tGlow = glowTex("rgba(255,250,235,1)", "rgba(255,190,90,0.35)"); texs.push(tGlow);
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  { const x = cv.getContext("2d")!, gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,252,240,1)"); gr.addColorStop(0.22, "rgba(255,200,100,.9)"); gr.addColorStop(0.55, "rgba(160,80,255,.5)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = "rgba(255,240,210,.6)"; x.lineWidth = 3; for (let k = 0; k < 8; k++) { x.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40, a = (k / 8) * Math.PI * 2 + u * 3.6, rr = 10 + u * 114; x.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); } x.stroke(); } }
  const tPortal = new THREE.CanvasTexture(cv); texs.push(tPortal);
  const cr = document.createElement("canvas"); cr.width = 1024; cr.height = 64;
  { const x = cr.getContext("2d")!; x.fillStyle = "rgba(255,226,160,.95)"; x.font = "bold 40px serif"; x.textBaseline = "middle";
    const glifos = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ✦"; for (let i = 0; i < 26; i++) x.fillText(glifos[i % glifos.length]!, 8 + i * 39, 34); }
  const tRunas = new THREE.CanvasTexture(cr); tRunas.wrapS = THREE.RepeatWrapping; texs.push(tRunas);
  // o portal em pé, na altura do peito (ESCALA 1.25: cabe uma pessoa)
  const portal = new THREE.Group(); portal.position.y = 1.4; portal.scale.setScalar(1.25); g.add(portal);
  const miolo = new THREE.Mesh(G(new THREE.CircleGeometry(1.6, 48)), M(new THREE.MeshBasicMaterial({ map: tPortal, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))); portal.add(miolo);
  const aro = new THREE.Mesh(G(new THREE.TorusGeometry(1.7, 0.07, 8, 72)), aditivo(0xffd28a)); portal.add(aro);
  const aroB = new THREE.Mesh(G(new THREE.TorusGeometry(1.95, 0.025, 6, 72, Math.PI * 1.3)), aditivo(0xb98cff, 0.85)); portal.add(aroB);
  const aroC = new THREE.Mesh(G(new THREE.TorusGeometry(1.8, 0.03, 6, 72)), aditivo(0x9fe8ff, 0.7)); portal.add(aroC);
  const runas = new THREE.Mesh(G(new THREE.RingGeometry(2.1, 2.5, 96, 1)), M(new THREE.MeshBasicMaterial({ map: tRunas, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  { const uv = runas.geometry.attributes.uv!, pos = runas.geometry.attributes.position!; for (let i = 0; i < uv.count; i++) { const x = pos.getX(i), y = pos.getY(i); uv.setXY(i, (Math.atan2(y, x) / (Math.PI * 2) + 0.5) * 3, Math.hypot(x, y) > 2.3 ? 1 : 0); } }
  portal.add(runas);
  const choque = new THREE.Mesh(G(new THREE.TorusGeometry(1, 0.06, 6, 64)), aditivo(0xfff0c8)); portal.add(choque);
  const flash = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: tGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); portal.add(flash);
  const feixe = new THREE.Mesh(G(new THREE.CylinderGeometry(0.6, 1.9, 46, 24, 1, true).translate(0, 23, 0)), aditivo(0xffd9a0, 0.3)); g.add(feixe);
  const NB = o.low ? 90 : 180, bp = new Float32Array(NB * 3), bol = Array.from({ length: NB }, () => ({ v: new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 1.4 - 0.2).normalize(), s: 2.5 + Math.random() * 5 }));
  const bg = G(new THREE.BufferGeometry()); bg.setAttribute("position", new THREE.BufferAttribute(bp, 3));
  const burstMat = M(new THREE.PointsMaterial({ map: tGlow, color: 0xffe2b0, size: 0.18, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  const burst = new THREE.Points(bg, burstMat); burst.frustumCulled = false; portal.add(burst);

  const DUR = o.dur ?? 1.7;
  let k = 1, modo: "entra" | "sai" = "sai";
  return {
    group: g,
    abrir(m, pos, rumo) { modo = m; k = 0; g.position.copy(pos); portal.rotation.y = rumo; g.visible = true; },
    ativo: () => k < 1,
    atualizar(dt, t) {
      if (k >= 1) { g.visible = false; return; }
      k = Math.min(1, k + dt / DUR);
      // ENTRA (sai daqui): abre, as fagulhas são SUGADAS, clarão, fecha. SAI (chega aqui): a coluna desce, abre, a onda de
      // choque, o CLARÃO, as fagulhas EXPLODEM pra fora, fecha
      const entra = modo === "entra";
      const abre = k < 0.22 ? s3(k / 0.22) : 1 - s3(fx(k, 0.78, 1));
      const choqueK = entra ? -1 : fx(k, 0.15, 0.55), flashK = entra ? sino(k, 0.45, 0.58, 0.8) : sino(k, 0.28, 0.4, 0.62);
      const feixeK = sino(k, 0, 0.32, 0.92), burstK = entra ? fx(k, 0.05, 0.6) : fx(k, 0.36, 1);
      for (const x of [miolo, aro, aroB, aroC, runas]) x.scale.setScalar(Math.max(0.001, abre));
      miolo.rotation.z -= dt * 3; aroB.rotation.z += dt * 2.2; aroC.rotation.x += dt * 1.7; aroC.rotation.y += dt * 1.1; runas.rotation.z -= dt * 0.6; aro.rotation.y = Math.sin(t * 3) * 0.15;
      choque.visible = choqueK > 0 && choqueK < 1; if (choque.visible) { choque.scale.setScalar(0.5 + choqueK * 4.5); (choque.material as THREE.MeshBasicMaterial).opacity = 1 - choqueK; }
      flash.visible = flashK > 0.01; flash.scale.setScalar(1 + flashK * 7); (flash.material as THREE.SpriteMaterial).opacity = flashK;
      feixe.visible = feixeK > 0.01; (feixe.material as THREE.MeshBasicMaterial).opacity = 0.32 * feixeK; feixe.scale.set(0.4 + feixeK * 0.6, 1, 0.4 + feixeK * 0.6);
      burst.visible = burstK > 0 && burstK < 1;
      if (burst.visible) {
        const dist = entra ? 1 - burstK : 1 - Math.pow(1 - burstK, 2.5);
        for (let i = 0; i < NB; i++) { const b = bol[i]!, rr = dist * b.s; bp[i * 3] = b.v.x * rr; bp[i * 3 + 1] = b.v.y * rr; bp[i * 3 + 2] = b.v.z * rr; }
        bg.attributes.position!.needsUpdate = true; burstMat.opacity = entra ? Math.min(1, burstK * 3) : 1 - burstK * burstK;
      }
    },
    dispose() { for (const x of geos) x.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose(); g.removeFromParent(); },
  };
}
