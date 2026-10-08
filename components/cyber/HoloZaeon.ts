/**
 * HoloZaeon — o ROSTO da Zaeon em HOLOGRAMA saindo do globo de luz no centro da capela (lib/cyber/ceu `GLOBO_CAPELA`).
 * É o avatar anime dela (public/avatars/zaeon: idle/talk/talk_half/blink/smile — o mesmo dos crachás vivos) num
 * shader de holograma: o fundo azul do retrato some (chave por cor), a imagem ganha tom ciano, linhas de varredura,
 * cintilação, um "glitch" de vez em quando e some num degradê embaixo (sai de dentro do globo). Ao APARECER, o retrato
 * sobe de dentro do globo enquanto uma linha de luz o revela de baixo pra cima; ao SUMIR, desce e se apaga. Enquanto
 * fala, a boca mexe (talk/talk_half); parada, ela pisca; pode sorrir. Um feixe do globo até o rosto, um aro projetor
 * e partículas subindo completam. Filho do grupo da ilha (local da Zaeon); vira sempre pra câmera (só no eixo Y).
 */
import * as THREE from "three";
import { GLOBO_CAPELA } from "@/lib/cyber/ceu";
import { glowTex } from "./CenaCosmica";
import { bocaDoNivel } from "@/lib/cyber/vozZaeon";

export type FaseHolo = "oculto" | "subindo" | "visivel" | "descendo";
export type HoloZaeonHandle = {
  group: THREE.Group;
  /** o rosto (onde a VOZ dela fica presa — o PositionalAudio vai junto quando ele sobe/desce) */
  rosto: THREE.Object3D;
  fase(): FaseHolo;
  aparecer(): void;
  sumir(): void;
  /** mexe a boca por `seg` segundos (sorteada — a reserva sem áudio) */
  falar(seg: number): void;
  /** a boca pela VOZ: o nível (0..1) do áudio agora → talk / talk_half / idle; null = sem voz (volta ao sorteio/idle) */
  boca(nivel: number | null): void;
  sorrir(seg: number): void;
  /** a cara de PENSANDO (esperando a IA responder) */
  pensar(on: boolean): void;
  /** BRAVA (a pessoa desrespeitou): a cara fechada, o holograma fica vermelho, treme e falha */
  brava(): void;
  /** o ponto (local da ilha) logo acima da cabeça — onde o balão de fala fica */
  ancora(): THREE.Vector3;
  atualizar(dt: number, t: number, cam: THREE.Vector3): void;
  dispose(): void;
};

