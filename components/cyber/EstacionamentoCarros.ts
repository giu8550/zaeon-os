/**
 * EstacionamentoCarros — o PISO de um estacionamento de CARROS VOADORES na Zaeon (lib/cyber/carros `LOTES_CARRO`): a
 * laje escura, uma vaga demarcada por carro (as faixas de luz e o fundo aceso, mais largo que o das motos), a FAIXA DE
 * DECOLAGEM na frente (setas de luz apontando pra borda — os carros saem de nariz pro céu aberto) e postes baixos de
 * recarga nos cantos. Referencial: +z = pra fora (a borda), x = ao longo da fila; y = 0 = o piso da ilha.
 */
import * as THREE from "three";
import { tamanhoDoLoteCarro, type LoteCarro } from "@/lib/cyber/carros";

export type PisoCarrosHandle = { group: THREE.Group; atualizar(t: number): void; dispose(): void };

export function criarPisoCarros(l: LoteCarro, o: { low: boolean }): PisoCarrosHandle {
  const g = new THREE.Group(); g.name = `estacionamento-carros-${l.nome}`;
  const { larg, prof } = tamanhoDoLoteCarro(l), geos: THREE.BufferGeometry[] = [];
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material) => { geos.push(geo); const x = new THREE.Mesh(geo, m); g.add(x); return x; };
  const laje = new THREE.MeshStandardMaterial({ color: 0x0b1222, emissive: 0x0c1830, emissiveIntensity: 0.45, roughness: 0.8, metalness: 0.35 });
  const faixa = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.85 });
  const fundo = new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  const seta = new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const poste = new THREE.MeshStandardMaterial({ color: 0x1c2438, roughness: 0.35, metalness: 0.85 });
  const luzPoste = new THREE.MeshBasicMaterial({ color: 0xffb46a });
  const PISTA = 7;   // a faixa de decolagem na frente (m)
  mesh(new THREE.BoxGeometry(larg, 0.1, prof + PISTA), laje).position.set(0, 0.05, PISTA / 2);
  for (let f = 0; f < l.filas; f++) {
    const z = (f - (l.filas - 1) / 2) * l.entreFilas;
    for (let i = 0; i <= l.porFila; i++) mesh(new THREE.BoxGeometry(0.14, 0.03, l.entreFilas - 1.4), faixa).position.set((i - l.porFila / 2) * l.passo, 0.115, z);
    mesh(new THREE.BoxGeometry(l.porFila * l.passo, 0.03, 0.14), faixa).position.set(0, 0.115, z - (l.entreFilas - 1.4) / 2);
    for (let i = 0; i < l.porFila; i++) { const q = mesh(new THREE.PlaneGeometry(l.passo - 0.9, l.entreFilas - 2), fundo); q.rotation.x = -Math.PI / 2; q.position.set((i - (l.porFila - 1) / 2) * l.passo, 0.12, z); }
  }
  // as SETAS da faixa de decolagem (chevrons pra fora)
  const chevron = new THREE.Shape(); chevron.moveTo(-1.2, 0); chevron.lineTo(0, 0.9); chevron.lineTo(1.2, 0); chevron.lineTo(1.2, 0.35); chevron.lineTo(0, 1.25); chevron.lineTo(-1.2, 0.35); chevron.closePath();
  const geoChev = new THREE.ShapeGeometry(chevron); geos.push(geoChev);
  const setas: THREE.Mesh[] = [];
  for (let i = 0; i < (o.low ? 2 : 3); i++) { const s = new THREE.Mesh(geoChev, seta); s.rotation.x = -Math.PI / 2; s.position.set(0, 0.13, prof / 2 + 1.2 + i * 1.8); g.add(s); setas.push(s); }
  // os POSTES de recarga nos 4 cantos (a luz quente do mesmo tom das faixas)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.2, 8), poste).position.set(sx * (larg / 2 - 0.4), 1.1, sz * (prof / 2 - 0.4));
    mesh(new THREE.SphereGeometry(0.2, 10, 8), luzPoste).position.set(sx * (larg / 2 - 0.4), 2.3, sz * (prof / 2 - 0.4));
  }
  const mats = [laje, faixa, fundo, seta, poste, luzPoste];
  return {
    group: g,
    // as setas acendem em sequência, pra fora (o "por aqui se decola")
    atualizar(t) { setas.forEach((s, i) => { s.visible = Math.floor(t * 2.5) % (setas.length + 1) > i; }); },
    dispose() { g.removeFromParent(); for (const x of geos) x.dispose(); for (const m of mats) m.dispose(); },
  };
}
