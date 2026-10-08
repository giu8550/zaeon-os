/**
 * RoboMotos — o ROBÔ do estacionamento que FABRICA uma moto nova quando alguém leva a da vaga (lib/cyber/motos:
 * `Fabrica`). Um drone (corpo claro, visor de luz, 4 rotores-anel embaixo, dois braços com emissores). Fabricando, ele
 * paira em cima da vaga (FABRICA.altura) e desce um FEIXE de luz dos braços até o chão, com um ANEL de varredura subindo
 * pela moto conforme ela se forma (`progresso` 0..1). O engine move o grupo (moverRobo) e diz o que ele está fazendo.
 * O EFEITO NA VAGA (`efeito`, o engine põe em cima da plataforma da vaga): uma COLUNA de luz com listras subindo e
 * FAÍSCAS enquanto a moto se forma — ela "nasce" da luz, não sai do nada — e um CLARÃO (esfera + anel no chão) quando
 * fica pronta (`clarao()`).
 */
import * as THREE from "three";
import { FABRICA } from "@/lib/cyber/motos";

export type RoboMotosHandle = {
  group: THREE.Group;
  /** o efeito de luz NA VAGA (coluna, faíscas, clarão) — o engine posiciona em cima da plataforma da vaga */
  efeito: THREE.Group;
  /** a moto ficou pronta: o clarão */
  clarao(): void;
  /** `progresso` = a moto sendo fabricada embaixo (0..1) ou null (voando/em casa); `rumo` = pra onde ele vira */
  atualizar(o: { dt: number; t: number; progresso: number | null; rumo: number }): void;
  dispose(): void;
};

