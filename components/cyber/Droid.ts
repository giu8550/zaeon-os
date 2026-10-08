/**
 * Droid — o corpo do agente de onboarding (lib/cyber/agentes `DROID`): um OFANIM (Ezequiel 1:15-21). Três rodas de
 * TOPÁZIO, uma cruzada dentro da outra (cada uma gira num eixo — "uma roda no meio da outra"), com a borda cheia de
 * dentes de ouro e OLHOS acesos (esferas com íris), e LUZ no centro (núcleo + halo + fagulhas orbitando). Plana de
 * leve, respirando. Aparece e some num MINI PORTAL (um aro de luz que abre, o Droid se forma de dentro dele girando,
 * e o aro fecha). Tudo é do cliente de quem está sendo guiado (nada vai pela rede).
 * `group` = o centro do Droid (o engine põe no mundo); o portal é filho dele.
 */
import * as THREE from "three";
import { glowTex } from "./CenaCosmica";

export type FaseDroid = "oculto" | "entrando" | "visivel" | "saindo";
export type DroidHandle = {
  group: THREE.Group;
  fase(): FaseDroid;
  aparecer(): void;
  sumir(): void;
  /** `rumo` = pra onde o "rosto" (a roda de fora) se vira devagar (atan2 dx,dz do mundo) */
  atualizar(dt: number, t: number, rumo: number): void;
  dispose(): void;
};

const ENTRA = 2.2, SAI = 1.6;
const s3 = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };

