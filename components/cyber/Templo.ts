/**
 * Templo — a ESCADARIA em curva que sai do lado direito do deck do lounge, a MURALHA-VEIA colada nela e o TEMPLO lá no
 * fim (layout puro em lib/cyber/templo; colisão e piso em lib/cyber/ceu). Tudo no referencial da SALA do lounge, com
 * y = 0 no piso do pátio (quem monta põe o grupo na sala do lounge, dentro da ilha):
 *  - a escadaria: degraus flutuantes (instanciados) com a quina acesa, a espinha de luz por baixo e o guarda-corpo do
 *    lado de dentro da curva;
 *  - a MURALHA do lado de fora: uma parede alta e orgânica que sobe do abismo, com VEIAS de luz se ramificando nela e o
 *    "vaso" grosso no topo — o pulso corre do lounge pro templo, como sangue numa veia;
 *  - o TEMPLO: a laje (sem a montanha invertida embaixo — out/2026), o piso com a mandala dourada, o guarda-corpo de
 *    vidro, o pórtico da entrada, as BANDEIRINHAS de luz (São João) e a CAPELA — a irmã pequena da capela da Zaeon
 *    (pilares, a coroa acesa no alto, cúpula de vidro estrelada, tambor, 2ª cúpula, ponta e farol) — no meio dela o
 *    SIGILO DE METATRON no piso (o Cubo de Metatron: as 13 esferas da Fruta da Vida ligadas por todas as retas, girando
 *    devagar) e, do lado oposto à entrada, o DESKTOP da Examiner (lib/cyber/examiner). O sanfoneiro saiu (out/2026).
 * Leve: a muralha vira pele escura lisa (sem o shader de veias, o mais caro do templo) e as veias que descem nela saem.
 */
import * as THREE from "three";
import { DECK, ESCADARIA, MESA_EXAMINER, TEMPLO, alturaDaEscadaria, curvaDaEscadaria, entradaDoTemplo, mesaDaExaminer } from "@/lib/cyber/templo";
import { criarTempestade } from "./Tempestade";

export type TemploHandle = {
  group: THREE.Group; alvos: THREE.Object3D[]; atualizar(dt: number, t: number): void;
  /** a TEMPESTADE (o ritual do dono — lib/cyber/ritual): a intensidade das nuvens (0..1, 0 = céu limpo) e se os raios já
   *  estão caindo; quem manda é o engine, a cada quadro */
  tempestade(intensidade: number, raios: boolean): void;
  /** estoura um relâmpago na tempestade agora — caindo em `alvoMundo` (ex.: o buraco negro em cima do DJ) ou à toa */
  raioAgora(alvoMundo?: THREE.Vector3): void;
  dispose(): void;
};

