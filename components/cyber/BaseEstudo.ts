/**
 * BaseEstudo — a estação de estudo do cyberespaço, no idioma "alienígena": uma CABINE aberta sobre a plataforma
 * circular — arcos estruturais formando um dossel sobre um ASSENTO DE ENERGIA flutuante, um anel de controle
 * holográfico na altura das mãos e a TELA lá no alto (inclinada pra quem está sentado), emoldurada e sustentada por
 * um monólito de cristal. Quando o dono está sentado (`energia`), um fluxo de luz sai das mãos/anel e sobe até a
 * tela (a "interação energética"); a tela acende junto. Cristais flutuando e neurônios subindo continuam.
 * Uma por pessoa, FIXA em `layout` (ver lib/cyber/bases.ts). O monitor é um mesh separado (hover + clique).
 * Local: +z aponta pra fora (praça); a tela fica no −z, de frente pra quem senta no assento (0, −0.15).
 */
import * as THREE from "three";
import type { LayoutBase } from "@/lib/cyber/bases";

export type BaseEstudoHandle = {
  group: THREE.Group;
  layout: LayoutBase;
  /** reposiciona (a ordem canônica dos membros chegou depois). */
  mover(l: LayoutBase): void;
  /** mesh clicável do monitor (raycast). */
  monitor: THREE.Mesh;
  /**
   * `ativa` = o dono (ou alguém) está perto → luz/cristais/linhas intensificam. `hover` = ponteiro no monitor.
   * `energia` (0..1) = o dono SENTADO no assento → o fluxo de energia mãos → tela.
   */
  atualizar(o: { dt: number; t: number; ativa: boolean; hover: boolean; perto: boolean; energia?: number }): void;
  dispose(): void;
};

/** a TELA (local): centro alto, de frente pro assento — o engine usa pra rótulos/menu */
export const TELA_BASE = { y: 2.75, z: -1.75, w: 2.4, h: 1.35 } as const;
/** o anel de controle (local), na altura das mãos de quem está sentado */
const ANEL_CTRL = { y: 1.25, z: -0.75 } as const;

