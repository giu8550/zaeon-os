/**
 * RifleCosmico — o RIFLE de energia (out/2026, a imagem de referência do dono): corpo longo azul-marinho quase preto, as
 * BORDAS em neon azul, as VEIAS violeta correndo pelo cano, o CANO TRIPLO com os anéis de luz na boca, o painel lateral
 * aceso (números) e a coronha vazada de tubo de luz. A lógica fica em lib/cyber/rifle.
 *
 * Referencial: a ORIGEM é o punho (onde a mão direita segura), +z = pra onde o cano aponta, +y = o topo da arma.
 * `revela` 0..1 materializa (cresce do punho pra boca, aceso); `calor` 0..1 esquenta a boca (azul → laranja).
 */
import * as THREE from "three";

export type RifleHandle = {
  group: THREE.Group;
  /** a BOCA do cano do meio (no referencial da arma) — de onde a bala sai */
  boca: THREE.Vector3;
  /** o clarão de um tiro (a boca acende e some em ~0,06 s) */
  disparar(): void;
  atualizar(t: number, dt: number, o: { revela: number; calor: number }): void;
  dispose(): void;
};

const AZUL = 0x2fa8ff, AZUL_CLARO = 0x9fdcff, VIOLETA = 0xb45cff;

export function criarRifleCosmico(o: { low: boolean }): RifleHandle {
  const group = new THREE.Group(); group.name = "rifle-cosmico";
  const corpo = new THREE.Group(); group.add(corpo);   // (o que escala ao materializar)
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const m = <T extends THREE.Material>(x: T) => { mats.push(x); return x; };
  const metal = m(new THREE.MeshStandardMaterial({ color: 0x0b1530, metalness: 0.75, roughness: 0.32, emissive: 0x061a3a, emissiveIntensity: 0.9 }));
  const metalEsc = m(new THREE.MeshStandardMaterial({ color: 0x060a16, metalness: 0.8, roughness: 0.4, emissive: 0x020814, emissiveIntensity: 1 }));
  const neon = m(new THREE.MeshBasicMaterial({ color: AZUL, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  const neonClaro = m(new THREE.MeshBasicMaterial({ color: AZUL_CLARO }));
  const violeta = m(new THREE.MeshBasicMaterial({ color: VIOLETA, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  const boca = m(new THREE.MeshBasicMaterial({ color: AZUL_CLARO, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, pai: THREE.Object3D = corpo) => { geos.push(geo); const k = new THREE.Mesh(geo, mat); k.position.set(x, y, z); pai.add(k); return k; };
  const caixa = (w: number, h: number, l: number, mat: THREE.Material, x: number, y: number, z: number) => add(new THREE.BoxGeometry(w, h, l), mat, x, y, z);
  const seg = o.low ? 10 : 18;

  // o RECEPTOR (o corpo do meio, chanfrado) e o topo com o trilho
  caixa(0.075, 0.095, 0.42, metal, 0, 0.065, 0.1);
  caixa(0.062, 0.03, 0.4, metalEsc, 0, 0.125, 0.11);
  for (let i = 0; i < 7; i++) caixa(0.05, 0.012, 0.025, metalEsc, 0, 0.145, -0.04 + i * 0.05);   // os dentes do trilho
  // a MIRA de cima (uma luneta curta com a lente acesa)
  const lun = add(new THREE.CylinderGeometry(0.022, 0.022, 0.13, seg), metal, 0, 0.175, 0.06); lun.rotation.x = Math.PI / 2;
  const lente = add(new THREE.CircleGeometry(0.018, seg), neonClaro, 0, 0.175, -0.006); lente.rotation.y = Math.PI;
  // o CANO longo (a capa) — um pouco mais estreito que o receptor, até a boca
  caixa(0.068, 0.075, 0.5, metal, 0, 0.058, 0.55);
  caixa(0.05, 0.022, 0.48, metalEsc, 0, 0.105, 0.55);
  // as BORDAS em neon azul (as quinas de cima e de baixo, dos dois lados, do receptor à boca)
  for (const sx of [-1, 1]) {
    caixa(0.006, 0.006, 0.9, neon, sx * 0.039, 0.112, 0.36);
    caixa(0.006, 0.006, 0.86, neon, sx * 0.036, 0.02, 0.38);
    // as VEIAS violeta pelo cano (duas faixas que correm na lateral) e os traços azuis curtos (o "texto" da arma)
    caixa(0.004, 0.009, 0.42, violeta, sx * 0.0355, 0.07, 0.56);
    caixa(0.004, 0.006, 0.3, violeta, sx * 0.0355, 0.045, 0.6);
    for (let i = 0; i < 4; i++) caixa(0.004, 0.005, 0.03 + (i % 2) * 0.02, neon, sx * 0.0385, 0.09, 0.2 + i * 0.05);
  }
  // o PAINEL lateral aceso (números, como na imagem) — dos dois lados do receptor
  const tex = new THREE.CanvasTexture((() => {
    const c = document.createElement("canvas"); c.width = 128; c.height = 48; const g = c.getContext("2d")!;
    g.fillStyle = "#04122a"; g.fillRect(0, 0, 128, 48); g.strokeStyle = "#5fd8ff"; g.lineWidth = 2; g.strokeRect(2, 2, 124, 44);
    g.fillStyle = "#9fe8ff"; g.font = "bold 11px monospace"; g.fillText("ZAEON·RX", 8, 16); g.font = "bold 15px monospace"; g.fillText("19:56 323", 8, 36);
    g.fillStyle = "#b45cff"; g.fillRect(100, 8, 18, 4); g.fillRect(100, 16, 12, 4);
    return c; })());
  tex.colorSpace = THREE.SRGBColorSpace;
  const matPainel = m(new THREE.MeshBasicMaterial({ map: tex }));
  for (const sx of [-1, 1]) { const p = add(new THREE.PlaneGeometry(0.13, 0.05), matPainel, sx * 0.0385, 0.072, 0.13); p.rotation.y = sx * Math.PI / 2; }
  // o CANO TRIPLO na boca: três tubos em triângulo, cada um com o anel de luz
  const bocaPos = new THREE.Vector3(0, 0.058, 0.86);
  const anel = new THREE.TorusGeometry(0.021, 0.006, 6, seg); geos.push(anel);
  for (const [x, y] of [[0, 0.03], [-0.026, -0.016], [0.026, -0.016]] as const) {
    const tubo = add(new THREE.CylinderGeometry(0.019, 0.019, 0.08, seg), metalEsc, x, bocaPos.y + y, 0.83); tubo.rotation.x = Math.PI / 2;
    const a = new THREE.Mesh(anel, boca); a.position.set(x, bocaPos.y + y, 0.872); corpo.add(a);
    const nucleo = add(new THREE.CircleGeometry(0.012, seg), boca, x, bocaPos.y + y, 0.873); nucleo.userData.nucleo = true;
  }
  const colar = add(new THREE.CylinderGeometry(0.05, 0.046, 0.05, seg), metal, 0, bocaPos.y, 0.78); colar.rotation.x = Math.PI / 2;
  const anelColar = add(new THREE.TorusGeometry(0.05, 0.005, 6, seg), neon, 0, bocaPos.y, 0.805);
  void anelColar;
  // o PUNHO (onde a mão direita segura: a origem) e o guarda-mato, o carregador de energia e a empunhadura da frente
  const punho = caixa(0.04, 0.13, 0.055, metalEsc, 0, -0.045, -0.01); punho.rotation.x = -0.28;
  caixa(0.006, 0.006, 0.09, neon, 0, -0.005, 0.03);   // o guarda-mato (aceso)
  const carregador = caixa(0.045, 0.1, 0.06, metal, 0, -0.02, 0.15); carregador.rotation.x = 0.12;
  caixa(0.048, 0.012, 0.062, violeta, 0, -0.068, 0.157);
  const frente = caixa(0.035, 0.07, 0.04, metalEsc, 0, 0.0, 0.42); frente.rotation.x = 0.2;   // (a mão de apoio fica por aqui)
  // a CORONHA vazada: um quadro de tubo de luz atrás do punho, com a soleira escura
  const tuboCoronha = (a: THREE.Vector3, b: THREE.Vector3, mat: THREE.Material, r: number) => {
    const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), 8); geos.push(g);
    const k = new THREE.Mesh(g, mat); k.position.copy(a).add(b).multiplyScalar(0.5); k.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); corpo.add(k);
  };
  const c0 = new THREE.Vector3(0, 0.09, -0.11), c1 = new THREE.Vector3(0, 0.07, -0.36), c2 = new THREE.Vector3(0, -0.06, -0.36), c3 = new THREE.Vector3(0, 0.0, -0.11);
  tuboCoronha(c0, c1, metal, 0.016); tuboCoronha(c3, c2, metal, 0.016); tuboCoronha(c1, c2, metalEsc, 0.022);
  tuboCoronha(c0.clone().setX(0.012), c1.clone().setX(0.012), neon, 0.004); tuboCoronha(c0.clone().setX(-0.012), c1.clone().setX(-0.012), neon, 0.004);
  caixa(0.05, 0.15, 0.025, metalEsc, 0, 0.005, -0.375);
  caixa(0.054, 0.12, 0.006, neon, 0, 0.005, -0.389);

  // o CLARÃO da boca (sprite) e o halo da arma (some quando materializada)
  const texClarao = new THREE.CanvasTexture((() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(160,220,255,.85)"); gr.addColorStop(0.6, "rgba(180,92,255,.35)"); gr.addColorStop(1, "rgba(60,80,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; })());
  const matClarao = m(new THREE.SpriteMaterial({ map: texClarao, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const clarao = new THREE.Sprite(matClarao); clarao.position.copy(bocaPos).setZ(0.92); clarao.scale.setScalar(0.35); group.add(clarao);
  corpo.traverse((x) => { (x as THREE.Mesh).castShadow = false; });

  let tClarao = -1;
  const azul = new THREE.Color(AZUL_CLARO), quente = new THREE.Color(0xff8a3a);
  return {
    group, boca: bocaPos.clone().setZ(0.9),
    disparar() { tClarao = 0; },
    atualizar(t, dt, { revela, calor }) {
      const r = Math.max(0, Math.min(1, revela));
      group.visible = r > 0.01;
      if (!group.visible) return;
      // materializa do punho pra boca (z cresce), um pouco mais acesa enquanto se forma
      corpo.scale.set(1, 1, Math.max(0.02, r * r * (3 - 2 * r)));
      const forma = 1 - r, pulso = 0.82 + 0.18 * Math.sin(t * 3.1);
      neon.opacity = Math.min(1, pulso + forma); violeta.opacity = Math.min(1, 0.75 + 0.25 * Math.sin(t * 2.3 + 1) + forma);
      boca.color.copy(azul).lerp(quente, Math.max(0, Math.min(1, calor * 1.15 - 0.15)));
      if (tClarao >= 0) { tClarao += dt; const k = Math.max(0, 1 - tClarao / 0.07); matClarao.opacity = k; clarao.scale.setScalar(0.22 + 0.3 * k + 0.1 * Math.random()); matClarao.rotation = Math.random() * 6.28; if (k <= 0) tClarao = -1; }
    },
    dispose() { for (const g of geos) g.dispose(); for (const x of mats) x.dispose(); tex.dispose(); texClarao.dispose(); group.removeFromParent(); },
  };
}