/** o pulso de luz correndo ao longo de `vUv.x` (as veias e o vaso) */
function materialFluxo(cor: THREE.Color, n: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCor: { value: cor }, uN: { value: n } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT, uN; uniform vec3 uCor; varying vec2 vUv;
      void main(){
        float p = fract(vUv.x * uN - uT * 0.55);
        float pulso = smoothstep(0.0, 0.04, p) * smoothstep(0.4, 0.06, p);
        float miolo = 1.0 - abs(vUv.y - 0.5) * 1.6;
        gl_FragColor = vec4(uCor * (0.35 + 1.8 * pulso) * (0.6 + 0.6 * miolo) + vec3(1.0) * pulso * 0.25, 1.0);
      }`,
  });
}
/** a parede da MURALHA: pele escura com as veias ramificadas (ruído "ridged") pulsando rumo ao templo */
function materialMuralha(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uLen: { value: 80 } },
    side: THREE.DoubleSide,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT, uLen; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float ridged(vec2 p){ float s = 0.0, a = 0.55; for (int i = 0; i < 4; i++) { s += a * (1.0 - abs(n(p) * 2.0 - 1.0)); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
      void main(){
        vec2 p = vec2(vUv.x * uLen / 7.0, vUv.y * 3.2);
        float r = ridged(p + vec2(0.0, sin(p.x * 0.7) * 0.3));
        float veia = smoothstep(0.86, 0.98, r), halo = smoothstep(0.7, 0.95, r);
        float fluxo = 0.5 + 0.5 * sin((vUv.x * uLen - uT * 9.0) * 0.35 + vUv.y * 2.0);
        vec3 pele = mix(vec3(0.025, 0.012, 0.04), vec3(0.07, 0.025, 0.09), n(p * 3.0)) * (0.6 + 0.6 * vUv.y);
        vec3 corV = mix(vec3(0.95, 0.12, 0.45), vec3(0.75, 0.35, 1.0), vUv.y);
        vec3 c = pele + corV * (halo * 0.25 + veia * (0.6 + 1.6 * fluxo)) + vec3(1.0, 0.8, 0.95) * veia * fluxo * 0.25;
        c *= smoothstep(0.0, 0.18, vUv.y);   // some no abismo, embaixo
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}
/** o piso do templo: mandala dourada sobre pedra escura (canvas) */
function texturaPisoTemplo(): THREE.CanvasTexture {
  const S = 1024, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S / 2); gr.addColorStop(0, "#2a1a10"); gr.addColorStop(1, "#120b10"); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2); g.strokeStyle = "rgba(240,190,90,.75)"; g.lineWidth = 3;
  for (const r of [60, 120, 230, 330, 440, 500]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 120, Math.sin(a) * 120); g.lineTo(Math.cos(a) * 500, Math.sin(a) * 500); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1; }
  g.strokeStyle = "rgba(255,120,170,.6)";
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.ellipse(Math.cos(a) * 280, Math.sin(a) * 280, 52, 22, a, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = "rgba(120,240,200,.55)";
  for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2 + k * Math.PI / 6; const x = Math.cos(a) * 200, y = Math.sin(a) * 200; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** o SIGILO DE METATRON (canvas, fundo transparente): as 13 esferas da Fruta da Vida (o centro, o anel de 6 e o de 6
 *  mais longe) e as 78 retas ligando todos os centros — o Cubo de Metatron —, num duplo círculo de contorno */
function texturaMetatron(): THREE.CanvasTexture {
  const S = 1024, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d")!;
  g.translate(S / 2, S / 2); g.lineCap = "round";
  const u = S * 0.13, centros: [number, number][] = [[0, 0]];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; centros.push([Math.cos(a) * u * 1.15, Math.sin(a) * u * 1.15]); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; centros.push([Math.cos(a) * u * 2.3, Math.sin(a) * u * 2.3]); }
  const brilho = (cor: string, larg: number, desenhar: () => void) => { g.strokeStyle = cor; g.shadowColor = cor; g.shadowBlur = larg * 4; g.lineWidth = larg; desenhar(); g.shadowBlur = 0; };
  brilho("rgba(255,214,120,1)", 8, () => { for (const r of [S * 0.47, S * 0.455]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); } });
  brilho("rgba(160,240,255,1)", 6, () => { g.beginPath(); for (let i = 0; i < centros.length; i++) for (let j = i + 1; j < centros.length; j++) { g.moveTo(centros[i]![0], centros[i]![1]); g.lineTo(centros[j]![0], centros[j]![1]); } g.stroke(); });
  brilho("rgba(255,224,150,1)", 7, () => { for (const [x, y] of centros) { g.beginPath(); g.arc(x, y, u * 0.575, 0, Math.PI * 2); g.stroke(); } });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function criarTemplo(o: { low: boolean; paredeMat: THREE.Material; estrela?: THREE.Texture; /** caiu um raio da tempestade (mundo): o trovão */ aoTrovao?: (em: THREE.Vector3) => void }): TemploHandle {
  const g = new THREE.Group(); g.name = "templo";
  const alvos: THREE.Object3D[] = [], anim: ((dt: number, t: number) => void)[] = [], texs: THREE.Texture[] = [];
  const basica = (cor: number, op = 1, ad = false) => new THREE.MeshBasicMaterial({ color: cor, transparent: op < 1 || ad, opacity: op, blending: ad ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !ad });
  const { pts, len } = curvaDaEscadaria(), M = ESCADARIA, T = TEMPLO;
  const fora = (x: number, z: number) => Math.hypot(x, z) > 70.2 && Math.hypot(x - T.x, z - T.z) > T.r + 0.1;   // (o lounge tem 70 m)
  /** o ponto da curva a `s` m (interpolado) */
  const em = (s: number) => {
    let i = 0; while (i < pts.length - 2 && pts[i + 1]!.s < s) i++;
    const a = pts[i]!, b = pts[i + 1]!, u = Math.max(0, Math.min(1, (s - a.s) / Math.max(1e-6, b.s - a.s)));
    const tx = a.tx + (b.tx - a.tx) * u, tz = a.tz + (b.tz - a.tz) * u, n = Math.hypot(tx, tz) || 1;
    return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, tx: tx / n, tz: tz / n };
  };

  // ── a ESCADARIA: degraus flutuantes ao longo da curva (a quina de cada um acesa) ──
  const PASSO = 0.8, degraus: { x: number; z: number; y: number; giro: number }[] = [];
  for (let s = PASSO / 2; s < len; s += PASSO) { const p = em(s); if (!fora(p.x, p.z)) continue; degraus.push({ x: p.x, z: p.z, y: alturaDaEscadaria(s), giro: Math.atan2(p.tx, p.tz) }); }
  const pedra = new THREE.MeshStandardMaterial({ color: 0x1a1426, emissive: 0x150c28, emissiveIntensity: 0.6, roughness: 0.45, metalness: 0.5 });
  const geoDeg = new THREE.BoxGeometry(M.meia * 2, 0.5, PASSO + 0.04); geoDeg.translate(0, -0.25, 0);
  const geoQuina = new THREE.BoxGeometry(M.meia * 2 - 0.3, 0.04, 0.06);
  const deg = new THREE.InstancedMesh(geoDeg, pedra, degraus.length), quina = new THREE.InstancedMesh(geoQuina, basica(0xff7ab8, 0.85, true), degraus.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), um = new THREE.Vector3(1, 1, 1);
    degraus.forEach((d, i) => {
      q.setFromEuler(e.set(0, d.giro, 0));
      deg.setMatrixAt(i, m.compose(v.set(d.x, d.y + 0.14, d.z), q, um));
      const f = new THREE.Vector3(0, 0, -PASSO / 2 + 0.03).applyQuaternion(q);   // a quina de baixo (de quem sobe)
      quina.setMatrixAt(i, m.compose(v.set(d.x + f.x, d.y + 0.16, d.z + f.z), q, um));
    });
    for (const im of [deg, quina]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); g.add(im); } }
  alvos.push(deg);
  // a ESPINHA de luz por baixo da escadaria e o GUARDA-CORPO do lado de dentro da curva (o +lat)
  const linha = (lat: number, dy: number, s0 = 0, s1 = len) => { const out: THREE.Vector3[] = []; for (let s = s0; s <= s1; s += 1.5) { const p = em(s); out.push(new THREE.Vector3(p.x + p.tz * lat, alturaDaEscadaria(s) + dy, p.z - p.tx * lat)); } return new THREE.CatmullRomCurve3(out); };
  const espinha = new THREE.Mesh(new THREE.TubeGeometry(linha(0, -1.2), o.low ? 60 : 140, 0.5, 8, false), materialFluxo(new THREE.Color(0xff5fa8), len / 9)); g.add(espinha);
  // (o corrimão: só no trecho FORA do lounge e do templo)
  let sIni = 0, sFim = len; for (let s = 0; s < len; s += 0.5) { const p = em(s); if (fora(p.x, p.z)) { sIni = s; break; } }
  for (let s = len; s > 0; s -= 0.5) { const p = em(s); if (fora(p.x, p.z)) { sFim = s; break; } }
  const corrimao = new THREE.Mesh(new THREE.TubeGeometry(linha(M.meia + 0.35, 1.05, sIni, sFim), o.low ? 50 : 120, 0.07, 6, false), basica(0x66e6ff, 0.9, true)); g.add(corrimao);
  { const n = Math.floor((sFim - sIni) / 2.4), postes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 6), pedra, n), m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const s = sIni + i * 2.4 + 1, p = em(s), lat = M.meia + 0.35; postes.setMatrixAt(i, m.makeTranslation(p.x + p.tz * lat, alturaDaEscadaria(s) + 0.52, p.z - p.tx * lat)); }
    postes.instanceMatrix.needsUpdate = true; postes.computeBoundingSphere(); g.add(postes); }
  // o vidro do guarda-corpo (uma fita entre o piso e o corrimão)
  { const pos: number[] = [], uv: number[] = [], idx: number[] = [], lat = M.meia + 0.35; let k = 0;
    for (let s = sIni; s <= sFim; s += 1) { const p = em(s), y = alturaDaEscadaria(s), x = p.x + p.tz * lat, z = p.z - p.tx * lat; pos.push(x, y, z, x, y + 1.05, z); uv.push(s / len, 0, s / len, 1); if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k); k++; }
    const vg = new THREE.BufferGeometry(); vg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); vg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); vg.setIndex(idx); vg.computeVertexNormals();
    g.add(new THREE.Mesh(vg, o.paredeMat)); }

  // ── a MURALHA-VEIA (o lado de FORA da curva, o −lat): sobe do abismo até `alt` acima da escada, ondulando como pele ──
  const muro = materialMuralha(); muro.uniforms.uLen!.value = len;
  const muroLeve = new THREE.MeshBasicMaterial({ color: 0x14081c, side: THREE.DoubleSide });   // (leve: pele escura lisa)
  { const pos: number[] = [], uv: number[] = [], idx: number[] = [], A = M.muralha.alt; let k = 0;
    for (let s = Math.max(0, sIni - 2); s <= Math.min(len, sFim + 2); s += 0.8) {
      const p = em(s), y = alturaDaEscadaria(s), u = (s - sIni) / Math.max(1, sFim - sIni);
      const bojo = 0.45 * Math.sin(s * 0.33) + 0.25 * Math.sin(s * 0.9 + 1.3), lat = -(M.meia + 0.6 + bojo);
      const topo = y + A * (0.8 + 0.3 * Math.sin(Math.PI * Math.max(0, Math.min(1, u)))), base = y - 14;
      const x = p.x + p.tz * lat, z = p.z - p.tx * lat;
      pos.push(x, base, z, x, topo, z); uv.push(s / len, 0, s / len, 1);
      if (k) idx.push(2 * k - 2, 2 * k, 2 * k - 1, 2 * k - 1, 2 * k, 2 * k + 1); k++;
    }
    const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); mg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); mg.setIndex(idx); mg.computeVertexNormals();
    g.add(new THREE.Mesh(mg, o.low ? muroLeve : muro));
    // o VASO no topo (o tubo grosso por onde o pulso corre) e as VEIAS que descem pela parede, ramificando
    const topoPts: THREE.Vector3[] = []; for (let i = 0; i < pos.length; i += 12) topoPts.push(new THREE.Vector3(pos[i + 3]!, pos[i + 4]! + 0.4, pos[i + 5]!));
    const vasoMat = materialFluxo(new THREE.Color(0xff3c8c), len / 7);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(topoPts), o.low ? 60 : 160, 1.0, 10, false), vasoMat));
    const veiaMat = materialFluxo(new THREE.Color(0xc46bff), 3);
    const nV = o.low ? 0 : 12;   // (leve: sem as veias descendo a parede)
    for (let v = 0; v < nV; v++) {
      const s0 = sIni + ((v + 0.5) / nV) * (sFim - sIni), out: THREE.Vector3[] = [];
      for (let j = 0; j <= 8; j++) {   // desce do vaso, serpenteando pra frente (rumo ao templo)
        const s = Math.min(len, s0 + j * 1.1 + Math.sin(v * 3 + j) * 0.6), p = em(s), y = alturaDaEscadaria(s), bojo = 0.45 * Math.sin(s * 0.33) + 0.25 * Math.sin(s * 0.9 + 1.3), lat = -(M.meia + 0.45 + bojo);
        out.push(new THREE.Vector3(p.x + p.tz * lat, y + A * 0.8 * (1 - j / 8) - j * 0.4, p.z - p.tx * lat));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(out), 24, 0.16 + (v % 3) * 0.05, 6, false), veiaMat));
    }
    anim.push((_, t) => { muro.uniforms.uT!.value = t; vasoMat.uniforms.uT!.value = t; veiaMat.uniforms.uT!.value = t * 1.3; (espinha.material as THREE.ShaderMaterial).uniforms.uT!.value = t; });
  }

  // ── o TEMPLO: a laje + o aro (como as plataformas das salas) ──
  const tg = new THREE.Group(); tg.position.set(T.x, T.h, T.z); g.add(tg);
  const ouro = new THREE.MeshStandardMaterial({ color: 0xd8b04a, roughness: 0.3, metalness: 0.8, emissive: 0x4a3008, emissiveIntensity: 0.5 });
  const laje = new THREE.Mesh(new THREE.CylinderGeometry(T.r + 1, T.r - 1, 1.8, o.low ? 48 : 96), new THREE.MeshStandardMaterial({ color: 0x1a1020, emissive: 0x2a1030, emissiveIntensity: 0.4, roughness: 0.5, metalness: 0.3 }));
  laje.position.y = -0.9; tg.add(laje);
  // (a montanha invertida embaixo do templo saiu — out/2026)
  const aro = new THREE.Mesh(new THREE.TorusGeometry(T.r + 1, 0.3, 6, o.low ? 64 : 128), basica(0xffb46b, 0.8, true)); aro.rotation.x = Math.PI / 2; aro.position.y = -0.4; tg.add(aro);
  // o piso com a mandala
  const texPiso = texturaPisoTemplo(); texs.push(texPiso);
  const piso = new THREE.Mesh(new THREE.CircleGeometry(T.r, o.low ? 48 : 96), new THREE.MeshStandardMaterial({ map: texPiso, roughness: 0.55, metalness: 0.3, emissive: 0xffffff, emissiveMap: texPiso, emissiveIntensity: 0.35 }));
  piso.rotation.x = -Math.PI / 2; piso.position.y = 0.12; tg.add(piso); alvos.push(piso);
  // o guarda-corpo de vidro em volta (com a ENTRADA da escadaria) + os aros dourados
  const ent = entradaDoTemplo(), th = Math.PI / 2 - ent.ang;   // (o θ do CylinderGeometry: x = sen θ, z = cos θ)
  const parede = new THREE.Mesh(new THREE.CylinderGeometry(T.r, T.r, 1.4, o.low ? 48 : 96, 1, true, th + ent.meia, Math.PI * 2 - 2 * ent.meia), o.paredeMat); parede.position.y = 0.7; tg.add(parede);
  for (const y of [1.4, 0.2]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(T.r + 0.02, T.r + 0.02, 0.12, o.low ? 48 : 96, 1, true, th + ent.meia, Math.PI * 2 - 2 * ent.meia), basica(0xffc46b, 0.85, true)); a.position.y = y; tg.add(a); }
  // o PÓRTICO da entrada (2 colunas douradas + a verga com um sol de luz)
  { const ex = Math.cos(ent.ang), ez = Math.sin(ent.ang), lx = -ez, lz = ex, w = T.r * ent.meia, AP = 10;
    for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, AP, 10), ouro); c.position.set(ex * T.r + lx * w * sx, AP / 2, ez * T.r + lz * w * sx); tg.add(c); }
    const verga = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 1.6, 0.8, 0.9), ouro); verga.position.set(ex * T.r, AP, ez * T.r); verga.rotation.y = Math.atan2(lx, lz) + Math.PI / 2; tg.add(verga);
    const sol = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 40), basica(0xffd36b, 0.95, true)); sol.position.set(ex * T.r, AP + 2, ez * T.r); sol.rotation.y = Math.atan2(ex, ez); tg.add(sol);
    anim.push((_, t) => { sol.rotation.z = t * 0.6; }); }

  // ── a CAPELA (a irmã pequena da capela da Zaeon) ──
  const C = T.capela, RC = C.r + 1, ACH = C.achata;
  const torreMat = new THREE.MeshStandardMaterial({ color: 0x0c1a30, emissive: 0x1a3a70, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.5 });
  { const pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(C.pilarR * 0.75, C.pilarR, C.altura, 10), torreMat, C.pilares), m = new THREE.Matrix4();
    for (let i = 0; i < C.pilares; i++) { const a = (i / C.pilares) * Math.PI * 2 + Math.PI / C.pilares; pil.setMatrixAt(i, m.makeTranslation(Math.cos(a) * C.r, C.altura / 2, Math.sin(a) * C.r)); }
    pil.instanceMatrix.needsUpdate = true; pil.computeBoundingSphere(); tg.add(pil); }
  const coroaMat = new THREE.MeshStandardMaterial({ color: 0x0c1a30, emissive: 0x66c8ff, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.4 });
  { const t = new THREE.Mesh(new THREE.TorusGeometry(C.r, 0.6, 8, o.low ? 64 : 128), coroaMat); t.rotation.x = Math.PI / 2; t.position.y = C.altura; tg.add(t); }   // (só a do alto: o anel no chão saiu — o dono, out/2026)
  const domoMat = new THREE.MeshStandardMaterial({ color: 0x0a1830, emissive: 0x2a4a80, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(RC, o.low ? 28 : 48, o.low ? 12 : 20, 0, Math.PI * 2, 0, Math.PI / 2), domoMat); cupula.position.y = C.altura; cupula.scale.y = ACH; tg.add(cupula);
  { const lin: number[] = [], NS = 10; for (let i = 0; i < C.pilares; i++) { const a = (i / C.pilares) * Math.PI * 2 + Math.PI / C.pilares;
      for (let k = 0; k < NS; k++) { const p0 = (k / NS) * 1.3, p1 = ((k + 1) / NS) * 1.3; lin.push(Math.cos(a) * Math.cos(p0) * RC, C.altura + Math.sin(p0) * RC * ACH, Math.sin(a) * Math.cos(p0) * RC, Math.cos(a) * Math.cos(p1) * RC, C.altura + Math.sin(p1) * RC * ACH, Math.sin(a) * Math.cos(p1) * RC); } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(lin, 3)); tg.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }))); }
  if (o.estrela) { const N = o.low ? 60 : 140, pv = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, ph = Math.random() * Math.PI / 2, r = RC - 0.5; pv[i * 3] = Math.cos(a) * Math.cos(ph) * r; pv[i * 3 + 1] = C.altura + Math.sin(ph) * r * ACH; pv[i * 3 + 2] = Math.sin(a) * Math.cos(ph) * r; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pv, 3)); tg.add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.5, map: o.estrela, color: 0xffe2b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); }
  const yT0 = C.altura + Math.sqrt(RC * RC - C.tamborR * C.tamborR) * ACH - 0.5;
  const tambor = new THREE.Mesh(new THREE.CylinderGeometry(C.tamborR * 0.92, C.tamborR, C.tamborAlt, o.low ? 16 : 24, 1, true), domoMat); tambor.position.y = yT0 + C.tamborAlt / 2; tg.add(tambor);
  const anelT = new THREE.Mesh(new THREE.TorusGeometry(C.tamborR * 0.92, 0.35, 8, 48), coroaMat); anelT.rotation.x = Math.PI / 2; anelT.position.y = yT0 + C.tamborAlt; tg.add(anelT);
  const cup2 = new THREE.Mesh(new THREE.SphereGeometry(C.tamborR * 0.92, o.low ? 16 : 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), domoMat); cup2.position.y = yT0 + C.tamborAlt; cup2.scale.y = 0.9; tg.add(cup2);
  const yPin = yT0 + C.tamborAlt + C.tamborR * 0.92 * 0.9 - 0.3;
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(1.6, C.pontaLen, 6), new THREE.MeshStandardMaterial({ color: 0x1a1206, emissive: 0xffc46b, emissiveIntensity: 1.1, roughness: 0.2, flatShading: true })); ponta.position.y = yPin + C.pontaLen / 2; tg.add(ponta);
  const feixeFarol = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 2.2, 70, 12, 1, true), basica(0xffd9a0, 0.14, true)); feixeFarol.position.y = yPin + C.pontaLen + 36; tg.add(feixeFarol);
  // a TEMPESTADE em volta da ponta (as nuvens ficam no terço de cima da ponta; a ponta fura e o farol sai por cima)
  const tempestade = criarTempestade({ low: o.low, yBase: yPin + C.pontaLen * 0.25, yTopo: yPin + C.pontaLen * 0.8, raioMax: 95, alvoPonta: new THREE.Vector3(0, yPin + C.pontaLen * 0.7, 0) });
  tg.add(tempestade.group); tempestade.group.traverse((n) => { n.userData.semLote = true; });
  tempestade.definir(0, false);   // céu limpo até o dono ligar o ritual
  const ondeCaiu = new THREE.Vector3();

  // ── o SIGILO DE METATRON no centro da capela: o desenho no piso (girando devagar) + um halo fraco por baixo ──
  const texSig = texturaMetatron(); texs.push(texSig);
  const sigMat = new THREE.MeshBasicMaterial({ map: texSig, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const sigilo = new THREE.Mesh(new THREE.CircleGeometry(T.sigilo.r, 64), sigMat); sigilo.rotation.x = -Math.PI / 2; sigilo.position.y = 0.16; sigilo.renderOrder = 2; tg.add(sigilo);
  const sigHalo = o.low ? null : new THREE.Mesh(new THREE.CircleGeometry(T.sigilo.r * 1.08, 48), basica(0xffc46b, 0.07, true));
  if (sigHalo) { sigHalo.rotation.x = -Math.PI / 2; sigHalo.position.y = 0.14; tg.add(sigHalo); }

  // ── o DESKTOP da Examiner (do lado oposto à entrada): a mesa escura com a quina acesa, dois monitores e o teclado de
  //    luz — virado pro centro (ela trabalha de costas pro sigilo) ──
  { const m = mesaDaExaminer(), M = MESA_EXAMINER, dg = new THREE.Group();
    dg.position.set(m.x - T.x, 0.12, m.z - T.z); dg.rotation.y = Math.atan2(-Math.cos(m.ang), -Math.sin(m.ang)); tg.add(dg);   // o +z da mesa aponta pro centro
    const escuro = new THREE.MeshStandardMaterial({ color: 0x14101c, roughness: 0.35, metalness: 0.7, emissive: 0x0c0818, emissiveIntensity: 0.6 });
    const tampo = new THREE.Mesh(new THREE.BoxGeometry(M.larg, 0.08, M.prof), escuro); tampo.position.y = M.alt; dg.add(tampo);
    for (const sx of [-1, 1]) { const pe = new THREE.Mesh(new THREE.BoxGeometry(0.08, M.alt, M.prof * 0.8), escuro); pe.position.set(sx * (M.larg / 2 - 0.1), M.alt / 2, 0); dg.add(pe); }
    const quinaM = new THREE.Mesh(new THREE.BoxGeometry(M.larg, 0.025, 0.025), basica(0xff7ab8, 0.9, true)); quinaM.position.set(0, M.alt + 0.03, M.prof / 2); dg.add(quinaM);
    const telaMat = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    for (const [x, giro] of [[-0.55, 0.22], [0.55, -0.22]] as const) {
      const mon = new THREE.Group(); mon.position.set(x, M.alt + 0.42, -M.prof / 2 + 0.22); mon.rotation.y = giro; dg.add(mon);
      const moldura = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.04), escuro); mon.add(moldura);
      const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.54), telaMat); tela.position.z = 0.025; mon.add(tela);
      const haste = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), escuro); haste.position.set(0, -0.42, -0.02); mon.add(haste);
    }
    const teclado = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), basica(0x9fe8ff, 0.5, true)); teclado.rotation.x = -Math.PI / 2; teclado.position.set(0, M.alt + 0.05, 0.12); dg.add(teclado);
    anim.push((_, t) => { telaMat.opacity = 0.75 + 0.1 * Math.sin(t * 2.3); (teclado.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.2 * Math.max(0, Math.sin(t * 11)); });
    alvos.push(tampo); }

  // ── as BANDEIRINHAS de luz (São João): cordões do topo dos pilares até o guarda-corpo, bandeirinhas coloridas ──
  { const cores = [0xff5a5a, 0xffd36b, 0x5aff8a, 0x45d6ff, 0xff6ad5, 0xffa64d], bandeiras: { p: THREE.Vector3; q: THREE.Quaternion; c: number }[] = [], fios: number[] = [];
    const nCord = o.low ? 8 : 16;
    for (let i = 0; i < nCord; i++) {
      const a = (i / nCord) * Math.PI * 2 + Math.PI / C.pilares, a2 = a + 0.18;
      const de = new THREE.Vector3(Math.cos(a) * C.r, C.altura - 1, Math.sin(a) * C.r), para = new THREE.Vector3(Math.cos(a2) * (T.r - 1), 5, Math.sin(a2) * (T.r - 1));
      const N = 14, ant = new THREE.Vector3();
      for (let k = 0; k <= N; k++) {
        const u = k / N, p = de.clone().lerp(para, u); p.y -= Math.sin(u * Math.PI) * 2.2;   // a barriga do cordão
        if (k) fios.push(ant.x, ant.y, ant.z, p.x, p.y, p.z);
        if (k && k < N) { const dir = p.clone().sub(ant).normalize(), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), new THREE.Vector3(-dir.z, 0, dir.x), new THREE.Vector3(0, 1, 0))); bandeiras.push({ p: p.clone(), q, c: cores[(i + k) % cores.length]! }); }
        ant.copy(p);
      }
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(fios, 3));
    tg.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.45 })));
    const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.Float32BufferAttribute([-0.42, 0, 0, 0.42, 0, 0, 0, -0.75, 0], 3)); bg.computeVertexNormals();
    const bm = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }), bandeiras.length), mm = new THREE.Matrix4(), um = new THREE.Vector3(1, 1, 1), cc = new THREE.Color();
    bandeiras.forEach((b, i) => { bm.setMatrixAt(i, mm.compose(b.p, b.q, um)); bm.setColorAt(i, cc.setHex(b.c)); });
    bm.instanceMatrix.needsUpdate = true; bm.computeBoundingSphere(); tg.add(bm); }

  // ── a laje da ENTRADA (o patamar entre a escada e o templo é o próprio templo) e o patamar do lado do lounge ──
  { const p = em(Math.max(0, sIni - 0.2)), w = new THREE.Mesh(new THREE.BoxGeometry(M.meia * 2, 0.5, 1.6), pedra); w.position.set(p.x, DECK.h - 0.11, p.z); w.rotation.y = Math.atan2(p.tx, p.tz); g.add(w); alvos.push(w); }

  return {
    group: g, alvos,
    tempestade: (i, raios) => tempestade.definir(i, raios),
    raioAgora: (alvoMundo) => { if (!alvoMundo) { tempestade.raioAgora(); return; } tg.updateMatrixWorld(); tempestade.raioAgora(tg.worldToLocal(alvoMundo.clone())); },
    atualizar(dt, t) {
      sigilo.rotation.z = t * 0.05; if (sigHalo) (sigHalo.material as THREE.MeshBasicMaterial).opacity = 0.05 + 0.03 * Math.sin(t * 0.9);
      { const c = tempestade.atualizar(t); if (c && o.aoTrovao) { tg.updateMatrixWorld(); o.aoTrovao(ondeCaiu.copy(c).applyMatrix4(tg.matrixWorld)); } }
      for (const f of anim) f(dt, t);
    },
    dispose() { tempestade.dispose(); muroLeve.dispose(); muro.dispose(); for (const x of texs) x.dispose(); g.traverse((n) => { const m = n as THREE.Mesh; m.geometry?.dispose(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mt)) mt.forEach((x) => x.dispose()); else mt?.dispose(); }); g.removeFromParent(); },
  };
}