const ESTADOS = ["idle", "talk", "talk_half", "blink", "smile", "think", "angry"] as const;
type Estado = (typeof ESTADOS)[number];
const TAM = 13, SUBIR = 2.6, DESCER = 1.8;
const Y_FIM = GLOBO_CAPELA.y + GLOBO_CAPELA.r * 0.5 + TAM / 2;   // a parte de baixo do busto ainda dentro do globo

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
  uniform sampler2D uMap; uniform float uT, uRevela, uAlpha, uGlitch, uTem, uIra;
  varying vec2 vUv;
  float h(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    float faixa = step(0.965, h(floor(uv.y * 46.0) + floor(uT * 9.0))) * uGlitch;   // as faixas do glitch
    uv.x += faixa * 0.035 * sin(uT * 61.0);
    vec3 c = uTem > 0.5 ? texture2D(uMap, uv).rgb : vec3(0.5, 0.9, 1.0);
    float fundo = smoothstep(0.03, 0.13, c.b - c.g) * smoothstep(0.16, 0.36, c.b - c.r);   // o fundo azul do retrato some
    float lum = dot(c, vec3(0.3, 0.59, 0.11));
    vec2 q = (uv - vec2(0.5, 0.5)) / vec2(0.47, 0.52); float masc = 1.0 - smoothstep(0.78, 1.0, length(q));
    masc *= smoothstep(0.0, 0.22, uv.y);                                                     // sai de dentro do globo
    float vis = 1.0 - smoothstep(uRevela - 0.02, uRevela, uv.y);                              // revela de baixo pra cima
    float linha = (1.0 - smoothstep(0.0, 0.02, abs(uv.y - uRevela))) * step(uRevela, 0.995);
    float scan = 0.8 + 0.2 * sin(uv.y * 420.0 - uT * 8.0);
    float pisca = 0.93 + 0.07 * sin(uT * 23.0) * sin(uT * 7.3);
    vec3 cor = mix(c, vec3(0.42, 0.95, 1.0) * (0.3 + lum * 1.1), 0.4) * scan * pisca;
    cor = mix(cor, vec3(1.0, 0.18, 0.12) * (0.35 + lum * 1.2), uIra * 0.75);   // brava: o holograma fica vermelho
    cor += vec3(0.55, 1.0, 1.0) * linha * 1.6 + vec3(0.3, 0.9, 1.0) * faixa * 0.4;
    float a = (1.0 - fundo * 0.93) * masc * vis * (0.72 + 0.28 * scan) + linha * masc;
    gl_FragColor = vec4(cor, clamp(a, 0.0, 1.0) * uAlpha);
    #include <colorspace_fragment>
  }`;

export function criarHoloZaeon(pai: THREE.Object3D, o: { low: boolean }): HoloZaeonHandle {
  const g = new THREE.Group(); g.visible = false; pai.add(g);
  const rosto = new THREE.Group(); g.add(rosto);
  const texs: Partial<Record<Estado, THREE.Texture>> = {}, loader = new THREE.TextureLoader();
  const uni = { uMap: { value: null as THREE.Texture | null }, uT: { value: 0 }, uRevela: { value: 0 }, uAlpha: { value: 1 }, uGlitch: { value: 0 }, uTem: { value: 0 }, uIra: { value: 0 } };
  for (const e of ESTADOS) loader.load(`/avatars/zaeon/${e}.webp`, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; texs[e] = tx; if (e === "idle" && !uni.uMap.value) { uni.uMap.value = tx; uni.uTem.value = 1; } });
  const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(TAM, TAM), mat); rosto.add(plano);
  // o brilho atrás do rosto
  const tGlow = glowTex("rgba(140,240,255,0.5)", "rgba(40,140,255,0.12)");
  const brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: tGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 })); brilho.scale.setScalar(TAM * 1.5); brilho.position.z = -0.2; rosto.add(brilho);
  // o FEIXE do globo até o rosto + o aro projetor + partículas subindo
  const aditivo = (c: number, op: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const feixeG = new THREE.CylinderGeometry(TAM * 0.42, GLOBO_CAPELA.r * 0.35, 1, 32, 1, true).translate(0, 0.5, 0);
  const feixe = new THREE.Mesh(feixeG, aditivo(0x7fe8ff, 0.14)); feixe.position.y = GLOBO_CAPELA.y; g.add(feixe);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(TAM * 0.42, 0.06, 6, 64), aditivo(0x9ff0ff, 0.9)); aro.rotation.x = Math.PI / 2; g.add(aro);
  const NP = o.low ? 60 : 140, pp = new Float32Array(NP * 3), pt = Array.from({ length: NP }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() * TAM * 0.45, u: Math.random(), v: 0.15 + Math.random() * 0.35 }));
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
  const pmat = new THREE.PointsMaterial({ map: tGlow, color: 0xaef6ff, size: 0.28, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(pg, pmat); pts.frustumCulled = false; g.add(pts);

  let fase: FaseHolo = "oculto", k = 0, falaAte = 0, sorriAte = 0, piscaEm = 3, troca = 0, agora = 0, estado: Estado = "idle", pensando = false, ira = 0, nivelVoz: number | null = null;
  const usar = (e: Estado) => { const tx = texs[e] ?? texs.idle; if (tx && uni.uMap.value !== tx) uni.uMap.value = tx; estado = e; };
  const s3 = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
  const anc = new THREE.Vector3(), wpos = new THREE.Vector3();
  return {
    group: g, rosto,
    fase: () => fase,
    aparecer() { if (fase === "visivel" || fase === "subindo") return; fase = "subindo"; k = 0; g.visible = true; },
    sumir() { if (fase === "oculto" || fase === "descendo") return; fase = "descendo"; k = 0; },
    falar(seg) { falaAte = agora + seg; },
    boca(nivel) { if (nivel === null && nivelVoz !== null) falaAte = 0; nivelVoz = nivel; },
    sorrir(seg) { sorriAte = agora + seg; },
    pensar(on) { pensando = on; },
    brava() { ira = 1; falaAte = 0; sorriAte = 0; pensando = false; },
    ancora() { return anc.set(0, rosto.position.y + TAM * 0.36, 0); },
    atualizar(dt, t, cam) {
      agora = t; uni.uT.value = t;
      let sobe = 1, revela = 1, alfa = 1;
      if (fase === "subindo") { k += dt / SUBIR; sobe = s3(k / 0.75); revela = s3((k - 0.15) / 0.8); if (k >= 1) fase = "visivel"; }
      else if (fase === "descendo") { k += dt / DESCER; sobe = 1 - s3(k); revela = 1 - s3(k * 1.2); alfa = 1 - s3((k - 0.5) / 0.5); if (k >= 1) { fase = "oculto"; g.visible = false; return; } }
      if (fase === "oculto") return;
      // sobe de dentro do globo até em cima dele; sempre de frente pra câmera (gira só em Y)
      rosto.position.y = GLOBO_CAPELA.y + (Y_FIM - GLOBO_CAPELA.y) * sobe + Math.sin(t * 0.9) * 0.15 * sobe;
      rosto.scale.setScalar(0.25 + 0.75 * sobe);
      const wp = g.getWorldPosition(wpos); rosto.rotation.y = Math.atan2(cam.x - wp.x, cam.z - wp.z);
      uni.uRevela.value = revela; uni.uAlpha.value = alfa;
      uni.uGlitch.value = Math.sin(t * 0.7) > 0.93 || fase !== "visivel" || ira > 0 ? 1 : 0;   // um glitch de vez em quando (e ao aparecer/sumir; brava, o tempo todo)
      uni.uIra.value = ira; if (ira > 0) { rosto.position.x = (Math.random() - 0.5) * 0.35; rosto.position.z = (Math.random() - 0.5) * 0.2; }   // brava: treme
      // a boca: falando alterna talk/talk_half/idle; parada pisca; às vezes sorri
      troca -= dt;
      if (ira > 0) usar("angry");   // BRAVA (public/avatars/zaeon/angry.webp)
      else if (pensando) usar("think");
      else if (nivelVoz !== null) { if (troca <= 0) { troca = 0.06; usar(bocaDoNivel(nivelVoz)); } }   // a boca segue a VOZ (troca a cada ~60 ms: sem tremer)
      else if (t < falaAte) { if (troca <= 0) { troca = 0.08 + Math.random() * 0.08; const r = Math.random(); usar(r < 0.45 ? "talk" : r < 0.8 ? "talk_half" : "idle"); } }
      else if (t < sorriAte) usar("smile");
      else { piscaEm -= dt; if (piscaEm <= 0) { usar("blink"); if (piscaEm < -0.13) piscaEm = 2.5 + Math.random() * 3; } else if (estado !== "idle") usar("idle"); }
      // o feixe, o aro e as partículas
      const base = rosto.position.y - TAM * 0.5 * rosto.scale.y;
      feixe.scale.y = Math.max(0.01, base - GLOBO_CAPELA.y + 1); (feixe.material as THREE.MeshBasicMaterial).opacity = 0.14 * alfa;
      aro.position.y = base + 0.4; aro.scale.setScalar(0.3 + 0.7 * sobe); aro.rotation.z += dt * 0.8; (aro.material as THREE.MeshBasicMaterial).opacity = 0.9 * alfa;
      (brilho.material as THREE.SpriteMaterial).opacity = 0.55 * alfa * revela;
      for (let i = 0; i < NP; i++) { const p = pt[i]!; p.u = (p.u + dt * p.v) % 1; const y = GLOBO_CAPELA.y + p.u * (base - GLOBO_CAPELA.y + TAM * 0.6); pp[i * 3] = Math.cos(p.a + p.u * 2) * p.r * (0.4 + p.u * 0.6); pp[i * 3 + 1] = y; pp[i * 3 + 2] = Math.sin(p.a + p.u * 2) * p.r * (0.4 + p.u * 0.6); }
      pg.attributes.position!.needsUpdate = true; pmat.opacity = 0.9 * alfa;
    },
    dispose() {
      for (const tx of Object.values(texs)) tx?.dispose(); tGlow.dispose();
      g.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); const mt = (m as { material?: THREE.Material | THREE.Material[] }).material; if (mt) (Array.isArray(mt) ? mt : [mt]).forEach((q) => q.dispose()); });
      g.removeFromParent();
    },
  };
}
