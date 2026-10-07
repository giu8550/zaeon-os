/**
 * Salas — os pavilhões da Zaeon em volta da cidadela. O LOUNGE virou CLUBE (a festa): PALCO de cristais de gelo no
 * fundo, com a MESA DO DJ (2 pickups + controladora) em cima, 2 TORRES DE SOM gigantes e 2 subs, TELÃO alto atrás,
 * PISTA de LED com um cristal-espelho girando por cima e as LUZES saindo do palco (feixes que varrem a sala + leque de
 * laser da mesa). Tudo pulsa com os GRAVES da música (`somTocando(on, nivel)`); parado, respira devagar.
 * Cada sala é um pavilhão redondo de vidro com a PORTA virada pro centro da ilha. Layout, móveis e colisores em
 * lib/cyber/ceu.ts (CIDADE.salas, MOVEIS, PALCO) — aqui só o three. Sem estrobo; `low` corta os detalhes miúdos.
 * Luzes/feixes/LEDs são Basic/Shader (o `camuflarGrupo` não mexe neles); corpos sólidos são Standard (viram `solidoLeve`).
 */
import * as THREE from "three";
import { CIDADE, MESA_DJ, MOVEIS, PALCO, rotDaSala, type Movel, type NomeSala } from "@/lib/cyber/ceu";
import { linhasDoRecado } from "@/lib/cyber/recado";

