/**
 * LOTES ESTÁTICOS (o `StaticBatch` do CS Brasil): depois de montar uma estrutura, junta num mesh só (por material)
 * as peças que NUNCA se mexem — centenas de draw calls viram dezenas.
 *
 * Como sabe o que se mexe: tira uma foto (matriz local + visível) de cada nó, roda a `simular` da estrutura (a
 * animação dela em vários estados: com música, voando, hover…) e compara. Cada peça parada é juntada no seu
 * QUADRO = o ancestral mais próximo a partir do qual nada no caminho se mexe (a moto inclina? as peças paradas da
 * moto viram um lote DENTRO do corpo dela, que continua inclinando). Fica de fora:
 *  - o que se mexe/pisca/some (e tudo abaixo de um grupo que se mexe vira lote só dentro dele);
 *  - grupo escondido no começo (o interior da nave, ligado pelo engine) ou marcado `userData.lote = "limite"`: vira
 *    quadro (o lote fica dentro dele e acompanha a visibilidade);
 *  - `manter` (alvos de clique/câmera), InstancedMesh, SkinnedMesh, multi-material, morph, escala espelhada;
 *  - geometria com ATRIBUTOS PRÓPRIOS (além de posição/normal/uv/cor — ex.: as veias do coração): juntar perderia o atributo.
 * Em dev, cada peça que ficou de fora ganha `userData.foraDoLote` = o motivo (o perfil de draw calls agrupa por ele).
 *
 * CONGELAR (o `matrixAutoUpdate = false` do spiderbench): o three recalcula a matriz de TODO objeto da cena a cada
 * quadro, mesmo dos que nunca se mexem — com ~9 mil objetos, ~35% da CPU do quadro. No fim, todo nó que a simulação
 * viu PARADO (menos a raiz, que o engine move, e os `manter`) para de recalcular a matriz local; a do mundo continua
 * seguindo o pai (a ilha que boia). Medido: Zaeon com 12 jogadores 64 → 78 fps.
 * Antes de juntar, MATERIAIS iguais (mesmo tipo/cor/opacidade/textura/mistura…) viram um só — os builders criam um
 * por peça. Material que muda durante a simulação (opacidade pulsando, cor) fica com a peça dele, sozinho.
 * Peças pequenas (< 4 m) vão pra lotes separados marcados `userData.detalhe` (a região continua escondendo de longe),
 * em células de 24 m (o frustum culling continua valendo por pedaço).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const PEQUENO = 4;
/** o tamanho da CÉLULA (m): peças do mesmo material na mesma célula viram 1 lote. `?celula=N` na URL (dev) pra medir */
const CELULA = (() => { const q = typeof location !== "undefined" && process.env.NODE_ENV !== "production" ? Number(new URLSearchParams(location.search).get("celula")) : 0; return q > 0 ? q : 120; })();   // era 24: o "super-tile" do spiderbench — menos lotes, a região ainda esconde o detalhe de longe
const ATRIBUTOS_OK = new Set(["position", "normal", "uv", "color"]);
const DEV = process.env.NODE_ENV !== "production";

type Foto = { m: THREE.Matrix4; v: boolean };

