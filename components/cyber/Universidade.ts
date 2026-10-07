/**
 * Universidade — o campus FLUTUANDO num disco no céu (lugar de encontro dos alunos), versão futurista e LIMPA:
 * vidro-metal escuro com frisos frios (ciano); por baixo, a base de cristal com os propulsores antigravidade e o
 * ELEVADOR DE LUZ (anel no chão ↔ anel no disco):
 *  - UMA muralha (a externa, lisa, 12 torres com agulha de energia) e o portão com arco de luz; as 4 torres grandes;
 *  - as salas são PAVILHÕES abertos (sem parede nem telhado): piso tingido com contorno de luz + placa + móveis;
 *  - eixo central: a torre de apartamentos (do chão), Grande Salão (mesas compridas), Biblioteca (estantes com
 *    lombadas); alas: Auditório, Laboratório, Salas de Estudo, Café, Ateliê; pátios com gramado e fontes.
 * Layout, paredes, móveis e colisão em lib/cyber/universidade.ts. Quase tudo instanciado; `low` corta os detalhes.
 */
import * as THREE from "three";
import { FONTES, PATIOS, SALAS, TORRES, UNIVERSIDADE, paredesDaUniversidade, todosOsMoveis, type MovelU, type Sala } from "@/lib/cyber/universidade";
import { PLATAFORMAS } from "@/lib/cyber/plataformas";
import { glowTex } from "./CenaCosmica";
import { criarElevadorDeLuz } from "./ElevadorDeLuz";
import { liberar } from "./Landmark";

export type UniversidadeHandle = {
  group: THREE.Group;
  /** o que a câmera não atravessa (muralhas, paredes, torres, telhados) */
  alvosCamera: THREE.Object3D[];
  atualizar(dt: number, t: number): void;
  dispose(): void;
};

/** o logo oficial da UNILAB (unilab.edu.br) — letreiro branco, fundo transparente: lê bem sobre as placas escuras */
const LOGO_UNILAB = "/assets/cyber/logo-unilab.png";
const COR_SALA: Record<Sala["tipo"], number> = { atrio: 0x66e6ff, salao: 0xffc46b, biblioteca: 0xb98cff, auditorio: 0xff8ad8, estudo: 0x7fe0ff, laboratorio: 0x9affd0, cafe: 0xffa36b, atelie: 0xff6ad5 };