const TEMA: Record<NomeSala, { piso: number; brilho: number; titulo: string; cor: string; alt: number }> = {
  lounge: { piso: 0x120a24, brilho: 0xb98cff, titulo: "LOUNGE", cor: "#e2d0ff", alt: 10 },
};
/** paleta da festa (feixes, LEDs da pista, lasers) */
const FESTA = [0x66e6ff, 0xb98cff, 0xff5fd2, 0x6bff9a, 0x4d7bff];
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type Opts = { low: boolean; texturas: THREE.Texture[]; paredeMat: THREE.Material };
export type SalasHandle = {
  alvos: THREE.Object3D[];
  /** a TELA do telão do lounge (clicável: o dono escreve o recado pro QG do Andrei) */
  tv: THREE.Mesh | null;
  /** mostra no telão o último recado enviado ao QG (null = some) */
  mostrarRecado(texto: string | null): void;
  /** as TORRES DE SOM do lounge (a música sai delas) e a MESA DO DJ (onde se abre o player) */
  caixas: THREE.Object3D[]; tocaDiscos: THREE.Object3D | null;
  /** tem música tocando? + a energia dos graves agora (0..1): as luzes, as caixas e a pista pulsam com ela */
  somTocando(on: boolean, nivel?: number): void;
  atualizar(dt: number, t: number): void;
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

  const MOVEL: Record<string, (p: THREE.Group, m: Movel, tema: typeof TEMA[NomeSala]) => void> = {
    // TELÃO alto atrás do palco (acima da coroa de cristais): é a "TV" do recado pro QG
    tv(p, m) {
      const W = m.larg, H = W * 0.45, yC = 7.1, pe = yC - H / 2;
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
      const z0 = r - 0.3, nD = 4;
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
        const rr = r - 0.65 - (i % 2) * 0.35, alt = 1.4 + 3.2 * meio * meio + (i % 3) * 0.35;
        lista.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr, y: h, w: 0.32 + 0.3 * meio + (i % 2) * 0.08, alt, ix: Math.sin(a) * 0.22, iz: -Math.cos(a) * 0.22, gira: i * 0.7 });
      }
      const nVolta = o.low ? 8 : 16;
      for (let i = 0; i < nVolta; i++) {   // cristais BAIXOS no chão, colados na borda (menos na boca da escada)
        const a = (i / nVolta) * Math.PI * 2 + 0.1, x = Math.cos(a) * (r + 0.45), z = Math.sin(a) * (r + 0.45);
        if (z > 0 && Math.abs(x) < escada.meia + 0.6) continue;
        lista.push({ x, z, y: 0, w: 0.28 + (i % 3) * 0.1, alt: 0.8 + (i % 4) * 0.35, ix: Math.sin(a) * 0.3, iz: -Math.cos(a) * 0.3, gira: i });
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
        feixe(p, Math.cos(a) * rr, h, Math.sin(a) * rr, { len: 22, abre: 1.5, rumo: 0, incl: 0.55 + (i % 2) * 0.25, fase: i * 1.3, cor: FESTA[i % FESTA.length]!, varre: 0.7 });
      }
      // LEQUE DE LASER saindo da frente da mesa do DJ (na altura da cabeça de quem dança)
      const nL = o.low ? 8 : 14, origem = new THREE.Vector3(0, h + MESA_DJ.topo - 0.25, MESA_DJ.z - PALCO.z + MESA_DJ.prof / 2 + 0.05);
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
      const nB = o.low ? 10 : 18, barras: THREE.Mesh[] = [];
      for (let i = 0; i < nB; i++) { const b = caixa(p, (m.larg - 0.5) / nB - 0.04, 1, 0.02, basica(FESTA[i % FESTA.length]!, 0.9, true), -((m.larg - 0.5) / 2) + ((i + 0.5) * (m.larg - 0.5)) / nB, 0.15, m.prof / 2 + 0.04); b.geometry.translate(0, 0.5, 0); b.position.y = 0.12; barras.push(b); }
      anim.push((_, t) => { barras.forEach((b, i) => { const v = 0.06 + (T - 0.4) * (0.15 + 0.85 * batida()) * (0.35 + 0.65 * Math.abs(Math.sin(t * (2.3 + (i % 5) * 0.7) + i * 1.9))); b.scale.y = v; }); });
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
      const vu: THREE.Mesh[] = [];
      for (let l = 0; l < 8; l++) for (const sx of [-1, 1]) vu.push(caixa(p, 0.025, 0.01, 0.022, basica(l > 6 ? 0xff5f6b : l > 4 ? 0xffd36b : 0x6bff9a, 0.95, true), sx * 0.36, T + 0.108, 0.24 - l * 0.035));
      tocaDiscos = p;
      anim.push((dt, t) => {
        if (tocando) for (const d of pratos) d.rotation.z -= dt * 3.5;
        const b = batida(); faders.forEach((f, i) => { f.position.z = 0.08 + 0.06 * Math.sin(t * 0.5 + i * 1.7) * ativo; });
        cross.position.x = 0.2 * Math.sin(t * 0.8) * ativo;
        vu.forEach((v, i) => { v.visible = Math.floor(i / 2) < Math.round(b * 8 + (pulso * 2 * ativo)); });
      });
    },
    // TORRE DE SOM gigante: subs embaixo, 4 médios, corneta em cima; LEDs nas quinas e um feixe no topo
    caixaSom(p, m) {
      const W = m.larg, D = m.prof, H = 7.5, fz = D / 2;
      caixa(p, W, H, D, escuro, 0, H / 2, 0);
      for (const y of [2.5, 5.6]) caixa(p, W + 0.06, 0.08, D + 0.06, gelo, 0, y, 0);   // divisórias dos módulos
      for (const x of [-W / 4, W / 4]) altoFalante(p, x, 1.25, fz, 0.62, 0xb98cff);         // SUBS
      for (const [x, y] of [[-W / 4, 3.3], [W / 4, 3.3], [-W / 4, 4.8], [W / 4, 4.8]] as const) altoFalante(p, x, y, fz, 0.42, 0x66e6ff);
      // corneta (boca retangular afunilada) + 2 tweeters
      const corneta = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.25, 0.5, 4, 1, true), coneMat); corneta.rotation.x = Math.PI / 2; corneta.rotation.y = Math.PI / 4; corneta.scale.set(1.6, 1, 0.6); corneta.position.set(0, 6.55, fz - 0.24); p.add(corneta);
      for (const x of [-W / 2 + 0.4, W / 2 - 0.4]) altoFalante(p, x, 6.55, fz, 0.16, 0xff5fd2);
      const boca = new THREE.Object3D(); boca.position.set(0, 4, fz); p.add(boca); caixasSom.push(boca);   // de onde a música sai
      const quinas: THREE.Mesh[] = [];
      for (const sx of [-1, 1]) quinas.push(caixa(p, 0.06, H - 0.2, 0.06, basica(0xb98cff, 0.9, true), sx * (W / 2 + 0.02), H / 2, fz + 0.02));
      caixa(p, W, 0.06, 0.06, basica(0x66e6ff, 0.9, true), 0, H + 0.02, fz);
      anim.push(() => { for (const q of quinas) (q.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.6 * batida(); });
      // um cristal no topo + o feixe virado pra pista
      const topo = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), cristalMat); topo.scale.y = 1.8; topo.position.set(0, H + 1.1, 0); p.add(topo);
      feixe(p, 0, H + 0.05, fz - 0.3, { len: 20, abre: 1.2, rumo: 0, incl: 1.05, fase: m.x * 0.3, cor: 0xff5fd2, varre: 0.4 });
    },
    // SUB na frente do palco: um cone grande
    sub(p, m) {
      caixa(p, m.larg, 1.6, m.prof, escuro, 0, 0.8, 0);
      altoFalante(p, 0, 0.8, m.prof / 2, 0.58, 0xb98cff);
      caixa(p, m.larg, 0.05, 0.05, basica(0x66e6ff, 0.9, true), 0, 1.62, m.prof / 2);
    },
    sofa(p, m) {
      const vel = new THREE.MeshStandardMaterial({ color: 0x3b2470, roughness: 0.85, metalness: 0.05, emissive: 0x1a0f3a, emissiveIntensity: 0.4 });
      const alm = new THREE.MeshStandardMaterial({ color: 0x5a3aa0, roughness: 0.9, emissive: 0x24154d, emissiveIntensity: 0.35 });
      caixa(p, m.larg, 0.42, m.prof, vel, 0, 0.26, 0);
      caixa(p, m.larg, 0.95, 0.32, vel, 0, 0.78, -m.prof / 2 + 0.16);
      for (const s of [-1, 1]) caixa(p, 0.32, 0.72, m.prof, vel, s * (m.larg / 2 - 0.16), 0.6, 0);
      const n = Math.max(1, Math.round((m.larg - 0.64) / 1.5)), w = (m.larg - 0.64) / n;
      if (!o.low) for (let i = 0; i < n; i++) { caixa(p, w - 0.06, 0.18, m.prof - 0.4, alm, -m.larg / 2 + 0.32 + w * (i + 0.5), 0.56, 0.1); caixa(p, w - 0.1, 0.55, 0.16, alm, -m.larg / 2 + 0.32 + w * (i + 0.5), 0.95, -m.prof / 2 + 0.38); }
      caixa(p, m.larg - 0.2, 0.04, 0.04, basica(0xb98cff, 0.8, true), 0, 0.05, m.prof / 2 - 0.05);   // luz de chão
    },
    // PISTA de LED: ladrilhos de 1 m com cores da festa, uma onda saindo do centro a cada batida; o CRISTAL-ESPELHO gira em cima
    pista(p, m) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uB: { value: 0 }, uOnda: { value: 9 }, uA: { value: 0 }, uTam: { value: new THREE.Vector2(m.larg, m.prof) } },
        vertexShader: `varying vec2 vP; uniform vec2 uTam; void main() { vP = (uv - 0.5) * uTam; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uT; uniform float uB; uniform float uOnda; uniform float uA; varying vec2 vP;
          vec3 pal(float k) { k = fract(k); return k < 0.2 ? vec3(0.4,0.9,1.0) : k < 0.4 ? vec3(0.73,0.55,1.0) : k < 0.6 ? vec3(1.0,0.37,0.82) : k < 0.8 ? vec3(0.42,1.0,0.6) : vec3(0.3,0.48,1.0); }
          void main() {
            vec2 c = floor(vP), f = fract(vP);
            float h = fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453);
            float junta = smoothstep(0.0, 0.06, f.x) * smoothstep(0.0, 0.06, f.y) * smoothstep(1.0, 0.94, f.x) * smoothstep(1.0, 0.94, f.y);
            float d = length(c + 0.5), onda = exp(-pow((d - uOnda) * 1.1, 2.0));
            float pisca = 0.5 + 0.5 * sin(uT * (0.8 + h * 1.6) + h * 30.0);
            float v = mix(0.10 + 0.08 * pisca, 0.18 + 0.55 * pisca * uB + 0.9 * onda * uA, uA);
            vec3 col = pal(h + floor(uT * 0.35) * 0.37) * v * junta + vec3(0.02, 0.03, 0.08);
            gl_FragColor = vec4(col, 1.0);
          }`,
      });
      const piso = new THREE.Mesh(new THREE.PlaneGeometry(m.larg, m.prof), mat); piso.rotation.x = -Math.PI / 2; piso.position.y = 0.025; p.add(piso); alvos.push(piso);
      // o cristal-espelho (bola de espelhos facetada) + o cabo até o teto
      const geoBola = new THREE.IcosahedronGeometry(0.75, 1); geoBola.computeVertexNormals();   // não indexada → normal por face (facetada)
      const bola = new THREE.Mesh(geoBola, new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0x223a66, emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.9 }));
      const bolaG = new THREE.Group(); bolaG.position.y = 8.3; bolaG.add(bola); p.add(bolaG);
      const facetas = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 1), new THREE.MeshBasicMaterial({ color: 0x66e6ff, wireframe: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); bolaG.add(facetas);
      caixa(p, 0.03, 4.5, 0.03, escuro, 0, 8.3 + 2.25 + 0.7, 0);
      const brilho = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), basica(0xb98cff, 0.12, true)); bolaG.add(brilho);
      let vista = 0;
      anim.push((dt, t) => {
        const u = mat.uniforms; u.uT!.value = calmo ? t * 0.3 : t; u.uB!.value = energia; u.uA!.value = ativo;
        if (batidas !== vista) { vista = batidas; u.uOnda!.value = 0; } else u.uOnda!.value += dt * 9;   // a onda nasce no centro a cada batida e corre pra fora
        bolaG.rotation.y += dt * (0.3 + 0.9 * ativo); (brilho.material as THREE.MeshBasicMaterial).opacity = 0.06 + 0.3 * batida();
      });
    },
  };

  for (const nome of Object.keys(CIDADE.salas) as NomeSala[]) {
    const s = CIDADE.salas[nome], tema = TEMA[nome], porta = CIDADE.salaParede.porta, ALT = tema.alt;
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = rotDaSala(s); ilha.add(g);
    // piso + friso de luz
    const piso = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r + 0.2, 0.16, o.low ? 32 : 48), new THREE.MeshStandardMaterial({ color: tema.piso, emissive: tema.piso, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.3 }));
    piso.position.y = 0.08; g.add(piso); alvos.push(piso);
    const friso = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.32, s.r - 0.18, 64), basica(tema.brilho, 0.7, true)); friso.rotation.x = -Math.PI / 2; friso.position.y = 0.17; g.add(friso);
    // parede de vidro com a PORTA em +z local (no CylinderGeometry: x = r·sen θ, z = r·cos θ → +z é θ = 0)
    const parede = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, ALT, o.low ? 32 : 48, 1, true, porta, Math.PI * 2 - 2 * porta), o.paredeMat); parede.position.y = ALT / 2; g.add(parede);
    const aro = new THREE.TorusGeometry(s.r, 0.09, 6, 64, Math.PI * 2 - 2 * porta); aro.rotateX(Math.PI / 2); aro.rotateY(-(Math.PI / 2 + porta));
    for (const y of [ALT, 0.25]) { const m = new THREE.Mesh(aro, basica(tema.brilho, 0.8, true)); m.position.y = y; g.add(m); }
    // portal da porta: 2 colunas + verga
    const pz = Math.cos(porta) * s.r, px = Math.sin(porta) * s.r, colMat = new THREE.MeshStandardMaterial({ color: 0x0c1a30, emissive: tema.brilho, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 });
    for (const sx of [-1, 1]) caixa(g, 0.4, ALT + 0.5, 0.4, colMat, sx * px, (ALT + 0.5) / 2, pz);
    caixa(g, px * 2 + 0.4, 0.35, 0.45, colMat, 0, ALT + 0.4, pz);
    // teto: cúpula baixa de vidro
    const teto = new THREE.Mesh(new THREE.SphereGeometry(s.r, o.low ? 20 : 32, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0a1830, emissive: tema.brilho, emissiveIntensity: 0.12, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, roughness: 0.2 }));
    teto.scale.y = 0.32; teto.position.y = ALT; g.add(teto);
    // placa com o nome (sobre a porta)
    const placa = new THREE.Sprite(new THREE.SpriteMaterial({ map: tela(512, 112, (c, w, h) => { c.fillStyle = "rgba(10,8,24,.72)"; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 50); c.fill(); c.strokeStyle = tema.cor; c.lineWidth = 4; c.stroke(); c.fillStyle = tema.cor; c.font = "800 52px system-ui,sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(tema.titulo, w / 2, h / 2 + 2); }), transparent: true, depthWrite: false }));
    placa.scale.set(6.4, 1.4, 1); placa.position.set(0, ALT + 2, pz); g.add(placa);
    // móveis (`y` = elevação própria, ex.: a mesa do DJ em cima do palco; senão, no piso da sala)
    for (const m of MOVEIS[nome]) { const p = new THREE.Group(); p.position.set(m.x, m.y ?? 0.16, m.z); p.rotation.y = m.rot; g.add(p); MOVEL[m.tipo]?.(p, m, tema); }
  }
  return {
    alvos, tv: tvTela, caixas: caixasSom, tocaDiscos,
    somTocando(on, nivel = 0) { tocando = on; nivelAlvo = on ? Math.max(0, Math.min(1, nivel)) : 0; },
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
