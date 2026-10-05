/**
 * Salas — os pavilhões da Zaeon em volta da cidadela: o LOUNGE (sofá em U, TV grande, 2 caixas de som, mesinha,
 * tapete). Cada sala é um pavilhão redondo de vidro
 * com a PORTA virada pro centro da ilha. Layout, móveis e colisores em lib/cyber/ceu.ts (CIDADE.salas, MOVEIS) — aqui
 * só o three. Telas/LEDs animam devagar (sem estrobo); `low` corta os detalhes miúdos.
 */
import * as THREE from "three";
import { CIDADE, MOVEIS, rotDaSala, type Movel, type NomeSala } from "@/lib/cyber/ceu";

const TEMA: Record<NomeSala, { piso: number; brilho: number; titulo: string; cor: string }> = {
  lounge: { piso: 0x170e2c, brilho: 0xb98cff, titulo: "LOUNGE", cor: "#e2d0ff" },
};
const ALT = 4;   // altura da parede

type Opts = { low: boolean; texturas: THREE.Texture[]; paredeMat: THREE.Material };
export type SalasHandle = { alvos: THREE.Object3D[]; atualizar(dt: number, t: number): void };

export function criarSalas(ilha: THREE.Group, o: Opts): SalasHandle {
  const alvos: THREE.Object3D[] = [], anim: ((dt: number, t: number) => void)[] = [];
  const tela = (w: number, h: number, pintar: (g: CanvasRenderingContext2D, w: number, h: number) => void, rep = false) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; pintar(c.getContext("2d")!, w, h);
    const t = new THREE.CanvasTexture(c); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; o.texturas.push(t); return t;
  };
  const caixa = (pai: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); pai.add(m); return m; };
  const basica = (cor: number, op = 1, aditivo = false) => new THREE.MeshBasicMaterial({ color: cor, transparent: op < 1 || aditivo, opacity: op, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !aditivo, side: THREE.DoubleSide });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x0d1220, roughness: 0.45, metalness: 0.5, emissive: 0x0a1226, emissiveIntensity: 0.5 });

  // texturas compartilhadas
  const texTV = tela(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#1a0b3a"); gr.addColorStop(0.5, "#0b2a55"); gr.addColorStop(1, "#2a0b3a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 5; k++) { g.strokeStyle = ["#66e6ff", "#b98cff", "#ff9ad5", "#9affd0", "#ffd36b"][k]!; g.globalAlpha = 0.7; g.lineWidth = 3; g.beginPath();
      for (let x = 0; x <= w; x += 4) { const y = h / 2 + Math.sin((x / w) * Math.PI * 4 + k) * (30 + k * 12) * Math.sin((x / w) * Math.PI * 2); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = "rgba(255,255,255,.9)"; g.font = "800 34px system-ui,sans-serif"; g.textAlign = "center"; g.fillText("ZAEON", w / 2, 50);
  }, true);
  const texTapete = tela(256, 192, (g, w, h) => { g.fillStyle = "#1d1236"; g.fillRect(0, 0, w, h); for (let k = 0; k < 6; k++) { g.strokeStyle = k % 2 ? "rgba(185,140,255,.55)" : "rgba(102,230,255,.35)"; g.lineWidth = 3; g.strokeRect(10 + k * 14, 10 + k * 12, w - 20 - k * 28, h - 20 - k * 24); } });

  const MOVEL: Record<string, (p: THREE.Group, m: Movel, tema: typeof TEMA[NomeSala]) => void> = {
    tv(p, m) {
      caixa(p, m.larg, 0.5, m.prof, escuro, 0, 0.25, 0);
      caixa(p, m.larg, 3.5, 0.16, escuro, 0, 2.45, -0.12);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(m.larg - 0.3, 3.2), new THREE.MeshBasicMaterial({ map: texTV })); s.position.set(0, 2.45, -0.03); p.add(s);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(m.larg + 1.4, 4.4), basica(0x6a5aff, 0.16, true)); h.position.set(0, 2.45, -0.2); p.add(h);
      anim.push((dt) => { texTV.offset.x = (texTV.offset.x + dt * 0.04) % 1; });
    },
    caixaSom(p, m) {
      caixa(p, m.larg, 2.3, m.prof, escuro, 0, 1.15, 0);
      const aneis: THREE.Mesh[] = [];
      for (const [y, r] of [[0.75, 0.34], [1.65, 0.22]] as const) {
        const cone = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 0.8 })); cone.position.set(0, y, m.prof / 2 + 0.01); p.add(cone);
        const anel = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.06, 32), basica(0xb98cff, 0.85, true)); anel.position.set(0, y, m.prof / 2 + 0.02); p.add(anel); aneis.push(anel);
      }
      caixa(p, m.larg * 0.8, 0.05, 0.05, basica(0x66e6ff, 0.9, true), 0, 2.2, m.prof / 2);
      anim.push((_, t) => { const b = 1 + 0.07 * Math.max(0, Math.sin(t * 7.5)) * (0.6 + 0.4 * Math.sin(t * 0.9)); for (const a of aneis) a.scale.setScalar(b); });
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
    mesinha(p, m) {
      caixa(p, m.larg * 0.5, 0.36, m.prof * 0.5, escuro, 0, 0.2, 0);
      const tampo = caixa(p, m.larg, 0.07, m.prof, new THREE.MeshStandardMaterial({ color: 0x9fd0ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.45, emissive: 0x2a4a80, emissiveIntensity: 0.4 }), 0, 0.45, 0);
      tampo.renderOrder = 1;
    },
    tapete(p, m) { const t = new THREE.Mesh(new THREE.PlaneGeometry(m.larg, m.prof), new THREE.MeshBasicMaterial({ map: texTapete, transparent: true, opacity: 0.9 })); t.rotation.x = -Math.PI / 2; t.position.y = 0.18; p.add(t); },
  };

  for (const nome of Object.keys(CIDADE.salas) as NomeSala[]) {
    const s = CIDADE.salas[nome], tema = TEMA[nome], porta = CIDADE.salaParede.porta;
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
    // móveis
    for (const m of MOVEIS[nome]) { const p = new THREE.Group(); p.position.set(m.x, 0.16, m.z); p.rotation.y = m.rot; g.add(p); MOVEL[m.tipo]?.(p, m, tema); }
  }
  return { alvos, atualizar(dt, t) { for (const f of anim) f(dt, t); } };
}
