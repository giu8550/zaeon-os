/**
 * LivrosEstudos — os ESTUDOS da pessoa como LIVROS na BIBLIOTECA do cyberespaço (lib/estudos/itens): cada estudo do
 * board de Meus Estudos flutua, aberto, em cima das mesas de leitura — as páginas e a moldura na cor da RARIDADE, o
 * título numa plaquinha de luz em cima, girando devagar. O item evolui com o estudo (na próxima vez que ela entra, o
 * livro já vem na raridade nova). Até 8 livros (2 por mesa). Tudo no referencial da ILHA.
 */
import * as THREE from "three";
import { ALTURA_LOUNGE, CIDADE, MOVEIS, daSala } from "@/lib/cyber/ceu";
import { COR_RARIDADE } from "@/lib/estudos/blueprint";
import type { ItemEstudo } from "@/lib/estudos/itens";

export type LivrosHandle = { group: THREE.Group; atualizar(t: number): void; dispose(): void };

function placa(texto: string, cor: string): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 512; c.height = 96; const g = c.getContext("2d")!;
  g.fillStyle = "rgba(5,20,40,.82)"; g.beginPath(); g.roundRect(4, 8, 504, 80, 16); g.fill(); g.strokeStyle = cor; g.lineWidth = 3; g.stroke();
  g.fillStyle = "#e8f6ff"; g.font = "600 34px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  const t = texto.length > 26 ? `${texto.slice(0, 25)}…` : texto; g.fillText(t, 256, 50);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

export function criarLivrosEstudos(itens: readonly ItemEstudo[], o: { low: boolean }): LivrosHandle {
  const group = new THREE.Group(); group.name = "livros-estudos";
  const s = CIDADE.salas.biblioteca, mesas = MOVEIS.biblioteca.filter((m) => m.tipo === "mesaLeitura");
  const livros: { g: THREE.Group; y0: number; fase: number }[] = [], descartar: { dispose(): void }[] = [];
  itens.slice(0, mesas.length * 2).forEach((it, i) => {
    const mesa = mesas[Math.floor(i / 2)]!, lado = i % 2 ? 0.9 : -0.9, p = daSala(s, mesa.x + lado, mesa.z), cor = COR_RARIDADE[it.raridade];
    const g = new THREE.Group(), y0 = ALTURA_LOUNGE + 2.3; g.position.set(p.x, y0, p.z); group.add(g);
    const pagina = new THREE.MeshBasicMaterial({ color: 0x0b2c4d, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const borda = new THREE.LineBasicMaterial({ color: cor });
    descartar.push(pagina, borda);
    for (const sx of [-1, 1]) {
      const geo = new THREE.BoxGeometry(0.42, 0.02, 0.56), m = new THREE.Mesh(geo, pagina), e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), borda);
      for (const x of [m, e]) { x.position.set(sx * 0.21, 0, 0); x.rotation.z = sx * -0.28; g.add(x); }
      descartar.push(geo, e.geometry);
    }
    if (!o.low) {   // o brilho da raridade embaixo do livro
      const halo = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.rotation.x = -Math.PI / 2; halo.position.y = -0.35; g.add(halo); descartar.push(halo.geometry, halo.material as THREE.Material);
    }
    const tex = placa(it.titulo, cor), sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(1.8, 0.34, 1); sprite.position.y = 0.55; g.add(sprite); descartar.push(tex, sprite.material);
    livros.push({ g, y0, fase: i * 1.3 });
  });
  return {
    group,
    atualizar(t) { for (const l of livros) { l.g.rotation.y = t * 0.4 + l.fase; l.g.position.y = l.y0 + Math.sin(t * 1.1 + l.fase) * 0.08; } },
    dispose() { for (const d of descartar) d.dispose(); group.removeFromParent(); },
  };
}
