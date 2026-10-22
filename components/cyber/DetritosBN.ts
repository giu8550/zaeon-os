/**
 * Os DETRITOS do buraco negro na tela (lib/cyber/detritos): as rochas (instanciadas — uma chamada de desenho), o RASTRO
 * de cada uma (a brasa riscando o escuro — outra) e a MARCA vermelha nas que vão te acertar (um anel virado pra câmera —
 * outra). Três chamadas de desenho no total.
 */
import * as THREE from "three";
import type { Detrito } from "@/lib/cyber/detritos";

export type DetritosHandle = {
  grupo: THREE.Group;
  /** desenha a lista de agora; `perigo` = os ids que vão te acertar; `cam` = pra virar as marcas */
  desenhar(lista: readonly Detrito[], perigo: ReadonlySet<number>, cam: THREE.Camera, t: number): void;
  dispose(): void;
};

export function criarDetritos(o: { low: boolean; max: number }): DetritosHandle {
  const grupo = new THREE.Group(); grupo.name = "detritosBN";
  // a ROCHA: um icosaedro amassado (o mesmo pra todas — o tamanho e o giro variam)
  const geo = new THREE.IcosahedronGeometry(1, o.low ? 0 : 1), pos = geo.attributes.position!;
  for (let i = 0; i < pos.count; i++) { const k = 0.72 + 0.5 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1); pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.85, pos.getZ(i) * k); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2430, roughness: 0.9, metalness: 0.15, emissive: 0xff5a1e, emissiveIntensity: 0.35, flatShading: true });
  const rochas = new THREE.InstancedMesh(geo, mat, o.max); rochas.count = 0; rochas.frustumCulled = false; grupo.add(rochas);
  // o RASTRO: um segmento por rocha, da posição pra trás (pela velocidade), em brasa
  const posR = new Float32Array(o.max * 6), corR = new Float32Array(o.max * 6), geoR = new THREE.BufferGeometry();
  geoR.setAttribute("position", new THREE.BufferAttribute(posR, 3)); geoR.setAttribute("color", new THREE.BufferAttribute(corR, 3));
  const rastros = new THREE.LineSegments(geoR, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  rastros.frustumCulled = false; grupo.add(rastros);
  // a MARCA: um anel vermelho em volta de quem vem na sua direção
  const marcas = new THREE.InstancedMesh(new THREE.RingGeometry(1.25, 1.6, 28), new THREE.MeshBasicMaterial({ color: 0xff3048, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, side: THREE.DoubleSide }), o.max);
  marcas.count = 0; marcas.frustumCulled = false; marcas.renderOrder = 10; grupo.add(marcas);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  return {
    grupo,
    desenhar(lista, perigo, cam, t) {
      let n = 0, nm = 0;
      for (const d of lista) {
        if (n >= o.max) break;
        p.set(d.p.x, d.p.y, d.p.z); e.set(d.gira.x * t, d.gira.y * t, d.gira.z * t); q.setFromEuler(e); s.setScalar(d.r);
        rochas.setMatrixAt(n, m.compose(p, q, s));
        const v = Math.hypot(d.v.x, d.v.y, d.v.z) || 1, L = d.r * 8 + v * 0.2, i6 = n * 6;
        posR[i6] = d.p.x; posR[i6 + 1] = d.p.y; posR[i6 + 2] = d.p.z;
        posR[i6 + 3] = d.p.x - (d.v.x / v) * L; posR[i6 + 4] = d.p.y - (d.v.y / v) * L; posR[i6 + 5] = d.p.z - (d.v.z / v) * L;
        const quente = perigo.has(d.id);
        corR[i6] = 1; corR[i6 + 1] = quente ? 0.35 : 0.62; corR[i6 + 2] = quente ? 0.3 : 0.2; corR[i6 + 3] = 0.12; corR[i6 + 4] = 0.02; corR[i6 + 5] = 0.08;
        if (quente) { s.setScalar(d.r * (1.15 + 0.15 * Math.sin(t * 14))); marcas.setMatrixAt(nm++, m.compose(p, cam.quaternion, s)); }
        n++;
      }
      rochas.count = n; rochas.instanceMatrix.needsUpdate = true;
      marcas.count = nm; marcas.instanceMatrix.needsUpdate = true;
      geoR.setDrawRange(0, n * 2); geoR.attributes.position!.needsUpdate = true; geoR.attributes.color!.needsUpdate = true;
    },
    dispose() { grupo.removeFromParent(); geo.dispose(); mat.dispose(); geoR.dispose(); (rastros.material as THREE.Material).dispose(); marcas.geometry.dispose(); (marcas.material as THREE.Material).dispose(); },
  };
}
