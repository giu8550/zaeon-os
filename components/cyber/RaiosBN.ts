/**
 * Os RAIOS do horizonte de eventos (out/2026, o dono: "mais raios ao estarmos no horizonte de eventos"): descargas em
 * zigue-zague saindo da borda do buraco negro e caindo em volta de quem está sendo tragado — mais e mais seguidas quanto
 * mais perto do núcleo, piscando. Uma chamada de desenho (segmentos).
 */
import * as THREE from "three";

export type RaiosBNHandle = {
  grupo: THREE.Group;
  /** `k` = o quanto da tragada já foi (0..1); `eu` e o centro/raio do buraco negro (mundo); devolve true quando caiu um
   *  raio novo perto (o engine toca o som) */
  atualizar(dt: number, k: number, eu: THREE.Vector3, bn: THREE.Vector3, R: number): boolean;
  apagar(): void;
  dispose(): void;
};

export function criarRaiosBN(o: { low: boolean }): RaiosBNHandle {
  const grupo = new THREE.Group(); grupo.name = "raiosBN";
  const MAX = o.low ? 4 : 10, SEG = 14, pos = new Float32Array(MAX * SEG * 6), geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xeee2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const linhas = new THREE.LineSegments(geo, mat); linhas.frustumCulled = false; grupo.add(linhas);
  const eixo = new THREE.Vector3(), lado = new THREE.Vector3(), cima = new THREE.Vector3(), de = new THREE.Vector3(), ate = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  let prox = 0, vivos = 0, brilho = 0;
  return {
    grupo,
    atualizar(dt, k, eu, bn, R) {
      prox -= dt; brilho = Math.max(0, brilho - dt * 3.2);
      let caiu = false;
      if (prox <= 0) {
        prox = (0.5 - 0.42 * k) * (0.6 + 0.8 * Math.random());   // (cada vez mais seguidos)
        vivos = Math.max(1, Math.round(MAX * (0.3 + 0.7 * k)));
        eixo.subVectors(eu, bn).normalize(); lado.set(0, 1, 0).cross(eixo); if (lado.lengthSq() < 1e-4) lado.set(1, 0, 0); lado.normalize(); cima.crossVectors(eixo, lado).normalize();
        const L = eu.distanceTo(bn);
        for (let r = 0; r < MAX; r++) {
          if (r >= vivos) { for (let s = 0; s < SEG * 6; s++) pos[r * SEG * 6 + s] = 0; continue; }
          // da BORDA do horizonte (do lado de quem está chegando) até em volta da pessoa
          const a0 = Math.random() * Math.PI * 2, rr = R * (1.02 + 0.1 * Math.random());
          de.copy(bn).addScaledVector(eixo, R * 0.3).addScaledVector(lado, Math.cos(a0) * rr).addScaledVector(cima, Math.sin(a0) * rr);
          const a1 = Math.random() * Math.PI * 2, perto = 6 + Math.random() * Math.min(60, L * 0.04);
          ate.copy(eu).addScaledVector(lado, Math.cos(a1) * perto).addScaledVector(cima, Math.sin(a1) * perto);
          a.copy(de);
          const zz = Math.min(L * 0.08, 160);
          for (let s = 1; s <= SEG; s++) {
            const f = s / SEG; b.lerpVectors(de, ate, f);
            if (s < SEG) b.addScaledVector(lado, (Math.random() - 0.5) * zz * (1 - f * 0.7)).addScaledVector(cima, (Math.random() - 0.5) * zz * (1 - f * 0.7));
            const o6 = (r * SEG + s - 1) * 6; pos[o6] = a.x; pos[o6 + 1] = a.y; pos[o6 + 2] = a.z; pos[o6 + 3] = b.x; pos[o6 + 4] = b.y; pos[o6 + 5] = b.z;
            a.copy(b);
          }
        }
        geo.attributes.position!.needsUpdate = true; brilho = 1; caiu = true;
      }
      mat.opacity = (0.25 + 0.75 * k) * brilho * (0.6 + 0.4 * Math.random());
      linhas.visible = true;
      return caiu;
    },
    apagar() { mat.opacity = 0; linhas.visible = false; },
    dispose() { grupo.removeFromParent(); geo.dispose(); mat.dispose(); },
  };
}
