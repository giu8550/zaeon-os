/**
 * Bercario — os TUBOS DE ENSAIO onde quem chega ao hiperespaço nasce (lib/cyber/onboarding), ao lado da Recepção no
 * piso da Cidade Zaeon. Cada tubo: pedestal com aro aceso, vidro, tampa, o LÍQUIDO luminoso com bolhas e um ser de luz
 * "se formando" lá dentro. No nascimento (`nascer(i)`), o líquido escoa, o vidro sobe pra dentro da tampa e a pessoa
 * sai; depois de um tempo o tubo fecha e enche de novo. Filho do grupo da ilha (coordenadas LOCAIS da Zaeon).
 * Leve: materiais compartilhados entre os 6 tubos, bolhas numa nuvem só.
 */
import * as THREE from "three";
import { CIDADE } from "@/lib/cyber/ceu";
import { NASCIMENTO, TUBO, TUBOS, estadoDoTubo } from "@/lib/cyber/onboarding";
import { glowTex } from "./CenaCosmica";

export type BercarioHandle = { group: THREE.Group; nascer(i: number): void; atualizar(dt: number, t: number): void; dispose(): void };

/** quanto tempo o tubo fica aberto depois de alguém sair, e quanto leva pra encher de novo (s) */
const ABERTO = 7, ENCHE = 3;

export function criarBercario(pai: THREE.Object3D, o: { low: boolean }): BercarioHandle {
  const g = new THREE.Group(); pai.add(g);
  const pedMat = new THREE.MeshStandardMaterial({ color: 0x182338, roughness: 0.3, metalness: 0.8, emissive: 0x0b1a3c, emissiveIntensity: 0.6 });
  const vidroMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, roughness: 0.05, metalness: 0.2, emissive: 0x1a4a66, emissiveIntensity: 0.35, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const liqMat = new THREE.MeshBasicMaterial({ color: 0x5fffd0, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
  const aroMat = new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const texSer = glowTex("rgba(255,255,255,1)", "rgba(120,255,220,0.45)");
  const P = 0.35, H = TUBO.alt, R = TUBO.r;
  const tubos = TUBOS.map((tb) => {
    const t = new THREE.Group(); t.position.set(tb.x - CIDADE.centro.x, 0, tb.z - CIDADE.centro.z); g.add(t);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.3, R + 0.45, P, 28), pedMat); ped.position.y = P / 2; t.add(ped);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(R + 0.3, 0.05, 6, 40), aroMat); aro.rotation.x = Math.PI / 2; aro.position.y = P + 0.01; t.add(aro);
    const vidro = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 28, 1, true), vidroMat); vidro.position.y = P + H / 2; t.add(vidro);
    const tampa = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.25, R + 0.1, 0.5, 28), pedMat); tampa.position.y = P + H + 0.25; t.add(tampa);
    const aroT = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.04, 6, 40), aroMat); aroT.rotation.x = Math.PI / 2; aroT.position.y = P + H - 0.02; t.add(aroT);
    // o líquido: um cilindro que encolhe de cima pra baixo (escala y a partir do fundo)
    const lg = new THREE.CylinderGeometry(R * 0.93, R * 0.93, H, 24, 1); lg.translate(0, H / 2, 0);
    const liq = new THREE.Mesh(lg, liqMat); liq.position.y = P; t.add(liq);
    // o ser de luz se formando lá dentro (some quando é a vez de alguém nascer ali)
    const ser = new THREE.Sprite(new THREE.SpriteMaterial({ map: texSer, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 })); ser.scale.set(0.9, 1.6, 1); ser.position.y = P + H * 0.5; t.add(ser);
    return { g: t, vidro, liq, ser, t0: -1, pendente: false };
  });
  // as bolhas: uma nuvem só pros 6 tubos
  const NB = o.low ? 6 : 14, N = NB * tubos.length, pos = new Float32Array(N * 3), bol = Array.from({ length: N }, () => ({ u: Math.random(), a: Math.random() * Math.PI * 2, r: Math.random() * R * 0.75, v: 0.15 + Math.random() * 0.25 }));
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const bolhas = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbffff0, size: 0.09, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  bolhas.frustumCulled = false; g.add(bolhas);
  return {
    group: g,
    nascer(i) { const tb = tubos[i]; if (tb) tb.pendente = true; },   // começa no próximo quadro (no relógio da cena)
    atualizar(dt, t) {
      tubos.forEach((tb, k) => {
        if (tb.pendente) { tb.pendente = false; tb.t0 = t; }
        let liquido = 1, vidro = 0;
        if (tb.t0 >= 0) {
          const s = t - tb.t0, e = estadoDoTubo(s), fecha = NASCIMENTO.sai + ABERTO;
          if (s < fecha) { liquido = e.liquido; vidro = e.vidro; }
          else if (s < fecha + 1.2) { liquido = 0; vidro = 1 - (s - fecha) / 1.2; }
          else if (s < fecha + 1.2 + ENCHE) { liquido = (s - fecha - 1.2) / ENCHE; vidro = 0; }
          else tb.t0 = -1;
        }
        tb.liq.scale.y = Math.max(0.001, liquido); tb.liq.visible = liquido > 0.01;
        tb.vidro.position.y = P + H / 2 + vidro * (H - 0.1); tb.vidro.scale.y = 1 - vidro * 0.92;   // sobe pra dentro da tampa
        tb.ser.visible = tb.t0 < 0;   // nascendo alguém ali: o ser de luz é a própria pessoa
        (tb.ser.material as THREE.SpriteMaterial).opacity = 0.45 + 0.2 * Math.sin(t * 1.3 + k);
        tb.ser.position.y = P + H * 0.5 + Math.sin(t * 0.8 + k) * 0.12;
        // bolhas deste tubo (só onde tem líquido)
        for (let j = 0; j < NB; j++) {
          const i = k * NB + j, b = bol[i]!; b.u += dt * b.v; if (b.u > 1) b.u = 0;
          const y = P + b.u * H * liquido;
          pos[i * 3] = tb.g.position.x + Math.cos(b.a + b.u * 3) * b.r; pos[i * 3 + 1] = liquido > 0.02 ? y : -999; pos[i * 3 + 2] = tb.g.position.z + Math.sin(b.a + b.u * 3) * b.r;
        }
      });
      geo.attributes.position!.needsUpdate = true;
      aroMat.opacity = 0.7 + 0.2 * Math.sin(t * 2);
    },
    dispose() {
      g.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); });
      for (const m of [pedMat, vidroMat, liqMat, aroMat, bolhas.material as THREE.Material, ...tubos.map((tb) => tb.ser.material)]) m.dispose();
      texSer.dispose(); g.removeFromParent();
    },
  };
}
