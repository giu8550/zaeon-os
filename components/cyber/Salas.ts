/**
 * Salas — os pavilhões da Zaeon. O LOUNGE é um CLUBE A CÉU ABERTO na plataforma própria (lá no alto, na altura do
 * início da ponta da capela — chega-se pela escada): PALCO alto de cristais de gelo com a MESA DO DJ (2 pickups +
 * controladora), a TRELIÇA de metal alta com as CAIXAS SUSPENSAS (line arrays penduradas nos braços), subs no chão,
 * (sem telão nem pista de LED: o centro do evento é a MANDALA em cima do DJ — components/cyber/MandalaSagrada) e as LUZES saindo do palco e da treliça. Tudo pulsa com
 * os GRAVES da música (`somTocando(on, nivel)`); parado, respira devagar. Guarda-corpo de vidro em volta com a
 * ENTRADA virada pra escada (o +z da sala). Layout, móveis e colisores em
 * lib/cyber/ceu.ts (CIDADE.salas, MOVEIS, PALCO) — aqui só o three. Sem estrobo; `low` corta os detalhes miúdos.
 * Luzes/feixes/LEDs são Basic/Shader (o `camuflarGrupo` não mexe neles); corpos sólidos são Standard (viram `solidoLeve`).
 */
import * as THREE from "three";
import { BN_NA_SALA, CAIXAS_SUSPENSAS, CIDADE, MESA_DJ, MOVEIS, PALCO, TORRE_DJ, TRELICA, rotDaSala, type Movel, type NomeSala } from "@/lib/cyber/ceu";
import { BOCA_DJ } from "@/lib/cyber/buracos";
import { DECK, GARAGEM_LOUNGE, PATIO, saidaDoLounge } from "@/lib/cyber/templo";
import { criarOlho } from "./OlhoHolografico";
import { criarMandala } from "./MandalaSagrada";
import { criarTempestade } from "./Tempestade";
import type { EstadoShow } from "@/lib/cyber/showLounge";
import { linhasDoRecado } from "@/lib/cyber/recado";
import type { PisoOclusor } from "./oclusaoPisos";

/** o tema de cada sala (sem placa com nome: os espaços falam por si) — todas a céu aberto, com guarda-corpo */
const TEMA: Record<NomeSala, { piso: number; brilho: number; cor: string; alt: number; aberto: boolean }> = {
  lounge: { piso: 0x120a24, brilho: 0xb98cff, cor: "#e2d0ff", alt: 1.6, aberto: true },
  garagem: { piso: 0x14100c, brilho: 0xffb46b, cor: "#ffe0bf", alt: 1.6, aberto: true },   // a ALA DOS VEÍCULOS (laranja)
  biblioteca: { piso: 0x081426, brilho: 0x7fb8ff, cor: "#d6e8ff", alt: 1.6, aberto: true },
  jardim: { piso: 0x07180f, brilho: 0x7dffb0, cor: "#d4ffe6", alt: 1.6, aberto: true },
};
/** paleta da festa (feixes, LEDs da pista, lasers) */
const FESTA = [0x66e6ff, 0xb98cff, 0xff5fd2, 0x6bff9a, 0x4d7bff];
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type Opts = { low: boolean; texturas: THREE.Texture[]; paredeMat: THREE.Material; /** a textura de ponto de luz (fumaça, faíscas) */ estrela?: THREE.Texture };
export type SalasHandle = {
  alvos: THREE.Object3D[];
  /** a TELA do telão do lounge (clicável: o dono escreve o recado pro QG do Andrei) */
  tv: THREE.Mesh | null;
  /** mostra no telão o último recado enviado ao QG (null = some) */
  mostrarRecado(texto: string | null): void;
  /** as TORRES DE SOM do lounge (a música sai delas) e a MESA DO DJ (onde se abre o player) */
  caixas: THREE.Object3D[]; tocaDiscos: THREE.Object3D | null;
  /** as CAIXAS DE SOM discretas dos espaços de convivência: de cada uma sai a música ambiente da sala (o engine toca) */
  ambiente: { sala: NomeSala; obj: THREE.Object3D }[];
  /** tem música tocando? + a energia dos graves agora (0..1): as luzes, as caixas e a pista pulsam com ela */
  somTocando(on: boolean, nivel?: number): void;
  /** o SHOW do lounge (lib/cyber/showLounge): o estado no ponto da música; `olho` = o modo ritual (o olho no lugar da mandala) */
  show(e: EstadoShow, olho: number): void;
  /** um relâmpago da névoa do lounge agora (`vel` = a velocidade do piscar; `alvoMundo` = onde cai — ex.: uma caixa de som) */
  raioNoLounge(vel?: number, alvoMundo?: THREE.Vector3): void;
  atualizar(dt: number, t: number): void;
  /** o conteúdo de cada sala por cima do piso (components/cyber/oclusaoPisos) */
  plataformas: PisoOclusor[];
};

