/**
 * DroidsObservadores — os droids que observam a Terra (layout/rotas puros em lib/cyber/terra). Cada grupo: um LÍDER
 * piramidal — moldura triangular de bronze gravada com runas, núcleo HEXAGONAL de luz azul, três placas-escudo com
 * símbolos, cristais azuis (no alto, na cauda e dois laterais), LEDs com espinhos — que controla 2 MENORES de três asas
 * triangulares (painel escuro com "raios" azuis) em volta de um cristal. Eles ANALISAM a Terra na estação de cada
 * mirante: o líder voa baixo na frente do TELÃO, varrendo os dados com um feixe; os menores escaneiam o GLOBO.
 *
 * Comuns e visíveis pra todos: a pose sai do RELÓGIO de parede (`Date.now`) — todo mundo vê os droids no mesmo lugar.
 * Leve: cada TIPO de peça é UM InstancedMesh pra todos os droids (≈ 14 chamadas de desenho no total).
 */
import * as THREE from "three";
import { GRUPOS_DROIDS, poseDoLider, poseDosMenores } from "@/lib/cyber/terra";

export type ObservadoresHandle = { group: THREE.Group; atualizar(dt: number): void; dispose(): void;
  /** de onde sai o SOM de cada droid (o zumbido de máquina flutuando — lib/cyber/somDroid): segue o droid; `voando` =
   *  o líder indo de uma tela pra outra (o motor acelera) */
  emissores: { obj: THREE.Object3D; lider: boolean; voando: boolean }[] };

const BRONZE = 0xe6cfa4;
/** o líder trabalha BAIXO, na frente do telão: menor que um droid "de céu" (não tampa a tela) */
const ESCALA_LIDER = 0.55;   // dourado-claro (o da referência), não laranja
/** o relógio de parede (s) — o mesmo pra todos os jogadores (ignora a pequena diferença entre relógios) */
const relogio = () => (Date.now() % 1e9) / 1000;

