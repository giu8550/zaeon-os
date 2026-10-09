/**
 * MATRIZES SÓ QUANDO PRECISA. O three recalcula, a cada quadro, a matriz de TODO objeto da cena (~9 mil nós na Zaeon
 * cheia, ~5 ms por quadro — um terço do orçamento de 73 fps). Dois cortes, sem mudar nada que se vê:
 *  - grupo do topo da cena INVISÍVEL não recalcula nada (os corpos do pool da frota guardados, personagens longe…);
 *  - AVATAR (esqueleto de ~50 a ~180 ossos) só recalcula no quadro em que ANIMOU ou SE MOVEU — de longe a animação roda
 *    a cada 2 quadros / 20 vezes por segundo, e quem está sentado nem sai do lugar.
 * Quem lê posição no mundo fora do quadro (IK, rótulos) usa `getWorldPosition`, que atualiza o próprio caminho sozinho.
 */
import type * as THREE from "three";

const foto = new WeakMap<THREE.Object3D, Float32Array>();

/** `raiz` (filho direto da cena) recalcula as matrizes neste quadro só se estiver visível E tiver animado ou se movido */
export function matrizDoAvatar(raiz: THREE.Object3D, animou: boolean): void {
  raiz.userData.matrizManual = true;
  if (!raiz.visible) { raiz.matrixWorldAutoUpdate = false; return; }
  let f = foto.get(raiz); if (!f) { f = new Float32Array(10).fill(NaN); foto.set(raiz, f); }
  const p = raiz.position, q = raiz.quaternion, s = raiz.scale;
  const mudou = f[0] !== p.x || f[1] !== p.y || f[2] !== p.z || f[3] !== q.x || f[4] !== q.y || f[5] !== q.z || f[6] !== q.w || f[7] !== s.x || f[8] !== s.y || f[9] !== s.z;
  if (mudou) { f[0] = p.x; f[1] = p.y; f[2] = p.z; f[3] = q.x; f[4] = q.y; f[5] = q.z; f[6] = q.w; f[7] = s.x; f[8] = s.y; f[9] = s.z; }
  raiz.matrixWorldAutoUpdate = animou || mudou;
}

/** antes de desenhar: os filhos da cena invisíveis não recalculam (os avatares marcados ficam com a regra deles) */
export function matrizesDaCena(cena: THREE.Object3D): void {
  for (const c of cena.children) { if (!c.visible) c.matrixWorldAutoUpdate = false; else if (!c.userData.matrizManual) c.matrixWorldAutoUpdate = true; }
}

/** OSSOS SEM NADA PRA DESENHAR saem da montagem da lista de desenho. O three percorre todo objeto VISÍVEL a cada quadro
 *  (`projectObject`), e osso é objeto: ~400 por VRM, ~50 por avatar — na Zaeon cheia, metade dos ~9.500 nós visíveis.
 *  Esconder o osso não muda o skinning (que usa só a matriz) nem a matriz (que o three recalcula invisível ou não).
 *  Osso que carrega alguma coisa desenhável no galho (acessório, fone, tablet — mesmo escondido agora) fica visível.
 *  Chame depois de montar o avatar e de vestir/trocar o VRM. Devolve quantos escondeu. */
export function esconderOssosVazios(raiz: THREE.Object3D): number {
  let n = 0;
  const temDesenho = (o: THREE.Object3D): boolean => {
    let tem = false;
    for (const c of o.children) if (temDesenho(c)) tem = true;   // (sem atalho: todo galho é visitado e marcado)
    const desenha = (o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite;
    if ((o as THREE.Bone).isBone && !tem && !desenha) { if (o.visible) n++; o.visible = false; }
    return tem || desenha;
  };
  temDesenho(raiz);
  return n;
}

/** quem PENDURA algo desenhável num osso (acessório) reabre o caminho até a raiz (os ossos vazios podem estar escondidos) */
export function mostrarCaminho(o: THREE.Object3D): void {
  for (let k: THREE.Object3D | null = o.parent; k; k = k.parent) if ((k as THREE.Bone).isBone) k.visible = true;
}