/** o FEIXE de luz (volumétrico fake): cone aberto com o ápice na origem, abrindo pra +y; some na ponta e nas bordas */
function materialFeixe(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uCor: { value: new THREE.Color(0x66e6ff) }, uI: { value: 0.2 } },
    vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV;
      void main() { vH = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCor; uniform float uI; varying float vH; varying vec3 vN; varying vec3 vV;
      void main() { float f = abs(dot(normalize(vN), normalize(vV))); float a = uI * pow(1.0 - clamp(vH, 0.0, 1.0), 1.6) * pow(f, 1.4); gl_FragColor = vec4(uCor * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

export function criarSalas(ilha: THREE.Group, o: Opts): SalasHandle {
  const alvos: THREE.Object3D[] = [], anim: ((dt: number, t: number) => void)[] = [], calmo = reducedMotion();
  const plataformas: PisoOclusor[] = [];
  const tela = (w: number, h: number, pintar: (g: CanvasRenderingContext2D, w: number, h: number) => void, rep = false) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; pintar(c.getContext("2d")!, w, h);
    const t = new THREE.CanvasTexture(c); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; o.texturas.push(t); return t;
  };
  const caixa = (pai: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); pai.add(m); return m; };
  const basica = (cor: number, op = 1, aditivo = false) => new THREE.MeshBasicMaterial({ color: cor, transparent: op < 1 || aditivo, opacity: op, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !aditivo, side: THREE.DoubleSide });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x0d1220, roughness: 0.45, metalness: 0.5, emissive: 0x0a1226, emissiveIntensity: 0.5 });
  const gelo = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.15, metalness: 0.1, emissive: 0x1f5fa8, emissiveIntensity: 0.55 });
  const cristalMat = new THREE.MeshStandardMaterial({ color: 0xd6f4ff, roughness: 0.05, metalness: 0, emissive: 0x3aa8ff, emissiveIntensity: 0.55, transparent: true, opacity: 0.62 });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a5266, roughness: 0.35, metalness: 0.9, emissive: 0x10141e, emissiveIntensity: 0.5 });   // a treliça e os cabos

  // ── a BATIDA: energia dos graves (ataque rápido, solta devagar), o "pulso" (quando o grave sobe de repente) e o
  //    `ativo` (0 parado → 1 tocando, com fade) ──
  let tocando = false, nivelAlvo = 0, nivelAnt = 0, energia = 0, pulso = 0, ativo = 0, batidas = 0;
  const batida = () => ativo * (0.25 + 0.75 * energia);

  // texturas compartilhadas
  const texTV = tela(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#1a0b3a"); gr.addColorStop(0.5, "#0b2a55"); gr.addColorStop(1, "#2a0b3a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 5; k++) { g.strokeStyle = ["#66e6ff", "#b98cff", "#ff9ad5", "#9affd0", "#ffd36b"][k]!; g.globalAlpha = 0.7; g.lineWidth = 3; g.beginPath();
      for (let x = 0; x <= w; x += 4) { const y = h / 2 + Math.sin((x / w) * Math.PI * 4 + k) * (30 + k * 12) * Math.sin((x / w) * Math.PI * 2); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = "rgba(255,255,255,.9)"; g.font = "800 34px system-ui,sans-serif"; g.textAlign = "center"; g.fillText("ZAEON", w / 2, 50);
  }, true);
  const texDisco = tela(256, 256, (g, w) => { g.fillStyle = "#06060a"; g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); g.fill(); g.strokeStyle = "rgba(185,140,255,.25)"; for (let r = 30; r < w / 2; r += 5) { g.beginPath(); g.arc(w / 2, w / 2, r, 0, Math.PI * 2); g.stroke(); } g.fillStyle = "#b98cff"; g.beginPath(); g.arc(w / 2, w / 2, 26, 0, Math.PI * 2); g.fill(); g.fillStyle = "#66e6ff"; g.fillRect(w / 2 - 20, w / 2 - 3, 18, 6); });
  const texGelo = tela(512, 512, (g, w, h) => {   // topo do palco: gelo com "rachaduras" de luz e um hexágono no meio
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, "#2a5f9a"); gr.addColorStop(1, "#0d2448"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(170,230,255,.55)"; g.lineWidth = 2;
    for (let k = 0; k < 26; k++) { let x = w / 2, y = h / 2, a = (k / 26) * Math.PI * 2; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 7; s++) { a += (Math.sin(k * 7.3 + s * 3.1) * 0.5); x += Math.cos(a) * 36; y += Math.sin(a) * 36; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = "rgba(102,230,255,.9)"; g.lineWidth = 5; g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6, x = w / 2 + Math.cos(a) * 90, y = h / 2 + Math.sin(a) * 90; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  });

  let tvTela: THREE.Mesh | null = null, recadoFaixa: THREE.Mesh | null = null, tocaDiscos: THREE.Object3D | null = null;
  const caixasSom: THREE.Object3D[] = [];
  const cRecado = document.createElement("canvas"); cRecado.width = 1024; cRecado.height = 220;
  const texRecado = new THREE.CanvasTexture(cRecado); o.texturas.push(texRecado);

  /** um FEIXE (moving head) preso a `pai`: base + cabeça que gira (pan/tilt) + o cone de luz; anima sozinho */
  const feixe = (pai: THREE.Object3D, x: number, y: number, z: number, o2: { len: number; abre: number; rumo: number; incl: number; fase: number; cor: number; varre?: number }) => {
    const base = new THREE.Group(); base.position.set(x, y, z); base.rotation.y = o2.rumo; pai.add(base);
    caixa(base, 0.36, 0.12, 0.36, escuro, 0, 0.06, 0);
    const cab = new THREE.Group(); cab.position.y = 0.32; base.add(cab);
    const corpo = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.36, 10), escuro); cab.add(corpo);
    const lente = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), basica(o2.cor, 0.95, true)); lente.position.y = 0.185; lente.rotation.x = -Math.PI / 2; cab.add(lente);
    const g = new THREE.ConeGeometry(1, 1, o.low ? 12 : 20, 1, true); g.rotateX(Math.PI); g.translate(0, 0.5, 0);
    const mat = materialFeixe(); mat.uniforms.uCor!.value.setHex(o2.cor);
    const cone = new THREE.Mesh(g, mat); cone.scale.set(o2.abre, o2.len, o2.abre); cone.position.y = 0.18; cone.renderOrder = 3; cone.frustumCulled = false; cab.add(cone);
    const cor = new THREE.Color(), varre = o2.varre ?? 0.55;
    anim.push((_, t) => {
      const v = calmo ? 0.25 : 1 + 0.6 * ativo, tt = t * v;
      cab.rotation.x = o2.incl + 0.22 * Math.sin(tt * 0.7 + o2.fase);                  // inclina pra frente (+z: rumo à pista)
      cab.rotation.z = varre * Math.sin(tt * 0.45 + o2.fase * 1.7);                      // varre de um lado pro outro
      cor.setHex(FESTA[Math.floor(t * 0.25 + o2.fase) % FESTA.length]!); mat.uniforms.uCor!.value.lerp(cor, 0.02);
      mat.uniforms.uI!.value = 0.07 + 0.55 * batida() + 0.25 * pulso * ativo;
      (lente.material as THREE.MeshBasicMaterial).color.copy(mat.uniforms.uCor!.value);
    });
  };
  /** um CONE DE CAIXA: aro escuro + domo que bombeia com o grave + anel de luz */
  const altoFalante = (pai: THREE.Object3D, x: number, y: number, z: number, r: number, cor: number) => {
    const aro = new THREE.Mesh(new THREE.CircleGeometry(r, o.low ? 20 : 32), coneMat); aro.position.set(x, y, z + 0.01); pai.add(aro);
    const domo = new THREE.Mesh(new THREE.SphereGeometry(r * 0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), escuro); domo.rotation.x = Math.PI / 2; domo.position.set(x, y, z + 0.02); domo.scale.y = 0.35; pai.add(domo);
    const anel = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.06 + r * 0.04, 40), basica(cor, 0.85, true)); anel.position.set(x, y, z + 0.03); pai.add(anel);
    anim.push(() => { const b = batida(), p = 1 + 0.12 * b + 0.08 * pulso * ativo; anel.scale.setScalar(p); domo.scale.y = 0.35 + 0.5 * b; (anel.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.6 * b; });
  };

  let salaAtual: NomeSala = "lounge";
  let showLounge: { olho: { group: THREE.Group }; mandala: ReturnType<typeof criarMandala>; nevoa: ReturnType<typeof criarTempestade>; grupo: THREE.Group } | null = null;
  let estadoShow: EstadoShow = { nascimento: 0, forma: 0, proxima: 1, mistura: 0, complexidade: 0, area: 1, serpentes: 0, tentaculos: 0, dna: 0, nevoa: 0, nivel: 0, turno: 0, olho: 0, anelSigilos: 0, sigilo: -1 }, olhoRitual = 0;
  const ambiente: { sala: NomeSala; obj: THREE.Object3D }[] = [];
  const tema = (_m: Movel) => TEMA[salaAtual];
  const MOVEL: Record<string, (p: THREE.Group, m: Movel, tema: typeof TEMA[NomeSala]) => void> = {
    // TELÃO alto atrás do palco (acima da coroa de cristais): é a "TV" do recado pro QG
    tv(p, m) {
      const W = m.larg, H = W * 0.45, yC = TORRE_DJ.topo + 4 + H / 2, pe = yC - H / 2;   // acima da cabine da torre
      caixa(p, W + 0.5, H + 0.5, m.prof, escuro, 0, yC, -0.1);
      for (const sx of [-1, 1]) caixa(p, 0.4, pe, 0.4, escuro, sx * (W / 2 - 0.8), pe / 2, -0.1);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: texTV })); s.position.set(0, yC, m.prof / 2 - 0.08); p.add(s); tvTela = s;
      // faixa do RECADO (não rola com as ondas): o último enviado ao QG, por cima da parte de baixo da tela
      recadoFaixa = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.6, (W - 0.6) * 0.215), new THREE.MeshBasicMaterial({ map: texRecado, transparent: true, depthWrite: false })); recadoFaixa.position.set(0, yC - H / 2 + 0.75, m.prof / 2 - 0.06); recadoFaixa.visible = false; p.add(recadoFaixa);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, H + 1.6), basica(0x6a5aff, 0.16, true)); h.position.set(0, yC, -0.45); p.add(h);
      anim.push((dt) => { texTV.offset.x = (texTV.offset.x + dt * (0.04 + 0.2 * batida())) % 1; (h.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.3 * batida(); });
    },
    // PALCO de CRISTAL DE GELO: plataforma de 12 faces, topo de gelo rachado de luz, escada na frente, COROA de cristais
    // atrás da mesa, cristais baixos em volta e os FEIXES de luz saindo dele
    palco(p) {
      const { r, h, escada } = PALCO, seg = 12;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.35, h, seg), gelo); base.position.y = h / 2; p.add(base);
      const topo = new THREE.Mesh(new THREE.CircleGeometry(r - 0.02, seg), new THREE.MeshBasicMaterial({ map: texGelo })); topo.rotation.x = -Math.PI / 2; topo.position.y = h + 0.012; p.add(topo); alvos.push(topo);
      const borda = new THREE.Mesh(new THREE.RingGeometry(r - 0.28, r - 0.04, seg), basica(0x66e6ff, 0.8, true)); borda.rotation.x = -Math.PI / 2; borda.position.y = h + 0.02; p.add(borda);
      const faixa = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.2, r + 0.22, 0.14, seg, 1, true), basica(0x66e6ff, 0.8, true)); faixa.position.y = h * 0.5; p.add(faixa);
      // escada: 4 degraus com a quina acesa (a rampa da colisão acompanha)
      const z0 = r - 0.3, nD = Math.max(4, Math.round(h / 0.38)), k = r / 5;   // `k`: os cristais crescem com o palco
      for (let i = 0; i < nD; i++) {
        const top = (h * (nD - i)) / (nD + 1), zc = z0 + ((i + 0.5) * escada.len) / nD;
        caixa(p, escada.meia * 2, top, escada.len / nD, gelo, 0, top / 2, zc);
        caixa(p, escada.meia * 2, 0.03, 0.05, basica(0x9fe8ff, 0.9, true), 0, top + 0.01, zc + escada.len / nD / 2 - 0.03);
      }
      // CRISTAIS: prisma hexagonal com ponta (Lathe de 6 lados = facetado); casca translúcida + miolo aceso que pulsa
      const perfil = [new THREE.Vector2(0, 0), new THREE.Vector2(0.85, 0), new THREE.Vector2(1, 0.1), new THREE.Vector2(1, 0.7), new THREE.Vector2(0, 1)];
      const geo = new THREE.LatheGeometry(perfil, 6);
      const lista: { x: number; z: number; y: number; w: number; alt: number; ix: number; iz: number; gira: number }[] = [];
      const nCoroa = o.low ? 9 : 15;
      for (let i = 0; i < nCoroa; i++) {   // a COROA: arco atrás da mesa, mais alto no meio, abrindo pra fora
        const u = i / (nCoroa - 1), a = Math.PI * (1.12 + 0.76 * u), meio = 1 - Math.abs(u - 0.5) * 2;
        const rr = r - 0.65 * k - (i % 2) * 0.35 * k, alt = (1.4 + 3.2 * meio * meio + (i % 3) * 0.35) * k;
        lista.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr, y: h, w: (0.32 + 0.3 * meio + (i % 2) * 0.08) * k, alt, ix: Math.sin(a) * 0.22, iz: -Math.cos(a) * 0.22, gira: i * 0.7 });
      }
      const nVolta = o.low ? 8 : 16;
      for (let i = 0; i < nVolta; i++) {   // cristais BAIXOS no chão, colados na borda (menos na boca da escada)
        const a = (i / nVolta) * Math.PI * 2 + 0.1, x = Math.cos(a) * (r + 0.45 * k), z = Math.sin(a) * (r + 0.45 * k);
        if (z > 0 && Math.abs(x) < escada.meia + 0.6 * k) continue;
        lista.push({ x, z, y: 0, w: (0.28 + (i % 3) * 0.1) * k, alt: (0.8 + (i % 4) * 0.35) * k * 1.4, ix: Math.sin(a) * 0.3, iz: -Math.cos(a) * 0.3, gira: i });
      }
      const casca = new THREE.InstancedMesh(geo, cristalMat, lista.length), miolo = new THREE.InstancedMesh(geo, basica(0x66e6ff, 0.5, true), lista.length);
      { const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
        lista.forEach((c, i) => {
          q.setFromEuler(e.set(c.ix, c.gira, c.iz)); pv.set(c.x, c.y - 0.05, c.z);
          casca.setMatrixAt(i, mm.compose(pv, q, sv.set(c.w, c.alt, c.w)));
          miolo.setMatrixAt(i, mm.compose(pv, q, sv.set(c.w * 0.55, c.alt * 0.85, c.w * 0.55)));
        });
        casca.instanceMatrix.needsUpdate = true; miolo.instanceMatrix.needsUpdate = true; casca.computeBoundingSphere(); miolo.computeBoundingSphere(); }
      casca.renderOrder = 2; p.add(miolo, casca);
      const mioloMat = miolo.material as THREE.MeshBasicMaterial, corM = new THREE.Color();
      anim.push((_, t) => { mioloMat.opacity = 0.28 + 0.6 * batida() + 0.2 * pulso * ativo; corM.setHex(FESTA[Math.floor(t * 0.18) % FESTA.length]!); mioloMat.color.lerp(corM, 0.015); (borda.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.5 * batida(); (faixa.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.6 * batida(); });
      // FEIXES saindo do palco: na borda de trás e dos lados, virados pra pista (+z), varrendo a sala
      const nF = o.low ? 4 : 8;
      for (let i = 0; i < nF; i++) {
        const u = i / (nF - 1), a = Math.PI * (1.05 + 0.9 * u), rr = r - 0.4;
        feixe(p, Math.cos(a) * rr, h, Math.sin(a) * rr, { len: 36, abre: 2.2, rumo: 0, incl: 0.55 + (i % 2) * 0.25, fase: i * 1.3, cor: FESTA[i % FESTA.length]!, varre: 0.7 });
      }
      // LEQUE DE LASER saindo da frente da mesa do DJ (na altura da cabeça de quem dança)
      const nL = o.low ? 8 : 14, origem = new THREE.Vector3(0, TORRE_DJ.topo + MESA_DJ.topo - 0.25, MESA_DJ.z - PALCO.z + MESA_DJ.prof / 2 + 0.05);   // da mesa, lá em cima na torre
      const lg = new THREE.BufferGeometry(), lp = new Float32Array(nL * 6); lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
      const laser = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x6bff9a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); laser.frustumCulled = false; laser.renderOrder = 3; p.add(laser);
      const corL = new THREE.Color();
      anim.push((_, t) => {
        const lm = laser.material as THREE.LineBasicMaterial; lm.opacity = ativo * (0.25 + 0.7 * energia);
        laser.visible = lm.opacity > 0.01; if (!laser.visible) return;
        corL.setHex([0x6bff9a, 0x66e6ff, 0xff5fd2][Math.floor(t * 0.12) % 3]!); lm.color.lerp(corL, 0.03);
        const tt = calmo ? t * 0.3 : t, abre = 0.9 + 0.25 * Math.sin(tt * 0.6), gira = 0.35 * Math.sin(tt * 0.33), sobe = 0.12 * Math.sin(tt * 0.9);
        for (let i = 0; i < nL; i++) {
          const a = gira + (i / (nL - 1) - 0.5) * 2 * abre, L = 24;
          lp.set([origem.x, origem.y, origem.z, origem.x + Math.sin(a) * L, origem.y + sobe * L * (0.6 + 0.4 * Math.sin(i + tt)), origem.z + Math.cos(a) * L], i * 6);
        }
        lg.attributes.position!.needsUpdate = true;
      });
    },
    // MESA DO DJ (em cima do palco): corpo de gelo com equalizador na frente, 2 PICKUPS girando e a CONTROLADORA no meio
    mesaDJ(p, m) {
      const T = MESA_DJ.topo;
      caixa(p, m.larg, T - 0.06, m.prof, escuro, 0, (T - 0.06) / 2, 0);
      caixa(p, m.larg + 0.12, 0.06, m.prof + 0.12, gelo, 0, T - 0.03, 0);
      // frente: equalizador (barras que dançam com o grave) sobre um painel de gelo
      caixa(p, m.larg - 0.1, T - 0.2, 0.04, gelo, 0, (T - 0.06) / 2, m.prof / 2 + 0.01);
      // (num InstancedMesh só: 1 draw — antes 1 mesh + 1 material por barra)
      const nB = o.low ? 10 : 18, wB = (m.larg - 0.5) / nB - 0.04, gB = new THREE.BoxGeometry(wB, 1, 0.02); gB.translate(0, 0.5, 0);
      const barras = new THREE.InstancedMesh(gB, basica(0xffffff, 0.9, true), nB), mB = new THREE.Matrix4(), xB = (i: number) => -((m.larg - 0.5) / 2) + ((i + 0.5) * (m.larg - 0.5)) / nB;
      for (let i = 0; i < nB; i++) { barras.setMatrixAt(i, mB.makeTranslation(xB(i), 0.12, m.prof / 2 + 0.04)); barras.setColorAt(i, new THREE.Color(FESTA[i % FESTA.length]!)); }
      barras.computeBoundingSphere(); barras.frustumCulled = false; p.add(barras);   // (a esfera muda com a altura das barras)
      anim.push((_, t) => { for (let i = 0; i < nB; i++) { const v = 0.06 + (T - 0.4) * (0.15 + 0.85 * batida()) * (0.35 + 0.65 * Math.abs(Math.sin(t * (2.3 + (i % 5) * 0.7) + i * 1.9))); barras.setMatrixAt(i, mB.makeScale(1, v, 1).setPosition(xB(i), 0.12, m.prof / 2 + 0.04)); } barras.instanceMatrix.needsUpdate = true; });
      // os 2 PICKUPS
      const pratos: THREE.Mesh[] = [];
      for (const sx of [-1, 1]) {
        const x = sx * (m.larg / 2 - 0.55);
        caixa(p, 0.92, 0.08, 0.72, escuro, x, T + 0.04, 0);
        const prato = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.03, 32), coneMat); prato.position.set(x - 0.06, T + 0.095, 0); p.add(prato);
        const disco = new THREE.Mesh(new THREE.CircleGeometry(0.29, 40), new THREE.MeshBasicMaterial({ map: texDisco })); disco.rotation.x = -Math.PI / 2; disco.position.set(x - 0.06, T + 0.112, 0); p.add(disco); pratos.push(disco);
        const aro = new THREE.Mesh(new THREE.RingGeometry(0.31, 0.335, 40), basica(sx < 0 ? 0x66e6ff : 0xb98cff, 0.9, true)); aro.rotation.x = -Math.PI / 2; aro.position.set(x - 0.06, T + 0.1, 0); p.add(aro);
        const braco = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.36), new THREE.MeshStandardMaterial({ color: 0xc8ccd8, roughness: 0.2, metalness: 0.9 })); braco.position.set(x + 0.3, T + 0.13, 0.04); braco.rotation.y = 0.45; p.add(braco);
        caixa(p, 0.04, 0.02, 0.16, basica(0x9affd0, 0.9, true), x + 0.36, T + 0.09, -0.22);   // pitch
      }
      // a CONTROLADORA / mixer no meio: knobs, faders, crossfader e VU
      const MX = 0.78, MZ = 0.62;
      caixa(p, MX, 0.1, MZ, escuro, 0, T + 0.05, 0);
      caixa(p, MX - 0.04, 0.005, MZ - 0.04, new THREE.MeshStandardMaterial({ color: 0x141a2e, roughness: 0.3, metalness: 0.5, emissive: 0x0a1630, emissiveIntensity: 0.6 }), 0, T + 0.103, 0);
      const knob = new THREE.CylinderGeometry(0.025, 0.028, 0.035, 10), knobMat = new THREE.MeshStandardMaterial({ color: 0xd8dcea, roughness: 0.3, metalness: 0.7 });
      if (!o.low) for (let c = 0; c < 4; c++) for (let l = 0; l < 3; l++) { const k = new THREE.Mesh(knob, knobMat); k.position.set(-0.27 + c * 0.18, T + 0.12, -0.24 + l * 0.08); p.add(k); }
      const faders: THREE.Mesh[] = [];
      for (let c = 0; c < 4; c++) { caixa(p, 0.012, 0.004, 0.18, basica(0x2a3550), -0.27 + c * 0.18, T + 0.106, 0.08); faders.push(caixa(p, 0.05, 0.03, 0.03, basica(FESTA[c]!, 0.95, true), -0.27 + c * 0.18, T + 0.12, 0.08)); }
      const cross = caixa(p, 0.07, 0.03, 0.035, basica(0xffffff, 0.9, true), 0, T + 0.12, 0.25);
      // VU (InstancedMesh: o segmento apagado vai a escala 0)
      const vu = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.01, 0.022), basica(0xffffff, 0.95, true), 16), mV = new THREE.Matrix4(), posVU: [number, number][] = [];
      for (let l = 0; l < 8; l++) for (const sx of [-1, 1]) { const i = posVU.length; posVU.push([sx * 0.36, 0.24 - l * 0.035]); vu.setMatrixAt(i, mV.makeTranslation(sx * 0.36, T + 0.108, 0.24 - l * 0.035)); vu.setColorAt(i, new THREE.Color(l > 6 ? 0xff5f6b : l > 4 ? 0xffd36b : 0x6bff9a)); }
      vu.computeBoundingSphere(); p.add(vu); let vuAnt = -1;
      tocaDiscos = p;
      anim.push((dt, t) => {
        if (tocando) for (const d of pratos) d.rotation.z -= dt * 3.5;
        const b = batida(); faders.forEach((f, i) => { f.position.z = 0.08 + 0.06 * Math.sin(t * 0.5 + i * 1.7) * ativo; });
        cross.position.x = 0.2 * Math.sin(t * 0.8) * ativo;
        const nv = Math.round(b * 8 + (pulso * 2 * ativo));
        if (nv !== vuAnt) { vuAnt = nv; posVU.forEach(([x, z], i) => vu.setMatrixAt(i, Math.floor(i / 2) < nv ? mV.makeTranslation(x, T + 0.108, z) : mV.makeScale(0, 0, 0))); vu.instanceMatrix.needsUpdate = true; }
      });
    },
    // A TORRE DO DJ (a MEGA ESTRUTURA): do palco sobe uma coluna hexagonal de cristal com o núcleo aceso, cristais
    // gigantes inclinados em volta e anéis de LED que sobem no compasso; lá no alto, a CABINE (piso de gelo, guarda-corpo
    // de vidro, feixes); atrás, o ELEVADOR DE LUZ que só DESCE (coluna com anéis descendo + a passarela até a cabine) e a
    // BOCA do buraco negro grande (o anel na cabine + o fio de luz até o buraco, lá em cima do palco) — a única entrada
    torreDJ(p) {
      const T = TORRE_DJ, A = T.topo - PALCO.h, k = T.r / 4.5, e = T.elevador;   // (o grupo já está no topo do palco)
      const nucleoMat = basica(0x66e6ff, 0.35, true);
      const coluna = new THREE.Mesh(new THREE.CylinderGeometry(T.r * 0.78, T.r * 0.9, A, 6), cristalMat); coluna.position.y = A / 2; p.add(coluna);
      const nucleo = new THREE.Mesh(new THREE.CylinderGeometry(T.r * 0.45, T.r * 0.55, A, 6, 1, true), nucleoMat); nucleo.position.y = A / 2; p.add(nucleo);
      // cristais gigantes em volta, abrindo pra fora (o "buquê" de gelo)
      const perfil = [new THREE.Vector2(0, 0), new THREE.Vector2(0.85, 0), new THREE.Vector2(1, 0.1), new THREE.Vector2(1, 0.7), new THREE.Vector2(0, 1)];
      const geo = new THREE.LatheGeometry(perfil, 6), nC = o.low ? 6 : 10, casca = new THREE.InstancedMesh(geo, cristalMat, nC), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), ev = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
      for (let i = 0; i < nC; i++) { const a = (i / nC) * Math.PI * 2 + 0.3, rr = T.r * 0.95, alt = (A * 0.7 + (i % 3) * 2.2) * 1, w = 0.9 + (i % 2) * 0.45; q.setFromEuler(ev.set(Math.sin(a) * 0.32, a, -Math.cos(a) * 0.32)); casca.setMatrixAt(i, mm.compose(pv.set(Math.cos(a) * rr, 0, Math.sin(a) * rr), q, sv.set(w * k, alt, w * k))); }
      casca.instanceMatrix.needsUpdate = true; casca.computeBoundingSphere(); casca.renderOrder = 2; p.add(casca);
      // anéis de LED subindo no compasso
      const aneis: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) { const an = new THREE.Mesh(new THREE.TorusGeometry(T.r * 0.82, 0.07, 6, 48), basica(0xb98cff, 0.8, true)); an.rotation.x = Math.PI / 2; an.position.y = (i + 0.5) * (A / 4); p.add(an); aneis.push(an); }
      // a CABINE lá em cima: laje, piso de gelo, aro aceso, guarda-corpo de vidro com corrimão de luz, base em cone
      const laje = new THREE.Mesh(new THREE.CylinderGeometry(T.r + 0.35, T.r * 0.7, 0.9, 32), gelo); laje.position.y = A - 0.45; p.add(laje);
      const piso = new THREE.Mesh(new THREE.CircleGeometry(T.r + 0.3, 32), new THREE.MeshBasicMaterial({ map: texGelo })); piso.rotation.x = -Math.PI / 2; piso.position.y = A + 0.012; p.add(piso); alvos.push(piso);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(T.r + 0.32, 0.08, 6, 64), basica(0x66e6ff, 0.9, true)); aro.rotation.x = Math.PI / 2; aro.position.y = A + 0.03; p.add(aro);
      const vidroGC = new THREE.Mesh(new THREE.CylinderGeometry(T.r + 0.1, T.r + 0.1, 1.1, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x0a1830, emissive: 0x3a4a90, emissiveIntensity: 0.4, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
      vidroGC.position.y = A + 0.55; p.add(vidroGC);
      const corrimao = new THREE.Mesh(new THREE.TorusGeometry(T.r + 0.1, 0.05, 6, 64), basica(0xb98cff, 0.9, true)); corrimao.rotation.x = Math.PI / 2; corrimao.position.y = A + 1.1; p.add(corrimao);
      // feixes no guarda-corpo da frente, pra pista
      for (const [i, a] of [-0.9, -0.3, 0.3, 0.9].entries()) feixe(p, Math.sin(a) * (T.r - 0.2), A + 1.15, Math.cos(a) * (T.r - 0.2), { len: 40, abre: 2.4, rumo: 0, incl: 1.2, fase: i * 1.7, cor: FESTA[(i + 1) % FESTA.length]!, varre: 0.6 });
      // o ELEVADOR DE LUZ (só desce): coluna de luz da cabine até o palco com anéis descendo, a passarela do guarda-corpo
      // e o anel de descer lá em cima (posições no referencial da sala − o centro da torre). Subir, só pelo buraco negro.
      const zS = e.sobe - T.z, zD = e.desce - T.z;
      const feixeElev = new THREE.Mesh(new THREE.CylinderGeometry(e.r * 0.9, e.r, A + 0.6, 24, 1, true), basica(0x9affd0, 0.16, true)); feixeElev.position.set(0, (A + 0.6) / 2, zS); p.add(feixeElev);
      const subindo: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) { const r2 = new THREE.Mesh(new THREE.TorusGeometry(e.r * 0.95, 0.04, 6, 32), basica(0x9affd0, 0.8, true)); r2.rotation.x = Math.PI / 2; r2.position.set(0, (i / 4) * A, zS); p.add(r2); subindo.push(r2); }
      const passarela = new THREE.Mesh(new THREE.PlaneGeometry(1.6, Math.abs(zS) - T.r + 0.4), basica(0x9affd0, 0.25, true)); passarela.rotation.x = -Math.PI / 2; passarela.position.set(0, A + 0.02, (zS + -T.r) / 2); p.add(passarela);
      const anelCima = new THREE.Mesh(new THREE.RingGeometry(e.rDesce - 0.12, e.rDesce, 32), basica(0x9affd0, 0.9, true)); anelCima.rotation.x = -Math.PI / 2; anelCima.position.set(0, A + 0.03, zD); p.add(anelCima);
      // a BOCA do par do dono, na cabine: aro quente + poço escuro + um aro girando — pisou (o dono) = atravessa pra nave
      // (o buraco negro grande que pairava em cima do palco saiu: no lugar dele, o olho/a mandala do show)
      const bx = BOCA_DJ.x, bz = BOCA_DJ.z - T.z;
      const bocaAro = new THREE.Mesh(new THREE.TorusGeometry(BOCA_DJ.r, 0.06, 6, 40), basica(0xffb45a, 0.9, true)); bocaAro.rotation.x = Math.PI / 2; bocaAro.position.set(bx, A + 0.05, bz); p.add(bocaAro);
      const bocaPoco = new THREE.Mesh(new THREE.CircleGeometry(BOCA_DJ.r - 0.05, 32), new THREE.MeshBasicMaterial({ color: 0x05030a, transparent: true, opacity: 0.9 })); bocaPoco.rotation.x = -Math.PI / 2; bocaPoco.position.set(bx, A + 0.03, bz); p.add(bocaPoco);
      const bocaGiro = new THREE.Mesh(new THREE.RingGeometry(BOCA_DJ.r * 0.5, BOCA_DJ.r * 0.6, 32, 1, 0, Math.PI * 1.5), basica(0xff7a2c, 0.8, true)); bocaGiro.rotation.x = -Math.PI / 2; bocaGiro.position.set(bx, A + 0.04, bz); p.add(bocaGiro);
      anim.push((dt, t) => {
        const b = batida(); nucleoMat.opacity = 0.22 + 0.45 * b + 0.2 * pulso * ativo;
        aneis.forEach((an, i) => { (an.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.7 * Math.max(0, Math.sin(t * 3 - i * 0.9)) * (0.4 + 0.6 * b); });
        subindo.forEach((r2) => { r2.position.y = (r2.position.y - dt * 3 + A) % A; (r2.material as THREE.MeshBasicMaterial).opacity = 0.8 * (r2.position.y / A); });   // descendo
        (anelCima.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.3 * Math.sin(t * 2.5 + 1);
        (bocaAro.material as THREE.MeshBasicMaterial).opacity = 0.65 + 0.3 * Math.sin(t * 3); bocaGiro.rotation.z -= dt * 2;
      });
    },
    // CAIXA SUSPENSA: um LINE ARRAY pendurado no braço da treliça (cabos de aço até lá em cima) — 8 gabinetes curvando
    // em "J" (o de baixo mira a pista), cada um com 2 cones e a corneta, frisos de luz que pulsam com o grave
    caixaSom(p) {
      const N = o.low ? 6 : 8, W = 3.2, Hc = 0.85, D = 1.7, topo = TRELICA.alt - 6, mira = new THREE.Group(); p.add(mira);
      const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), um = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
      const gab = new THREE.InstancedMesh(new THREE.BoxGeometry(W, Hc, D), escuro, N), frente = new THREE.InstancedMesh(new THREE.PlaneGeometry(W - 0.2, Hc - 0.16), coneMat, N);
      const luz = new THREE.InstancedMesh(new THREE.BoxGeometry(W, 0.05, 0.05), basica(0xb98cff, 0.9, true), N);
      let y = topo, ang = 0;
      for (let i = 0; i < N; i++) {   // cada gabinete pendura no de cima e inclina um pouco mais (a curva do "J")
        ang += i < 3 ? 0.02 : 0.07; y -= Hc * Math.cos(ang);
        q.setFromEuler(e.set(ang, 0, 0)); const fz = Math.sin(ang) * Hc * i * 0.5;
        gab.setMatrixAt(i, mm.compose(pv.set(0, y, fz), q, um));
        frente.setMatrixAt(i, mm.compose(pv.set(0, y, fz + D / 2 + 0.01), q, um));
        luz.setMatrixAt(i, mm.compose(pv.set(0, y - Hc / 2 + 0.03, fz + D / 2 + 0.03), q, um));
      }
      for (const im of [gab, frente, luz]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); mira.add(im); }
      // a moldura (bumper) no topo + os cabos de aço até o braço da treliça
      caixa(mira, W + 0.4, 0.25, D + 0.3, metal, 0, topo + 0.2, 0);
      for (const sx of [-1, 1]) caixa(mira, 0.05, TRELICA.alt - topo - 0.4, 0.05, metal, sx * (W / 2 - 0.2), (TRELICA.alt + topo) / 2 + 0.1, 0);
      const boca = new THREE.Object3D(); boca.position.set(0, (topo + y) / 2, D / 2 + 0.5); mira.add(boca); caixasSom.push(boca);   // de onde a música sai
      // a ONDA (a que era da pista de LED): a cada batida, anéis de luz saem da boca da caixa e correm pela sala — num
      // disco vertical na frente dela (o centro do evento é a mandala; o chão fica livre)
      const ondaMat = new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uB: { value: 0 }, uOnda: { value: 40 }, uA: { value: 0 } },
        vertexShader: `varying vec2 vP; void main() { vP = (uv - 0.5) * 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uT, uB, uOnda, uA; varying vec2 vP;
          vec3 pal(float k) { k = fract(k); return k < 0.2 ? vec3(0.4,0.9,1.0) : k < 0.4 ? vec3(0.73,0.55,1.0) : k < 0.6 ? vec3(1.0,0.37,0.82) : k < 0.8 ? vec3(0.42,1.0,0.6) : vec3(0.3,0.48,1.0); }
          void main() {
            float d = length(vP) * 18.0;
            float onda = exp(-pow((d - uOnda) * 0.9, 2.0)) + 0.55 * exp(-pow((d - uOnda + 2.2) * 0.9, 2.0)) + 0.3 * exp(-pow((d - uOnda + 4.4) * 0.9, 2.0));
            float v = onda * uA * (0.45 + 0.55 * uB) * smoothstep(18.0, 12.0, d);
            vec3 col = pal(d * 0.04 + uT * 0.1) * v;
            gl_FragColor = vec4(col, v);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const onda = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), ondaMat); onda.position.set(0, (topo + y) / 2, D / 2 + 0.6); onda.renderOrder = 3; mira.add(onda); onda.userData.semLote = true;
      let vistaC = 0;
      const luzMat = luz.material as THREE.MeshBasicMaterial;
      anim.push((dt, t) => {
        luzMat.opacity = 0.35 + 0.65 * batida(); mira.position.z = 0.02 * batida();
        const u = ondaMat.uniforms; u.uT!.value = t; u.uB!.value = energia; u.uA!.value = ativo;
        if (batidas !== vistaC) { vistaC = batidas; u.uOnda!.value = 0; } else u.uOnda!.value += dt * 14;   // a onda nasce na boca a cada batida e corre pra fora
      });
    },
    // TORRE DE SOM gigante no chão (a de antes, maior: 10 m): subs embaixo, 4 médios, corneta em cima; LEDs nas quinas
    // e um feixe no topo — a música sai das caixas SUSPENSAS; estas dão o peso visual do palco
    torreSom(p, m) {
      const W = m.larg, D = m.prof, H = 10, k = H / 7.5, fz = D / 2;
      caixa(p, W, H, D, escuro, 0, H / 2, 0);
      for (const y of [2.5 * k, 5.6 * k]) caixa(p, W + 0.06, 0.1, D + 0.06, gelo, 0, y, 0);   // divisórias dos módulos
      for (const x of [-W / 4, W / 4]) altoFalante(p, x, 1.25 * k, fz, 0.62 * k * (W / 3.6) * 1.1, 0xb98cff);   // SUBS
      for (const [x, y] of [[-W / 4, 3.3 * k], [W / 4, 3.3 * k], [-W / 4, 4.8 * k], [W / 4, 4.8 * k]] as const) altoFalante(p, x, y, fz, 0.42 * k, 0x66e6ff);
      const corneta = new THREE.Mesh(new THREE.CylinderGeometry(0.75 * k, 0.25 * k, 0.5 * k, 4, 1, true), coneMat); corneta.rotation.x = Math.PI / 2; corneta.rotation.y = Math.PI / 4; corneta.scale.set(1.6, 1, 0.6); corneta.position.set(0, 6.55 * k, fz - 0.24 * k); p.add(corneta);
      for (const x of [-W / 2 + 0.45, W / 2 - 0.45]) altoFalante(p, x, 6.55 * k, fz, 0.16 * k, 0xff5fd2);
      const quinas: THREE.Mesh[] = [];
      for (const sx of [-1, 1]) quinas.push(caixa(p, 0.08, H - 0.2, 0.08, basica(0xb98cff, 0.9, true), sx * (W / 2 + 0.03), H / 2, fz + 0.03));
      caixa(p, W, 0.08, 0.08, basica(0x66e6ff, 0.9, true), 0, H + 0.03, fz);
      anim.push(() => { for (const q of quinas) (q.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.6 * batida(); });
      const topo = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), cristalMat); topo.scale.y = 1.8; topo.position.set(0, H + 1.5, 0); p.add(topo);
      feixe(p, 0, H + 0.05, fz - 0.3, { len: 30, abre: 1.8, rumo: 0, incl: 1.05, fase: m.x * 0.3, cor: 0xff5fd2, varre: 0.4 });
    },
    // TRELIÇA: torre de metal alta (4 montantes + travessas em X), no topo a VIGA até a outra torre e um BRAÇO que avança
    // pra frente (de onde pende a caixa suspensa); LED nos montantes e um feixe no alto
    trelica(p, m) {
      const A = TRELICA.alt, l = m.larg / 2 - 0.15, seg = 2.6, nS = Math.floor(A / seg), lado = Math.sign(m.x) || 1;
      const montante = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, A, 0.22), metal, 4), mm = new THREE.Matrix4();
      [[-l, -l], [l, -l], [-l, l], [l, l]].forEach(([x, z], i) => montante.setMatrixAt(i, mm.makeTranslation(x!, A / 2, z!)));
      montante.instanceMatrix.needsUpdate = true; montante.computeBoundingSphere(); p.add(montante);
      const xs: number[] = [];   // travessas em X nas 4 faces (linhas: leves e com cara de treliça)
      for (let k = 0; k < nS; k++) {
        const y0 = k * seg, y1 = y0 + seg;
        for (const [ax, az, bx, bz] of [[-l, -l, l, -l], [l, -l, l, l], [l, l, -l, l], [-l, l, -l, -l]]) xs.push(ax!, y0, az!, bx!, y1, bz!, bx!, y0, bz!, ax!, y1, az!, ax!, y1, az!, bx!, y1, bz!);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(xs), 3));
      p.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8a94ad, transparent: true, opacity: 0.9 })));
      // a VIGA no topo (da torre até o meio, a outra torre faz a outra metade) e o BRAÇO até a caixa suspensa
      const meio = Math.abs(m.x), viga = caixa(p, meio, 1.2, 1.2, metal, -lado * meio / 2, A + 0.6, 0);
      const cs = CAIXAS_SUSPENSAS[lado > 0 ? 1 : 0], bx = cs.x - m.x, bz = cs.z - m.z, bl = Math.hypot(bx, bz);
      const braco = caixa(p, 1, 1, bl + 1, metal, bx / 2, A + 0.6, bz / 2); braco.rotation.y = Math.atan2(bx, bz);
      void viga;
      // LED subindo nos montantes da frente + o feixe no alto, mirando a pista
      const leds: THREE.Mesh[] = [];
      for (const x of [-l, l]) leds.push(caixa(p, 0.06, A - 1, 0.06, basica(0x66e6ff, 0.85, true), x, A / 2, l + 0.14));
      anim.push((_, t) => { for (const [i, led] of leds.entries()) (led.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.6 * batida() * (0.6 + 0.4 * Math.sin(t * 3 + i)); });
      feixe(p, 0, A + 1.2, l, { len: 40, abre: 2.6, rumo: 0, incl: 1.2, fase: m.x * 0.2, cor: 0xff5fd2, varre: 0.5 });
    },
    // SUB na frente do palco: um cone grande
    sub(p, m) {
      caixa(p, m.larg, 2.4, m.prof, escuro, 0, 1.2, 0);
      altoFalante(p, 0, 1.2, m.prof / 2, 0.95, 0xb98cff);
      caixa(p, m.larg, 0.05, 0.05, basica(0x66e6ff, 0.9, true), 0, 2.42, m.prof / 2);
    },
    sofa(p, m) {
      const vel = new THREE.MeshStandardMaterial({ color: 0x3b2470, roughness: 0.85, metalness: 0.05, emissive: 0x1a0f3a, emissiveIntensity: 0.4 });
      const alm = new THREE.MeshStandardMaterial({ color: 0x5a3aa0, roughness: 0.9, emissive: 0x24154d, emissiveIntensity: 0.35 });
      caixa(p, m.larg, 0.42, m.prof, vel, 0, 0.26, 0);
      caixa(p, m.larg, 0.95, 0.32, vel, 0, 0.78, -m.prof / 2 + 0.16);
      for (const s of [-1, 1]) caixa(p, 0.32, 0.72, m.prof, vel, s * (m.larg / 2 - 0.16), 0.6, 0);
      const n = Math.max(1, Math.round((m.larg - 0.64) / 1.5)), w = (m.larg - 0.64) / n;
      if (!o.low) for (let i = 0; i < n; i++) { caixa(p, w - 0.06, 0.18, m.prof - 0.4, alm, -m.larg / 2 + 0.32 + w * (i + 0.5), 0.56, 0.1); caixa(p, w - 0.1, 0.55, 0.16, alm, -m.larg / 2 + 0.32 + w * (i + 0.5), 0.95, -m.prof / 2 + 0.38); }
      caixa(p, m.larg - 0.2, 0.04, 0.04, basica(m.cor ?? 0xb98cff, 0.8, true), 0, 0.05, m.prof / 2 - 0.05);   // luz de chão
    },
    // ── ZONAS DE LOUNGE (lib/cyber/ceu `zonaLounge`) ──
    // TAPETE redondo escuro com um aro de luz na cor da zona (marca o "cantinho")
    tapete(p, m) {
      const r = Math.min(m.larg, m.prof) / 2;
      const t = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ color: 0x150c28, roughness: 0.95, emissive: m.cor ?? 0xb98cff, emissiveIntensity: 0.08 })); t.rotation.x = -Math.PI / 2; t.position.y = 0.012; p.add(t);
      const aro = new THREE.Mesh(new THREE.RingGeometry(r - 0.22, r - 0.1, 64), basica(m.cor ?? 0xb98cff, 0.7, true)); aro.rotation.x = -Math.PI / 2; aro.position.y = 0.02; p.add(aro);
      anim.push((_, t2) => { (aro.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.25 * Math.sin(t2 * 0.8 + m.x) + 0.3 * batida(); });
    },
    // MESINHA baixa redonda: tampo de vidro com friso e 3 copos acesos
    mesaBaixa(p, m) {
      const r = m.larg / 2;
      const pe = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.5, 0.42, 16), escuro); pe.position.y = 0.21; p.add(pe);
      const tampo = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 32), gelo); tampo.position.y = 0.45; p.add(tampo);
      const friso = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, 48), basica(m.cor ?? 0x66e6ff, 0.9, true)); friso.rotation.x = Math.PI / 2; friso.position.y = 0.45; p.add(friso);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.4, c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.16, 10), basica([0x9affd0, 0xff9ad5, 0xffd36b][i]!, 0.85, true)); c.position.set(Math.cos(a) * r * 0.62, 0.55, Math.sin(a) * r * 0.62); p.add(c); }
    },
    // NARGUILÉ: base de vidro colorida, haste, prato, fornilho com a BRASA acesa, mangueira e a FUMAÇA subindo devagar
    narguile(p, m) {
      const cor = m.cor ?? 0xb98cff;
      const vaso = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); vaso.scale.y = 1.15; vaso.position.y = 0.19; p.add(vaso);
      const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.55, 8), metal); haste.position.y = 0.6; p.add(haste);
      const prato = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 16), metal); prato.position.y = 0.78; p.add(prato);
      const forn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.09, 12), escuro); forn.position.y = 0.86; p.add(forn);
      const brasa = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6), basica(0xff7a2c, 0.95, true)); brasa.position.y = 0.92; p.add(brasa);
      // a mangueira: uma curva que desce até perto do chão e volta (Tube)
      const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(0.03, 0.5, 0), new THREE.Vector3(0.35, 0.3, 0.1), new THREE.Vector3(0.55, 0.05, 0.35), new THREE.Vector3(0.9, 0.1, 0.65), new THREE.Vector3(1.1, 0.35, 0.8)]);
      const mangueira = new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 0.018, 6, false), new THREE.MeshStandardMaterial({ color: 0x2a1840, roughness: 0.6, emissive: cor, emissiveIntensity: 0.25 })); p.add(mangueira);
      // fumaça: partículas subindo, abrindo e sumindo
      const NF = o.low ? 14 : 30, fum = Array.from({ length: NF }, (_, i) => ({ f: i / NF, a: Math.random() * 6.28, r: 0.05 + Math.random() * 0.12 }));
      const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NF * 3), 3));
      const fumaca = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.45, map: o.estrela ?? null, color: 0xd8dcff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending })); fumaca.frustumCulled = false; p.add(fumaca);
      anim.push((dt, t) => {
        (brasa.material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.3 * Math.sin(t * 2.1 + m.x);
        const a = fg.attributes.position!.array as Float32Array;
        fum.forEach((f, i) => { f.f = (f.f + dt * 0.18) % 1; f.a += dt * 0.6; const r = f.r + f.f * 0.5; a[i * 3] = Math.cos(f.a) * r; a[i * 3 + 1] = 0.95 + f.f * 2.2; a[i * 3 + 2] = Math.sin(f.a) * r; });
        fg.attributes.position!.needsUpdate = true;
      });
    },
    // FOGUEIRA holográfica: anel de pedra escura com brasa e chamas de luz (cones aditivos) que respiram
    fogueira(p, m) {
      const r = m.larg / 2, cor = m.cor ?? 0xff9a5c;
      const anel = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 24), escuro); anel.rotation.x = Math.PI / 2; anel.position.y = 0.16; p.add(anel);
      const brasas = new THREE.Mesh(new THREE.CircleGeometry(r - 0.1, 24), basica(0xff7a2c, 0.75, true)); brasas.rotation.x = -Math.PI / 2; brasas.position.y = 0.12; p.add(brasas);
      const chamas: THREE.Mesh[] = [];
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, c = new THREE.Mesh(new THREE.ConeGeometry(0.22 + (i % 2) * 0.08, 1, 10, 1, true), basica(i % 2 ? cor : 0xffe3b0, 0.55, true)); c.position.set(Math.cos(a) * 0.22, 0.6, Math.sin(a) * 0.22); p.add(c); chamas.push(c); }
      anim.push((_, t) => chamas.forEach((c, i) => { const k = 0.85 + 0.25 * Math.sin(t * (3.1 + i * 0.7) + i) + 0.2 * batida(); c.scale.set(1, k, 1); c.position.y = 0.12 + k / 2; c.rotation.y = t * 0.6 + i; }));
    },
    // PUFF: almofadão redondo, macio (esfera achatada) com o friso aceso
    // PUFE grande (de largar o corpo): saco macio afundado + o encosto que sobe atrás (o −z), aro de luz no pé
    pufe(p, m) {
      const cor = new THREE.Color(m.cor ?? 0xb98cff), tecido = new THREE.MeshStandardMaterial({ color: cor.clone().multiplyScalar(0.28).add(new THREE.Color(0x1a1530)), roughness: 0.95, emissive: cor, emissiveIntensity: 0.08 });
      const corpo = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 12), tecido); corpo.scale.set(1, 0.42, 1); corpo.position.y = 0.26; p.add(corpo);
      const encosto = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12), tecido); encosto.scale.set(1.02, 0.78, 0.5); encosto.position.set(0, 0.55, -0.42); encosto.rotation.x = -0.35; p.add(encosto);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.02, 6, 40), basica(m.cor ?? 0xb98cff, 0.7, true)); aro.rotation.x = Math.PI / 2; aro.position.y = 0.06; p.add(aro);
    },
    // ESTANTE alta de livros: moldura escura, 5 prateleiras com livros (instanciados) e um friso de luz no alto
    estante(p, m) {
      const H = 4.2, W = m.larg, D = m.prof, mold = new THREE.MeshStandardMaterial({ color: 0x0c1424, roughness: 0.5, metalness: 0.4, emissive: 0x0a1630, emissiveIntensity: 0.4 });
      caixa(p, W, H, 0.08, mold, 0, H / 2, -D / 2 + 0.04);
      for (const sx of [-1, 1]) caixa(p, 0.1, H, D, mold, sx * (W / 2 - 0.05), H / 2, 0);
      const N = 5, livrosPor = o.low ? 10 : 22, livros = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.05 }), N * livrosPor);
      const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), cores = [0x2f4a7a, 0x6a3a5a, 0x3a6a5a, 0x7a5a2f, 0x4a3a7a, 0x2f6a7a], cor = new THREE.Color();
      let k = 0, sem = Math.abs(m.x * 7 + m.z * 3);
      const rnd = () => { sem = (sem * 9301 + 49297) % 233280; return sem / 233280; };
      for (let i = 0; i < N; i++) {
        const y0 = 0.1 + i * (H - 0.2) / N; caixa(p, W - 0.1, 0.05, D - 0.08, mold, 0, y0, 0);
        let x = -W / 2 + 0.2;
        for (let j = 0; j < livrosPor && x < W / 2 - 0.25; j++) {
          const w = 0.06 + rnd() * 0.12, h = 0.45 + rnd() * 0.3; q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rnd() < 0.1 ? 0.25 : 0);
          livros.setMatrixAt(k, mx.compose(new THREE.Vector3(x + w / 2, y0 + 0.03 + h / 2, -0.05), q, new THREE.Vector3(w, h, D * 0.7)));
          livros.setColorAt(k++, cor.setHex(cores[Math.floor(rnd() * cores.length)]!)); x += w + 0.015;
        }
      }
      livros.count = k; livros.instanceMatrix.needsUpdate = true; if (livros.instanceColor) livros.instanceColor.needsUpdate = true; p.add(livros);
      caixa(p, W, 0.04, 0.04, basica(0x7fb8ff, 0.85, true), 0, H + 0.02, D / 2 - 0.02);
    },
    // MESA DE LEITURA: tampo fino, luminária acesa e um livro holográfico aberto flutuando
    mesaLeitura(p, m) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x141c2e, roughness: 0.4, metalness: 0.5, emissive: 0x0a1630, emissiveIntensity: 0.4 });
      caixa(p, m.larg, 0.06, m.prof, mat, 0, 0.76, 0);
      for (const sx of [-1, 1]) caixa(p, 0.06, 0.74, m.prof - 0.2, mat, sx * (m.larg / 2 - 0.15), 0.37, 0);
      const haste = caixa(p, 0.04, 0.5, 0.04, mat, m.larg / 2 - 0.45, 1.04, -0.35); void haste;
      const cupula = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 16, 1, true), basica(m.cor ?? 0x7fb8ff, 0.8, true)); cupula.position.set(m.larg / 2 - 0.45, 1.3, -0.35); p.add(cupula);
      const luz = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), basica(m.cor ?? 0x7fb8ff, 0.18, true)); luz.rotation.x = -Math.PI / 2; luz.position.set(m.larg / 2 - 0.55, 0.8, -0.3); p.add(luz);
      const livro = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), basica(0xd6e8ff, 0.55, true)); livro.position.set(-0.3, 1.0, 0); livro.rotation.x = -1.1; p.add(livro);
      anim.push((_, t) => { livro.position.y = 1.0 + 0.04 * Math.sin(t * 1.3 + m.x); });
    },
    // PLANTA: em vaso (pequena) ou, larga, uma ÁRVORE DE LUZ (tronco fino + copa de cristal acesa)
    planta(p, m) {
      const vaso = new THREE.MeshStandardMaterial({ color: 0x16202e, roughness: 0.6, metalness: 0.3 });
      const folha = new THREE.MeshStandardMaterial({ color: 0x1f5a3a, roughness: 0.7, emissive: 0x2fbf7a, emissiveIntensity: 0.35, flatShading: true });
      if (m.larg >= 1.5) {
        const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 4.2, 8), vaso); tronco.position.y = 2.1; p.add(tronco);
        const copa = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), folha); copa.position.y = 5; copa.scale.set(1, 1.15, 1); p.add(copa);
        const brilho = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 0), basica(0x7dffb0, 0.16, true)); brilho.position.copy(copa.position); brilho.scale.copy(copa.scale); p.add(brilho);
        anim.push((_, t) => { (brilho.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.06 * Math.sin(t * 0.7 + m.rot * 3); });
      } else {
        const v = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.7, 14), vaso); v.position.y = 0.35; p.add(v);
        for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 - i * 0.07, 0), folha); f.position.set((i - 1) * 0.16, 0.95 + i * 0.32, ((i * 7) % 3 - 1) * 0.1); p.add(f); }
      }
    },
    // ESMERALDA de luz (o jardim — out/2026): um cristal verde lapidado (bipirâmide de 6 faces, alongada) pairando e
    // girando devagar, com o miolo aceso; um feixe de luz verde cai dele até um anel no chão, "respirando" devagar
    esmeralda(p, m) {
      const grande = m.larg >= 2.5, h = grande ? 3.4 : 1.7, r = grande ? 1.15 : 0.58, alt = grande ? 5.2 : 2.7, cor = m.cor ?? 0x2dff8f;
      const cristal = new THREE.Group(); cristal.position.y = alt; p.add(cristal);
      const mat = new THREE.MeshStandardMaterial({ color: 0x0b7a40, emissive: cor, emissiveIntensity: 0.75, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.86, flatShading: true });
      const cima = new THREE.Mesh(new THREE.CylinderGeometry(0, r, h * 0.62, 6), mat); cima.position.y = h * 0.31; cristal.add(cima);
      const baixo = new THREE.Mesh(new THREE.CylinderGeometry(r, 0, h * 0.38, 6), mat); baixo.position.y = -h * 0.19; cristal.add(baixo);
      const miolo = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.45, 0), basica(0xc8ffe2, 0.9, true)); miolo.scale.y = 1.8; cristal.add(miolo);
      const feixe = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 2.4, alt, o.low ? 10 : 20, 1, true), basica(cor, 0.1, true)); feixe.position.y = alt / 2; feixe.renderOrder = 3; p.add(feixe);
      const anel = new THREE.Mesh(new THREE.RingGeometry(r * 1.9, r * 2.4, o.low ? 24 : 48), basica(cor, 0.4, true)); anel.rotation.x = -Math.PI / 2; anel.position.y = 0.04; p.add(anel);
      const fase = m.x * 0.37 + m.z * 0.21;
      anim.push((dt, t) => {
        const resp = 0.5 + 0.5 * Math.sin(t * 0.55 + fase);   // a "respiração" (~11 s)
        cristal.rotation.y += dt * 0.35; cristal.position.y = alt + Math.sin(t * 0.8 + fase) * 0.18;
        mat.emissiveIntensity = 0.55 + 0.5 * resp; (feixe.material as THREE.MeshBasicMaterial).opacity = 0.06 + 0.08 * resp; (anel.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.3 * resp;
      });
    },
    // ESPELHO D'ÁGUA: borda de pedra escura, água quase parada (reflexo frio) e pontos de luz flutuando em cima
    espelhoAgua(p, m) {
      const R = m.larg / 2, borda = new THREE.Mesh(new THREE.TorusGeometry(R, 0.3, 8, 64), new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.6, metalness: 0.3 })); borda.rotation.x = Math.PI / 2; borda.position.y = 0.2; p.add(borda);
      const agua = new THREE.Mesh(new THREE.CircleGeometry(R - 0.1, 48), new THREE.MeshStandardMaterial({ color: 0x0a2a3a, roughness: 0.05, metalness: 0.6, emissive: m.cor ?? 0x7dffb0, emissiveIntensity: 0.12, transparent: true, opacity: 0.9 })); agua.rotation.x = -Math.PI / 2; agua.position.y = 0.15; p.add(agua);
      const anel = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 40), basica(m.cor ?? 0x7dffb0, 0.5, true)); anel.rotation.x = -Math.PI / 2; anel.position.y = 0.17; p.add(anel);
      // os pontos de luz: UMA malha instanciada (1 draw call; eram 16), cor alternada por instância
      const NL = o.low ? 8 : 16, luzes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), basica(0xffffff, 0.9, true), NL);
      luzes.frustumCulled = false; luzes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); p.add(luzes);
      const cl = new THREE.Color(); for (let i = 0; i < NL; i++) luzes.setColorAt(i, cl.setHex(i % 2 ? 0x7dffb0 : 0xd4ffe6));
      const mL = new THREE.Matrix4(), cada = Array.from({ length: NL }, (_, i) => ({ a: (i / NL) * Math.PI * 2, r: 1.5 + (i % 4) * 1.2 }));
      anim.push((dt, t) => {
        const k = (t * 0.25) % 1; anel.scale.setScalar(1 + k * (R - 1)); (anel.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k);   // uma ondinha saindo do meio
        cada.forEach((L, i) => { const a = L.a + t * 0.08; luzes.setMatrixAt(i, mL.makeTranslation(Math.cos(a) * L.r, 0.6 + 0.25 * Math.sin(t * 0.9 + L.a * 3), Math.sin(a) * L.r)); });
        luzes.instanceMatrix.needsUpdate = true;
      });
    },
    // TORRE DE CARGA (garagem): coluna escura com anéis laranja subindo — a "energia" das motos
    torreCarga(p, m) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.4, metalness: 0.7, emissive: 0x2a1406, emissiveIntensity: 0.6 });
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 6, 12), mat); col.position.y = 3; p.add(col);
      const topo = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), basica(0xffb46b, 0.9, true)); topo.position.y = 6.8; topo.scale.y = 1.6; p.add(topo);
      const aneis = [0, 1, 2].map((k) => { const a = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 32), basica(0xffb46b, 0.6, true)); a.rotation.x = Math.PI / 2; p.add(a); return { a, k }; });
      anim.push((_, t) => { for (const { a, k } of aneis) { const u = (t * 0.35 + k / 3) % 1; a.position.y = 0.4 + u * 5.6; (a.material as THREE.MeshBasicMaterial).opacity = 0.7 * Math.sin(Math.PI * u); } topo.rotation.y = t * 0.6; });
    },
    // CAIXA DE SOM discreta: coluna fina escura, tela de tecido e 2 cones com um aro aceso que respira com a música
    caixaMinimal(p, m) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x10141e, roughness: 0.55, metalness: 0.4 });
      caixa(p, m.larg, 2.6, m.prof, mat, 0, 1.3, 0);
      const aros = [0.85, 1.85].map((y) => { const a = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 32), basica(tema(m).brilho, 0.5, true)); a.position.set(0, y, m.prof / 2 + 0.01); p.add(a); return a; });
      anim.push((_, t) => { const k = 0.32 + 0.18 * Math.sin(t * 1.1 + m.x); for (const a of aros) (a.material as THREE.MeshBasicMaterial).opacity = k; });
      ambiente.push({ sala: salaAtual, obj: p });
    },
    puff(p, m) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), new THREE.MeshStandardMaterial({ color: 0x3b2470, roughness: 0.9, emissive: m.cor ?? 0x1a0f3a, emissiveIntensity: 0.18 })); puff.scale.set(1, 0.55, 1); puff.position.y = 0.28; p.add(puff);
      const f = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.02, 6, 32), basica(m.cor ?? 0xb98cff, 0.75, true)); f.rotation.x = Math.PI / 2; f.position.y = 0.12; p.add(f);
    },
  };

  /** o LOUNGE EM DOIS NÍVEIS (lib/cyber/templo): o DECK da festa (laje alta atrás de `zFrente`, com guarda-corpo de
   *  vidro na frente), a RAMPA larga do meio, as CALÇADAS do pátio (a central, da porta até a rampa, com postes de luz;
   *  e a da frente do deck) e o OLHO holográfico em cima do DJ */
  function doisNiveis(g: THREE.Group, s: { r: number }) {
    const R = s.r - 0.35, zf = DECK.zFrente, h = DECK.h + 0.16, xf = Math.sqrt(R * R - zf * zf), fr = Math.atan2(-zf, xf);
    // o DECK: o disco cortado na frente, extrudado pra cima (forma no plano: y = −z da sala)
    const sh = new THREE.Shape(); sh.moveTo(-xf, -zf); sh.lineTo(xf, -zf); sh.absarc(0, 0, R, fr, Math.PI - fr, false);
    const dg = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: o.low ? 32 : 72 }); dg.rotateX(-Math.PI / 2);
    const topoMat = new THREE.MeshStandardMaterial({ color: 0x170b2c, emissive: 0x1a0d36, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.45 });
    const ladoMat = new THREE.MeshStandardMaterial({ color: 0x0b0f1e, emissive: 0x0c1430, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.6 });
    const deck = new THREE.Mesh(dg, [topoMat, ladoMat]); g.add(deck); alvos.push(deck);
    // o rejunte de luz do deck (anéis concêntricos fininhos em volta da pista, como um palco de show)
    for (const rr of [24, 36, 48]) { const a = new THREE.Mesh(new THREE.RingGeometry(rr - 0.06, rr + 0.06, o.low ? 48 : 96, 1, 0.25, Math.PI - 0.5), basica(0x7a5aff, 0.35, true)); a.rotation.x = -Math.PI / 2; a.position.set(0, h + 0.01, -12); g.add(a); }
    // a frente do deck: faixa de LED na quina, frisos verticais no espelho e o guarda-corpo de vidro (menos na rampa)
    const { meia, len } = DECK.rampa;
    for (const sx of [-1, 1]) {
      const w = xf - meia, cx = sx * (meia + w / 2);
      caixa(g, w, 0.07, 0.07, basica(0xb98cff, 0.95, true), cx, h - 0.04, zf + 0.04);
      caixa(g, w, 1.1, 0.06, o.paredeMat, cx, h + 0.55, zf + 0.1);
      caixa(g, w, 0.05, 0.08, basica(0x66e6ff, 0.9, true), cx, h + 1.1, zf + 0.1);
      for (let x = meia + 1.5; x < xf - 1; x += 3) caixa(g, 0.06, h - 0.4, 0.04, basica(FESTA[Math.floor(x / 3) % FESTA.length]!, 0.55, true), sx * x, h / 2, zf + 0.03);
    }
    // a RAMPA: a laje inclinada, os degraus de luz e os corrimãos de vidro dos lados
    const L = Math.hypot(len, DECK.h), ang = Math.atan2(DECK.h, len), rampa = new THREE.Group(); rampa.position.set(0, 0.16 + DECK.h / 2, zf + len / 2); rampa.rotation.x = ang; g.add(rampa);
    const laje = new THREE.Mesh(new THREE.BoxGeometry(meia * 2, 0.3, L), topoMat); laje.position.y = -0.15; rampa.add(laje); alvos.push(laje);
    for (let k = 1; k < 12; k++) caixa(rampa, meia * 2 - 0.4, 0.02, 0.06, basica(0x9fe8ff, 0.5, true), 0, 0.01, -L / 2 + (k * L) / 12);
    for (const sx of [-1, 1]) { caixa(rampa, 0.06, 1.0, L, o.paredeMat, sx * (meia + 0.3), 0.5, 0); caixa(rampa, 0.08, 0.06, L, basica(0x66e6ff, 0.9, true), sx * (meia + 0.3), 1.0, 0); }
    // a base da rampa (a cunha embaixo), escura
    { const cg = new THREE.BufferGeometry(), z0 = zf, z1 = zf + len, y1 = h, mx = meia;
      const v = [-mx, 0.16, z0, mx, 0.16, z0, mx, y1, z0, -mx, y1, z0, -mx, 0.16, z1, mx, 0.16, z1];
      cg.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); cg.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3, 1, 2, 5, 3, 4, 5, 3, 5, 2]); cg.computeVertexNormals();
      g.add(new THREE.Mesh(cg, ladoMat)); }
    // as CALÇADAS do pátio: a central (da porta até o pé da rampa) e a da frente do deck; postes de luz na central
    const calcMat = new THREE.MeshStandardMaterial({ color: 0x2a2440, emissive: 0x241a44, emissiveIntensity: 0.6, roughness: 0.6, metalness: 0.2 });
    const cm = PATIO.calcadaMeia, cz0 = zf + len, cz1 = s.r - 0.5;
    const calc = new THREE.Mesh(new THREE.BoxGeometry(cm * 2, 0.06, cz1 - cz0), calcMat); calc.position.set(0, 0.19, (cz0 + cz1) / 2); g.add(calc);
    for (const sx of [-1, 1]) caixa(g, 0.1, 0.03, cz1 - cz0, basica(0xb98cff, 0.85, true), sx * cm, 0.23, (cz0 + cz1) / 2);
    const frente = new THREE.Mesh(new THREE.BoxGeometry(2 * Math.sqrt(R * R - (zf + 4) ** 2), 0.06, 4), calcMat); frente.position.set(0, 0.19, zf + 2); g.add(frente);
    const posteMat = new THREE.MeshStandardMaterial({ color: 0x1c2438, roughness: 0.35, metalness: 0.85 });
    for (let z = cz0 + 4; z < cz1 - 2; z += 9) for (const sx of [-1, 1]) {
      const x = sx * (cm + 0.8); caixa(g, 0.16, 4.2, 0.16, posteMat, x, 2.1, z);
      caixa(g, 1.1, 0.08, 0.16, posteMat, x - sx * 0.5, 4.2, z);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), basica(0xffe2b0, 1)); lamp.position.set(x - sx * 1.0, 4.05, z); g.add(lamp);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), basica(0xffc87a, 0.18, true)); halo.position.copy(lamp.position); g.add(halo);
    }
    // o ELEVADOR DE LUZ da GARAGEM (as motos ficam numa plataforma 25 m abaixo, do lado esquerdo — lib/cyber/templo):
    // a coluna do pé (na plataforma) até a altura do pátio, anéis subindo, o anel de embarque embaixo, o de descer no
    // pátio e a passarela de luz entre eles (a viagem desliza por ela pra dentro do lounge)
    { const G = GARAGEM_LOUNGE, e = G.elevador, alt = G.desce + 0.6, aneisG: THREE.Mesh[] = [];
      const col = new THREE.Mesh(new THREE.CylinderGeometry(e.r + 0.3, e.r + 0.5, alt, 24, 1, true), basica(0x66e6ff, 0.16, true)); col.position.set(e.pe.x, -G.desce + alt / 2, e.pe.z); g.add(col);
      const nucleo = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, alt, 8, 1, true), basica(0xd8f6ff, 0.5, true)); nucleo.position.copy(col.position); g.add(nucleo);
      for (let i = 0; i < 5; i++) { const an = new THREE.Mesh(new THREE.TorusGeometry(e.r + 0.35, 0.06, 6, 40), basica(0xb98cff, 0.8, true)); an.rotation.x = Math.PI / 2; an.position.set(e.pe.x, -G.desce, e.pe.z); g.add(an); aneisG.push(an); }
      for (const [p, y] of [[e.pe, -G.desce + 0.05], [e.topo, 0.22]] as const) {
        const an = new THREE.Mesh(new THREE.TorusGeometry(e.r, 0.08, 6, 40), basica(0x66e6ff, 0.9, true)); an.rotation.x = Math.PI / 2; an.position.set(p.x, y, p.z); g.add(an);
        const disco = new THREE.Mesh(new THREE.CircleGeometry(e.r - 0.1, 32), basica(0x66e6ff, 0.18, true)); disco.rotation.x = -Math.PI / 2; disco.position.set(p.x, y + 0.01, p.z); g.add(disco);
      }
      const pass = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(e.topo.x - e.pe.x), 0.08, 2.2), basica(0x9fe8ff, 0.35, true)); pass.position.set((e.pe.x + e.topo.x) / 2, 0.35, e.pe.z); g.add(pass);
      for (const n of [col, nucleo, pass, ...aneisG]) n.userData.semLote = true;
      anim.push((_, t) => { for (const [i, an] of aneisG.entries()) an.position.y = -G.desce + ((t * 2.4 + (i * alt) / 5) % alt); });
    }
    // o OLHO em cima do DJ (acima do buraco negro), inclinado pra pista
    const olho = criarOlho({ low: o.low, tam: 46 }); olho.group.position.set(0, DECK.h + 60, -44); olho.group.rotation.x = 0.55; olho.group.visible = false; g.add(olho.group);
    olho.group.traverse((n) => { n.userData.semLote = true; });
    // a MANDALA do show (no mesmo centro do olho), as serpentes e os tentáculos; e a NÉVOA do lounge com os trovões leves
    const mandala = criarMandala({ low: o.low, estrela: o.estrela, tam: 60 }); mandala.group.position.copy(olho.group.position); mandala.group.rotation.x = 0.55; g.add(mandala.group);
    const nevoa = criarTempestade({ low: o.low, yBase: DECK.h + 48, yTopo: DECK.h + 80, raioMax: 70, alvoPonta: new THREE.Vector3(0, DECK.h + 60, -44), cor: new THREE.Color(0.22, 0.13, 0.32), semAbismo: true, densidade: 0.4, nuvens: o.low ? 18 : 36 });   // (menos nuvens: não pesar)
    nevoa.group.position.set(0, 0, 0); nevoa.group.traverse((n) => { n.userData.semLote = true; }); g.add(nevoa.group); nevoa.definir(0, false);
    showLounge = { olho, mandala, nevoa, grupo: g };
    anim.push((_, t) => {
      const tt = calmo ? t * 0.3 : t, b = batida();
      if (olho.group.visible) {   // (no 3º modo do show o olho nasce crescendo, no lugar da mandala)
        olho.group.scale.setScalar(Math.max(0.001, olhoRitual > 0.001 ? 1 : estadoShow.olho));
        olho.atualizar(tt, b, Math.max(ativo, olhoRitual, estadoShow.olho), { anel: estadoShow.anelSigilos, iris: estadoShow.olho > 0.5 ? estadoShow.sigilo : -1 });
      }
      // a complexidade PULSA no ritmo (o grave acrescenta camadas por um instante)
      mandala.definir({ ...estadoShow, complexidade: Math.min(0.72, estadoShow.complexidade + 0.18 * b), nascimento: estadoShow.nascimento * (1 - estadoShow.olho) }, b, tt);
      nevoa.atualizar(t);
    });
  }

  for (const nome of Object.keys(CIDADE.salas) as NomeSala[]) {
    const s = CIDADE.salas[nome], tema = TEMA[nome], porta = s.porta ?? CIDADE.salaParede.porta, ALT = tema.alt;
    const g = new THREE.Group(); g.position.set(s.x, s.y ?? 0, s.z); g.rotation.y = rotDaSala(s); ilha.add(g);   // o lounge: lá no alto
    // piso + friso de luz
    const piso = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r + 0.2, 0.16, o.low ? 32 : 48), new THREE.MeshStandardMaterial({ color: tema.piso, emissive: tema.piso, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.3 }));
    piso.position.y = 0.08; g.add(piso); alvos.push(piso);
    const friso = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.32, s.r - 0.18, 64), basica(tema.brilho, 0.7, true)); friso.rotation.x = -Math.PI / 2; friso.position.y = 0.17; g.add(friso);
    // parede de vidro com a PORTA em +z local (no CylinderGeometry: x = r·sen θ, z = r·cos θ → +z é θ = 0)
    // (o LOUNGE tem também a SAÍDA pra escadaria do templo, à direita — lib/cyber/templo)
    const arcos: [number, number][] = nome === "lounge" ? (() => { const sd = saidaDoLounge(s.r), th = Math.PI / 2 - sd.ang; return [[porta, th - sd.meia], [th + sd.meia, Math.PI * 2 - porta]]; })() : [[porta, Math.PI * 2 - porta]];
    const segP = o.low ? 32 : nome === "lounge" ? 96 : 48;
    for (const [a0, a1] of arcos) {
      const parede = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, ALT, segP, 1, true, a0, a1 - a0), o.paredeMat); parede.position.y = ALT / 2; g.add(parede);
      for (const y of [ALT, 0.25]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(s.r + 0.02, s.r + 0.02, 0.16, segP, 1, true, a0, a1 - a0), basica(tema.brilho, 0.8, true)); m.position.y = y; g.add(m); }
    }
    // portal da porta: 2 colunas + verga (no clube a céu aberto, um PÓRTICO alto na chegada da escada)
    const pz = Math.cos(porta) * s.r, px = Math.sin(porta) * s.r, colMat = new THREE.MeshStandardMaterial({ color: 0x0c1a30, emissive: tema.brilho, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 });
    const AP = tema.aberto ? 9 : ALT + 0.5;
    for (const sx of [-1, 1]) caixa(g, tema.aberto ? 0.9 : 0.4, AP, tema.aberto ? 0.9 : 0.4, colMat, sx * px, AP / 2, pz);
    caixa(g, px * 2 + 0.9, 0.6, 0.9, colMat, 0, AP - 0.1, pz);
    if (!tema.aberto) {   // teto: cúpula baixa de vidro
      const teto = new THREE.Mesh(new THREE.SphereGeometry(s.r, o.low ? 20 : 32, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0a1830, emissive: tema.brilho, emissiveIntensity: 0.12, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, roughness: 0.2 }));
      teto.scale.y = 0.32; teto.position.y = ALT; g.add(teto);
    }
    if (nome === "lounge") doisNiveis(g, s);
    // móveis (`y` = elevação própria, ex.: a mesa do DJ em cima do palco; senão, no piso da sala)
    salaAtual = nome;
    for (const m of MOVEIS[nome]) { const p = new THREE.Group(); p.position.set(m.x, m.y ?? 0.16, m.z); p.rotation.y = m.rot; g.add(p); MOVEL[m.tipo]?.(p, m, tema); }
    // tudo que está EM CIMA do piso num grupo próprio: quem está abaixo da plataforma não enxerga (components/cyber/oclusaoPisos)
    // — e os lotes ficam dentro dele (`limite`), senão se misturariam com o resto da cidade
    const acima = new THREE.Group(); acima.name = `sala-${nome}-acima`; acima.userData.lote = "limite";
    for (const c of [...g.children]) if (c !== piso) acima.add(c);
    g.add(acima); g.userData.lote = "limite";
    plataformas.push({ acima, r: s.r + 0.2, topo: 0.16 });
  }
  return {
    plataformas,
    alvos, tv: tvTela, caixas: caixasSom, tocaDiscos, ambiente,
    somTocando(on, nivel = 0) { tocando = on; nivelAlvo = on ? Math.max(0, Math.min(1, nivel)) : 0; },
    show(e, olho) {
      if (!showLounge) return;
      const ritual = olho > 0.001; olhoRitual = olho;
      estadoShow = ritual ? { ...e, nascimento: 0, serpentes: 0, tentaculos: 0, dna: 0, anelSigilos: 0, sigilo: -1, olho: 1 } : e;   // no ritual, a mandala se recolhe: fica o olho (sem os sigilos)
      showLounge.olho.group.visible = ritual || e.olho > 0.02;   // (o 3º modo do show: o olho de volta, com os sigilos)
      showLounge.nevoa.definir(Math.max(e.nevoa, olho), e.nivel > 0 || olho > 0.5);   // no ritual, a névoa do lounge se forma junto com a do templo (os raios cortam as caixas)
    },
    raioNoLounge(vel = 1, alvoMundo) {
      if (!showLounge) return;
      if (!alvoMundo) { showLounge.nevoa.raioAgora(undefined, vel); return; }
      showLounge.nevoa.group.updateMatrixWorld(); showLounge.nevoa.raioAgora(showLounge.nevoa.group.worldToLocal(alvoMundo.clone()), vel);
    },
    mostrarRecado(texto) {
      if (!recadoFaixa) return;
      recadoFaixa.visible = !!texto; if (!texto) return;
      const g = cRecado.getContext("2d")!; g.clearRect(0, 0, cRecado.width, cRecado.height);
      g.fillStyle = "rgba(6,10,30,.82)"; g.beginPath(); g.roundRect(4, 4, cRecado.width - 8, cRecado.height - 8, 28); g.fill(); g.strokeStyle = "#66e6ff"; g.lineWidth = 4; g.stroke();
      g.fillStyle = "#66e6ff"; g.font = "700 34px system-ui,sans-serif"; g.textBaseline = "top"; g.fillText("✉ No QG do Andrei", 30, 22);
      g.fillStyle = "#f2fbff"; g.font = "500 36px system-ui,sans-serif";
      linhasDoRecado(texto, (x) => g.measureText(x).width, cRecado.width - 60, 3).slice(0, 3).forEach((l, i) => g.fillText(l, 30, 72 + i * 44));
      texRecado.needsUpdate = true;
    },
    atualizar(dt, t) {
      ativo += ((tocando ? 1 : 0) - ativo) * Math.min(1, dt * 0.8);
      energia += (nivelAlvo - energia) * Math.min(1, dt * (nivelAlvo > energia ? 22 : 5));
      if (nivelAlvo - nivelAnt > 0.12 && pulso < 0.5) { pulso = 1; batidas++; }   // o grave subiu de repente = batida
      nivelAnt = nivelAlvo; pulso *= Math.exp(-dt * 5);
      for (const f of anim) f(dt, t);
    },
  };
}