/** junta as peças estáticas (malhas e linhas de aresta) de `raiz`; devolve quantas saíram e quantos lotes entraram */
export function fundirEstaticos(raiz: THREE.Object3D, o: { passo?: (k: number, t: number) => void; quadros?: number; manter?: Iterable<THREE.Object3D>; congelar?: boolean } = {}): { antes: number; lotes: number; congelados: number } {
  // `?semLotes` na URL desliga (comparar antes/depois, como o `?batch=0` do CS Brasil)
  if (typeof location !== "undefined" && new URLSearchParams(location.search).has("semLotes")) return { antes: 0, lotes: 0, congelados: 0 };
  const manter = new Set(o.manter ?? []);
  raiz.updateMatrixWorld(true);
  // 1) foto de todos os nós
  const fotos = new Map<THREE.Object3D, Foto>(), fotoMat = new Map<THREE.Material, string>();
  const matsDe = (n: THREE.Object3D) => { const m = (n as THREE.Mesh).material; return !m ? [] : Array.isArray(m) ? m : [m]; };
  raiz.traverse((n) => { n.updateMatrix(); fotos.set(n, { m: n.matrix.clone(), v: n.visible }); for (const m of matsDe(n)) fotoMat.set(m, assinatura(m)); });
  const mexe = new Set<THREE.Object3D>(), matMexe = new Set<THREE.Material>();
  const comparar = () => raiz.traverse((n) => {
    const f = fotos.get(n); if (!f) { mexe.add(n); return; }   // nó criado durante a simulação: não confia
    n.updateMatrix();
    if (n.visible !== f.v || !n.matrix.equals(f.m)) mexe.add(n);
    for (const m of matsDe(n)) if (fotoMat.get(m) !== assinatura(m)) matMexe.add(m);
  });
  if (o.passo) { const N = o.quadros ?? 60; for (let k = 0; k < N; k++) { o.passo(k, k * 0.37); if (k % 5 === 4) comparar(); } comparar(); }
  // 2..4) primeiro as LINHAS (contornos de aresta são filhos das peças: saindo elas, a peça fica sem filho), depois as malhas
  const ehLimite = (n: THREE.Object3D) => n === raiz || mexe.has(n) || !fotos.get(n)!.v || n.userData.lote === "limite";
  let antes = 0, lotes = 0;
  const usadas = new Set<THREE.BufferGeometry>();
  for (const linha of [true, false]) {
    type Cand = { obj: THREE.Mesh | THREE.LineSegments; quadro: THREE.Object3D; rel: THREE.Matrix4 };
    const cands: Cand[] = [];
    raiz.traverse((n) => {
      const m = n as THREE.Mesh & THREE.LineSegments;
      const f = n as unknown as { isInstancedMesh?: boolean; isSkinnedMesh?: boolean };
      if (linha ? !m.isLineSegments : !m.isMesh || f.isInstancedMesh || f.isSkinnedMesh) return;
      const fora = (motivo: string) => { if (DEV) m.userData.foraDoLote = motivo; };
      if (Array.isArray(m.material)) return fora("multi-material");
      if (manter.has(m)) return fora("manter");
      if (m.children.length) return fora("tem-filhos");
      if (mexe.has(m)) return fora("mexe");
      if (!m.visible) return fora("escondida");
      if (m.morphTargetInfluences) return fora("morph");
      if (m.userData.semLote) return fora("semLote");
      if (!m.geometry?.attributes.position || Object.keys(m.geometry.morphAttributes).length) return fora("geometria");
      if (Object.keys(m.geometry.attributes).some((a) => !ATRIBUTOS_OK.has(a))) return fora("atributo-proprio");   // (as veias do coração)
      // sobe até o quadro: tudo entre a peça e o quadro tem que estar parado e visível
      let q = m.parent!;
      while (!ehLimite(q)) q = q.parent!;
      const rel = new THREE.Matrix4();   // peça → quadro (produto das locais do caminho)
      for (let k: THREE.Object3D = m; k !== q; k = k.parent!) rel.premultiply(k.matrix);
      if (rel.determinant() <= 0) return fora("espelhada");   // espelhada: a face viraria do avesso
      cands.push({ obj: m, quadro: q, rel });
    });
    // materiais iguais (e que não mudam) viram um só
    const canon = new Map<string, THREE.Material>();
    for (const k of cands) {
      const m = k.obj.material as THREE.Material; if (matMexe.has(m) || (m as THREE.ShaderMaterial).isShaderMaterial) continue;
      const a = fotoMat.get(m) ?? assinatura(m), c0 = canon.get(a);
      if (!c0) canon.set(a, m); else k.obj.material = c0;
    }
    // agrupa por quadro + material + célula + pequeno/grande + ordem de desenho/culling
    const grupos = new Map<string, { quadro: THREE.Object3D; mat: THREE.Material; pequeno: boolean; l: Cand[] }>();
    const c = new THREE.Vector3(), esf = new THREE.Sphere();
    for (const k of cands) {
      const g = k.obj.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      esf.copy(g.boundingSphere!).applyMatrix4(k.rel); c.copy(esf.center);
      const pequeno = esf.radius < PEQUENO, mat = k.obj.material as THREE.Material;
      // células CENTRADAS na origem do quadro (meia célula de deslocamento): com a fronteira em 0, tudo que é simétrico
      // (esquerda/direita, frente/trás de uma moto) caía em células diferentes e nunca juntava
      const cel = (v: number) => Math.floor(v / CELULA + 0.5);
      const chave = `${k.quadro.id}|${mat.uuid}|${cel(c.x)},${cel(c.y)},${cel(c.z)}|${pequeno ? 1 : 0}|${k.obj.renderOrder}|${k.obj.frustumCulled ? 1 : 0}`;
      let gr = grupos.get(chave); if (!gr) { gr = { quadro: k.quadro, mat, pequeno, l: [] }; grupos.set(chave, gr); }
      gr.l.push(k);
    }
    // funde (só vale a pena com 2+ peças)
    for (const gr of grupos.values()) {
      if (gr.l.length < 2) { if (DEV) gr.l[0]!.obj.userData.foraDoLote = matMexe.has(gr.mat) ? "sozinha:material-muda" : "sozinha"; continue; }
      const cor = !!(gr.mat as THREE.MeshBasicMaterial).vertexColors;
      const geos = gr.l.map((k) => normalizar(k.obj.geometry, cor, linha).applyMatrix4(k.rel));
      const junta = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
      if (!junta) continue;
      const lote: THREE.Mesh | THREE.LineSegments = linha ? new THREE.LineSegments(junta, gr.mat) : new THREE.Mesh(junta, gr.mat);
      lote.name = "lote"; lote.renderOrder = gr.l[0]!.obj.renderOrder; lote.frustumCulled = gr.l[0]!.obj.frustumCulled;
      // o lote fica no CENTRO das peças (não na origem do quadro): o three ordena os transparentes pela posição do objeto
      junta.computeBoundingSphere(); const cen = junta.boundingSphere!.center.clone(); junta.translate(-cen.x, -cen.y, -cen.z); lote.position.copy(cen);
      lote.matrixAutoUpdate = false; lote.updateMatrix();   // parado dentro do quadro: nunca muda
      if (gr.pequeno) lote.userData.detalhe = true;
      gr.quadro.add(lote); lotes++;
      for (const k of gr.l) { usadas.add(k.obj.geometry); k.obj.removeFromParent(); antes++; }
    }
  }
  // geometrias que ninguém mais usa
  const vivas = new Set<THREE.BufferGeometry>(); raiz.traverse((n) => { const g = (n as THREE.Mesh).geometry; if (g) vivas.add(g); });
  for (const g of usadas) if (!vivas.has(g)) g.dispose();
  raiz.updateMatrixWorld(true);
  // CONGELA o que ficou parado (`?semCongelar` desliga, pra comparar)
  let congelados = 0;
  const semCongelar = o.congelar === false || (typeof location !== "undefined" && new URLSearchParams(location.search).has("semCongelar"));
  if (!semCongelar) raiz.traverse((n) => {
    if (n === raiz || !n.matrixAutoUpdate || mexe.has(n) || manter.has(n) || !fotos.has(n) || (n as THREE.Bone).isBone) return;
    n.updateMatrix(); n.matrixAutoUpdate = false; n.userData.congelado = true; congelados++;
  });
  return { antes, lotes, congelados };
}