export function criarRoboMotos(o: { low: boolean }): RoboMotosHandle {
  const g = new THREE.Group(), corpo = new THREE.Group(); g.add(corpo);
  const seg = o.low ? 10 : 20;
  const casca = new THREE.MeshStandardMaterial({ color: 0xdfe8f5, roughness: 0.3, metalness: 0.5, emissive: 0x24304a, emissiveIntensity: 0.35 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x1a2133, roughness: 0.4, metalness: 0.8 });
  const luz = new THREE.MeshBasicMaterial({ color: 0x7fe8ff });
  const brilho = new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  // corpo: cápsula deitada + "cabeça" com visor
  const tronco = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 6, seg), casca); tronco.rotation.z = Math.PI / 2; corpo.add(tronco);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.06), luz); visor.position.set(0, 0.12, 0.42); corpo.add(visor);
  const faixa = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.025, 6, seg * 2), brilho); faixa.rotation.y = Math.PI / 2; corpo.add(faixa);
  // 4 rotores-anel embaixo (giram)
  const rotores: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.75, 0.45], [0.75, 0.45], [-0.75, -0.45], [0.75, -0.45]] as const) {
    const braco = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.08), escuro); braco.position.set(x * 0.6, -0.12, z * 0.6); braco.rotation.y = Math.atan2(z, x); corpo.add(braco);
    const r = new THREE.Group(); r.position.set(x, -0.18, z); corpo.add(r);
    r.add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 6, seg * 2), escuro).rotateX(Math.PI / 2));
    const pas = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.06), brilho); r.add(pas); rotores.push(pas);
  }
  // os 2 braços com EMISSORES (apontam pra baixo) — daqui sai o feixe
  const emissores: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const ombro = new THREE.Group(); ombro.position.set(s * 0.35, -0.3, 0.1); corpo.add(ombro);
    const ante = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), escuro); ante.position.y = -0.25; ombro.add(ante);
    const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 10), casca); ponta.rotation.x = Math.PI; ponta.position.y = -0.55; ombro.add(ponta);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), luz); e.position.y = -0.66; ombro.add(e); emissores.push(ombro);
  }
  // o FEIXE (cone de luz até o chão) e o ANEL de varredura — no referencial do grupo (o chão fica em −altura)
  const H = FABRICA.altura;
  const feixeMat = new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const feixe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1.7, H - 0.9, seg, 1, true), feixeMat); feixe.position.y = -0.9 - (H - 0.9) / 2; g.add(feixe);
  const anelMat = new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const anel = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.04, 6, seg * 3), anelMat); anel.rotation.x = Math.PI / 2; g.add(anel);
  // ── o EFEITO na vaga ──
  const ef = new THREE.Group();
  const colunaMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uForca: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT, uForca; varying vec2 vUv;
      void main() {
        float y = vUv.y, listras = 0.55 + 0.45 * smoothstep(0.6, 1.0, sin((y * 9.0 - uT * 3.0) * 6.2832));
        float a = uForca * (1.0 - y) * (1.0 - y) * listras * (0.6 + 0.4 * sin(vUv.x * 6.2832 * 3.0 + uT * 2.0));
        gl_FragColor = vec4(vec3(0.55, 0.92, 1.0) * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const coluna = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 3.2, seg * 2, 1, true), colunaMat); coluna.position.y = 1.6; ef.add(coluna);
  const N = o.low ? 24 : 60, pos = new Float32Array(N * 3), fase = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = (i * 2.399) % (Math.PI * 2), r = 0.3 + ((i * 0.618) % 1) * 1.2; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 2] = Math.sin(a) * r; fase[i] = (i * 0.37) % 1; }
  const faiscasGeo = new THREE.BufferGeometry(); faiscasGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const faiscasMat = new THREE.PointsMaterial({ color: 0xbff4ff, size: 0.12, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const faiscas = new THREE.Points(faiscasGeo, faiscasMat); faiscas.frustumCulled = false; ef.add(faiscas);
  const claraoMat = new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const bola = new THREE.Mesh(new THREE.SphereGeometry(1, seg, 12), claraoMat); bola.position.y = 0.9; ef.add(bola);
  const ondaMat = new THREE.MeshBasicMaterial({ color: 0x9feaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const onda = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, seg * 3), ondaMat); onda.rotation.x = -Math.PI / 2; onda.position.y = 0.05; ef.add(onda);
  ef.visible = false;
  let fab = 0, forca = 0, clarao = -1;
  return {
    group: g, efeito: ef,
    clarao() { clarao = 0; },
    atualizar({ dt, t, progresso, rumo }) {
      corpo.position.y = Math.sin(t * 2.3) * 0.08;   // paira
      let d = rumo - corpo.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); corpo.rotation.y += d * Math.min(1, dt * 4);
      for (const [i, r] of rotores.entries()) r.rotation.y = t * (22 + i);
      fab += ((progresso !== null ? 1 : 0) - fab) * Math.min(1, dt * 5);
      for (const [i, e] of emissores.entries()) e.rotation.x = -0.25 * fab + 0.05 * Math.sin(t * 9 + i * 2) * fab;   // os braços "trabalham"
      feixeMat.opacity = fab * (0.16 + 0.06 * Math.sin(t * 17));
      const k = progresso ?? 1;
      anel.position.y = -H + 0.1 + k * 1.7; anelMat.opacity = fab * 0.9; anel.scale.setScalar(1 - 0.25 * k);
      // o efeito na vaga: a coluna e as faíscas acendem enquanto fabrica (mais forte perto do fim); o clarão no fim
      forca += ((progresso !== null ? 0.55 + 0.45 * k : 0) - forca) * Math.min(1, dt * 4);
      colunaMat.uniforms.uT!.value = t; colunaMat.uniforms.uForca!.value = forca;
      faiscasMat.opacity = forca * 0.9;
      const p = faiscasGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) { const u = (fase[i]! + t * (0.35 + 0.25 * ((i * 0.53) % 1))) % 1; p.setY(i, u * 2.6); }
      p.needsUpdate = true;
      if (clarao >= 0) {
        clarao += dt; const c = Math.min(1, clarao / 0.9);
        claraoMat.opacity = (1 - c) * 0.8; bola.scale.setScalar(0.4 + 2.2 * c);
        ondaMat.opacity = (1 - c) * 0.9; onda.scale.setScalar(1 + 3 * c);
        if (c >= 1) clarao = -1;
      } else { claraoMat.opacity = 0; ondaMat.opacity = 0; }
      ef.visible = forca > 0.01 || clarao >= 0;
    },
    dispose() {
      g.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); });
      ef.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); });
      for (const m of [casca, escuro, luz, brilho, feixeMat, anelMat, colunaMat, faiscasMat, claraoMat, ondaMat]) m.dispose();
      g.removeFromParent(); ef.removeFromParent();
    },
  };
}
