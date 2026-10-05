/**
 * HoloRecado — o HOLOGRAMA do recado do dono no QG do Andrei: um painel de luz flutuando ao lado da tela onde ele
 * trabalha (a base dele no centro do salão). Mostra quem mandou (na cor dele), há quanto tempo e o texto. Translúcido,
 * com linhas de varredura e um brilho lento; quando chega um recado NOVO, pulsa e "acende" (o engine toca o ping).
 * Sem recado: some (só a base fica, com um emissorzinho apagado).
 */
import * as THREE from "three";
import type { RecadoQG } from "@/lib/lounge3d/tipos";
import { linhasDoRecado, tempoDoRecado } from "@/lib/cyber/recado";

const W = 1.8, H = 2.2;   // metros

export type HoloRecadoHandle = {
  group: THREE.Group;
  mostrar(r: RecadoQG | null, novo: boolean): void;
  atualizar(dt: number, t: number): void;
  dispose(): void;
};

export function criarHoloRecado(): HoloRecadoHandle {
  const g = new THREE.Group();
  const c = document.createElement("canvas"); c.width = 512; c.height = 648;
  const tex = new THREE.CanvasTexture(c);
  // fundo escuro translúcido + texto claro (normal, não aditivo): lê bem até contra o piso claro do salão
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const painel = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat); painel.position.y = 2.1; g.add(painel);
  // moldura de luz + emissor no chão (o "projetor") + feixe fininho que sobe até o painel
  const ciano = new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const borda = new THREE.Group(); borda.position.copy(painel.position); g.add(borda);   // (a borda de luz vem desenhada no canvas)
  const emissor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0x0c1a30, emissive: 0x2b6bd0, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.5 }));
  emissor.position.y = 0.06; g.add(emissor);
  const feixe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.6, 1.2, 16, 1, true), ciano); feixe.position.y = 0.7; g.add(feixe);

  let atual: RecadoQG | null = null, alvo = 0, vis = 0, pulso = 0, ultimoDesenho = 0;
  const desenhar = () => {
    const x = c.getContext("2d")!; x.clearRect(0, 0, c.width, c.height);
    if (!atual) return;
    x.font = "600 34px system-ui,sans-serif";
    const linhas = linhasDoRecado(atual.texto, (s) => x.measureText(s).width, c.width - 64, 12);
    const alto = Math.min(c.height, 112 + linhas.length * 40 + 30);   // o fundo cobre só o conteúdo
    // fundo holográfico (escuro translúcido, borda de luz) + linhas de varredura
    const gr = x.createLinearGradient(0, 0, 0, alto); gr.addColorStop(0, "rgba(8,34,72,.92)"); gr.addColorStop(1, "rgba(5,20,48,.86)");
    x.fillStyle = gr; x.beginPath(); x.roundRect(4, 4, c.width - 8, alto - 8, 22); x.fill();
    x.strokeStyle = "rgba(120,225,255,.9)"; x.lineWidth = 4; x.stroke();
    x.save(); x.clip(); x.fillStyle = "rgba(160,235,255,.07)"; for (let y = 0; y < alto; y += 6) x.fillRect(0, y, c.width, 2); x.restore();
    // cabeçalho: quem mandou (na cor dele) + há quanto tempo
    x.fillStyle = atual.deCor; x.beginPath(); x.arc(42, 52, 14, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#e6f6ff"; x.font = "700 30px system-ui,sans-serif"; x.textBaseline = "middle"; x.fillText(atual.deNome.slice(0, 22), 68, 52);
    x.fillStyle = "rgba(200,240,255,.7)"; x.font = "500 22px system-ui,sans-serif"; x.textAlign = "right"; x.fillText(tempoDoRecado(atual.ts, Date.now()), c.width - 28, 52); x.textAlign = "left";
    x.fillStyle = "rgba(160,235,255,.5)"; x.fillRect(28, 86, c.width - 56, 2);
    // o texto, quebrado em linhas
    x.fillStyle = "#ffffff"; x.font = "600 34px system-ui,sans-serif"; x.textBaseline = "top";
    linhas.forEach((l, i) => x.fillText(l, 32, 112 + i * 40));
    tex.needsUpdate = true; ultimoDesenho = Date.now();
  };

  return {
    group: g,
    mostrar(r, novo) {
      atual = r; alvo = r ? 1 : 0;
      if (r && novo) pulso = 1;
      desenhar();
    },
    atualizar(dt, t) {
      vis += (alvo - vis) * Math.min(1, dt * 3);
      pulso = Math.max(0, pulso - dt * 0.6);
      const tremor = 0.9 + 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 17.1);   // cintilar de holograma (suave)
      mat.opacity = vis * tremor * (0.85 + 0.6 * pulso);
      ciano.opacity = vis * (0.12 + 0.25 * pulso);
      painel.position.y = borda.position.y = 2.1 + Math.sin(t * 0.9) * 0.04;
      painel.scale.setScalar(1 + 0.04 * pulso); borda.scale.copy(painel.scale);
      (emissor.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + vis * 0.8;
      if (atual && Date.now() - ultimoDesenho > 30000) desenhar();   // "há 3 min" vai envelhecendo
    },
    dispose() { g.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mt = m.material as THREE.Material | undefined; mt?.dispose?.(); }); tex.dispose(); g.removeFromParent(); },
  };
}
