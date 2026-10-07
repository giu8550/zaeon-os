/**
 * Campus — os OUTROS CAMPI flutuantes (UFC, Unifor, UECE — lib/cyber/campi.ts) na MESMA fundação da UNILAB (disco com
 * grade de luz, aro aceso na borda, base de cristal com propulsores antigravidade, ELEVADOR DE LUZ), cada um com a cara
 * dele (estilo do layout + cores):
 *  - os PRÉDIOS são caixas INSTANCIADAS com um shader de JANELAS procedural (as janelas saem da posição na fachada,
 *    acesas/apagadas por célula): UMA chamada de desenho por tipo (bloco, vidro, torre), mesmo com centenas de prédios;
 *  - o MARCO (Reitoria) tem o LOGO oficial nas quatro faces; os prédios com nome têm placa (logo + nome);
 *  - ruas, parques, praças e água são planos instanciados; árvores instanciadas (tronco + copa);
 *  - o PORTAL da chegada (do elevador de luz) com o logo.
 * Custo pensado: ~40–60 chamadas por campus, tudo estático (lotes) menos os propulsores e o elevador.
 */
import * as THREE from "three";
import { CAMPI, layoutDoCampus, naEntrada, type IdCampus, type Predio } from "@/lib/cyber/campi";
import { PLATAFORMAS } from "@/lib/cyber/plataformas";
import { glowTex } from "./CenaCosmica";
import { criarElevadorDeLuz } from "./ElevadorDeLuz";
import { liberar } from "./Landmark";

export type CampusHandle = {
  group: THREE.Group;
  /** o que a câmera não atravessa (os prédios) */
  alvosCamera: THREE.Object3D[];
  atualizar(dt: number, t: number): void;
  dispose(): void;
};

/** o material dos PRÉDIOS: cor da parede com luz difusa simples + JANELAS procedurais (por andar de 3,6 m e vão de
 *  2,4 m ao longo da fachada; uma parte acesa em tom quente, o resto vidro frio) + friso de luz no topo. Instancing. */