const CRISTAIS = [0x66e6ff, 0xb98cff, 0x9affd0, 0xffd36b];
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function criarBase(layout: LayoutBase, accent: string, starTex: THREE.Texture, low: boolean): BaseEstudoHandle {
  const office = new THREE.Group();
  office.position.set(layout.x, 0, layout.z); office.rotation.y = layout.rot;
  const acc = new THREE.Color(accent), parado = reducedMotion();
  const seg = low ? 24 : 40;

  // plataforma + anel de luz na cor da pessoa
  const plat = new THREE.Mesh(new THREE.CircleGeometry(3.4, 56), new THREE.MeshStandardMaterial({ color: 0x101a32, roughness: 0.9, emissive: 0x0b1736, emissiveIntensity: 0.5 }));
  plat.rotation.x = -Math.PI / 2; plat.position.y = 0.03; office.add(plat);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.5, 64), new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; office.add(ring);

  // ── estrutura "alienígena": metal escuro com veios de luz na cor da pessoa ──
  const casco = new THREE.MeshStandardMaterial({ color: 0x1a2440, roughness: 0.35, metalness: 0.5, emissive: acc.clone().multiplyScalar(0.25), emissiveIntensity: 0.6 });
  const veio = new THREE.MeshBasicMaterial({ color: acc.clone().lerp(new THREE.Color(0xffffff), 0.35), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });

  // dossel: arcos estruturais (do chão, por cima do assento, até o chão) crescendo em direção à tela
  const arcos: { z: number; r: number }[] = [{ z: 0.55, r: 1.45 }, { z: -0.35, r: 1.7 }, { z: -1.25, r: 1.95 }];
  for (const a of arcos) {
    const arco = new THREE.Mesh(new THREE.TorusGeometry(a.r, 0.07, 8, seg, Math.PI), casco); arco.position.set(0, 0, a.z); office.add(arco);
    const luzArco = new THREE.Mesh(new THREE.TorusGeometry(a.r - 0.09, 0.018, 4, seg, Math.PI), veio); luzArco.position.set(0, 0, a.z); office.add(luzArco);
  }
  // espinha: liga o topo dos arcos (de trás pra frente)
  { const p0 = new THREE.Vector3(0, arcos[0]!.r, arcos[0]!.z), p1 = new THREE.Vector3(0, arcos[2]!.r, arcos[2]!.z), d = p0.distanceTo(p1);
    const esp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, d, 8), casco); esp.position.copy(p0).add(p1).multiplyScalar(0.5);
    esp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()); office.add(esp); }

  // assento de energia flutuante (sem cadeira): disco + borda de luz + encosto em arco de luz
  const assento = new THREE.Group(); assento.position.set(0, 0, -0.15); office.add(assento);
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.07, seg), casco); disco.position.y = 0.48; assento.add(disco);
  const bordaDisco = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, seg), veio); bordaDisco.rotation.x = Math.PI / 2; bordaDisco.position.y = 0.5; assento.add(bordaDisco);
  const encosto = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, seg, Math.PI), veio); encosto.position.set(0, 0.62, 0.3); encosto.rotation.x = -0.25; assento.add(encosto);
  const sustentacao = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: acc, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  sustentacao.scale.set(1.4, 1.4, 1); sustentacao.position.y = 0.2; assento.add(sustentacao);

  // anel de controle holográfico (onde as mãos "tocam")
  const anelCtrl = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.02, 6, seg), veio); anelCtrl.position.set(0, ANEL_CTRL.y, ANEL_CTRL.z); anelCtrl.rotation.x = Math.PI / 2 - 0.5; office.add(anelCtrl);
  const discoCtrl = new THREE.Mesh(new THREE.CircleGeometry(0.3, seg), new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  discoCtrl.position.copy(anelCtrl.position); discoCtrl.rotation.copy(anelCtrl.rotation); office.add(discoCtrl);

  // monólito de cristal sustentando a tela (no lugar da mesa) + dois menores
  const monolito = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: acc, emissiveIntensity: 0.9, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.92 }));
  monolito.scale.set(0.8, 2.6, 0.8); monolito.position.set(0, 1.1, TELA_BASE.z - 0.1); office.add(monolito);
  for (const lado of [-1, 1]) { const m = monolito.clone(); m.scale.set(0.45, 1.5, 0.45); m.position.set(lado * 0.85, 0.65, TELA_BASE.z + 0.05); office.add(m); }

  // TELA no alto, inclinada pra baixo (de frente pra quem está sentado), com moldura oval
  const tela = new THREE.Group(); tela.position.set(0, TELA_BASE.y, TELA_BASE.z); tela.rotation.x = 0.18; office.add(tela);
  const scrGlow = new THREE.Mesh(new THREE.PlaneGeometry(TELA_BASE.w + 0.25, TELA_BASE.h + 0.2), new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  scrGlow.position.z = -0.02; tela.add(scrGlow);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(TELA_BASE.w, TELA_BASE.h), new THREE.MeshBasicMaterial({ color: 0x0a2436, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  tela.add(scr);
  const scrEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(TELA_BASE.w, TELA_BASE.h)), new THREE.LineBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.85 }));
  tela.add(scrEdge);
  const moldura = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, low ? 32 : 56), casco); moldura.scale.set(1.5, 0.95, 1); moldura.position.z = -0.05; tela.add(moldura);
  const molduraLuz = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.014, 4, low ? 32 : 56), veio); molduraLuz.scale.copy(moldura.scale); molduraLuz.position.z = -0.04; tela.add(molduraLuz);
  const linhas: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const w = 0.3 + Math.random() * 1.5;
    const ln = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.07), new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
    ln.position.set(-1.05 + w / 2, 0.45 - i * 0.17, 0.01); tela.add(ln); linhas.push(ln);
  }
  const luz = new THREE.PointLight(0x9fd8ff, 1.6, 11); luz.position.set(0, 3.1, -0.6); office.add(luz);

  // ── fluxo de ENERGIA: das mãos (anel de controle) até a tela, numa curva; só com o dono sentado ──
  const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, ANEL_CTRL.y, ANEL_CTRL.z), new THREE.Vector3(0, ANEL_CTRL.y + 1.6, ANEL_CTRL.z - 0.4), new THREE.Vector3(0, TELA_BASE.y - 0.1, TELA_BASE.z + 0.15));
  const fN = low ? 24 : 48, fPos = new Float32Array(fN * 3), fFase = Array.from({ length: fN }, (_, i) => ({ u: i / fN, j: Math.random() * 6.283, r: 0.04 + Math.random() * 0.1 }));
  const fGeo = new THREE.BufferGeometry(); fGeo.setAttribute("position", new THREE.BufferAttribute(fPos, 3));
  const fMat = new THREE.PointsMaterial({ size: 0.16, map: starTex, color: acc.clone().lerp(new THREE.Color(0xffffff), 0.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const fluxo = new THREE.Points(fGeo, fMat); fluxo.frustumCulled = false; office.add(fluxo);
  const fio = new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 0.012, 5, false), new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  office.add(fio);
  const tmp = new THREE.Vector3();

  const cristais: { m: THREE.Mesh; baseY: number; ph: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * 6.283, rad = 2.6 + Math.random() * 0.5, h = 0.35 + Math.random() * 0.8;
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.17 + Math.random() * 0.13), new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: CRISTAIS[i % CRISTAIS.length]!, emissiveIntensity: 1.3, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92, flatShading: true }));
    c.scale.y = 1.6 + Math.random(); c.position.set(Math.cos(ang) * rad, h, Math.sin(ang) * rad); office.add(c); cristais.push({ m: c, baseY: h, ph: Math.random() * 6.28 });
  }

  // neurônios subindo (corkscrew vivo, estilo cérebro) + núcleo do feixe
  const upN = low ? 50 : 90, upPos = new Float32Array(upN * 3);
  const upData = Array.from({ length: upN }, () => ({ a: Math.random() * 6.283, r: 0.25 + Math.random() * 0.9, y: Math.random() * 15, sp: 1.3 + Math.random() * 1.9, dr: 0.5 + Math.random() * 0.7 }));
  const upGeo = new THREE.BufferGeometry(); upGeo.setAttribute("position", new THREE.BufferAttribute(upPos, 3));
  const upPts = new THREE.Points(upGeo, new THREE.PointsMaterial({ size: 0.34, map: starTex, transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x8fe8ff }));
  upPts.frustumCulled = false; office.add(upPts);
  const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: 0x9fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.scale.set(3.2, 3.2, 1); beam.position.y = 0.4; office.add(beam);

  let e = 0;   // energia suavizada
  return {
    group: office, layout, monitor: scr,
    mover(l) { this.layout = l; office.position.set(l.x, office.position.y, l.z); office.rotation.y = l.rot; },
    atualizar({ dt, t, ativa, hover, perto, energia = 0 }) {
      e += (energia - e) * Math.min(1, dt * 2.5);
      const pulso = 0.5 + 0.5 * Math.sin(t * 2.2);
      (scrEdge.material as THREE.LineBasicMaterial).opacity = hover ? (perto ? 0.75 + 0.25 * pulso : 0.95) : 0.85;
      (scrEdge.material as THREE.LineBasicMaterial).color.setHex(hover && perto ? 0xffffff : 0x66e6ff);
      (scrGlow.material as THREE.MeshBasicMaterial).opacity = hover ? (perto ? 0.3 + 0.12 * pulso : 0.2) : 0.13 + 0.25 * e;
      luz.intensity = 1.5 + (ativa ? 1.4 : 0) + 1.2 * e;
      linhas.forEach((ln, i) => { (ln.material as THREE.MeshBasicMaterial).opacity = (ativa ? 0.6 : 0.28) + 0.22 * (0.5 + 0.5 * Math.sin(t * (2 + 2 * e) + i)); });
      cristais.forEach((c) => { c.m.position.y = c.baseY + Math.sin(t * 1.2 + c.ph) * 0.12; c.m.rotation.y += dt * 0.6; (c.m.material as THREE.MeshStandardMaterial).emissiveIntensity = (ativa ? 1.4 : 1.0) + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.5 + c.ph)); });
      (monolito.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + 0.5 * e + 0.15 * pulso;
      (veio as THREE.MeshBasicMaterial).opacity = 0.6 + 0.3 * e;
      anelCtrl.rotation.z += dt * (0.3 + 1.2 * e);
      (discoCtrl.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.3 * e;
      // fluxo: partículas sobem pela curva mãos → tela, espiralando de leve
      fMat.opacity = 0.9 * e; (fio.material as THREE.MeshBasicMaterial).opacity = 0.35 * e * (0.7 + 0.3 * pulso);
      fluxo.visible = fio.visible = e > 0.01;
      if (fluxo.visible) {
        for (let i = 0; i < fN; i++) {
          const f = fFase[i]!; if (!parado) f.u = (f.u + dt * 0.45) % 1;
          curva.getPoint(f.u, tmp); const a = f.j + t * 3 + f.u * 6;
          fPos[i * 3] = tmp.x + Math.cos(a) * f.r; fPos[i * 3 + 1] = tmp.y + Math.sin(a) * f.r * 0.6; fPos[i * 3 + 2] = tmp.z;
        }
        fGeo.attributes.position!.needsUpdate = true;
      }
      const pa = upGeo.attributes.position!.array as Float32Array;
      for (let i = 0; i < upN; i++) {
        const d = upData[i]!; d.y += d.sp * dt; if (d.y > 15) { d.y = 0; d.a = Math.random() * 6.283; d.r = 0.25 + Math.random() * 0.9; }
        const rr = d.r * (0.5 + d.y * 0.06), ang = d.a + d.y * d.dr * 0.35;
        pa[i * 3] = Math.cos(ang) * rr; pa[i * 3 + 1] = d.y; pa[i * 3 + 2] = Math.sin(ang) * rr;
      }
      upGeo.attributes.position!.needsUpdate = true;
      (upPts.material as THREE.PointsMaterial).size = 0.3 + 0.08 * Math.sin(t * 3);
      (beam.material as THREE.SpriteMaterial).opacity = 0.6 + 0.3 * Math.sin(t * 2.2);
    },
    dispose() {
      office.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mt = (m as { material?: THREE.Material | THREE.Material[] }).material;
        if (mt) (Array.isArray(mt) ? mt : [mt]).forEach((x) => x.dispose());
      });
      office.removeFromParent();
    },
  };
}
