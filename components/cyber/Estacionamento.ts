/**
 * Estacionamento — o PISO de um estacionamento de motos voadoras (o do chão e o da Zaeon usam o mesmo): piso escuro,
 * uma vaga demarcada por moto (faixas + fundo de luz), postes de recarga atrás da fila. Referencial local: a fila
 * corre em x, a FRENTE das vagas é +z. As motos são do engine (components/cyber/Moto.ts).
 */
import * as THREE from "three";
import { ESTACIONAMENTO } from "@/lib/cyber/motos";

export type PisoEstacionamentoHandle = { group: THREE.Group; atualizar(t: number): void; dispose(): void };

export function criarPisoEstacionamento(o: { low: boolean; parado?: boolean }): PisoEstacionamentoHandle {
  const g = new THREE.Group(), e = ESTACIONAMENTO, larg = e.n * e.espacamento + 2.4, prof = 7.2;
  const piso = new THREE.Mesh(new THREE.BoxGeometry(larg, 0.1, prof), new THREE.MeshStandardMaterial({ color: 0x0b1222, emissive: 0x0c1830, emissiveIntensity: 0.45, roughness: 0.8, metalness: 0.35 }));
  piso.position.y = 0.05; g.add(piso);
  const faixa = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.8 });
  const fundo = new THREE.MeshBasicMaterial({ color: 0x45d6ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  // faixas entre as vagas (ao longo da profundidade) + a linha do fundo + o fundo de luz de cada vaga
  for (let i = 0; i <= e.n; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 5), faixa); b.position.set((i - e.n / 2) * e.espacamento, 0.115, 0); g.add(b); }
  const linha = new THREE.Mesh(new THREE.BoxGeometry(e.n * e.espacamento, 0.03, 0.12), faixa); linha.position.set(0, 0.115, -2.56); g.add(linha);
  for (let i = 0; i < e.n; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(e.espacamento - 0.6, 4.6), fundo); l.rotation.x = -Math.PI / 2; l.position.set((i - (e.n - 1) / 2) * e.espacamento, 0.12, 0); g.add(l); }
  // postes de recarga atrás da fila (um entre cada vaga), com um anel de luz no alto
  const poste = new THREE.MeshStandardMaterial({ color: 0x1c2438, roughness: 0.35, metalness: 0.85 });
  const anelMat = new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i <= e.n; i++) {
    const x = (i - e.n / 2) * e.espacamento;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 2.6, o.low ? 6 : 10), poste); p.position.set(x, 1.3, -3.15); g.add(p);
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), anelMat); a.rotation.x = Math.PI / 2; a.position.set(x, 2.45, -3.15); g.add(a);
  }
  return {
    group: g,
    atualizar(t) { if (o.parado) return; anelMat.opacity = 0.55 + 0.2 * Math.sin(t * 1.4); fundo.opacity = 0.18 + 0.06 * Math.sin(t * 1.1); },
    dispose() {
      g.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); });
      for (const m of [piso.material as THREE.Material, faixa, fundo, poste, anelMat]) m.dispose();
      g.removeFromParent();
    },
  };
}