function materialPredio(o: { base: number; vidro: number; luz: number; friso: number; acesas: number; faixa?: boolean }) {
  return new THREE.ShaderMaterial({
    uniforms: { uBase: { value: new THREE.Color(o.base) }, uVidro: { value: new THREE.Color(o.vidro) }, uLuz: { value: new THREE.Color(o.luz) }, uFriso: { value: new THREE.Color(o.friso) }, uAcesas: { value: o.acesas }, uFaixa: { value: o.faixa ? 1 : 0 } },
    vertexShader: `
      varying vec3 vW; varying vec3 vN; varying float vTopo; varying float vAlt;
      void main() {
        vec4 p = vec4(position, 1.0); vec3 n = normal; float alt = 1.0;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; n = mat3(instanceMatrix) * n; alt = length(instanceMatrix[1].xyz);
        #endif
        vec4 w = modelMatrix * p; vW = w.xyz; vN = normalize(mat3(modelMatrix) * n);
        vTopo = position.y + 0.5; vAlt = alt;   // 0 no chão do prédio, 1 no topo; a altura (m)
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uBase, uVidro, uLuz, uFriso; uniform float uAcesas, uFaixa;
      varying vec3 vW; varying vec3 vN; varying float vTopo; varying float vAlt;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 n = normalize(vN);
        float dif = 0.42 + 0.58 * max(0.0, dot(n, normalize(vec3(0.35, 0.8, 0.45))));
        vec3 c = uBase * dif;
        float y = vTopo * vAlt;   // altura no prédio (m)
        if (abs(n.y) < 0.5) {
          vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
          float u = dot(vW, t), fu = fract(u / 2.4), fv = fract(y / 3.6);
          float jan = uFaixa > 0.5
            ? step(0.3, fv) * step(fv, 0.85)                                     // faixas de vidro (fachada contínua)
            : step(0.16, fu) * step(fu, 0.84) * step(0.28, fv) * step(fv, 0.82);  // janelas em grade
          jan *= step(1.2, y) * step(y, vAlt - 1.0);
          float acesa = step(1.0 - uAcesas, h(vec2(floor(u / 2.4), floor(y / 3.6)) + floor(vW.xz / 37.0)));
          c = mix(c, mix(uVidro * (0.55 + 0.3 * dif), uLuz, acesa), jan);
          c += uFriso * smoothstep(0.35, 0.0, abs(y - (vAlt - 0.35)));   // friso de luz no topo
        } else c *= 0.7;   // telhado
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export function criarCampus(id: IdCampus, o: { low: boolean }): CampusHandle {
  const C = CAMPI[id], L = layoutDoCampus(id), { low } = o, R = C.r;
  const raiz = new THREE.Group(); raiz.position.set(C.centro.x, C.y, C.centro.z);
  const alvosCamera: THREE.Object3D[] = [], texturas: THREE.Texture[] = [], anim: ((dt: number, t: number) => void)[] = [];
  const add = <T extends THREE.Object3D>(x: T, cam = false) => { raiz.add(x); if (cam) alvosCamera.push(x); return x; };
  const tela = (w: number, h: number, pintar: (g: CanvasRenderingContext2D, w: number, h: number) => void) => { const c = document.createElement("canvas"); c.width = w; c.height = h; pintar(c.getContext("2d")!, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texturas.push(t); return t; };
  const cssCor = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
  /** textura com o LOGO (redesenha quando a imagem chega); logo escuro (UFC) → tingido de claro */
  const comLogo = (w: number, h: number, pintar: (g: CanvasRenderingContext2D, w: number, h: number, logo: CanvasImageSource | null, lw: number, lh: number) => void) => {
    const t = tela(w, h, (g, ww, hh) => pintar(g, ww, hh, null, 0, 0));
    if (typeof Image !== "undefined") {
      const img = new Image();
      img.onload = () => {
        const lw = img.naturalWidth || 600, lh = img.naturalHeight || 250;
        let fonte: CanvasImageSource = img;
        if (C.logoEscuro) { const k = document.createElement("canvas"); k.width = lw; k.height = lh; const kg = k.getContext("2d")!; kg.drawImage(img, 0, 0, lw, lh); kg.globalCompositeOperation = "source-in"; kg.fillStyle = "#f4f8ff"; kg.fillRect(0, 0, lw, lh); fonte = k; }
        const c = t.image as HTMLCanvasElement, g = c.getContext("2d")!; g.clearRect(0, 0, c.width, c.height); pintar(g, c.width, c.height, fonte, lw, lh); t.needsUpdate = true;
      };
      img.src = C.logo;
    }
    return t;
  };
  const logoEm = (g: CanvasRenderingContext2D, img: CanvasImageSource, lw: number, lh: number, cx: number, cy: number, maxW: number, maxH: number) => { const k = Math.min(maxW / lw, maxH / lh), w = lw * k, h = lh * k; g.drawImage(img, cx - w / 2, cy - h / 2, w, h); };
  const mx = new THREE.Matrix4(), mq = new THREE.Quaternion(), ms = new THREE.Vector3(), mp = new THREE.Vector3(), eixoY = new THREE.Vector3(0, 1, 0);
  /** InstancedMesh a partir de [cx, cy, cz, sx, sy, sz, giroY?] */
  const instancias = (geo: THREE.BufferGeometry, lista: number[][], mat: THREE.Material, cam = false) => {
    if (!lista.length) { geo.dispose(); return null; }
    const im = new THREE.InstancedMesh(geo, mat, lista.length);
    lista.forEach((c, i) => { mq.setFromAxisAngle(eixoY, c[6] ?? 0); im.setMatrixAt(i, mx.compose(mp.set(c[0]!, c[1]!, c[2]!), mq, ms.set(c[3]!, c[4]!, c[5]!))); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); return add(im, cam);
  };
  const sofis = C.estilo === "sofisticado";

  // ── a FUNDAÇÃO (a mesma da UNILAB): disco com grade de luz, casca, aros, base de cristal, propulsores ──
  const friso = new THREE.MeshBasicMaterial({ color: C.cores.friso, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const seg = low ? 64 : 128, cel = sofis ? 10 : 8;
  const grade = tela(512, 512, (g, w, h) => {
    g.fillStyle = sofis ? "#3a3c46" : "#0d1630"; g.fillRect(0, 0, w, h);   // Unifor: pedra clara quente (pegada sofisticada)
    g.strokeStyle = sofis ? "rgba(255,226,168,.32)" : `${cssCor(C.cores.friso)}38`; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * w / 8, 0); g.lineTo(i * w / 8, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8); g.stroke(); }
  });
  grade.wrapS = grade.wrapT = THREE.RepeatWrapping; grade.repeat.set(R / cel, R / cel);
  const piso = add(new THREE.Mesh(new THREE.CircleGeometry(R, seg), new THREE.MeshStandardMaterial({ map: grade, roughness: 0.55, metalness: 0.4, emissive: sofis ? 0x2a2620 : 0x0a1430, emissiveIntensity: 0.5 })));
  piso.rotation.x = -Math.PI / 2; piso.position.y = 0.03;
  const pedra = new THREE.MeshStandardMaterial({ color: 0x141e38, roughness: 0.28, metalness: 0.75, emissive: 0x0b1a3c, emissiveIntensity: 0.65 });
  const casca = add(new THREE.Mesh(new THREE.CylinderGeometry(R, R - 2, C.espessura * 0.25, seg, 1, true), pedra)); casca.position.y = -C.espessura * 0.125;
  const aroBorda = add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.45, 6, seg), friso)); aroBorda.rotation.x = Math.PI / 2; aroBorda.position.y = 0.1;
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x0a1226, roughness: 0.3, metalness: 0.5, emissive: 0x1a2f6a, emissiveIntensity: 0.55, flatShading: true });
  const altCone = Math.min(220, R * 0.6), cone = add(new THREE.Mesh(new THREE.ConeGeometry(R - 3, altCone, low ? 10 : 18, 3), baseMat)); cone.rotation.x = Math.PI; cone.position.y = -C.espessura * 0.25 - altCone / 2;
  for (let k = 0; k < (low ? 4 : 7); k++) { const a = (k / 7) * Math.PI * 2 + 0.4, hh = altCone * (0.5 + (k % 2) * 0.2), c = add(new THREE.Mesh(new THREE.ConeGeometry(R * (0.17 + (k % 3) * 0.05), hh, 7), baseMat)); c.rotation.x = Math.PI; c.position.set(Math.cos(a) * R * 0.55, -C.espessura * 0.25 - hh / 2 - 0.5, Math.sin(a) * R * 0.55); }
  const texAnti = glowTex("rgba(185,140,255,.95)", "rgba(102,230,255,.25)"); texturas.push(texAnti);
  const antis: THREE.Sprite[] = [], nAnti = R > 300 ? 12 : 8;
  for (let k = 0; k < nAnti; k++) {
    const a = (k / nAnti) * Math.PI * 2, x = Math.cos(a) * R * 0.78, z = Math.sin(a) * R * 0.78;
    const anel = add(new THREE.Mesh(new THREE.TorusGeometry(R * 0.04, R * 0.004, 6, 32), friso)); anel.rotation.x = Math.PI / 2; anel.position.set(x, -C.espessura * 0.25 - 1, z);
    const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: texAnti, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); s.position.set(x, -C.espessura * 0.25 - 4, z); s.scale.setScalar(R * 0.15); antis.push(s);
  }
  anim.push((_, t) => antis.forEach((s, i) => { s.material.opacity = 0.55 + 0.35 * Math.sin(t * 1.6 + i); }));
  // ELEVADOR DE LUZ (do lado da praça)
  const elev = PLATAFORMAS[id], lc = { x: elev.anelChao.x - C.centro.x, z: elev.anelChao.z - C.centro.z }, ld = { x: elev.anelDisco.x - C.centro.x, z: elev.anelDisco.z - C.centro.z };
  anim.push(criarElevadorDeLuz(raiz, { chao: { ...lc, r: elev.anelChao.r, y: -C.y }, disco: { ...ld, r: elev.anelDisco.r }, low, cor: C.cores.friso }));

  // ── o CHÃO: ruas, parques, praças, água ──
  const ruaMat = new THREE.MeshStandardMaterial({ color: sofis ? 0x2a2f3a : 0x0a0f1c, roughness: 0.9, metalness: 0.1, emissive: 0x05080f, emissiveIntensity: 0.4 });
  const gramaMat = new THREE.MeshStandardMaterial({ color: 0x0c3a32, roughness: 1, emissive: 0x0b4a3c, emissiveIntensity: 0.5 });
  const pracaMat = new THREE.MeshStandardMaterial({ color: sofis ? 0xd9d2c0 : 0x24304e, roughness: 0.6, metalness: 0.2, emissive: sofis ? 0x2a2418 : 0x0c1630, emissiveIntensity: 0.4 });
  const aguaMat = new THREE.MeshStandardMaterial({ color: 0x0d3a66, roughness: 0.05, metalness: 0.6, emissive: 0x1a5aa0, emissiveIntensity: 0.55, transparent: true, opacity: 0.92 });
  const plano = (y: number) => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; };
  const porTipo = (tipo: string, y: number) => L.areas.flatMap((a) => (a.tipo === tipo && "lx" in a ? [[a.x, y, a.z, a.lx, 1, a.lz, a.rot]] : []));
  instancias(plano(0), porTipo("rua", 0.05), ruaMat);
  instancias(plano(0), porTipo("parque", 0.06), gramaMat);
  instancias(plano(0), porTipo("praca", 0.07), pracaMat);
  // faixa central de luz nas ruas (UFC)
  if (C.estilo === "cidade") instancias(plano(0), porTipo("rua", 0.09).map((v) => (v[3]! > v[5]! ? [v[0]!, v[1]!, v[2]!, v[3]!, 1, 0.3, v[6]!] : [v[0]!, v[1]!, v[2]!, 0.3, 1, v[5]!, v[6]!])), friso);
  for (const a of L.areas) {
    if (a.tipo === "aguaR") { const m = add(new THREE.Mesh(new THREE.CircleGeometry(a.r, low ? 32 : 64), aguaMat)); m.rotation.x = -Math.PI / 2; m.position.set(a.x, 0.4, a.z); const borda = add(new THREE.Mesh(new THREE.TorusGeometry(a.r, 0.3, 6, low ? 48 : 96), new THREE.MeshBasicMaterial({ color: C.cores.detalhe }))); borda.rotation.x = Math.PI / 2; borda.position.set(a.x, 0.45, a.z); }
    if (a.tipo === "pracaR") { const m = add(new THREE.Mesh(new THREE.RingGeometry(48, a.r, low ? 48 : 96), pracaMat)); m.rotation.x = -Math.PI / 2; m.position.set(a.x, 0.07, a.z); }
  }

  // ── os PRÉDIOS (instanciados por tipo, janelas no shader) ──
  const cores = C.cores, ehUfc = C.estilo === "cidade";
  const matBloco = materialPredio({ base: cores.predio, vidro: cores.vidro, luz: 0xffd9a0, friso: cores.friso, acesas: ehUfc ? 0.35 : 0.25 });
  const matVidro = materialPredio({ base: sofis ? 0xf2f4f8 : 0x1b2c4e, vidro: cores.vidro, luz: 0xfff0c8, friso: sofis ? cores.detalhe : cores.friso, acesas: 0.3, faixa: true });
  const matTorre = materialPredio({ base: sofis ? 0xdfe5ee : 0x101a30, vidro: cores.vidro, luz: 0xbfe6ff, friso: sofis ? cores.detalhe : cores.friso, acesas: 0.45, faixa: sofis });
  const caixa = () => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; };   // base no chão
  const lista = (tipo: Predio["tipo"]) => L.predios.filter((p) => p.tipo === tipo).map((p) => [p.x, 0, p.z, p.lx, p.alt, p.lz, p.rot]);
  instancias(caixa(), lista("bloco"), matBloco, true);
  instancias(caixa(), lista("vidro"), matVidro, true);
  instancias(caixa(), lista("torre"), matTorre, true);
  // coroamento das torres: uma "coroa" de luz (anel fino) em cima
  instancias(new THREE.BoxGeometry(1, 1, 1), L.predios.filter((p) => p.tipo === "torre").map((p) => [p.x, p.alt + 0.6, p.z, p.lx * 0.7, 1.2, p.lz * 0.7, p.rot]), friso);

  // ── o MARCO (Reitoria): prédio alto com o LOGO nas 4 faces + agulha de luz ──
  const texLogoFace = comLogo(1024, 512, (g, w, h, logo, lw, lh) => {
    g.fillStyle = sofis ? "rgba(20,24,34,.92)" : "rgba(6,12,30,.92)"; g.fillRect(0, 0, w, h);
    g.strokeStyle = cssCor(sofis ? cores.detalhe : cores.friso); g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
    if (logo) logoEm(g, logo, lw, lh, w / 2, h / 2, w - 120, h - 100); else { g.fillStyle = "#fff"; g.font = "bold 160px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(C.sigla, w / 2, h / 2); }
  });
  for (const p of L.predios.filter((q) => q.tipo === "marco")) {
    const m = add(new THREE.Mesh(caixa(), matTorre), true); m.scale.set(p.lx, p.alt, p.lz); m.position.set(p.x, 0, p.z); m.rotation.y = p.rot;
    const placaMat = new THREE.MeshBasicMaterial({ map: texLogoFace, transparent: true });
    for (let f = 0; f < 4; f++) {
      const a = p.rot + (f * Math.PI) / 2, larg = (f % 2 ? p.lz : p.lx) * 0.86, d = (f % 2 ? p.lx : p.lz) / 2 + 0.08;
      const pl = add(new THREE.Mesh(new THREE.PlaneGeometry(larg, larg / 2), placaMat)); pl.position.set(p.x + Math.sin(a) * d, p.alt * 0.78, p.z + Math.cos(a) * d); pl.rotation.y = a;
    }
    const agulha = add(new THREE.Mesh(new THREE.ConeGeometry(Math.min(p.lx, p.lz) * 0.12, p.alt * 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: sofis ? cores.detalhe : cores.friso, emissiveIntensity: 1.4 }))); agulha.position.set(p.x, p.alt + p.alt * 0.175, p.z);
  }

  // ── PLACAS dos prédios com nome: totem no chão em frente (logo pequeno + nome) — virada pro centro do campus ──
  for (const p of L.predios.filter((q) => q.nome && q.tipo !== "marco")) {
    const tex = comLogo(512, 256, (g, w, h, logo, lw, lh) => {
      g.fillStyle = sofis ? "rgba(245,242,234,.95)" : "rgba(8,14,32,.9)"; g.fillRect(0, 0, w, h);
      g.fillStyle = cssCor(sofis ? cores.detalhe : cores.friso); g.fillRect(0, h - 10, w, 10);
      if (logo && !sofis) logoEm(g, logo, lw, lh, w / 2, h * 0.32, w - 120, h * 0.38);
      g.fillStyle = sofis ? "#1c2230" : "#eaf6ff"; g.textAlign = "center"; g.textBaseline = "middle";
      let tam = 40; g.font = `600 ${tam}px sans-serif`; while (g.measureText(p.nome!).width > w - 40 && tam > 18) { tam -= 2; g.font = `600 ${tam}px sans-serif`; }
      g.fillText(p.nome!, w / 2, sofis || !logo ? h / 2 : h * 0.74);
    });
    const d = Math.hypot(p.x, p.z) || 1, ux = -p.x / d, uz = -p.z / d, frente = Math.max(p.lx, p.lz) / 2 + 3;
    const s = add(new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })));
    s.position.set(p.x + ux * frente, 2.2, p.z + uz * frente); s.rotation.y = Math.atan2(ux, uz);
  }

  // ── PORTAL da chegada (ao lado do elevador de luz): dois pilares + viga com o logo, virado pra quem chega ──
  {
    const pe = naEntrada(id, R - 22), rumo = Math.atan2(-pe.x, -pe.z), vao = 14, hP = 9, eixo = new THREE.Vector3(Math.cos(rumo), 0, -Math.sin(rumo));
    for (const s of [-1, 1]) { const pil = add(new THREE.Mesh(new THREE.BoxGeometry(1.4, hP, 1.4), sofis ? new THREE.MeshStandardMaterial({ color: 0xeef0f4, roughness: 0.3, metalness: 0.4 }) : pedra)); pil.position.set(pe.x + eixo.x * s * vao / 2, hP / 2, pe.z + eixo.z * s * vao / 2); }
    const viga = add(new THREE.Mesh(new THREE.PlaneGeometry(vao + 2, (vao + 2) / 3), new THREE.MeshBasicMaterial({ map: texLogoFace, transparent: true, side: THREE.DoubleSide })));
    viga.position.set(pe.x, hP + 1.8, pe.z); viga.rotation.y = rumo + Math.PI;
    const aro = add(new THREE.Mesh(new THREE.BoxGeometry(vao + 2.4, 0.2, 0.3), friso)); aro.position.set(pe.x, hP - 0.2, pe.z); aro.rotation.y = rumo;
  }

  // ── ÁRVORES (instanciadas: tronco + copa) ──
  const tronco = new THREE.MeshStandardMaterial({ color: 0x2a1f1a, roughness: 0.9 }), copa = new THREE.MeshStandardMaterial({ color: sofis ? 0x2f6a46 : 0x1c5a4a, roughness: 0.8, emissive: 0x0e3a2a, emissiveIntensity: 0.5, flatShading: true });
  const arv = low ? L.arvores.filter((_, i) => i % 2 === 0) : L.arvores;
  instancias(new THREE.CylinderGeometry(0.18, 0.26, 1, 6).translate(0, 0.5, 0), arv.map((a) => [a.x, 0, a.z, 1, 3, 1]), tronco);
  instancias(new THREE.IcosahedronGeometry(1, 0), arv.map((a, i) => [a.x, 4 + (i % 3) * 0.4, a.z, 2.2, 2 + (i % 2) * 0.5, 2.2, i]), copa);

  return {
    group: raiz, alvosCamera,
    atualizar(dt, t) { for (const f of anim) f(dt, t); },
    dispose() { liberar(raiz, texturas); for (const m of [matBloco, matVidro, matTorre]) m.dispose(); },
  };
}
