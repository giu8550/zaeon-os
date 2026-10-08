/**
 * Moto — a MOTO VOADORA de corrida (hover bike). Uma moto de verdade, não um bloco: CASCO esculpido em seções (afina no
 * bico e na rabeta, tanque alto, cintura fina embaixo do banco), dois AROS DE ENERGIA no lugar das rodas (pneu escuro,
 * faixa de luz e um disco de energia que GIRA com a velocidade), garfo dianteiro inclinado, balança traseira, o REATOR
 * brilhando entre as pernas, semi-guidão baixo e pedaleiras recuadas (o piloto vai DEITADO na moto, em posição de
 * corrida). Três carenagens (uma por vaga, `estilo`) no mesmo esqueleto — o avatar encaixa igual em qualquer uma:
 *  - 0 RAIO (esportiva): bico afiado, tanque alto, rabeta pontuda subindo, aletas no nariz;
 *  - 1 TUBARÃO (robusta): casco largo e quadrado, tomadas de ar no nariz, barbatana dorsal, guelras de luz;
 *  - 2 GOTA (arredondada): casco em gota contínua, calotas nos aros, anéis de luz na cintura.
 * Pintura na cor da vaga (clara, metálica), detalhes escuros, frisos de luz, farol de LED e lanterna.
 * PROPULSORES com CHAMA de verdade (shader): núcleo branco-amarelo no bocal, corpo na cor da moto, ponta alaranjada,
 * tremulando com ruído; no BOOST esticam, puxam pro azul-branco e mostram os "diamantes de choque".
 * SETAS âmbar nos 4 cantos: piscam do lado da curva (o engine manda qual lado está aceso).
 * Frente = +z local (o mesmo rumo do voo). Voando: INCLINA nas curvas e aponta o nariz com a subida/descida; parada,
 * flutua de leve. `assento` = onde o avatar senta (montado).
 */
import * as THREE from "three";
import { ESCALA_MOTO, MOTO } from "@/lib/cyber/motos";

export type MotoHandle = {
  group: THREE.Group;
  /** ponto do banco (o QUADRIL do avatar montado vai aqui) */
  assento: THREE.Object3D;
  /** onde as mãos e os pés do piloto encaixam (IK): punhos do guidão e pedaleiras — E = esquerda do piloto (+x) */
  pontos: { maoE: THREE.Object3D; maoD: THREE.Object3D; peE: THREE.Object3D; peD: THREE.Object3D };
  /** o que dá pra clicar (montar) */
  alvos: THREE.Object3D[];
  /** `inclina` (rad, a da pilotagem — lib/cyber/motoFisica) manda na rolagem; sem ela, sai do giro (`curva`, motos dos
   *  outros). `boost` (0..1) estica as chamas; `seta` = o pisca ACESO agora (−1 esquerda, 1 direita, 0 apagado) */
  atualizar(o: { dt: number; t: number; voando: boolean; vel: number; curva: number; vy?: number; inclina?: number; boost?: number; seta?: number }): void;
  dispose(): void;
};

export const ESTILOS_MOTO = ["raio", "tubarao", "gota"] as const;