/** cópia com o mesmo conjunto de atributos (posição, normal, uv [, cor]) e índice — o `mergeGeometries` exige */
function normalizar(g0: THREE.BufferGeometry, cor: boolean, linha = false): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry(), n = g0.attributes.position!.count;
  g.setAttribute("position", g0.attributes.position!.clone());
  if (linha) {   // linha: só posição (+ cor), e sem índice se a original não tinha
    if (cor) g.setAttribute("color", g0.attributes.color ? g0.attributes.color.clone() : new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    return g0.index ? g.setIndex(g0.index.clone()).toNonIndexed() : g;
  }
  if (g0.attributes.normal) g.setAttribute("normal", g0.attributes.normal.clone());
  g.setAttribute("uv", g0.attributes.uv ? g0.attributes.uv.clone() : new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (cor) g.setAttribute("color", g0.attributes.color ? g0.attributes.color.clone() : new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  // índice sempre 32 bits (lotes juntam milhares de vértices: 16 bits estoura)
  const i32 = new Uint32Array(g0.index ? g0.index.count : n);
  for (let i = 0; i < i32.length; i++) i32[i] = g0.index ? g0.index.getX(i) : i;
  g.setIndex(new THREE.BufferAttribute(i32, 1));
  if (!g0.attributes.normal) g.computeVertexNormals();
  return g;
}

/** o que define a aparência de um material (dois iguais desenham igual) */
function assinatura(m: THREE.Material): string {
  const x = m as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial & THREE.ShaderMaterial;
  if (x.isShaderMaterial) return `shader|${m.uuid}`;   // uniforms próprios: só o mesmo objeto
  // shader remendado (`onBeforeCompile` próprio — toon, tinta…): o remendo pode capturar valores diferentes; só o mesmo objeto
  if (m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return `remendo|${m.uuid}`;
  const cor = (c?: THREE.Color) => (c ? c.getHexString() : "-");
  return [m.type, cor(x.color), cor(x.emissive), x.emissiveIntensity ?? "-", x.roughness ?? "-", x.metalness ?? "-", m.opacity.toFixed(4), m.transparent, m.blending, m.side, m.depthWrite, m.depthTest,
    m.alphaTest, m.vertexColors, (x as { flatShading?: boolean }).flatShading ?? "-", x.map?.uuid ?? "-", x.alphaMap?.uuid ?? "-", x.emissiveMap?.uuid ?? "-", x.fog ?? "-", m.toneMapped, m.visible, m.colorWrite, m.polygonOffset].join("|");
}