export function criarDroid(o: { low: boolean }): DroidHandle {
  const g = new THREE.Group(), corpo = new THREE.Group(); g.add(corpo);
  const mats: THREE.Material[] = [], geos: THREE.BufferGeometry[] = [], texs: THREE.Texture[] = [];
  const M = <T extends THREE.Material>(m: T) => { mats.push(m); return m; };
  const G = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  // topázio/berilo: a faixa vermelho-âmbar com brilho próprio, o ouro dos dentes e dos frisos, os olhos de luz
  const faixa = M(new THREE.MeshStandardMaterial({ color: 0x8c2414, roughness: 0.35, metalness: 0.5, emissive: 0x5a0f04, emissiveIntensity: 0.9 }));
  const ouro = M(new THREE.MeshStandardMaterial({ color: 0xffc46b, roughness: 0.25, metalness: 0.9, emissive: 0x7a4a10, emissiveIntensity: 0.7 }));
  const olhoMat = M(new THREE.MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.2, metalness: 0.1, emissive: 0xffe2b0, emissiveIntensity: 0.9 }));
  const irisMat = M(new THREE.MeshBasicMaterial({ color: 0xffb02e }));
  const pupilaMat = M(new THREE.MeshBasicMaterial({ color: 0x2a0a02 }));
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), fora = new THREE.Vector3();
  /** uma RODA: faixa + 2 frisos de ouro + dentes (pra fora e pra dentro) + olhos (olhando pra fora) */
  const roda = (R: number, nOlhos: number, nDentes: number) => {
    const r = new THREE.Group();
    r.add(new THREE.Mesh(G(new THREE.TorusGeometry(R, 0.075, 10, o.low ? 48 : 80)), faixa));
    for (const k of [-1, 1]) { const f = new THREE.Mesh(G(new THREE.TorusGeometry(R + k * 0.075, 0.018, 6, o.low ? 48 : 80)), ouro); r.add(f); }
    // dentes: cones finos de ouro na borda de fora e na de dentro, alternados
    const dg = G(new THREE.ConeGeometry(0.022, 0.13, 5)), dentes = new THREE.InstancedMesh(dg, ouro, nDentes * 2);
    for (let i = 0; i < nDentes * 2; i++) {
      const a = (i / (nDentes * 2)) * Math.PI * 2, out = i % 2 === 0, rr = out ? R + 0.13 : R - 0.13;
      fora.set(Math.cos(a), Math.sin(a), 0).multiplyScalar(out ? 1 : -1); q.setFromUnitVectors(up, fora);
      dentes.setMatrixAt(i, mx.compose(p.set(Math.cos(a) * rr, Math.sin(a) * rr, 0), q, sc));
    }
    dentes.instanceMatrix.needsUpdate = true; r.add(dentes);
    // olhos: o globo + a íris + a pupila, na frente da faixa (dos dois lados da roda)
    const ng = G(new THREE.SphereGeometry(0.062, 14, 10)), ig = G(new THREE.SphereGeometry(0.034, 10, 8)), pg = G(new THREE.SphereGeometry(0.016, 8, 6));
    const globos = new THREE.InstancedMesh(ng, olhoMat, nOlhos * 2), iris = new THREE.InstancedMesh(ig, irisMat, nOlhos * 2), pup = new THREE.InstancedMesh(pg, pupilaMat, nOlhos * 2);
    let n = 0;
    for (let i = 0; i < nOlhos; i++) for (const lado of [1, -1]) {
      const a = ((i + (lado < 0 ? 0.5 : 0)) / nOlhos) * Math.PI * 2, x = Math.cos(a) * R, y = Math.sin(a) * R;
      globos.setMatrixAt(n, mx.makeTranslation(x, y, lado * 0.06));
      iris.setMatrixAt(n, mx.makeTranslation(x, y, lado * 0.098));
      pup.setMatrixAt(n, mx.makeTranslation(x, y, lado * 0.124)); n++;
    }
    for (const im of [globos, iris, pup]) { im.instanceMatrix.needsUpdate = true; r.add(im); }
    return r;
  };
  // "uma roda no meio da outra": a de fora gira em Y; a do meio, presa nela, em X; a de dentro, presa na do meio, em Z
  const r0 = roda(0.86, o.low ? 8 : 12, o.low ? 28 : 40), r1 = roda(0.68, o.low ? 7 : 10, o.low ? 22 : 32), r2 = roda(0.5, o.low ? 6 : 8, o.low ? 16 : 24);
  corpo.add(r0); r0.add(r1); r1.add(r2); r1.rotation.y = Math.PI / 2; r2.rotation.x = Math.PI / 2;
  // a LUZ no centro: núcleo + halo + coroa
  const tGlow = glowTex("rgba(255,250,235,1)", "rgba(255,190,90,0.35)"), tHalo = glowTex("rgba(255,214,140,0.55)", "rgba(255,120,40,0.12)"); texs.push(tGlow, tHalo);
  const nucleo = new THREE.Mesh(G(new THREE.SphereGeometry(0.15, 20, 14)), M(new THREE.MeshBasicMaterial({ color: 0xfff6e0 }))); corpo.add(nucleo);
  const brilho = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: tGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); brilho.scale.setScalar(1.1); corpo.add(brilho);
  const halo = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: tHalo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); halo.scale.setScalar(3.4); corpo.add(halo);
  // fagulhas orbitando
  const NF = o.low ? 24 : 48, fp = new Float32Array(NF * 3), fag = Array.from({ length: NF }, () => ({ a: Math.random() * Math.PI * 2, b: Math.random() * Math.PI * 2, r: 0.95 + Math.random() * 0.5, v: 0.3 + Math.random() * 0.6 }));
  const fg = G(new THREE.BufferGeometry()); fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
  const fagulhas = new THREE.Points(fg, M(new THREE.PointsMaterial({ map: tGlow, color: 0xffd9a0, size: 0.09, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  fagulhas.frustumCulled = false; corpo.add(fagulhas);

  // ── o PORTAL (dramático): miolo em redemoinho, 3 aros em eixos diferentes, o anel de RUNAS, a ONDA DE CHOQUE, o
  //    CLARÃO, a COLUNA de luz do céu e a EXPLOSÃO de fagulhas (pra fora quando ele nasce; pra dentro quando ele vai) ──
  const portal = new THREE.Group(); portal.visible = false; g.add(portal);
  const aditivo = (c: number, op = 1) => M(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  { const x = cv.getContext("2d")!, gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,252,240,1)"); gr.addColorStop(0.22, "rgba(255,200,100,.9)"); gr.addColorStop(0.55, "rgba(160,80,255,.5)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = "rgba(255,240,210,.6)"; x.lineWidth = 3; for (let k = 0; k < 8; k++) { x.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40, a = (k / 8) * Math.PI * 2 + u * 3.6, rr = 10 + u * 114; x.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); } x.stroke(); } }
  const tPortal = new THREE.CanvasTexture(cv); texs.push(tPortal);
  const cr = document.createElement("canvas"); cr.width = 1024; cr.height = 64;   // as runas: glifos numa faixa (vira anel)
  { const x = cr.getContext("2d")!; x.fillStyle = "rgba(0,0,0,0)"; x.fillRect(0, 0, 1024, 64); x.fillStyle = "rgba(255,226,160,.95)"; x.font = "bold 40px serif"; x.textBaseline = "middle";
    const glifos = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ✦"; for (let i = 0; i < 26; i++) x.fillText(glifos[i % glifos.length]!, 8 + i * 39, 34); }
  const tRunas = new THREE.CanvasTexture(cr); tRunas.wrapS = THREE.RepeatWrapping; texs.push(tRunas);
  const miolo = new THREE.Mesh(G(new THREE.CircleGeometry(1.6, 48)), M(new THREE.MeshBasicMaterial({ map: tPortal, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))); portal.add(miolo);
  const aro = new THREE.Mesh(G(new THREE.TorusGeometry(1.7, 0.07, 8, 72)), aditivo(0xffd28a)); portal.add(aro);
  const aroB = new THREE.Mesh(G(new THREE.TorusGeometry(1.95, 0.025, 6, 72, Math.PI * 1.3)), aditivo(0xb98cff, 0.85)); portal.add(aroB);
  const aroC = new THREE.Mesh(G(new THREE.TorusGeometry(1.8, 0.03, 6, 72)), aditivo(0x9fe8ff, 0.7)); portal.add(aroC);
  const runas = new THREE.Mesh(G(new THREE.RingGeometry(2.1, 2.5, 96, 1)), M(new THREE.MeshBasicMaterial({ map: tRunas, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  { const uv = runas.geometry.attributes.uv!, pos = runas.geometry.attributes.position!; for (let i = 0; i < uv.count; i++) { const x = pos.getX(i), y = pos.getY(i); uv.setXY(i, (Math.atan2(y, x) / (Math.PI * 2) + 0.5) * 3, Math.hypot(x, y) > 2.3 ? 1 : 0); } }
  portal.add(runas);
  const choque = new THREE.Mesh(G(new THREE.TorusGeometry(1, 0.06, 6, 64)), aditivo(0xfff0c8)); portal.add(choque);
  const flash = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: tGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); portal.add(flash);
  const feixe = new THREE.Mesh(G(new THREE.CylinderGeometry(0.5, 1.7, 46, 24, 1, true).translate(0, 23, 0)), aditivo(0xffd9a0, 0.3)); g.add(feixe); feixe.visible = false;
  const NB = o.low ? 90 : 180, bp = new Float32Array(NB * 3), bol = Array.from({ length: NB }, () => { const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 1.4 - 0.2).normalize(); return { v, s: 2.5 + Math.random() * 5 }; });
  const bg = G(new THREE.BufferGeometry()); bg.setAttribute("position", new THREE.BufferAttribute(bp, 3));
  const burstMat = M(new THREE.PointsMaterial({ map: tGlow, color: 0xffe2b0, size: 0.16, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  const burst = new THREE.Points(bg, burstMat); burst.frustumCulled = false; portal.add(burst);
  const fx = (lin: number, a: number, b: number) => Math.max(0, Math.min(1, (lin - a) / (b - a)));
  const sino = (lin: number, a: number, m: number, b: number) => (lin < m ? s3(fx(lin, a, m)) : 1 - s3(fx(lin, m, b)));

  let fase: FaseDroid = "oculto", k = 0, rumoAtual = 0;
  g.visible = false;
  return {
    group: g,
    fase: () => fase,
    aparecer() { if (fase === "visivel" || fase === "entrando") return; fase = "entrando"; k = 0; g.visible = true; },
    sumir() { if (fase === "oculto" || fase === "saindo") return; fase = "saindo"; k = 0; },
    atualizar(dt, t, rumo) {
      // a linha do tempo (k: 0..1). NASCENDO: a coluna de luz desce, o portal abre, a onda de choque, o CLARÃO, o Droid se
      // forma girando no meio da explosão de fagulhas, o portal fecha. INDO EMBORA: abre, as fagulhas são sugadas, ele
      // encolhe girando pra dentro, clarão, fecha
      let escala = 1, abre = 0, choqueK = -1, flashK = 0, feixeK = 0, burstK = -1, entra = true;
      if (fase === "entrando") { k += dt / ENTRA; abre = k < 0.25 ? s3(k / 0.25) : 1 - s3(fx(k, 0.82, 1)); escala = s3(fx(k, 0.38, 0.85)); choqueK = fx(k, 0.15, 0.55); flashK = sino(k, 0.3, 0.42, 0.65); feixeK = sino(k, 0, 0.3, 0.9); burstK = fx(k, 0.38, 1); if (k >= 1) { fase = "visivel"; abre = 0; escala = 1; } }
      else if (fase === "saindo") { k += dt / SAI; entra = false; abre = k < 0.25 ? s3(k / 0.25) : 1 - s3(fx(k, 0.75, 1)); escala = 1 - s3(fx(k, 0.2, 0.62)); burstK = fx(k, 0.05, 0.62); flashK = sino(k, 0.5, 0.62, 0.85); feixeK = sino(k, 0.4, 0.62, 1); if (k >= 1) { fase = "oculto"; g.visible = false; feixe.visible = false; return; } }
      portal.visible = abre > 0.01 || flashK > 0.01 || (burstK >= 0 && burstK < 1); portal.scale.setScalar(1);
      for (const x of [miolo, aro, aroB, aroC, runas]) x.scale.setScalar(Math.max(0.001, abre));
      miolo.rotation.z -= dt * 3; aroB.rotation.z += dt * 2.2; aroC.rotation.x += dt * 1.7; aroC.rotation.y += dt * 1.1; runas.rotation.z -= dt * 0.6; aro.rotation.y = Math.sin(t * 3) * 0.15;
      choque.visible = choqueK > 0 && choqueK < 1; if (choque.visible) { choque.scale.setScalar(0.5 + choqueK * 4.5); (choque.material as THREE.MeshBasicMaterial).opacity = 1 - choqueK; }
      flash.visible = flashK > 0.01; flash.scale.setScalar(1 + flashK * 7); (flash.material as THREE.SpriteMaterial).opacity = flashK;
      feixe.visible = feixeK > 0.01; (feixe.material as THREE.MeshBasicMaterial).opacity = 0.32 * feixeK; feixe.scale.set(0.4 + feixeK * 0.6, 1, 0.4 + feixeK * 0.6); feixe.position.y = -0.2;
      burst.visible = burstK >= 0 && burstK < 1;
      if (burst.visible) {
        const dist = entra ? 1 - Math.pow(1 - burstK, 2.5) : 1 - burstK;   // nascendo: explode pra fora (freando); indo: sugadas pra dentro
        for (let i = 0; i < NB; i++) { const b = bol[i]!, rr = (entra ? dist : dist) * b.s; bp[i * 3] = b.v.x * rr; bp[i * 3 + 1] = b.v.y * rr; bp[i * 3 + 2] = b.v.z * rr; }
        bg.attributes.position!.needsUpdate = true; burstMat.opacity = entra ? 1 - burstK * burstK : Math.min(1, burstK * 3);
      }
      portal.rotation.y = rumo;   // o portal de frente pra quem olha (o Droid se vira pra pessoa)
      corpo.scale.setScalar(Math.max(0.001, escala)); corpo.visible = escala > 0.01;
      // planando, respirando; as rodas girando cada uma no seu eixo (mais rápido ao se formar)
      const giro = fase === "visivel" ? 1 : 4.5;
      corpo.position.y = Math.sin(t * 1.1) * 0.09; corpo.rotation.z = Math.sin(t * 0.6) * 0.08;
      let d = rumo - rumoAtual; d = Math.atan2(Math.sin(d), Math.cos(d)); rumoAtual += d * Math.min(1, dt * 2.5); corpo.rotation.y = rumoAtual;
      // a roda de FORA também tomba (gira no próprio plano E em volta de um eixo inclinado) — senão parecia parada
      r0.rotation.z += dt * 0.6 * giro; r0.rotation.x = Math.sin(t * 0.45) * 1.1; r0.rotation.y += dt * 0.3 * giro;
      r1.rotation.x += dt * 0.55 * giro; r2.rotation.y += dt * 0.75 * giro;
      const pulso = 0.85 + 0.15 * Math.sin(t * 2.2); brilho.scale.setScalar(1.1 * pulso); (halo.material as THREE.SpriteMaterial).opacity = 0.55 + 0.25 * pulso;
      for (let i = 0; i < NF; i++) { const f = fag[i]!; f.a += dt * f.v; const cb = Math.cos(f.b); fp[i * 3] = Math.cos(f.a) * f.r * cb; fp[i * 3 + 1] = Math.sin(f.b) * f.r * 0.6 + Math.sin(t + i) * 0.05; fp[i * 3 + 2] = Math.sin(f.a) * f.r * cb; }
      fg.attributes.position!.needsUpdate = true;
    },
    dispose() { for (const x of geos) x.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose(); g.removeFromParent(); },
  };
}