/** a CHAMA (aditiva, sem textura): `nucleo` = o miolo branco curto; uT/uBoost compartilhados pela moto toda */
function materialChama(cor: THREE.Color, nucleo: boolean, u: { uT: { value: number }; uBoost: { value: number } }) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: u.uT, uBoost: u.uBoost, uCor: { value: cor }, uNucleo: { value: nucleo ? 1 : 0 } },
    vertexShader: `
      uniform float uT; varying vec2 vUv; varying float vFrente;
      void main() {
        vUv = uv; vec3 p = position;
        // tremula: a chama "respira" de lado, mais na ponta
        float tremor = 1.0 + 0.14 * sin(uT * 41.0 + p.y * 13.0) * uv.y + 0.06 * sin(uT * 67.0 + p.y * 29.0);
        p.xz *= tremor;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vFrente = pow(abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))), 1.4);   // borda some macia
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uT, uBoost, uNucleo; uniform vec3 uCor; varying vec2 vUv; varying float vFrente;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float y = vUv.y;   // 0 = bocal, 1 = ponta
        float n = ruido(vec2(vUv.x * 7.0, y * 5.0 - uT * 11.0)) * 0.6 + ruido(vec2(vUv.x * 15.0, y * 11.0 - uT * 19.0)) * 0.4;
        float corpo = pow(1.0 - y, 1.6) * (0.55 + 0.75 * n) * vFrente;
        vec3 cor = mix(uCor, vec3(0.65, 0.85, 1.0), uBoost * 0.6);
        vec3 quente = mix(vec3(1.0, 0.98, 0.88), vec3(1.0, 0.78, 0.35), smoothstep(0.0, 0.3, y));
        vec3 c = mix(quente, cor, smoothstep(0.12, 0.55, y));
        c = mix(c, vec3(1.0, 0.42, 0.12), smoothstep(0.55, 1.0, y) * 0.55 * (1.0 - uBoost));   // ponta alaranjada
        if (uNucleo > 0.5) { c = mix(vec3(1.0), vec3(0.8, 0.93, 1.0), y); corpo *= 1.4 * (1.0 - smoothstep(0.0, 0.55, y)); }
        // boost: DIAMANTES DE CHOQUE (anéis brilhantes correndo pela chama)
        corpo += uBoost * smoothstep(0.82, 1.0, sin(y * 26.0 - uT * 34.0)) * (1.0 - y) * 0.9 * vFrente;
        corpo *= mix(0.62, 0.42, uBoost);   // aditiva e em camadas: sem isso, satura em branco
        gl_FragColor = vec4(c * corpo, corpo);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

/** uma SEÇÃO do casco: em `z`, meia-largura `w`, topo `yt`, fundo `yb`; `p` = expoente da superelipse (2 = elipse,
 *  maior = mais quadrada) */
type Secao = { z: number; w: number; yt: number; yb: number; p?: number };
/** o CASCO: as seções interpoladas (Catmull-Rom) ao longo de z e costuradas num tubo fechado nas pontas */
function casco(secoes: Secao[], low: boolean): THREE.BufferGeometry {
  const n = low ? 12 : 22, m = low ? 22 : 48, campos = ["w", "yt", "yb", "p"] as const;
  const cr = (a: number, b: number, c: number, d: number, t: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const amostra = (u: number): Required<Secao> => {   // u 0..1 ao longo das seções (por índice)
    const f = u * (secoes.length - 1), i = Math.min(secoes.length - 2, Math.floor(f)), t = f - i;
    const S = (k: number) => secoes[Math.max(0, Math.min(secoes.length - 1, k))]!;
    const r = { z: S(i).z + (S(i + 1).z - S(i).z) * t } as Required<Secao>;
    for (const c of campos) r[c] = cr(S(i - 1)[c] ?? 2, S(i)[c] ?? 2, S(i + 1)[c] ?? 2, S(i + 2)[c] ?? 2, t);
    r.w = Math.max(0.004, r.w); return r;
  };
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let a = 0; a <= m; a++) {
    const s = amostra(a / m), yc = (s.yt + s.yb) / 2, h = Math.max(0.004, (s.yt - s.yb) / 2), e = 2 / s.p;
    for (let k = 0; k <= n; k++) {
      const f = (k / n) * Math.PI * 2, c = Math.cos(f), sn = Math.sin(f);
      pos.push(s.w * Math.sign(c) * Math.abs(c) ** e, yc + h * Math.sign(sn) * Math.abs(sn) ** e, s.z); uv.push(k / n, a / m);
    }
  }
  for (let a = 0; a < m; a++) for (let k = 0; k < n; k++) { const i0 = a * (n + 1) + k, i1 = i0 + n + 1; idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1); }
  // tampas: um leque em cada ponta (as pontas já são finas — a tampa quase não aparece)
  for (const [a, sentido] of [[0, 1], [m, -1]] as const) {
    const s = amostra(a / m), c = pos.length / 3; pos.push(0, (s.yt + s.yb) / 2, s.z); uv.push(0.5, a / m);
    for (let k = 0; k < n; k++) { const i0 = a * (n + 1) + k; if (sentido > 0) idx.push(c, i0 + 1, i0); else idx.push(c, i0, i0 + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}

/** o desenho do DISCO de energia dos aros (um só pra todas as motos): miolo claro, 3 pás curvas e a borda apagando */
let texDisco: THREE.CanvasTexture | null = null;
function discoDeEnergia(): THREE.CanvasTexture | null {
  if (texDisco || typeof document === "undefined") return texDisco;
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); if (!x) return null;
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.25, "rgba(255,255,255,0.35)"); g.addColorStop(0.8, "rgba(255,255,255,0.12)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = "rgba(255,255,255,0.8)"; x.lineWidth = 5; x.lineCap = "round";
  for (let k = 0; k < 3; k++) { const a = (k * 2 * Math.PI) / 3; x.beginPath(); x.moveTo(64 + 10 * Math.cos(a), 64 + 10 * Math.sin(a)); x.quadraticCurveTo(64 + 40 * Math.cos(a + 0.5), 64 + 40 * Math.sin(a + 0.5), 64 + 56 * Math.cos(a + 1.1), 64 + 56 * Math.sin(a + 1.1)); x.stroke(); }
  texDisco = new THREE.CanvasTexture(c); texDisco.colorSpace = THREE.SRGBColorSpace; return texDisco;
}

/** as SEÇÕES de cada carenagem (z = frente; o banco fica por cima de z −0,1..−0,9, com o topo do casco ali ≤ 1,04) */
const CASCOS: Record<(typeof ESTILOS_MOTO)[number], Secao[]> = {
  // FINO (a perna do piloto passa por fora) e ABERTO embaixo no meio (o fundo sobe entre z 0,7 e −0,6: o MOTOR fica à mostra)
  raio: [
    { z: 1.82, w: 0.012, yt: 0.99, yb: 0.95, p: 2.2 }, { z: 1.58, w: 0.1, yt: 1.06, yb: 0.88, p: 2.2 }, { z: 1.2, w: 0.16, yt: 1.14, yb: 0.86, p: 2.4 },
    { z: 0.72, w: 0.19, yt: 1.22, yb: 0.96, p: 2.4 }, { z: 0.3, w: 0.19, yt: 1.24, yb: 1.03, p: 2.4 }, { z: -0.05, w: 0.14, yt: 1.08, yb: 0.99, p: 2.4 },
    { z: -0.55, w: 0.12, yt: 1.02, yb: 0.97, p: 2.4 }, { z: -1.02, w: 0.13, yt: 1.2, yb: 1.0, p: 2.4 }, { z: -1.45, w: 0.09, yt: 1.3, yb: 1.11, p: 2.4 },
    { z: -1.74, w: 0.018, yt: 1.31, yb: 1.25, p: 2.2 },
  ],
  tubarao: [
    { z: 1.74, w: 0.05, yt: 1.0, yb: 0.87, p: 3 }, { z: 1.55, w: 0.17, yt: 1.1, yb: 0.82, p: 3.2 }, { z: 1.1, w: 0.22, yt: 1.17, yb: 0.84, p: 3.4 },
    { z: 0.6, w: 0.23, yt: 1.23, yb: 0.95, p: 3.4 }, { z: 0.2, w: 0.22, yt: 1.23, yb: 1.03, p: 3.4 }, { z: -0.08, w: 0.16, yt: 1.08, yb: 0.99, p: 3 },
    { z: -0.55, w: 0.14, yt: 1.02, yb: 0.96, p: 3 }, { z: -1.05, w: 0.17, yt: 1.16, yb: 0.97, p: 3.2 }, { z: -1.5, w: 0.13, yt: 1.2, yb: 1.0, p: 3 },
    { z: -1.7, w: 0.045, yt: 1.17, yb: 1.05, p: 2.6 },
  ],
  gota: [
    { z: 1.74, w: 0.018, yt: 0.97, yb: 0.93 }, { z: 1.5, w: 0.14, yt: 1.08, yb: 0.83 }, { z: 1.0, w: 0.21, yt: 1.19, yb: 0.84 },
    { z: 0.45, w: 0.22, yt: 1.24, yb: 0.95 }, { z: 0.05, w: 0.18, yt: 1.12, yb: 1.0 }, { z: -0.5, w: 0.15, yt: 1.03, yb: 0.98 },
    { z: -1.0, w: 0.17, yt: 1.12, yb: 0.95 }, { z: -1.45, w: 0.12, yt: 1.14, yb: 0.99 }, { z: -1.7, w: 0.018, yt: 1.08, yb: 1.04 },
  ],
};
/** o RABO (onde sai o propulsor principal) de cada carenagem */
const RABO = { raio: { y: 1.26, z: -1.66 }, tubarao: { y: 1.1, z: -1.64 }, gota: { y: 1.05, z: -1.62 } } as const;
/** os AROS: centro (z), raio; o cubo fica a `r + 0,08` do chão */
const AROS = [{ z: 1.12, r: 0.42 }, { z: -1.1, r: 0.46 }] as const;

export function criarMoto(o: { cor: string; low: boolean; estilo?: number }): MotoHandle {
  const g = new THREE.Group(), corpo = new THREE.Group(); g.add(corpo);
  corpo.scale.setScalar(ESCALA_MOTO);   // proporção de moto de verdade pro avatar (~2 m): tudo (inclusive as âncoras) escala junto
  const estilo = ESTILOS_MOTO[(((o.estilo ?? 0) % 3) + 3) % 3]!;
  const acento = new THREE.Color(o.cor), seg = o.low ? 8 : 16;
  // PINTURA na cor da vaga (clara e metálica), detalhes escuros, cromado, frisos de luz, vidro, banco
  const pintura = new THREE.MeshStandardMaterial({ color: acento.clone().lerp(new THREE.Color(0xffffff), 0.3), roughness: 0.24, metalness: 0.6, emissive: acento, emissiveIntensity: 0.14 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x1c2436, roughness: 0.38, metalness: 0.7, emissive: 0x0a1020, emissiveIntensity: 0.6 });
  const cromado = new THREE.MeshStandardMaterial({ color: 0x9aa4ba, roughness: 0.16, metalness: 0.95, emissive: 0x141a28, emissiveIntensity: 0.4 });
  const brilho = new THREE.MeshBasicMaterial({ color: acento, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
  const vidro = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, emissive: 0x2a6bd0, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const couro = new THREE.MeshStandardMaterial({ color: 0x10131c, roughness: 0.85, metalness: 0.1 });
  const farol = new THREE.MeshBasicMaterial({ color: 0xeaf6ff }), lanterna = new THREE.MeshBasicMaterial({ color: 0xff2a3a });
  const peca = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number, pai: THREE.Object3D = corpo) => { m.position.set(x, y, z); pai.add(m); return m; };
  const alvos: THREE.Object3D[] = [];

  /** um PERFIL lateral (pontos [z, y], curva suave) extrudado na largura (x), centrado em `x` */
  const perfil = (pts: [number, number][], largura: number, mat: THREE.Material, x = 0, chanfro = 0.05) => {
    const s = new THREE.Shape(); s.moveTo(pts[0]![0], pts[0]![1]); s.splineThru(pts.slice(1).map(([a, b]) => new THREE.Vector2(a, b))); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.005, largura - 2 * chanfro), bevelEnabled: chanfro > 0, bevelThickness: chanfro, bevelSize: chanfro, bevelSegments: o.low ? 1 : 3, curveSegments: o.low ? 10 : 20 });
    geo.translate(0, 0, -(largura - 2 * chanfro) / 2); geo.rotateY(-Math.PI / 2);   // shape x → +z (frente), extrusão → x
    return peca(new THREE.Mesh(geo, mat), x, 0, 0);
  };
  /** uma BARRA (cilindro) de `a` até `b` */
  const barra = (a: [number, number, number], b: [number, number, number], r: number, mat: THREE.Material) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = vb.clone().sub(va);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), mat);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return peca(m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  };
  /** um FRISO de luz (tubo fino) passando pelos pontos */
  const friso = (pts: [number, number, number][], r = 0.011) => peca(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), o.low ? 16 : 40, r, 4), brilho), 0, 0, 0);
  /** a meia-largura do casco em z (pra encostar peças na lateral) */
  const secoes = CASCOS[estilo];
  const larguraEm = (z: number) => { for (let i = 0; i < secoes.length - 1; i++) { const a = secoes[i]!, b = secoes[i + 1]!; if (z <= a.z && z >= b.z) return a.w + ((b.w - a.w) * (a.z - z)) / (a.z - b.z); } return 0.1; };

  // ───────────── CASCO ─────────────
  alvos.push(peca(new THREE.Mesh(casco(secoes, o.low), pintura), 0, 0, 0));
  // frisos de luz correndo pela lateral, do bico à rabeta
  for (const s of [-1, 1]) {
    const pts: [number, number, number][] = [1.5, 1.0, 0.5, 0.1, -0.4, -0.9, -1.35].map((z) => { const i = secoes.findIndex((q) => q.z < z), a = secoes[Math.max(0, i - 1)]!, b = secoes[Math.max(0, i)]!, u = (a.z - z) / (a.z - b.z || 1), yb = a.yb + (b.yb - a.yb) * u, yt = a.yt + (b.yt - a.yt) * u; return [s * (larguraEm(z) * 0.93 + 0.004), yb + (yt - yb) * 0.42, z]; });
    friso(pts);
  }
  // FAROL de LED (dois rasgos no bico) e a LANTERNA na rabeta
  const bico = secoes[1]!;
  for (const s of [-1, 1]) { const f = peca(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.14), farol), s * bico.w * 0.55, (bico.yt + bico.yb) / 2 + 0.01, bico.z - 0.02); f.rotation.y = s * 0.35; }
  const rabo = RABO[estilo];
  peca(new THREE.Mesh(new THREE.BoxGeometry(larguraEm(rabo.z + 0.12) * 1.7, 0.03, 0.04), lanterna), 0, rabo.y + 0.06, rabo.z + 0.1);

  if (estilo === "raio") {
    perfil([[1.16, 1.12], [0.82, 1.42], [0.62, 1.43], [0.8, 1.2]], 0.3, vidro, 0, 0.01);   // bolha alta
    for (const s of [-1, 1]) {   // ALETAS no nariz (asinhas de corrida)
      const a = perfil([[1.45, 0.92], [1.05, 0.95], [0.95, 0.86], [1.3, 0.86]], 0.02, escuro, s * (larguraEm(1.2) + 0.06), 0.005); a.rotation.z = s * -0.25;
    }
  } else if (estilo === "tubarao") {
    perfil([[1.08, 1.17], [0.86, 1.33], [0.7, 1.34], [0.86, 1.18]], 0.42, vidro, 0, 0.01);   // para-brisa baixo e largo
    perfil([[-0.85, 1.12], [-1.25, 1.5], [-1.48, 1.47], [-1.3, 1.14]], 0.05, pintura, 0, 0.015);   // barbatana dorsal
    for (const s of [-1, 1]) {
      const tomada = peca(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.3, seg, 1, true), escuro), s * 0.17, 0.92, 1.45); tomada.rotation.x = Math.PI / 2;
      peca(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.014, 6, seg * 2), brilho), s * 0.17, 0.92, 1.6);
      for (let k = 0; k < 3; k++) peca(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.035, 0.13), brilho), s * (larguraEm(0.9 - k * 0.15) + 0.003), 1.0, 0.9 - k * 0.15).rotation.x = -0.5;   // guelras de luz
    }
  } else {
    perfil([[1.06, 1.15], [0.88, 1.32], [0.74, 1.32], [0.86, 1.16]], 0.32, vidro, 0, 0.01);
    for (const [z, y, w, h] of [[-0.25, 0.965, 0.245, 0.11], [-1.25, 1.03, 0.19, 0.09]] as const) {   // anéis de luz na cintura e no rabo
      const anel = peca(new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 4, seg * 3), brilho), 0, y, z); anel.scale.set(w, h, 1);
    }
  }
  // BANCO (o mesmo nas três: o quadril encaixa igual) + o pedestal do semi-guidão e o painel
  perfil([[0.02, 1.04], [-0.12, 1.11], [-0.66, 1.1], [-0.9, 1.19], [-1.0, 1.11], [-0.74, 1.0], [0.0, 0.98]], 0.3, couro, 0, 0.04);
  peca(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.12), escuro), 0, 1.16, 0.7);
  const painel = peca(new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), brilho), 0, 1.2, 0.62); painel.rotation.x = -1.0;

  // ───────────── AROS DE ENERGIA (as "rodas") + garfo, balança, reator ─────────────
  const tex = discoDeEnergia();
  const energia = new THREE.MeshBasicMaterial({ color: acento, map: tex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const discos: THREE.Mesh[] = [];
  for (const [k, a] of AROS.entries()) {
    const roda = peca(new THREE.Group(), 0, a.r + 0.08, a.z); roda.rotation.y = Math.PI / 2;   // o plano do aro = yz
    const pneu = new THREE.Mesh(new THREE.TorusGeometry(a.r, 0.075, o.low ? 6 : 10, o.low ? 24 : 44), escuro); roda.add(pneu); alvos.push(pneu);
    for (const lado of [-1, 1]) { const f = new THREE.Mesh(new THREE.TorusGeometry(a.r - 0.035, 0.016, 4, o.low ? 24 : 48), brilho); f.position.z = lado * 0.055; roda.add(f); }
    const disco = new THREE.Mesh(new THREE.CircleGeometry(a.r - 0.07, o.low ? 20 : 36), energia); roda.add(disco); discos.push(disco);
    disco.userData.semLote = true;   // gira: fica fora do lote estático
    const cubo = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, seg), cromado); cubo.rotation.x = Math.PI / 2; roda.add(cubo);
    if (estilo === "gota") { for (const lado of [-1, 1]) { const calota = new THREE.Mesh(new THREE.CircleGeometry(a.r * 0.5, seg * 2), pintura); calota.position.z = lado * 0.06; calota.rotation.y = lado > 0 ? 0 : Math.PI; roda.add(calota); } }
    // para-lama: um arco por cima (o dianteiro cobre em cima/na frente; o traseiro, em cima/atrás)
    const arco = new THREE.Mesh(new THREE.TorusGeometry(a.r + 0.07, 0.045, 6, 24, Math.PI * 0.5), estilo === "gota" ? pintura : escuro);
    arco.rotation.z = k === 0 ? Math.PI * 0.42 : Math.PI * 0.12; roda.add(arco);
  }
  const yF = AROS[0].r + 0.08, yT = AROS[1].r + 0.08;
  for (const s of [-1, 1]) {
    barra([s * 0.12, 1.12, 0.7], [s * 0.12, yF, AROS[0].z], 0.032, cromado);   // GARFO inclinado
    barra([s * 0.13, 0.66, 0.0], [s * 0.13, yT, AROS[1].z], 0.04, escuro);    // BALANÇA (do motor até o cubo traseiro)
    barra([s * 0.09, 1.08, 0.66], [s * 0.1, 0.72, 0.36], 0.03, escuro);        // QUADRO: da caixa de direção até o motor
  }
  // o MOTOR EXPOSTO (sem carenagem embaixo): o cárter com o miolo de energia aceso, dois CILINDROS em V com aletas e os
  // ESCAPAMENTOS cromados descendo por baixo do banco até a rabeta
  const ym = 0.66, zm = 0.22;
  const carter = peca(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.26, seg * 2), escuro), 0, ym, zm); carter.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) { const tampa = peca(new THREE.Mesh(new THREE.CircleGeometry(0.115, seg * 2), brilho), s * 0.132, ym, zm); tampa.rotation.y = s * Math.PI / 2; }   // o miolo aceso dos dois lados
  for (const [ang, comp] of [[0.5, 0.34], [-0.45, 0.32]] as const) {   // V: um pra frente, um pra trás
    const cil = new THREE.Group(); cil.position.set(0, ym, zm); cil.rotation.x = ang; corpo.add(cil);
    const bloco = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, comp, seg), cromado); bloco.position.y = comp / 2 + 0.08; cil.add(bloco);
    for (let k = 0; k < 5; k++) { const aleta = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.014, seg), escuro); aleta.position.y = 0.14 + k * 0.05; cil.add(aleta); }
    const cabeca = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.14), escuro); cabeca.position.y = comp + 0.1; cil.add(cabeca);
    const vela = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), brilho); vela.position.y = comp + 0.14; cil.add(vela);
  }
  const yR = rabo.y - 0.12, zR = rabo.z - 0.06;
  for (const s of [-1, 1]) peca(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(s * 0.05, ym + 0.36, zm + 0.2), new THREE.Vector3(s * 0.13, ym + 0.05, zm + 0.28), new THREE.Vector3(s * 0.17, ym - 0.08, zm - 0.1),
    new THREE.Vector3(s * 0.17, ym - 0.02, -0.6), new THREE.Vector3(s * 0.19, yR - 0.05, -1.25), new THREE.Vector3(s * 0.2, yR, zR + 0.08),
  ]), o.low ? 20 : 48, 0.026, 6), cromado), 0, 0, 0);

  // semi-guidão (baixo, de corrida): as duas barras saindo do pedestal + os punhos; pedaleiras recuadas
  for (const s of [-1, 1]) {
    barra([s * 0.1, 1.15, 0.68], [s * 0.33, 1.13, 0.62], 0.022, cromado);
    const p = peca(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), couro), s * 0.38, 1.13, 0.61); p.rotation.z = Math.PI / 2;
    peca(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.16), escuro), s * 0.3, 0.64, -0.22);
  }

  // ───────────── PROPULSORES com CHAMA ─────────────
  const u = { uT: { value: 0 }, uBoost: { value: 0 } };
  const chamaMat = materialChama(acento, false, u), nucleoMat = materialChama(acento, true, u);
  const garganta = new THREE.MeshBasicMaterial({ color: acento.clone().lerp(new THREE.Color(0xffffff), 0.5) });
  type Prop = { chama: THREE.Group; tam: number; tipo: "principal" | "sustenta" | "manobra"; lado: number };
  const props: Prop[] = [];
  /** um propulsor em (x,y,z), apontando pra `dir` ("tras" = −z, "baixo" = −y, "lado" = ±x pra fora) */
  const propulsor = (x: number, y: number, z: number, r: number, dir: "tras" | "baixo" | "lado", tam: number) => {
    const g2 = new THREE.Group(); g2.position.set(x, y, z); corpo.add(g2);
    // o +y local do grupo aponta pra saída
    if (dir === "tras") g2.rotation.x = -Math.PI / 2; else if (dir === "baixo") g2.rotation.x = Math.PI; else g2.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    const bocal = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r, r * 1.5, seg, 1, true), cromado); bocal.position.y = r * 0.25; g2.add(bocal);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(r * 0.94, r * 0.13, 6, seg + 4), escuro); aro.rotation.x = Math.PI / 2; aro.position.y = r * 1.0; g2.add(aro);
    const fundo = new THREE.Mesh(new THREE.CircleGeometry(r * 0.76, seg), garganta); fundo.rotation.x = -Math.PI / 2; fundo.position.y = r * 0.55; g2.add(fundo);
    // a chama: cone com a BASE no bocal e a ponta pra fora (comprimento 1 → escala `tam × força`)
    const chama = new THREE.Group(); chama.position.y = r * 0.95; g2.add(chama);
    const fora = new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, 1, seg, 1, true), chamaMat); fora.position.y = 0.5; chama.add(fora);
    const nucleo = new THREE.Mesh(new THREE.ConeGeometry(r * 0.5, 0.55, seg, 1, true), nucleoMat); nucleo.position.y = 0.275; chama.add(nucleo);
    props.push({ chama, tam, tipo: dir === "tras" ? "principal" : dir === "baixo" ? "sustenta" : "manobra", lado: Math.sign(x) });
  };
  // TRASEIRA: a nacele presa ao rabo, o PRINCIPAL no meio e dois menores dos lados (embaixo da rabeta)
  const nacele = peca(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.34, seg), escuro), 0, rabo.y - 0.04, rabo.z - 0.02); nacele.rotation.x = Math.PI / 2; nacele.scale.set(1.4, 1, 1);
  peca(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 4, seg * 2), brilho), 0, rabo.y - 0.04, rabo.z + 0.12).scale.set(1.4, 1, 1);
  propulsor(0, rabo.y - 0.04, rabo.z - 0.2, 0.12, "tras", 1.5);
  for (const s of [-1, 1]) propulsor(s * 0.2, yR, zR, 0.07, "tras", 1.1);
  // de SUSTENTAÇÃO embaixo do reator e da balança
  for (const [x, z] of [[0.08, 0.62], [-0.08, 0.62], [0.08, -0.62], [-0.08, -0.62]] as const) propulsor(x, 0.62, z, 0.055, "baixo", 0.5);
  for (const s of [-1, 1]) {   // de MANOBRA nas laterais do nariz: acendem na curva, do lado de fora
    const zM = 1.36, xM = larguraEm(zM) + 0.01;
    peca(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.14), escuro), s * (xM - 0.01), 0.95, zM);
    propulsor(s * (xM + 0.02), 0.95, zM, 0.035, "lado", 0.4);
  }

  // ───────────── SETAS (pisca) ─────────────
  // lente âmbar apagada (fica) + a luz acesa e o halo (ligam no pisca) — frente e trás, dos dois lados
  const lente = new THREE.MeshStandardMaterial({ color: 0x3a2610, roughness: 0.25, metalness: 0.4, emissive: 0x1a0d00, emissiveIntensity: 1 });
  const luz = new THREE.MeshBasicMaterial({ color: 0xffb22e });
  const halo = new THREE.MeshBasicMaterial({ color: 0xff9a1a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  // o aceso de cada LADO num grupo só (frente + trás piscam juntos): liga/desliga o grupo — e o lote junta as peças dele
  const setas: Record<number, THREE.Group> = { 1: new THREE.Group(), [-1]: new THREE.Group() };   // −1 = esquerda do piloto = +x
  for (const gS of Object.values(setas)) { gS.visible = false; corpo.add(gS); }
  for (const s of [-1, 1]) for (const [z, y] of [[1.28, 1.04], [-1.4, rabo.y - 0.02]] as const) {
    const x = s * (larguraEm(z) + 0.01), gS = setas[s > 0 ? -1 : 1]!;
    peca(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.1), lente), x, y, z);   // embutida (só a pontinha aparece)
    peca(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.034, 0.105), luz), x, y, z, gS);
    peca(new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), halo), x + s * 0.02, y, z, gS);
  }

  // ancoragem do PILOTO (frente da moto = +z; a esquerda de quem pilota = +x): quadril no banco, mãos nos punhos,
  // pés nas pedaleiras — o avatar encaixa nesses pontos por IK (AvatarLuz `montado`)
  const ancora = (x: number, y: number, z: number) => { const a = new THREE.Object3D(); a.position.set(x, y, z); corpo.add(a); return a; };
  const assento = ancora(0, MOTO.banco / ESCALA_MOTO, -0.36);   // (dentro do corpo já escalado)
  // posição de CORRIDA: mãos baixas e à frente (semi-guidão), pés recuados (pedaleiras atrás do reator)
  const pontos = { maoE: ancora(0.38, 1.14, 0.6), maoD: ancora(-0.38, 1.14, 0.6), peE: ancora(0.3, 0.68, -0.22), peD: ancora(-0.3, 0.68, -0.22) };

  let rola = 0, nariz2 = 0, boostSuave = 0, giroAro = 0, brilhoAro = 0.35;
  return {
    group: g, assento, pontos, alvos,
    atualizar({ dt, t, voando, vel, curva, vy = 0, inclina, boost = 0, seta = 0 }) {
      const k = Math.min(1, dt * 4);
      if (inclina !== undefined) rola = inclina;   // a pilotagem já suaviza
      else rola += (Math.max(-0.5, Math.min(0.5, -curva * 0.55)) * (voando ? 1 : 0) - rola) * k;
      nariz2 += ((voando ? Math.max(-0.25, Math.min(0.25, -vy * 0.02)) - Math.min(1.8, vel) * 0.07 : 0) - nariz2) * k;
      corpo.rotation.set(nariz2, 0, rola);
      corpo.position.y = ESCALA_MOTO * (voando ? Math.sin(t * 3.1) * 0.03 : 0.05 + Math.sin(t * 1.7) * 0.04);   // parada: flutua de leve
      boostSuave += (boost - boostSuave) * Math.min(1, dt * 6);
      u.uT.value = t; u.uBoost.value = boostSuave;
      // chamas: principais crescem com a velocidade (e MUITO no boost); as de sustentação, com o voo; as de manobra, na curva
      props.forEach((p, i) => {
        const forca = p.tipo === "principal" ? (voando ? 0.3 + 0.7 * Math.min(1, vel) + 0.75 * boostSuave : 0.06)
          : p.tipo === "sustenta" ? (voando ? 0.65 + 0.35 * Math.min(1, Math.abs(vy) / 8) : 0.14)
          : (voando ? 0.1 + 0.9 * Math.max(0, -curva * p.lado) : 0.03);
        const tremor = 0.9 + 0.1 * Math.sin(t * 31 + i * 1.7) + 0.05 * Math.sin(t * 57 + i);
        p.chama.scale.set(1 + 0.25 * boostSuave * (p.tipo === "principal" ? 1 : 0), Math.max(0.02, p.tam * forca * tremor), 1 + 0.25 * boostSuave * (p.tipo === "principal" ? 1 : 0));
      });
      setas[-1]!.visible = seta === -1; setas[1]!.visible = seta === 1;
      // os AROS: o disco de energia gira com a velocidade e acende no voo
      if (voando || giroAro !== 0) { giroAro = (giroAro - dt * (2 + 14 * Math.min(1.8, vel))) % (Math.PI * 2); for (const d of discos) d.rotation.z = giroAro; }
      const alvoAro = voando ? 0.7 + 0.3 * boostSuave : 0.35; if (Math.abs(alvoAro - brilhoAro) > 0.005) { brilhoAro += (alvoAro - brilhoAro) * k; energia.opacity = brilhoAro; }
    },
    dispose() {
      g.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); const mt = m.material as THREE.Material | undefined; mt?.dispose?.(); });   // (a textura do disco é compartilhada: fica)
      g.removeFromParent();
    },
  };
}
