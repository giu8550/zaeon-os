import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { criarPoolGemeos } from "./poolGemeos";

/** uma "base" de teste: um casco (Standard com emissivo na cor do dono), um brilho aditivo, uma linha e 3 cristais instanciados */
function gemeo(cor: number, x: number) {
  const g = new THREE.Group(); g.position.set(x, 0, 0);
  const casco = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: cor, emissiveIntensity: 0.5 }));
  const brilho = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
  brilho.position.y = 2;
  const linha = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)]), new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: 0.8 }));
  const cristais = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffffff }), 3);
  for (let i = 0; i < 3; i++) cristais.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i, 1, 0));
  const monitor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  g.add(casco, brilho, linha, cristais, monitor); g.updateMatrixWorld(true);
  return { g, casco, brilho, linha, cristais, monitor };
}
const inst = (pool: ReturnType<typeof criarPoolGemeos>, i: number) => pool.grupo.children[i] as THREE.InstancedMesh;

describe("pool de gêmeos (as bases desenhadas juntas)", () => {
  it("cada peça vira UMA malha pra todas; as originais param de desenhar (mas continuam existindo); o que fica de fora segue", () => {
    const pool = criarPoolGemeos({ max: 8, nome: "teste" });
    const a = gemeo(0xff0000, 0), b = gemeo(0x00ff00, 10);
    expect(pool.registrar(a.g, [a.monitor])).toBe(true);
    expect(pool.registrar(b.g, [b.monitor])).toBe(true);
    pool.atualizar();
    expect(pool.grupo.children).toHaveLength(4);   // casco, brilho, linha, cristais (o monitor fica com a base)
    expect(a.casco.layers.mask).toBe(0); expect(a.monitor.layers.mask).toBe(1);
    expect(inst(pool, 0).count).toBe(2);           // 1 casco por base
    expect(inst(pool, 3).count).toBe(6);           // 3 cristais × 2 bases
    // a matriz da instância é a do objeto da base (no mundo)
    const m = new THREE.Matrix4(); inst(pool, 0).getMatrixAt(1, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).x).toBeCloseTo(10);
    inst(pool, 3).getMatrixAt(5, m); expect(new THREE.Vector3().setFromMatrixPosition(m).x).toBeCloseTo(12);   // base em 10 + cristal em 2
  });
  it("a cor de cada instância é a do material dela AGORA: emissivo × intensidade, aditivo × opacidade; linha com alfa", () => {
    const pool = criarPoolGemeos({ max: 8, nome: "teste" });
    const a = gemeo(0xff0000, 0), b = gemeo(0x0000ff, 10);
    pool.registrar(a.g); pool.registrar(b.g); pool.atualizar();
    const c = new THREE.Color();
    inst(pool, 0).getColorAt(1, c); expect([c.r, c.g, c.b]).toEqual([0, 0, 0.5]);   // emissivo azul × 0,5
    inst(pool, 1).getColorAt(0, c); expect(c.r).toBeCloseTo(0.5);                   // vermelho × opacidade 0,5
    (a.brilho.material as THREE.MeshBasicMaterial).opacity = 1; pool.atualizar();   // a base animou: o pool acompanha
    inst(pool, 1).getColorAt(0, c); expect(c.r).toBeCloseTo(1);
    const cor = (pool.grupo.children[2] as THREE.LineSegments).geometry.attributes.color!;
    expect(cor.getW(0)).toBeCloseTo(0.8);
  });
  it("peça escondida (ou base escondida) some do pool; remover devolve o desenho pra base", () => {
    const pool = criarPoolGemeos({ max: 8, nome: "teste" });
    const a = gemeo(0xff0000, 0), b = gemeo(0x00ff00, 10);
    pool.registrar(a.g); pool.registrar(b.g);
    a.brilho.visible = false; b.g.visible = false; pool.atualizar();
    const m = new THREE.Matrix4(); inst(pool, 1).getMatrixAt(0, m); expect(m.determinant()).toBe(0);
    inst(pool, 0).getMatrixAt(1, m); expect(m.determinant()).toBe(0);
    expect((pool.grupo.children[2] as THREE.LineSegments).geometry.attributes.color!.getW(2)).toBe(0);
    pool.remover(b.g); expect(b.casco.layers.mask).toBe(1);
    pool.atualizar(); expect(inst(pool, 0).count).toBe(1);
  });
  it("estrutura que não bate com o molde não entra (segue desenhando sozinha)", () => {
    const pool = criarPoolGemeos({ max: 8, nome: "teste" });
    const a = gemeo(0xff0000, 0), b = gemeo(0x00ff00, 10); b.g.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    expect(pool.registrar(a.g)).toBe(true);
    expect(pool.registrar(b.g)).toBe(false);
    expect(b.casco.layers.mask).toBe(1);
  });
});
