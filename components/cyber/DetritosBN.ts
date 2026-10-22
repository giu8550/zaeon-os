/**
 * O CAMPO DE ASTEROIDES do caminho até o buraco negro na tela (lib/cyber/detritos):
 *  - as ROCHAS em 3 formas (instanciadas — uma chamada de desenho por forma), escuras, com a borda acesa na luz do
 *    disco do buraco negro e as rachaduras em brasa;
 *  - a POEIRA passando por você (riscos de velocidade — a sensação de estar indo rápido pra dentro do campo);
 *  - a MARCA vermelha nas que vão te acertar (um anel virado pra câmera, por cima de tudo).
 */
import * as THREE from "three";
import type { Asteroide, V3 } from "@/lib/cyber/detritos";

export type DetritosHandle = {
  grupo: THREE.Group;
  /** desenha o campo de agora; `perigo` = os ids que vão te acertar; `frente` = o eixo (eu → buraco negro) */
  desenhar(lista: readonly Asteroide[], perigo: ReadonlySet<number>, cam: THREE.Camera, t: number, eu: V3, frente: V3, vel: number, dt: number): void;
  dispose(): void;
};

/** uma rocha: uma esfera amassada por ruído (cada forma uma semente) */
function geoRocha(semente: number, det: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, det), p = g.attributes.position!, v = new THREE.Vector3();
  const h = (x: number) => { const s = Math.sin(x * 12.9898 + semente * 78.233) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const amassa = 0.68 + 0.45 * h(Math.round(v.x * 7) + Math.round(v.y * 13) * 3 + Math.round(v.z * 5) * 7) + 0.18 * Math.sin(v.x * 3 + semente) * Math.cos(v.z * 2.5);
    v.multiplyScalar(amassa); v.y *= 0.8 + 0.2 * semente / 3; p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}

export function criarDetritos(o: { low: boolean; max: number }): DetritosHandle {
  const grupo = new THREE.Group(); grupo.name = "camposAsteroides";
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c2632, roughness: 0.95, metalness: 0.1, flatShading: true, emissive: 0x3a1206, emissiveIntensity: 0.6 });
  // (a borda acesa: o lado virado pro buraco negro pega a luz do disco — um brilho de borda violeta/âmbar)
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>", `
      float borda = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.5);
      outgoingLight += vec3(0.75, 0.35, 1.0) * borda * 0.9;
      #include <opaque_fragment>`);
  };
  const formas = [0, 1, 2].map((k) => { const im = new THREE.InstancedMesh(geoRocha(k + 1, o.low ? 0 : 1), mat, o.max); im.count = 0; im.frustumCulled = false; grupo.add(im); return im; });
  // a POEIRA: riscos parados no espaço em volta de você; com a velocidade, esticam pra trás
  const NP = o.low ? 140 : 380, poeira = Array.from({ length: NP }, () => new THREE.Vector3(Infinity, 0, 0));
  const posP = new Float32Array(NP * 6), geoP = new THREE.BufferGeometry(); geoP.setAttribute("position", new THREE.BufferAttribute(posP, 3));
  const matP = new THREE.LineBasicMaterial({ color: 0xc9b6ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  const riscos = new THREE.LineSegments(geoP, matP); riscos.frustumCulled = false; grupo.add(riscos);
  // a MARCA vermelha
  const marcas = new THREE.InstancedMesh(new THREE.RingGeometry(1.3, 1.4, 40), new THREE.MeshBasicMaterial({ color: 0xff3048, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false, side: THREE.DoubleSide }), o.max);
  marcas.count = 0; marcas.frustumCulled = false; marcas.renderOrder = 10; grupo.add(marcas);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), cont = [0, 0, 0];
  return {
    grupo,
    desenhar(lista, perigo, cam, t, eu, frente, vel, dt) {
      cont[0] = cont[1] = cont[2] = 0; let nm = 0;
      for (const d of lista) {
        const f = d.forma, i = cont[f]!++; if (i >= o.max) continue;
        p.set(d.p.x, d.p.y, d.p.z); e.set(d.gira.x * t * 0.7, d.gira.y * t, d.gira.z * t * 0.5); q.setFromEuler(e); s.setScalar(d.r);
        formas[f]!.setMatrixAt(i, m.compose(p, q, s));
        // (a marca só nas que ainda estão LONGE — de perto, a rocha já se vê)
        const longe = Math.hypot(d.p.x - eu.x, d.p.y - eu.y, d.p.z - eu.z);
        if (perigo.has(d.id) && longe > 28) { s.setScalar(Math.min(d.r, 4) * (1.25 + 0.1 * Math.sin(t * 14))); marcas.setMatrixAt(nm++, m.compose(p, cam.quaternion, s)); }
      }
      formas.forEach((im, k) => { im.count = Math.min(o.max, cont[k]!); im.instanceMatrix.needsUpdate = true; });
      marcas.count = nm; marcas.instanceMatrix.needsUpdate = true;
      // a poeira: renasce na frente quando fica pra trás (ou longe); o risco estica com a velocidade
      const L = 0.4 + vel * 0.06;
      for (let i = 0; i < NP; i++) {
        const q2 = poeira[i]!, rel = (q2.x - eu.x) * frente.x + (q2.y - eu.y) * frente.y + (q2.z - eu.z) * frente.z;
        if (!Number.isFinite(q2.x) || rel < -15 || q2.distanceToSquared(p.set(eu.x, eu.y, eu.z)) > 160 * 160) {
          const fundo = Number.isFinite(q2.x) ? 60 + Math.random() * 100 : Math.random() * 160, a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 45;
          const lx = -frente.z, lz = frente.x, ll = Math.hypot(lx, lz) || 1;
          q2.set(eu.x + frente.x * fundo + (lx / ll) * Math.cos(a) * r, eu.y + frente.y * fundo + Math.sin(a) * r, eu.z + frente.z * fundo + (lz / ll) * Math.cos(a) * r);
        }
        q2.x -= frente.x * vel * 0.25 * dt; q2.y -= frente.y * vel * 0.25 * dt; q2.z -= frente.z * vel * 0.25 * dt;   // (a poeira também vem — mais devagar que as rochas)
        const o6 = i * 6; posP[o6] = q2.x; posP[o6 + 1] = q2.y; posP[o6 + 2] = q2.z; posP[o6 + 3] = q2.x + frente.x * L; posP[o6 + 4] = q2.y + frente.y * L; posP[o6 + 5] = q2.z + frente.z * L;
      }
      geoP.attributes.position!.needsUpdate = true; riscos.visible = lista.length > 0;
    },
    dispose() { grupo.removeFromParent(); for (const im of formas) im.geometry.dispose(); mat.dispose(); geoP.dispose(); matP.dispose(); marcas.geometry.dispose(); (marcas.material as THREE.Material).dispose(); },
  };
}