function canvasTex(w: number, h: number, desenho: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; desenho(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** um triângulo (lado `l`, ápice pra cima) como Shape, centrado no baricentro */
const triangulo = (l: number) => { const h = (l * Math.sqrt(3)) / 2, s = new THREE.Shape(); s.moveTo(0, (2 * h) / 3); s.lineTo(l / 2, -h / 3); s.lineTo(-l / 2, -h / 3); s.closePath(); return s; };

export function criarObservadores(o: { low: boolean }): ObservadoresHandle {
  const group = new THREE.Group(), NL = GRUPOS_DROIDS.length, NM = NL * 2, liberar: { dispose(): void }[] = [];
  const g = <T extends { dispose(): void }>(x: T) => { liberar.push(x); return x; };
  const bronze = g(new THREE.MeshStandardMaterial({ color: BRONZE, metalness: 0.5, roughness: 0.38, emissive: 0x4a3a22, emissiveIntensity: 0.5 }));
  const escuro = g(new THREE.MeshStandardMaterial({ color: 0x1c2230, metalness: 0.6, roughness: 0.4, emissive: 0x0a1020, emissiveIntensity: 0.4 }));
  const cristal = g(new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x4aa8ff, emissiveIntensity: 1.6, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.92, flatShading: true }));
  const luz = g(new THREE.MeshBasicMaterial({ color: 0xbfe8ff }));
  // as RUNAS (vermelhas, gravadas no bronze) e os SÍMBOLOS das placas
  const runas = g(canvasTex(512, 64, (c) => { c.fillStyle = "#e2c99c"; c.fillRect(0, 0, 512, 64); c.fillStyle = "#8c2a22"; c.font = "bold 40px serif"; c.textBaseline = "middle"; const gl = "ᚠᛟᛉᛞᛝᚱᛏᛒᛗᛚᛜᛞᚲᚷᚹ"; for (let i = 0; i < 13; i++) c.fillText(gl[(i * 7) % gl.length]!, 12 + i * 38, 34); c.strokeStyle = "#7a5530"; c.lineWidth = 3; c.strokeRect(2, 2, 508, 60); }));
  const simbolo = g(canvasTex(128, 128, (c) => { c.fillStyle = "#e4cba0"; c.fillRect(0, 0, 128, 128); c.strokeStyle = "#8c2a22"; c.lineWidth = 7; c.beginPath(); c.arc(64, 58, 22, Math.PI * 0.2, Math.PI * 1.8); c.stroke(); c.beginPath(); c.moveTo(64, 80); c.lineTo(64, 108); c.moveTo(48, 96); c.lineTo(80, 96); c.stroke(); c.strokeStyle = "#7a5530"; c.lineWidth = 5; c.strokeRect(6, 6, 116, 116); }));
  const raios = g(canvasTex(128, 128, (c) => { c.fillStyle = "#1a2030"; c.fillRect(0, 0, 128, 128); c.strokeStyle = "#cfe8ff"; c.lineWidth = 3; c.shadowColor = "#6fb8ff"; c.shadowBlur = 8; for (const [x, y] of [[40, 20], [70, 30], [55, 60]]) { c.beginPath(); c.moveTo(x!, y!); c.lineTo(x! + 10, y! + 18); c.lineTo(x! - 2, y! + 24); c.lineTo(x! + 14, y! + 48); c.stroke(); } }));
  const matRunas = g(new THREE.MeshStandardMaterial({ map: runas, metalness: 0.6, roughness: 0.4, emissive: 0x2a1a0a, emissiveIntensity: 0.3 }));
  const matSimbolo = g(new THREE.MeshStandardMaterial({ map: simbolo, metalness: 0.6, roughness: 0.4, emissive: 0x2a1a0a, emissiveIntensity: 0.3 }));
  const matRaios = g(new THREE.MeshStandardMaterial({ map: raios, metalness: 0.4, roughness: 0.5, emissive: 0x1a3a6a, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
  const nucleoMat = g(new THREE.MeshBasicMaterial({ color: 0x9fe0ff }));
  const feixeMat = g(new THREE.MeshBasicMaterial({ color: 0x6fc8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));

  // ── as PEÇAS do líder (no referencial dele: frente = +z, a moldura em pé no plano xy). Lado do triângulo ~9 m ──
  const L = 9, H = (L * Math.sqrt(3)) / 2, ext = (s: THREE.Shape, d: number) => { const e = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1, curveSegments: 4 }); e.translate(0, 0, -d / 2); return e; };
  const moldura = (() => { const s = triangulo(L), furo = triangulo(L - 2.6); s.holes.push(new THREE.Path(furo.getPoints())); return ext(s, 0.7); })();
  const escudo = (() => { const s = new THREE.Shape(); s.moveTo(0, 1.6); s.lineTo(1.25, 0.8); s.lineTo(1.0, -0.9); s.lineTo(0, -1.5); s.lineTo(-1.0, -0.9); s.lineTo(-1.25, 0.8); s.closePath(); return ext(s, 0.55); })();
  const hex = new THREE.CylinderGeometry(1.35, 1.35, 1.0, 6); hex.rotateX(Math.PI / 2); hex.rotateZ(Math.PI / 6);
  const hexLuz = new THREE.CylinderGeometry(0.85, 0.85, 1.1, 6); hexLuz.rotateX(Math.PI / 2); hexLuz.rotateZ(Math.PI / 6);
  const diamante = new THREE.OctahedronGeometry(1, 0); diamante.scale(0.55, 1.05, 0.3);
  const faixaRunas = new THREE.PlaneGeometry(L - 2.4, 0.62);
  const placaSimb = new THREE.PlaneGeometry(1.5, 1.5);
  const led = new THREE.SphereGeometry(0.32, 10, 8), espinho = new THREE.ConeGeometry(0.22, 1.3, 6); espinho.rotateX(Math.PI);
  type Parte = { geo: THREE.BufferGeometry; mat: THREE.Material; locais: THREE.Matrix4[] };
  const M = (x: number, y: number, z: number, rz = 0, rx = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(s, s, s));
  // as 3 faixas de runas ficam na face da frente de cada lado da moldura
  const ladoMeio = (k: number) => { const a = Math.PI / 2 + (k * 2 * Math.PI) / 3 + Math.PI / 3, rIn = H / 3 - 0.65; return { x: Math.cos(a) * rIn, y: Math.sin(a) * rIn, rz: a - Math.PI / 2 }; };
  const escudos = [Math.PI / 2 + 0.6, Math.PI / 2 - 0.6 + Math.PI * 2, -Math.PI / 2].map((a, k) => ({ a, k }));
  const partesLider: Parte[] = [
    { geo: moldura, mat: bronze, locais: [M(0, 0, 0)] },
    { geo: faixaRunas, mat: matRunas, locais: [0, 1, 2].map((k) => { const l = ladoMeio(k); return M(l.x, l.y, 0.42, l.rz); }) },
    { geo: hex, mat: escuro, locais: [M(0, -0.3, 0.2)] },
    { geo: hexLuz, mat: nucleoMat, locais: [M(0, -0.3, 0.25)] },
    { geo: escudo, mat: bronze, locais: escudos.map(({ a }) => M(Math.cos(a) * 2.3, -0.3 + Math.sin(a) * 2.3, 0.1, a - Math.PI / 2)) },
    { geo: placaSimb, mat: matSimbolo, locais: escudos.map(({ a }) => M(Math.cos(a) * 2.3, -0.3 + Math.sin(a) * 2.3, 0.4, a - Math.PI / 2, 0, 0.85)) },
    { geo: diamante, mat: cristal, locais: [M(0, H / 3 - 0.3, 0.2, 0, 0, 1.15), M(0, -H / 3 - 2.4, 0.1, 0, 0, 1.25), M(-2.6, 1.3, 0.3, 0.9, 0, 0.8), M(2.6, 1.3, 0.3, -0.9, 0, 0.8)] },
    { geo: led, mat: luz, locais: [M(-2.9, -H / 3 + 0.2, 0.4), M(2.9, -H / 3 + 0.2, 0.4)] },
    { geo: espinho, mat: bronze, locais: [M(-3.3, -H / 3 - 0.9, 0.2, -0.35), M(3.3, -H / 3 - 0.9, 0.2, 0.35)] },
  ];
  // ── as PEÇAS dos menores: 3 asas triangulares (moldura de bronze + painel com raios) em volta de um cristal ──
  const asaMold = (() => { const s = triangulo(2.6), furo = triangulo(1.8); s.holes.push(new THREE.Path(furo.getPoints())); return ext(s, 0.25); })();
  const asaPainel = new THREE.ShapeGeometry(triangulo(1.85));
  const nucleoMenor = new THREE.ConeGeometry(0.75, 1.5, 3); nucleoMenor.rotateX(Math.PI / 2);
  const asas = [0, 1, 2].map((k) => { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3, d = 1.55; return M(Math.cos(a) * d, Math.sin(a) * d, 0, a + Math.PI / 2); });
  const partesMenor: Parte[] = [
    { geo: asaMold, mat: bronze, locais: asas },
    { geo: asaPainel, mat: matRaios, locais: asas },
    { geo: nucleoMenor, mat: cristal, locais: [M(0, 0, 0.2)] },
  ];
  const instanciar = (partes: Parte[], n: number) => partes.map((p) => { g(p.geo); const im = new THREE.InstancedMesh(p.geo, p.mat, n * p.locais.length); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(im); return { ...p, im }; });
  const lideres = instanciar(partesLider, NL), menores = instanciar(partesMenor, NM);
  // o FEIXE de leitura: um leque de luz do núcleo do líder até o ponto da TELA que ele lê (cone com a ponta no
  // droid, o eixo +y do cone apontado pro alvo); os menores: um feixe fino cada até o globo
  const coneLeque = g(new THREE.ConeGeometry(1, 1, 24, 1, true)); coneLeque.translate(0, -0.5, 0); coneLeque.rotateX(Math.PI);   // ponta na origem, abre pra +y
  const feixes = Array.from({ length: NL }, () => { const f = new THREE.Mesh(coneLeque, feixeMat.clone()); g(f.material as THREE.Material); f.visible = false; group.add(f); return f; });
  const feixesMen = Array.from({ length: NM }, () => { const f = new THREE.Mesh(coneLeque, feixeMat.clone()); g(f.material as THREE.Material); group.add(f); return f; });
  const cima = new THREE.Vector3(0, 1, 0), dirF = new THREE.Vector3();
  /** aponta o feixe `f` de `de` até `ate`, com a boca de raio `r` */
  const mirar = (f: THREE.Mesh, de: { x: number; y: number; z: number }, ate: { x: number; y: number; z: number }, r: number) => {
    dirF.set(ate.x - de.x, ate.y - de.y, ate.z - de.z); const len = dirF.length(); dirF.normalize();
    f.position.set(de.x, de.y, de.z); f.quaternion.setFromUnitVectors(cima, dirF); f.scale.set(r, len, r);
  };
  // brilho do núcleo (sprite) por líder
  const brilho = g(canvasTex(64, 64, (c) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(220,245,255,1)"); gr.addColorStop(0.35, "rgba(120,200,255,.6)"); gr.addColorStop(1, "rgba(40,120,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); }));
  const halos = Array.from({ length: NL }, () => { const s = new THREE.Sprite(g(new THREE.SpriteMaterial({ map: brilho, color: 0x8fd0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }))); s.scale.setScalar(5); group.add(s); return s; });

  const base = new THREE.Matrix4(), mat = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), um = new THREE.Vector3(1, 1, 1);
  const emissores = [...Array.from({ length: NL }, () => ({ obj: new THREE.Object3D(), lider: true, voando: false })), ...Array.from({ length: NM }, () => ({ obj: new THREE.Object3D(), lider: false, voando: false }))];
  for (const em of emissores) group.add(em.obj);
  const pousar = (lista: typeof lideres, i: number, b: THREE.Matrix4) => { for (const pt of lista) pt.locais.forEach((l, k) => pt.im.setMatrixAt(i * pt.locais.length + k, mat.multiplyMatrices(b, l))); };
  return {
    group, emissores,
    atualizar(dt) {
      const t = relogio(); void dt;
      GRUPOS_DROIDS.forEach((gr, i) => {
        const l = poseDoLider(gr, t);
        // o líder: BAIXO, na frente do telão, de frente pra ele (as costas pra quem chega), inclinado olhando o ponto
        // que lê; menor que os do céu (não tampa a tela)
        e.set(Math.atan2(l.alvo.y - l.y, 9) * 0.5 + Math.sin(t * 0.7 + i) * 0.04, l.rumo, Math.sin(t * 0.5 + i) * 0.06, "YXZ"); q.setFromEuler(e);
        base.compose(p.set(l.x, l.y, l.z), q, um.set(ESCALA_LIDER, ESCALA_LIDER, ESCALA_LIDER)); um.set(1, 1, 1); pousar(lideres, i, base);
        nucleoMat.color.setHSL(0.56, 1, 0.7 + 0.15 * Math.sin(t * 2.2));
        const f = feixes[i]!; f.visible = true; mirar(f, { x: l.x, y: l.y - 0.2, z: l.z }, l.alvo, 1.2 + 2.2 * l.lendo); (f.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.2 * l.lendo;
        emissores[i]!.obj.position.set(l.x, l.y, l.z); emissores[i]!.voando = l.lendoTela === null;
        halos[i]!.position.set(l.x, l.y - 0.2, l.z); halos[i]!.material.opacity = 0.55 + 0.35 * l.lendo;
        // os 2 menores: escaneando o GLOBO (de frente pra ele, girando devagar), um feixe fino cada
        poseDosMenores(gr, t).forEach((m, k) => {
          emissores[NL + i * 2 + k]!.obj.position.set(m.x, m.y, m.z);
          e.set(0, m.rumo, t * 0.8 + k * 1.3, "YXZ"); q.setFromEuler(e); base.compose(p.set(m.x, m.y, m.z), q, um); pousar(menores, i * 2 + k, base);
          const fm = feixesMen[i * 2 + k]!; mirar(fm, m, { x: gr.globo.x, y: gr.globo.y + Math.sin(t * 1.3 + k) * gr.globo.r * 0.5, z: gr.globo.z }, 0.7);
          (fm.material as THREE.MeshBasicMaterial).opacity = 0.16 + 0.1 * Math.sin(t * 3 + k);
        });
      });
      for (const pt of [...lideres, ...menores]) pt.im.instanceMatrix.needsUpdate = true;
    },
    dispose() { for (const x of liberar) x.dispose(); group.removeFromParent(); },
  };
}
