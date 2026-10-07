/**
 * Estacionamento — o PISO de um estacionamento de motos voadoras (o do chão e o da Zaeon usam o mesmo): piso escuro,
 * uma vaga demarcada por moto (faixas + fundo de luz) com a PLATAFORMA DE LANÇAMENTO dela (um pedestal sextavado com
 * anel de luz em cima: a moto parada fica nele, mais alta), postes de recarga atrás de cada fila e a PLATAFORMA do robô que
 * repõe as motos (ao lado da fila da frente). Referencial local: a fila corre em x, a FRENTE das vagas é +z; as filas
 * vêm uma atrás da outra (lib/cyber/motos: `vagaNoLote`). As motos e o robô são do engine.
 */
import * as THREE from "three";
import { PLATAFORMA_MOTO, tamanhoDoLote, vagaNoLote, type Lote } from "@/lib/cyber/motos";

export type PisoEstacionamentoHandle = { group: THREE.Group; atualizar(t: number): void; dispose(): void };

export function criarPisoEstacionamento(o: { low: boolean; parado?: boolean; lote: Lote }): PisoEstacionamentoHandle {
  const g = new THREE.Group(), l = o.lote, { larg, prof } = tamanhoDoLote(l), e = l.espacamento;
  const piso = new THREE.Mesh(new THREE.BoxGeometry(larg, 0.1, prof), new THREE.MeshStandardMaterial({ color: 0x0b1222, emissive: 0x0c1830, emissiveIntensity: 0.45, roughness: 0.8, metalness: 0.35 }));
  piso.position.y = 0.05; g.add(piso);
  const faixa = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.8 });
  const fundo = new THREE.MeshBasicMaterial({ color: 0x45d6ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const poste = new THREE.MeshStandardMaterial({ color: 0x1c2438, roughness: 0.35, metalness: 0.85 });
  const pedestal = new THREE.MeshStandardMaterial({ color: 0x182238, roughness: 0.3, metalness: 0.8, emissive: 0x0a1428, emissiveIntensity: 0.6 });
  const tampo = new THREE.MeshStandardMaterial({ color: 0x0e1a30, roughness: 0.2, metalness: 0.6, emissive: 0x123a66, emissiveIntensity: 0.5 });
  const anelMat = new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let f = 0; f < l.filas; f++) {
    const zf = vagaNoLote(l, f, 0).z;
    // faixas entre as vagas (ao longo da profundidade) + a linha do fundo + o fundo de luz de cada vaga
    for (let i = 0; i <= l.porFila; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 5), faixa); b.position.set((i - l.porFila / 2) * e, 0.115, zf); g.add(b); }
    const linha = new THREE.Mesh(new THREE.BoxGeometry(l.porFila * e, 0.03, 0.12), faixa); linha.position.set(0, 0.115, zf - 2.56); g.add(linha);
    for (let i = 0; i < l.porFila; i++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(e - 0.8, 4.6), fundo); q.rotation.x = -Math.PI / 2; q.position.set(vagaNoLote(l, f, i).x, 0.12, zf); g.add(q); }
    // a PLATAFORMA DE LANÇAMENTO de cada vaga: pedestal sextavado (a moto parada fica em cima), anel de luz no topo e
    // uma faixa de luz na lateral — de onde se sai pairando
    const H = PLATAFORMA_MOTO.altura, R = PLATAFORMA_MOTO.r;
    for (let i = 0; i < l.porFila; i++) {
      const x = vagaNoLote(l, f, i).x;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.12, H, 6), pedestal); ped.position.set(x, H / 2, zf); ped.rotation.y = Math.PI / 6; g.add(ped);
      const topo = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.92, R * 0.92, 0.04, 6), tampo); topo.position.set(x, H + 0.02, zf); topo.rotation.y = Math.PI / 6; g.add(topo);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(R * 0.82, 0.035, 6, o.low ? 24 : 48), anelMat); aro.rotation.x = Math.PI / 2; aro.position.set(x, H + 0.05, zf); g.add(aro);
      const faixaLat = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.06, R * 1.08, 0.06, 6, 1, true), anelMat); faixaLat.position.set(x, H * 0.45, zf); faixaLat.rotation.y = Math.PI / 6; g.add(faixaLat);
    }
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
      for (const m of [piso.material as THREE.Material, faixa, fundo, poste, anelMat, pedestal, tampo]) m.dispose();
      g.removeFromParent();
    },
  };
}
