/**
 * O TABLET do modo estudo (o T do lounge cósmico) — UM SÓ, usado pelo avatar do cyberespaço (components/cyber/AvatarLuz)
 * e pela avatar do painel dos documentos (components/research/ZaeonDocumentos). O dono (out/2026): "o tablet é o mesmo
 * que temos no lounge cósmico, tem que ser o mesmo".
 * Corpo fino escuro, tela acesa com o laboratório, halo; materializa de PARTÍCULAS que espiralam pra mão
 * (lib/cyber/descanso `TABLET`) e "estala" no lugar (ease-out-back). Quem usa põe o `tablet` e as `particulas` no grupo
 * dele, posiciona o tablet a cada quadro (no meio das mãos, virado pro rosto) e chama `animar`.
 */
import * as THREE from "three";

/** ease-out-back (o tablet "estala" no lugar) */
export const voltaPraFora = (x: number) => { const c1 = 1.70158, c3 = c1 + 1, u = x - 1; return 1 + c3 * u * u * u + c1 * u * u; };

export type TabletLounge = {
  tablet: THREE.Group;
  particulas: THREE.Points;
  /** o canvas da tela (quem quiser desenhar por cima chama `telaMudou()` depois) */
  tela: HTMLCanvasElement;
  telaMudou: () => void;
  /** `w` = 0..1 (materializando → aceso); com o tablet já posicionado no quadro */
  animar: (w: number, t: number, parado?: boolean) => void;
  dispose: () => void;
};

/** a tela do laboratório (a de sempre) */
export function desenharTelaLab(c: HTMLCanvasElement) {
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 176); gr.addColorStop(0, "#0a1f3d"); gr.addColorStop(1, "#04101f"); g.fillStyle = gr; g.fillRect(0, 0, 256, 176);
  g.fillStyle = "#66e6ff"; g.fillRect(0, 0, 256, 22); g.fillStyle = "#04101f"; g.font = "bold 13px system-ui, sans-serif"; g.fillText("ZAEON · LABORATÓRIO", 10, 15);
  g.fillStyle = "rgba(143,232,255,.85)"; for (let i = 0; i < 7; i++) g.fillRect(12, 38 + i * 17, 70 + ((i * 47) % 90), 6);
  g.strokeStyle = "#9fe8ff"; g.lineWidth = 3; g.beginPath(); g.arc(205, 92, 30, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(205, 92, 14, 0, Math.PI * 2); g.stroke();
}

/** a TELA HOLOGRÁFICA (sem nada escrito): luz ciano, borda acesa, linhas de varredura bem leves */
export function desenharTelaHolograma(c: HTMLCanvasElement) {
  const g = c.getContext("2d")!; g.clearRect(0, 0, 256, 176);
  const gr = g.createLinearGradient(0, 0, 0, 176); gr.addColorStop(0, "rgba(20,150,210,.55)"); gr.addColorStop(1, "rgba(10,90,160,.32)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 176);
  g.fillStyle = "rgba(160,240,255,.16)"; for (let y = 2; y < 176; y += 4) g.fillRect(0, y, 256, 1);
  g.strokeStyle = "rgba(150,240,255,1)"; g.lineWidth = 4; g.strokeRect(2, 2, 252, 172);
  g.fillStyle = "rgba(150,240,255,1)"; for (const [x, y] of [[2, 2], [238, 2], [2, 158], [238, 158]] as const) g.fillRect(x, y, 16, 16);
}

/** um brilho redondo (o halo do holograma — sem a borda quadrada do plano) */
function brilhoRedondo(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!, gr = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function criarTabletLounge(o: { luz: THREE.ColorRepresentation; corpo: THREE.Material; estrela: THREE.Texture; low?: boolean; /** a versão HOLOGRÁFICA (tela de luz sem nada escrito, sem o corpo opaco) — o painel dos documentos */ holograma?: boolean }): TabletLounge {
  const tablet = new THREE.Group(); tablet.visible = false;
  const tela = document.createElement("canvas"); tela.width = 256; tela.height = 176; (o.holograma ? desenharTelaHolograma : desenharTelaLab)(tela);
  const texTela = new THREE.CanvasTexture(tela); texTela.colorSpace = THREE.SRGBColorSpace;
  const matTabTela = new THREE.MeshBasicMaterial({ map: texTela, transparent: true, opacity: 0, ...(o.holograma ? { depthWrite: false, side: THREE.DoubleSide, toneMapped: false } : {}) });
  const brilho = o.holograma ? brilhoRedondo() : null;
  const matTabHalo = new THREE.MeshBasicMaterial({ color: o.luz, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, ...(brilho ? { map: brilho } : {}) });
  if (!o.holograma) tablet.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.21, 0.014), o.corpo));
  const telaTab = new THREE.Mesh(new THREE.PlaneGeometry(0.272, 0.186), matTabTela); telaTab.position.z = 0.0075; tablet.add(telaTab);
  const haloTab = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.48), matTabHalo); haloTab.position.z = -0.012; tablet.add(haloTab);
  const NPT = o.low ? 18 : 36, ptPos = new Float32Array(NPT * 3), ptGeo = new THREE.BufferGeometry(); ptGeo.setAttribute("position", new THREE.BufferAttribute(ptPos, 3));
  const matPtTab = new THREE.PointsMaterial({ size: 0.07, map: o.estrela, color: o.luz, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const particulas = new THREE.Points(ptGeo, matPtTab); particulas.frustumCulled = false; particulas.visible = false;

  return {
    tablet, particulas, tela,
    telaMudou: () => { texTela.needsUpdate = true; },
    animar(w, t, parado = false) {
      tablet.visible = w > 0.01; particulas.visible = w > 0.01 && w < 0.985;
      if (!tablet.visible) return;
      const e = voltaPraFora(Math.min(1, w)); tablet.scale.setScalar(Math.max(0.001, e));
      matTabTela.opacity = Math.max(0, Math.min(1, (w - 0.55) / 0.4)) * (w < 0.98 && !parado ? 0.75 + 0.25 * Math.sin(t * 40) : 1);
      matTabHalo.opacity = (0.55 * Math.sin(Math.PI * Math.min(1, w)) + 0.12 * w) * (o.holograma ? 0.5 : 1);
      if (particulas.visible) {
        const pl = tablet.position, abre = 1 - w;
        for (let i = 0; i < NPT; i++) { const a = i * 2.39996 + t * 5, r = 0.06 + abre * (0.45 + 0.25 * ((i * 7) % 5) / 5), y = (((i * 13) % 11) / 11 - 0.5) * abre * 0.9; ptPos[i * 3] = pl.x + Math.cos(a) * r; ptPos[i * 3 + 1] = pl.y + y; ptPos[i * 3 + 2] = pl.z + Math.sin(a) * r; }
        ptGeo.attributes.position!.needsUpdate = true; matPtTab.opacity = 0.9 * Math.min(1, abre * 3);
      }
    },
    dispose() {
      tablet.traverse((m) => { (m as THREE.Mesh).geometry?.dispose(); }); o.corpo.dispose(); matTabTela.dispose(); matTabHalo.dispose(); texTela.dispose(); brilho?.dispose(); ptGeo.dispose(); matPtTab.dispose();
    },
  };
}
