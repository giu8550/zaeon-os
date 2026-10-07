/**
 * Estacionamento — o PISO de um estacionamento de motos voadoras (o do chão e o da Zaeon usam o mesmo): piso escuro,
 * uma vaga demarcada por moto (faixas + fundo de luz), postes de recarga atrás de cada fila e a PLATAFORMA do robô que
 * repõe as motos (ao lado da fila da frente). Referencial local: a fila corre em x, a FRENTE das vagas é +z; as filas
 * vêm uma atrás da outra (lib/cyber/motos: `vagaNoLote`). As motos e o robô são do engine.
 */
import * as THREE from "three";
import { tamanhoDoLote, vagaNoLote, type Lote } from "@/lib/cyber/motos";

export type PisoEstacionamentoHandle = { group: THREE.Group; atualizar(t: number): void; dispose(): void };

export function criarPisoEstacionamento(o: { low: boolean; parado?: boolean; lote: Lote }): PisoEstacionamentoHandle {
  const g = new THREE.Group(), l = o.lote, { larg, prof } = tamanhoDoLote(l), e = l.espacamento;
  const piso = new THREE.Mesh(new THREE.BoxGeometry(larg, 0.1, prof), new THREE.MeshStandardMaterial({ color: 0x0b1222, emissive: 0x0c1830, emissiveIntensity: 0.45, roughness: 0.8, metalness: 0.35 }));
  piso.position.y = 0.05; g.add(piso);
  const faixa = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.8 });
  const fundo = new THREE.MeshBasicMaterial({ color: 0x45d6ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const poste = new THREE.MeshStandardMaterial({ color: 0x1c2438, roughness: 0.35, metalness: 0.85 });
  const anelMat = new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let f = 0; f < l.filas; f++) {
    const zf = vagaNoLote(l, f, 0).z;
    // faixas entre as vagas (ao longo da profundidade) + a linha do fundo + o fundo de luz de cada vaga
    for (let i = 0; i <= l.porFila; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 5), faixa); b.position.set((i - l.porFila / 2) * e, 0.115, zf); g.add(b); }
    const linha = new THREE.Mesh(new THREE.BoxGeometry(l.porFila * e, 0.03, 0.12), faixa); linha.position.set(0, 0.115, zf - 2.56); g.add(linha);
    for (let i = 0; i < l.porFila; i++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(e - 0.8, 4.6), fundo); q.rotation.x = -Math.PI / 2; q.position.set(vagaNoLote(l, f, i).x, 0.12, zf); g.add(q); }
    // postes de recarga atrás da fila (um entre cada vaga), com um anel de luz no alto
    for (let i = 0; i <= l.porFila; i++) {
      const x = (i - l.porFila / 2) * e;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 2.6, o.low ? 6 : 10), poste); p.position.set(x, 1.3, zf - 3.15); g.add(p);
      const a = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), anelMat); a.rotation.x = Math.PI / 2; a.position.set(x, 2.45, zf - 3.15); g.add(a);
    }
  }
  // a PLATAFORMA do robô (a base de onde ele sai pra fabricar): um disco com anel de luz ao lado da fila da frente
  const bx = larg / 2 + 2.5, bz = ((l.filas - 1) / 2) * l.entreFilas;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.25, o.low ? 16 : 32), poste); pad.position.set(bx, 0.125, bz); g.add(pad);
  const anelPad = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.05, 6, o.low ? 24 : 48), anelMat); anelPad.rotation.x = Math.PI / 2; anelPad.position.set(bx, 0.27, bz); g.add(anelPad);
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
