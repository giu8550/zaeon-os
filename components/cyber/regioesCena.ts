/**
 * Regiões da cena (lib/cyber/regioes): cada grande estrutura (Zaeon do céu, UNILAB, Solana House, marcos, bases,
 * motos) vira uma região. De longe some o DETALHE (peças pequenas: móveis, telas, botões, partículas), a animação
 * da região para, e bem longe some a região inteira. Igual ao corte por distância do CS Brasil (lotes de props).
 *
 * O detalhe é separado AUTOMATICAMENTE na montagem: toda peça desenhável cujo tamanho no mundo (raio da esfera da
 * geometria × escala; nos InstancedMesh, a maior instância) fica abaixo de `limiar` metros. Esconder/mostrar guarda
 * a visibilidade que a peça tinha (o laser que só acende com música, a nave por dentro…) e devolve igual — e como o
 * detalhe só some depois que a animação da região parou, ninguém fica brigando com o `visible`. Peça FORA da área da
 * região (o anel do elevador de luz lá no chão, o portal embaixo da Zaeon) nunca é detalhe: é de quem está lá.
 */
import * as THREE from "three";
import { distanciaDaRegiao, estadoDaRegiao, type EstadoRegiao, type Regiao } from "@/lib/cyber/regioes";

export type RegiaoCena = {
  nome: string;
  raiz: THREE.Object3D;
  /** a área da região AGORA (as que andam/boiam recalculam pela posição da raiz) */
  area(): Regiao;
  detalhe: THREE.Object3D[];
  estado: EstadoRegiao;
};

const guardado = new WeakMap<THREE.Object3D, boolean>();
const esconder = (o: THREE.Object3D) => { if (!guardado.has(o)) guardado.set(o, o.visible); o.visible = false; };
const mostrar = (o: THREE.Object3D) => { const v = guardado.get(o); if (v === undefined) return; guardado.delete(o); o.visible = v; };

const mI = new THREE.Matrix4(), vS = new THREE.Vector3(), vP = new THREE.Vector3(), qR = new THREE.Quaternion();
/** tamanho (raio, m) de uma peça desenhável no mundo; Infinity = não é peça (grupo) */
function tamanho(o: THREE.Object3D): number {
  const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
  if ((o as THREE.Sprite).isSprite) { o.getWorldScale(vS); return Math.max(vS.x, vS.y) / 2; }
  if (!g) return Infinity;
  if ((o as THREE.Points).isPoints) return 0;   // partículas: sempre detalhe
  if (!g.boundingSphere) g.computeBoundingSphere();
  const r = g.boundingSphere?.radius ?? 0;
  o.getWorldScale(vS); let s = Math.max(vS.x, vS.y, vS.z);
  const im = o as THREE.InstancedMesh;
  if (im.isInstancedMesh) {
    let k = 0;
    for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, mI); mI.decompose(vP, qR, vS); k = Math.max(k, vS.x, vS.y, vS.z); }
    s *= k;
  }
  return r * s;
}

/** as peças pequenas (detalhe) de uma raiz dentro da `area`: não desce dentro de uma peça já escolhida */
export function separarDetalhe(raiz: THREE.Object3D, limiar = 4, area?: Regiao): THREE.Object3D[] {
  raiz.updateMatrixWorld(true);
  const out: THREE.Object3D[] = [], w = new THREE.Vector3();
  const visitar = (o: THREE.Object3D) => {
    for (const f of o.children) {
      if (tamanho(f) < limiar) { if (!area || distanciaDaRegiao(f.getWorldPosition(w), area) < 1) out.push(f); continue; }
      visitar(f);
    }
  };
  visitar(raiz);
  return out;
}

/** a área (cilindro) de uma raiz pela caixa dela, relativa à posição da raiz — acompanha se ela boiar/andar */
export function areaPelaCaixa(raiz: THREE.Object3D, folga = 2): () => Regiao {
  raiz.updateMatrixWorld(true);
  const cx = new THREE.Box3().setFromObject(raiz), p0 = raiz.getWorldPosition(new THREE.Vector3());
  if (cx.isEmpty()) return () => ({ x: raiz.position.x, z: raiz.position.z, r: folga, y0: raiz.position.y - folga, y1: raiz.position.y + folga });
  const dx = (cx.min.x + cx.max.x) / 2 - p0.x, dz = (cx.min.z + cx.max.z) / 2 - p0.z, r = Math.hypot(cx.max.x - cx.min.x, cx.max.z - cx.min.z) / 2 + folga;
  const y0 = cx.min.y - p0.y - folga, y1 = cx.max.y - p0.y + folga, w = new THREE.Vector3();
  return () => { raiz.getWorldPosition(w); return { x: w.x + dx, z: w.z + dz, r, y0: w.y + y0, y1: w.y + y1 }; };
}

export function criarRegiao(nome: string, raiz: THREE.Object3D, o: { limiar?: number; area?: () => Regiao } = {}): RegiaoCena {
  const area = o.area ?? areaPelaCaixa(raiz);
  return { nome, raiz, area, detalhe: separarDetalhe(raiz, o.limiar, area()), estado: { visivel: true, detalhe: true, anima: true } };
}

/** recalcula o estado pela câmera e aplica (só mexe quando muda); devolve se a região deve ANIMAR neste quadro */
export function atualizarRegiao(r: RegiaoCena, cam: THREE.Vector3): boolean {
  const novo = estadoDaRegiao(cam, r.area(), r.estado), a = r.estado;
  if (novo.detalhe !== a.detalhe) for (const o of r.detalhe) (novo.detalhe ? mostrar : esconder)(o);
  if (novo.visivel !== a.visivel) (novo.visivel ? mostrar : esconder)(r.raiz);
  r.estado = novo;
  return novo.anima;
}

/** devolve tudo como era (ao desmontar a região) */
export function soltarRegiao(r: RegiaoCena) { for (const o of r.detalhe) mostrar(o); mostrar(r.raiz); }