export function criarUniversidade(o: { low: boolean; starTex: THREE.Texture }): UniversidadeHandle {
  const { low } = o, U = UNIVERSIDADE;
  const raiz = new THREE.Group(); raiz.position.set(U.centro.x, U.y, U.centro.z);   // flutuando: tudo é relativo ao piso do disco
  const alvosCamera: THREE.Object3D[] = [], texturas: THREE.Texture[] = [], anim: ((dt: number, t: number) => void)[] = [];
  const add = <T extends THREE.Object3D>(x: T, cam = false) => { raiz.add(x); if (cam) alvosCamera.push(x); return x; };
  const tela = (w: number, h: number, pintar: (g: CanvasRenderingContext2D, w: number, h: number) => void) => { const c = document.createElement("canvas"); c.width = w; c.height = h; pintar(c.getContext("2d")!, w, h); const t = new THREE.CanvasTexture(c); texturas.push(t); return t; };
  const glow = (a: string, b: string) => { const t = glowTex(a, b); texturas.push(t); return t; };
  /** textura de canvas com o LOGO da UNILAB (redesenha quando a imagem chega) */
  const comLogo = (w: number, h: number, pintar: (g: CanvasRenderingContext2D, w: number, h: number, logo: HTMLImageElement | null) => void) => {
    const t = tela(w, h, (g, ww, hh) => pintar(g, ww, hh, null));
    if (typeof Image !== "undefined") { const img = new Image(); img.onload = () => { const c = t.image as HTMLCanvasElement, g = c.getContext("2d")!; g.clearRect(0, 0, c.width, c.height); pintar(g, c.width, c.height, img); t.needsUpdate = true; }; img.src = LOGO_UNILAB; }
    return t;
  };
  /** desenha o logo centrado numa caixa (mantém a proporção) */
  const logoEm = (g: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, maxW: number, maxH: number) => { const k = Math.min(maxW / img.width, maxH / img.height), w = img.width * k, h = img.height * k; g.drawImage(img, cx - w / 2, cy - h / 2, w, h); };
  const mx = new THREE.Matrix4(), mq = new THREE.Quaternion(), ms = new THREE.Vector3(), mp = new THREE.Vector3(), cor = new THREE.Color();
  /** InstancedMesh de caixas unitárias a partir de [cx, cy, cz, sx, sy, sz, giroY?] */
  const caixas = (lista: number[][], mat: THREE.Material, cam = false, cores?: number[]) => {
    if (!lista.length) return null;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, lista.length);
    lista.forEach((c, i) => { mq.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, c[6] ?? 0); im.setMatrixAt(i, mx.compose(mp.set(c[0]!, c[1]!, c[2]!), mq, ms.set(c[3]!, c[4]!, c[5]!))); if (cores) im.setColorAt(i, cor.setHex(cores[i]!)); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); return add(im, cam);
  };

  // materiais
  const pedra = new THREE.MeshStandardMaterial({ color: 0x141e38, roughness: 0.28, metalness: 0.75, emissive: 0x0b1a3c, emissiveIntensity: 0.65 });   // vidro-metal escuro
  const pedraClara = new THREE.MeshStandardMaterial({ color: 0x1f2d55, roughness: 0.22, metalness: 0.7, emissive: 0x112a5a, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 });
  const friso = new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const janelaMat = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const telhadoMat = new THREE.MeshStandardMaterial({ color: 0x14204a, roughness: 0.35, metalness: 0.5, emissive: 0x1f3a7a, emissiveIntensity: 0.55, flatShading: true });
  const pontaMat = new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x9fe8ff, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true });
  const escuroMon = new THREE.MeshStandardMaterial({ color: 0x0a0f1c, roughness: 0.4, metalness: 0.6 });
  const madeira = new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.7, metalness: 0.1, emissive: 0x24140c, emissiveIntensity: 0.5 });

  // ── O DISCO flutuante: piso com grade de luz, aro aceso na borda, base de cristal por baixo com os propulsores
  //    antigravidade e o ELEVADOR DE LUZ (anel no chão + coluna até o disco + anel de volta lá em cima) ──
  const em = U.externa.meia, R = U.discoR, seg = low ? 64 : 128;
  const grade = tela(512, 512, (g, w, h) => { g.fillStyle = "#0d1630"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(102,230,255,.22)"; g.lineWidth = 2; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * w / 8, 0); g.lineTo(i * w / 8, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8); g.stroke(); } });
  grade.wrapS = grade.wrapT = THREE.RepeatWrapping; grade.repeat.set(R / 6, R / 6);
  const piso = add(new THREE.Mesh(new THREE.CircleGeometry(R, seg), new THREE.MeshStandardMaterial({ map: grade, color: 0xffffff, roughness: 0.55, metalness: 0.4, emissive: 0x0a1430, emissiveIntensity: 0.5 })));
  piso.rotation.x = -Math.PI / 2; piso.position.y = 0.03;
  const casca = add(new THREE.Mesh(new THREE.CylinderGeometry(R, R - 1.5, U.espessura * 0.25, seg, 1, true), pedra)); casca.position.y = -U.espessura * 0.125;
  const aroBorda = add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 6, seg), friso)); aroBorda.rotation.x = Math.PI / 2; aroBorda.position.y = 0.1;
  const aroBaixo = add(new THREE.Mesh(new THREE.TorusGeometry(R - 1.2, 0.5, 6, seg), new THREE.MeshBasicMaterial({ color: 0xb98cff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }))); aroBaixo.rotation.x = Math.PI / 2; aroBaixo.position.y = -U.espessura * 0.25;
  // base de cristal: cone invertido facetado (com veios de luz) + cones menores em volta
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x0a1226, roughness: 0.3, metalness: 0.5, emissive: 0x1a2f6a, emissiveIntensity: 0.55, flatShading: true });
  const cone = add(new THREE.Mesh(new THREE.ConeGeometry(R - 2, 90, low ? 10 : 18, 3), baseMat)); cone.rotation.x = Math.PI; cone.position.y = -U.espessura * 0.25 - 45;
  // (a base larga fica rente ao fundo do disco: antes o centro a −30 m com 75 m de altura furava o piso e aparecia como
  //  placas escuras de 7 lados em cima do campus)
  for (let k = 0; k < (low ? 4 : 7); k++) { const a = (k / 7) * Math.PI * 2 + 0.4, h = 55 + (k % 2) * 20, c = add(new THREE.Mesh(new THREE.ConeGeometry(26 + (k % 3) * 8, h, 7), baseMat)); c.rotation.x = Math.PI; c.position.set(Math.cos(a) * R * 0.55, -U.espessura * 0.25 - h / 2 - 0.5, Math.sin(a) * R * 0.55); }
  // propulsores antigravidade: anéis + brilho embaixo do disco, pulsando
  const texAnti = glow("rgba(185,140,255,.95)", "rgba(102,230,255,.25)"), antis: THREE.Sprite[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, x = Math.cos(a) * R * 0.78, z = Math.sin(a) * R * 0.78;
    const anel = add(new THREE.Mesh(new THREE.TorusGeometry(6, 0.6, 6, 32), friso)); anel.rotation.x = Math.PI / 2; anel.position.set(x, -U.espessura * 0.25 - 1, z);
    const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: texAnti, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); s.position.set(x, -U.espessura * 0.25 - 4, z); s.scale.setScalar(22); antis.push(s);
  }
  anim.push((_, t) => antis.forEach((s, i) => { s.material.opacity = 0.55 + 0.35 * Math.sin(t * 1.6 + i); }));
  // ELEVADOR DE LUZ: anel no chão (embaixo), coluna de luz até o disco e o anel de volta no disco
  const elev = PLATAFORMAS.univ, lc = { x: elev.anelChao.x - U.centro.x, z: elev.anelChao.z - U.centro.z }, ld = { x: elev.anelDisco.x - U.centro.x, z: elev.anelDisco.z - U.centro.z };
  anim.push(criarElevadorDeLuz(raiz, { chao: { ...lc, r: elev.anelChao.r, y: -U.y }, disco: { ...ld, r: elev.anelDisco.r }, low }));
  const grama = new THREE.MeshStandardMaterial({ color: 0x0c3a3a, roughness: 1, emissive: 0x0b4a44, emissiveIntensity: 0.55 });
  for (const p of PATIOS) { const g = add(new THREE.Mesh(new THREE.PlaneGeometry(p.x1 - p.x0 - 2, p.z1 - p.z0 - 2), grama)); g.rotation.x = -Math.PI / 2; g.position.set((p.x0 + p.x1) / 2, 0.05, (p.z0 + p.z1) / 2); }
  const caminho = add(new THREE.Mesh(new THREE.PlaneGeometry(10, em + 40), new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false })));
  caminho.rotation.x = -Math.PI / 2; caminho.position.set(0, 0.06, -em / 2 - 20);   // do elevador de luz até o portão

  // ── MURALHA EXTERNA (a única parede que sobrou), lisa, com friso de luz no alto. A muralha interna, as paredes das
  //    salas e as janelas em fita saíram: era parede dobrada em cima de parede e faixa de luz vazando nas pontas ──
  const muralhas: number[][] = [], frisos: number[][] = [];
  for (const w of paredesDaUniversidade()) {
    const L = Math.hypot(w.bx - w.ax, w.bz - w.az), giro = -Math.atan2(w.bz - w.az, w.bx - w.ax), cx = (w.ax + w.bx) / 2, cz = (w.az + w.bz) / 2;
    muralhas.push([cx, w.alt / 2, cz, L, w.alt, w.esp, giro]);
    frisos.push([cx, w.alt + 0.06, cz, L, 0.12, w.esp + 0.1, giro]);
  }
  caixas(muralhas, pedra, true); caixas(frisos, friso);

  // ── TORRES: corpo + friso + AGULHA de energia (no lugar do telhado cônico) + aros flutuando + ponta acesa ──
  const corpoT = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.08, 1, low ? 10 : 16), pedra, TORRES.length);
  const telhadoT = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 1, low ? 6 : 8), pontaMat, TORRES.length);
  const aroT = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.03, 4, 32), friso, TORRES.length);
  const texPonta = glow("rgba(220,250,255,1)", "rgba(110,200,255,.35)"), pontas: THREE.Sprite[] = [];
  TORRES.forEach((t, i) => {
    corpoT.setMatrixAt(i, mx.compose(mp.set(t.x, t.alt / 2, t.z), mq.identity(), ms.set(t.r, t.alt, t.r)));
    const hT = t.r * 2.3; telhadoT.setMatrixAt(i, mx.compose(mp.set(t.x, t.alt + hT / 2, t.z), mq.identity(), ms.set(t.r * 1.22, hT, t.r * 1.22)));
    aroT.setMatrixAt(i, mx.compose(mp.set(t.x, t.alt + 0.1, t.z), mq.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), ms.set(t.r * 1.1, t.r * 1.1, t.r * 1.1)));
    const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: texPonta, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); s.position.set(t.x, t.alt + hT + 0.8, t.z); s.scale.setScalar(3 + t.r * 0.4); pontas.push(s);
  });
  for (const im of [corpoT, telhadoT, aroT]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
  add(corpoT, true); add(telhadoT, true); add(aroT);   // (os aros soltos girando em volta das agulhas saíram)

  // ── PORTÃO (só o da muralha externa): pilares dos dois lados + arco de luz ──
  {
    const w = U.externa.portao, alt = U.externa.alt;
    caixas([-1, 1].map((s) => [s * (w / 2 + 1.6), alt / 2 + 1.5, -em, 3.2, alt + 3, 4.2]), pedra, true);
    const arco = add(new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.25, 6, 32, Math.PI), friso)); arco.position.set(0, alt * 0.55, -em - 2.15);
  }

  // ── TORRE DE APARTAMENTOS no átrio (no lugar da torre do relógio): três volumes escalonados, sacadas a cada
  //    andar, janelas acesas em grade (luz quente e fria) e um mastro com farol — mesma altura total (sólido pra voo) ──
  const tc = U.torreCentral, y0 = 0;   // nasce do chão (as paredes do átrio, que a seguravam, saíram)
  const texPontaC = glow("rgba(220,250,255,1)", "rgba(110,200,255,.35)");
  const blocoMat = new THREE.MeshStandardMaterial({ color: 0x27304e, roughness: 0.4, metalness: 0.3, emissive: 0x111a36, emissiveIntensity: 0.5 });
  const lajeMat = new THREE.MeshStandardMaterial({ color: 0xc9d2ea, roughness: 0.5, metalness: 0.1, emissive: 0x1d2440, emissiveIntensity: 0.4 });
  const volumes = [   // [dx, dz, largura, profundidade, base, topo] — escalonados, como prédios residenciais modernos
    [-2.2, 1.4, tc.lado * 0.62, tc.lado * 0.72, y0, tc.alt],
    [2.6, -1.8, tc.lado * 0.55, tc.lado * 0.6, y0, tc.alt - 9],
    [0.4, 2.8, tc.lado * 0.8, tc.lado * 0.45, y0, tc.alt - 17],
  ] as const;
  const blocos: number[][] = [], sacadas: number[][] = [], janQ: number[][] = [], janF: number[][] = [];
  let sr = 11; const rnd = () => { sr = (sr * 16807) % 2147483647; return (sr - 1) / 2147483646; };
  for (const [dx, dz, w, d, b0, b1] of volumes) {
    const cx = tc.x + dx, cz = tc.z + dz;
    blocos.push([cx, (b0 + b1) / 2, cz, w, b1 - b0, d]);
    for (let y = b0 + 3.2; y < b1 - 0.5; y += 3.2) {
      sacadas.push([cx, y, cz, w + 0.9, 0.22, d + 0.9]);   // a laje-sacada contorna o andar
      for (const [nx, nz, L] of [[0, -1, w], [0, 1, w], [-1, 0, d], [1, 0, d]] as const) {
        for (let k = -L / 2 + 1.1; k < L / 2 - 0.6; k += 1.6) {
          const x = cx + (nz !== 0 ? k : nx * (w / 2 + 0.02)), z = cz + (nx !== 0 ? k : nz * (d / 2 + 0.02));
          if (rnd() < 0.3) continue;   // nem toda janela acesa
          (rnd() < 0.55 ? janQ : janF).push([x, y + 1.5, z, nz !== 0 ? 1.1 : 0.04, 1.6, nx !== 0 ? 1.1 : 0.04]);
        }
      }
    }
  }
  caixas(blocos, blocoMat, true); caixas(sacadas, lajeMat);
  caixas(janQ, janelaMat); caixas(janF, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  const mastro = add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, tc.pinaculo, 8), pontaMat), true); mastro.position.set(tc.x - 2.2, tc.alt + tc.pinaculo / 2, tc.z + 1.4);
  const topoPin = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: texPontaC, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); topoPin.position.set(tc.x - 2.2, tc.alt + tc.pinaculo, tc.z + 1.4); topoPin.scale.setScalar(8);

  // ── SALAS = PAVILHÕES abertos (sem parede nem telhado): piso tingido + CONTORNO de luz na cor da sala + placa ──
  const contornos: number[][] = [], corContorno: number[] = [];
  for (const s of SALAS) {
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, lx = s.x1 - s.x0, lz = s.z1 - s.z0, cor = COR_SALA[s.tipo];
    const ch = add(new THREE.Mesh(new THREE.PlaneGeometry(lx, lz), new THREE.MeshStandardMaterial({ color: 0x101a33, roughness: 0.6, emissive: cor, emissiveIntensity: 0.06 }))); ch.rotation.x = -Math.PI / 2; ch.position.set(cx, 0.07, cz);
    for (const c of [[cx, s.z0, lx, 0.22], [cx, s.z1, lx, 0.22], [s.x0, cz, 0.22, lz], [s.x1, cz, 0.22, lz]]) { contornos.push([c[0]!, 0.1, c[1]!, c[2]!, 0.04, c[3]!]); corContorno.push(cor); }
    // placa com o nome da sala, na entrada principal (pra achar cada área)
    const p0 = s.portas[0]!, px = p0.lado === "s" || p0.lado === "n" ? p0.em : p0.lado === "o" ? s.x0 - 0.6 : s.x1 + 0.6, pz = p0.lado === "s" ? s.z0 - 0.6 : p0.lado === "n" ? s.z1 + 0.6 : p0.em;
    const corCss = "#" + new THREE.Color(cor).getHexString();
    const placa = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tela(512, 112, (g, w, h) => { g.fillStyle = "rgba(10,8,24,.75)"; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 50); g.fill(); g.strokeStyle = corCss; g.lineWidth = 4; g.stroke(); g.fillStyle = corCss; g.font = "800 46px system-ui,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s.nome.toUpperCase(), w / 2, h / 2 + 2); }), transparent: true, depthWrite: false })));
    placa.scale.set(7.5, 1.65, 1); placa.position.set(px, 3.4, pz);
  }
  caixas(contornos, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), false, corContorno);
  // placa grande do campus sobre o portão externo: o LOGO da UNILAB (sem "campus virtual")
  const nomeCampus = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: comLogo(1024, 320, (g, w, h, logo) => {
    g.fillStyle = "rgba(8,10,28,.82)"; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 60); g.fill(); g.strokeStyle = "#66e6ff"; g.lineWidth = 6; g.stroke();
    if (logo) logoEm(g, logo, w / 2, h / 2, w - 100, h - 70);
  }), transparent: true, depthWrite: false })));
  nomeCampus.scale.set(30, 9.4, 1); nomeCampus.position.set(0, U.externa.alt + 11, -em - 2);
  // estandartes com o logo: nos pilares do portão (virados pro sul) e no painel do palco do Grande Salão
  const texEstandarte = comLogo(256, 512, (g, w, h, logo) => {
    g.fillStyle = "#0b1834"; g.fillRect(0, 0, w, h); g.fillStyle = "#66e6ff"; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    g.beginPath(); g.moveTo(0, h - 10); g.lineTo(w / 2, h - 70); g.lineTo(w, h - 10); g.fillStyle = "#050a18"; g.fill();
    if (logo) logoEm(g, logo, w / 2, h * 0.42, w - 40, h * 0.5);
  });
  const matEst = new THREE.MeshBasicMaterial({ map: texEstandarte, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) { const e = add(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 6.4), matEst)); e.position.set(sx * (U.externa.portao / 2 + 1.6), U.externa.alt - 2.5, -em - 2.2); e.rotation.y = Math.PI; }   // nos pilares do portão
  const sal = SALAS.find((s) => s.tipo === "salao")!;
  const fundoPalco = add(new THREE.Mesh(new THREE.PlaneGeometry(12, 5.2), new THREE.MeshBasicMaterial({ map: comLogo(1024, 444, (g, w, h, logo) => { g.fillStyle = "#08102a"; g.fillRect(0, 0, w, h); g.strokeStyle = "#ffc46b"; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16); if (logo) logoEm(g, logo, w / 2, h / 2, w - 140, h - 120); }) })));
  // os painéis ficam EM PÉ no fundo do palco (que é sólido), com um caixilho atrás — sem parede, nada solto no ar
  const palcoSal = todosOsMoveis().find((m) => m.tipo === "palco" && m.z0 > sal.z0 && m.z1 < sal.z1)!;
  fundoPalco.position.set(0, palcoSal.alt + 3.1, palcoSal.z1 - 0.35); fundoPalco.rotation.y = Math.PI;
  const caixilhos: number[][] = [[0, palcoSal.alt + 3, palcoSal.z1 - 0.2, 12.6, 6, 0.25]];

  // ── MÓVEIS (do layout: mesas, bancos, estantes, fileiras, bancadas, balcão…) ──
  const moveis = todosOsMoveis(), porTipo = new Map<MovelU["tipo"], number[][]>();
  for (const m of moveis) { const l = porTipo.get(m.tipo) ?? []; l.push([(m.x0 + m.x1) / 2, m.alt / 2, (m.z0 + m.z1) / 2, m.x1 - m.x0, m.alt, m.z1 - m.z0]); porTipo.set(m.tipo, l); }
  const matMovel: Record<MovelU["tipo"], THREE.Material> = {
    mesa: madeira, banco: madeira, mesinha: madeira, atelie: madeira, balcao: pedraClara,
    palco: new THREE.MeshStandardMaterial({ color: 0x1a1030, emissive: 0x3a1f6a, emissiveIntensity: 0.6, roughness: 0.5 }),
    fileira: new THREE.MeshStandardMaterial({ color: 0x3a1a3a, emissive: 0x4a1a4a, emissiveIntensity: 0.45, roughness: 0.8 }),
    bancada: new THREE.MeshStandardMaterial({ color: 0x0f2a2a, emissive: 0x0f5a4a, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.4 }),
    estante: madeira, pc: pedraClara, cadeira: madeira, bloco: madeira,
  };
  for (const [tipo, l] of porTipo) if (tipo !== "estante" && tipo !== "bloco" && tipo !== "cadeira") caixas(l, matMovel[tipo]);
  // CADEIRAS (assento + encosto virado pro lado oposto da frente) e os COMPUTADORES das salas de estudo (monitor + teclado)
  const cadeiras = moveis.filter((m) => m.tipo === "cadeira"), assentos: number[][] = [], encostos: number[][] = [];
  for (const c of cadeiras) {
    const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2, f = c.frente ?? "+z", dx = f === "+x" ? 1 : f === "-x" ? -1 : 0, dz = f === "+z" ? 1 : f === "-z" ? -1 : 0;
    assentos.push([cx, 0.46, cz, 0.55, 0.08, 0.55]); encostos.push([cx - dx * 0.26, 0.82, cz - dz * 0.26, dx ? 0.06 : 0.55, 0.62, dz ? 0.06 : 0.55]);
  }
  const estofado = new THREE.MeshStandardMaterial({ color: 0x2a3a6a, roughness: 0.85, emissive: 0x141e44, emissiveIntensity: 0.4 });
  caixas(assentos, estofado); caixas(encostos, estofado);
  const telaPc = tela(128, 80, (g, w, h) => { g.fillStyle = "#06223a"; g.fillRect(0, 0, w, h); g.fillStyle = "#66e6ff"; g.fillRect(6, 6, w - 12, 8); g.fillStyle = "rgba(143,232,255,.7)"; for (let i = 0; i < 6; i++) g.fillRect(8, 22 + i * 9, 30 + ((i * 37) % 70), 4); g.fillStyle = "rgba(154,255,208,.6)"; g.fillRect(w - 40, 24, 30, 44); });
  const monitores: number[][] = [], teclados: number[][] = [], telas: { x: number; z: number; giro: number }[] = [];
  for (const m of moveis.filter((m) => m.tipo === "pc")) {
    const sx = m.frente === "+x" ? 1 : -1, xm = sx > 0 ? m.x0 + 0.3 : m.x1 - 0.3;
    for (let z = m.z0 + 1.2; z < m.z1 - 0.6; z += 2.4) {
      monitores.push([xm, m.alt + 0.42, z, 0.06, 0.6, 1.0]); teclados.push([xm + sx * 0.55, m.alt + 0.02, z, 0.22, 0.03, 0.6]);
      telas.push({ x: xm + sx * 0.035, z, giro: sx > 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
  }
  caixas(monitores, escuroMon); caixas(teclados, escuroMon);
  if (telas.length) {
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.92, 0.52), new THREE.MeshBasicMaterial({ map: telaPc }), telas.length);
    telas.forEach((t, i) => im.setMatrixAt(i, mx.compose(mp.set(t.x, 1.22, t.z), mq.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t.giro), ms.set(1, 1, 1))));
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); add(im);
  }
  // estantes: caixas com LOMBADAS de livros (textura repetida pelo comprimento)
  const lombadas = tela(256, 256, (g) => { g.fillStyle = "#1a1020"; g.fillRect(0, 0, 256, 256); const cs = ["#66e6ff", "#b98cff", "#9affd0", "#ffd36b", "#7fb4ff", "#ff9ad5", "#ffb45a"];
    for (let r = 0; r < 4; r++) { let x = 0; while (x < 256) { const w = 6 + ((x * 7 + r * 13) % 9); g.fillStyle = cs[(x + r * 3) % cs.length]!; g.globalAlpha = 0.75; g.fillRect(x, r * 64 + 8, w - 1, 52); x += w; } g.globalAlpha = 1; g.fillStyle = "#3a2a24"; g.fillRect(0, r * 64 + 60, 256, 4); } });
  lombadas.wrapS = THREE.RepeatWrapping;
  for (const m of moveis.filter((m) => m.tipo === "estante")) {
    const t = lombadas.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round((m.x1 - m.x0) / 2.5)), 2); t.wrapT = THREE.RepeatWrapping; texturas.push(t);
    const e = add(new THREE.Mesh(new THREE.BoxGeometry(m.x1 - m.x0, m.alt, m.z1 - m.z0), [madeira, madeira, madeira, madeira, new THREE.MeshBasicMaterial({ map: t }), new THREE.MeshBasicMaterial({ map: t })]));
    e.position.set((m.x0 + m.x1) / 2, m.alt / 2, (m.z0 + m.z1) / 2);
  }
  // telas: o telão do auditório e os hologramas das bancadas do laboratório
  const aud = SALAS.find((s) => s.tipo === "auditorio")!;
  const telao = add(new THREE.Mesh(new THREE.PlaneGeometry(16, 7), new THREE.MeshBasicMaterial({ map: comLogo(1024, 448, (g, w, h, logo) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#1a0b3a"); gr.addColorStop(1, "#0b2a55"); g.fillStyle = gr; g.fillRect(0, 0, w, h); if (logo) logoEm(g, logo, w / 2, h / 2, w - 200, h - 160); }) })));
  const palcoAud = moveis.find((m) => m.tipo === "palco" && m.x0 > aud.x0 && m.x1 < aud.x1)!;
  telao.position.set((palcoAud.x0 + palcoAud.x1) / 2, palcoAud.alt + 4, palcoAud.z1 - 0.35); telao.rotation.y = Math.PI;
  caixilhos.push([telao.position.x, palcoAud.alt + 3.9, palcoAud.z1 - 0.2, 16.6, 7.8, 0.25]);
  caixas(caixilhos, pedra);
  const holos: number[][] = []; for (const m of moveis.filter((m) => m.tipo === "bancada")) for (let x = m.x0 + 2; x < m.x1 - 1; x += 4) holos.push([x, 1.9, (m.z0 + m.z1) / 2, 1.4, 1, 0.03]);
  const holoMat = new THREE.MeshBasicMaterial({ color: 0x9affd0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  caixas(holos, holoMat);

  // ── FONTES modernas (pátios + pátio externo): bacia com aro de luz e coluna de água iluminada ──
  const aguaMat = new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const jatos: THREE.Mesh[] = [];
  for (const f of FONTES) {
    const borda = add(new THREE.Mesh(new THREE.CylinderGeometry(f.r, f.r + 0.4, 0.6, 32), pedraClara)); borda.position.set(f.x, 0.3, f.z);
    const aro = add(new THREE.Mesh(new THREE.TorusGeometry(f.r + 0.15, 0.08, 6, 48), friso)); aro.rotation.x = Math.PI / 2; aro.position.set(f.x, 0.62, f.z);
    const agua = add(new THREE.Mesh(new THREE.CircleGeometry(f.r - 0.2, 32), aguaMat)); agua.rotation.x = -Math.PI / 2; agua.position.set(f.x, 0.55, f.z);
    const jato = add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 6, 16, 1, true), aguaMat)); jato.position.set(f.x, 3.5, f.z); jatos.push(jato);
  }
  anim.push((_, t) => jatos.forEach((j, i) => { j.scale.y = 0.9 + 0.12 * Math.sin(t * 2.2 + i); }));

  // (saíram: a NATUREZA, a muralha interna, as paredes e janelas das salas, os aros soltos das torres, as lanternas e
  //  estandartes do salão, o cristal do átrio, os anéis das fontes e os monólitos/anéis do pátio externo — tudo que
  //  ficava no ar sem colisão ou dobrava parede em cima de parede)

  return {
    group: raiz, alvosCamera,
    atualizar(dt, t) {
      for (const f of anim) f(dt, t);
      pontas.forEach((p, i) => { p.material.opacity = 0.7 + 0.3 * Math.sin(t * 1.1 + i); });
    },
    dispose() { liberar(raiz, texturas); },
  };
}
