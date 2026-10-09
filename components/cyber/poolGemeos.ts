/**
 * POOL DE GÊMEOS — várias estruturas IDÊNTICAS (montadas pelo mesmo construtor: as bases de estudo, uma por jogador)
 * desenhadas JUNTAS: cada peça vira UMA malha instanciada pra todas (o padrão das estações dos agentes e dos `pool.js`
 * do spiderbench). Com 12 jogadores na praça, as bases eram ~320 draw calls; aqui ~25 pras bases todas.
 *
 * Como: depois do lote estático (components/cyber/lotes), toda base tem os MESMOS objetos desenháveis na MESMA ordem.
 * A 1ª registrada vira o MOLDE; pra cada posição k da lista:
 *  - Mesh → InstancedMesh com a geometria do molde; a matriz de cada instância é a matrixWorld do objeto k daquela base
 *    (que continua existindo, animando e com clique — só não desenha: `layers.mask = 0`); a COR da instância é a cor do
 *    material dele agora (no aditivo, cor × opacidade = o brilho; no Standard, o emissivo × intensidade, via remendo);
 *  - InstancedMesh (aninhada: linhas, medidores, cristais) → uma só com as instâncias de todas (matriz da base × a local);
 *  - LineSegments / Points → uma geometria só com as de todas (no mundo), cor RGBA por vértice (a opacidade varia por base).
 * Objeto invisível (na base ou num pai: o fluxo de energia, o detalhe que a região escondeu) some do pool no quadro.
 * Estrutura que não bate com o molde (outra contagem de peças) fica desenhando sozinha, como antes.
 */
import * as THREE from "three";

type Tipo = "mesh" | "inst" | "linha" | "pontos";
type Peca = THREE.Mesh | THREE.InstancedMesh | THREE.LineSegments | THREE.Points;
type Slot = { tipo: Tipo; assinatura: string; desenho: THREE.Object3D; padrao: number; cor: "aditivo" | "emissivo" | "cor" | "instancia"; /** o material é do pool (não o do molde) */ proprio: boolean };
type Cache = { m: Float64Array; r: number; g: number; b: number; vis: boolean | null; vM: number; vC: number; vP: number; a?: number };
type Membro = { raiz: THREE.Object3D; pecas: Peca[]; cache: Cache[] };

const tipoDe = (o: THREE.Object3D): Tipo | null => (o as THREE.InstancedMesh).isInstancedMesh ? "inst" : (o as THREE.Mesh).isMesh ? "mesh" : (o as THREE.LineSegments).isLineSegments ? "linha" : (o as THREE.Points).isPoints ? "pontos" : null;
const matDe = (o: Peca) => o.material as THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number; opacity: number };

export type PoolGemeos = {
  grupo: THREE.Group;
  /** passa a desenhar `raiz` pelo pool (`fora`: objetos que continuam se desenhando — o monitor clicável); false = não bateu com o molde */
  registrar(raiz: THREE.Object3D, fora?: Iterable<THREE.Object3D>): boolean;
  remover(raiz: THREE.Object3D): void;
  /** a cada quadro, DEPOIS das bases animarem e ANTES de desenhar (as matrizes do mundo já atualizadas) */
  atualizar(): void;
  dispose(): void;
};

export function criarPoolGemeos(o: { max: number; nome: string }): PoolGemeos {
  const grupo = new THREE.Group(); grupo.name = o.nome;
  let slots: Slot[] | null = null, versaoMembros = -1; const membros: Membro[] = [];
  const v = new THREE.Vector3(), mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), cor = new THREE.Color(), zero = new THREE.Matrix4().makeScale(0, 0, 0);

  const pecasDe = (raiz: THREE.Object3D, fora: Set<THREE.Object3D>) => { const l: Peca[] = []; raiz.traverse((n) => { if (!fora.has(n) && tipoDe(n)) l.push(n as Peca); }); return l; };
  const assinatura = (p: Peca) => `${tipoDe(p)}|${p.material && (p.material as THREE.Material).type}|${p.geometry.attributes.position?.count ?? 0}|${(p as THREE.InstancedMesh).isInstancedMesh ? (p as THREE.InstancedMesh).count : ""}`;

  /** o material do pool a partir do do molde: a cor (ou o emissivo) passa a vir da instância / do vértice */
  function materialDoPool(p: Peca, tipo: Tipo): { m: THREE.Material; cor: Slot["cor"] } {
    const m0 = matDe(p), aditivo = m0.blending === THREE.AdditiveBlending;
    if (tipo === "linha" || tipo === "pontos") {
      const m = m0.clone() as THREE.LineBasicMaterial; m.vertexColors = true; m.color.set(0xffffff); m.opacity = 1; m.transparent = true;
      return { m, cor: "cor" };
    }
    if ((m0 as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      if (tipo === "inst" && (p as THREE.InstancedMesh).instanceColor) return { m: m0, cor: "instancia" };   // (os cristais: o remendo deles já usa a cor da instância)
      const m = m0.clone() as THREE.MeshStandardMaterial; const base = m0.onBeforeCompile;   // (o clone() não copia o remendo da instância)
      m.onBeforeCompile = (sh, r) => { base.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance = vColor;\n diffuseColor.rgb = diffuse;\n#endif"); };
      m.customProgramCacheKey = () => `${o.nome}-emissivo-${m0.uuid.slice(0, 8)}`;
      return { m, cor: "emissivo" };
    }
    const m = m0.clone() as THREE.MeshBasicMaterial; m.color.set(0xffffff); if (aditivo) m.opacity = 1;
    return { m, cor: aditivo ? "aditivo" : "cor" };
  }

  function montarMolde(pecas: Peca[]) {
    slots = pecas.map((p) => {
      const tipo = tipoDe(p)!, { m, cor: c } = materialDoPool(p, tipo);
      let desenho: THREE.Object3D;
      // a geometria é CLONADA: a base-molde pode sair (o jogador vai embora) e levar a dela junto
      if (tipo === "mesh") desenho = new THREE.InstancedMesh(p.geometry.clone(), m, o.max);
      else if (tipo === "inst") desenho = new THREE.InstancedMesh(p.geometry.clone(), m, o.max * (p as THREE.InstancedMesh).count);
      else {
        const n = p.geometry.attributes.position!.count, g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * o.max * 3), 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * o.max * 4), 4).setUsage(THREE.DynamicDrawUsage));
        desenho = tipo === "linha" ? new THREE.LineSegments(g, m) : new THREE.Points(g, m);
      }
      desenho.frustumCulled = false; desenho.renderOrder = p.renderOrder; desenho.matrixAutoUpdate = false;
      if ((desenho as THREE.InstancedMesh).isInstancedMesh) { const im = desenho as THREE.InstancedMesh; im.count = 0; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.setColorAt(0, cor.set(1, 1, 1)); }
      grupo.add(desenho);
      return { tipo, assinatura: assinatura(p), desenho, padrao: (p.material as THREE.Material).opacity, cor: c, proprio: m !== p.material } as Slot;
    });
  }

  /** o objeto e todos os pais até a raiz estão visíveis? */
  const visivel = (p: THREE.Object3D, raiz: THREE.Object3D) => { for (let k: THREE.Object3D | null = p; k; k = k.parent) { if (!k.visible) return false; if (k === raiz) return true; } return true; };

  return {
    grupo,
    registrar(raiz, fora = []) {
      if (membros.length >= o.max || membros.some((m) => m.raiz === raiz)) return false;
      const pecas = pecasDe(raiz, new Set(fora));
      if (!slots) montarMolde(pecas);
      if (pecas.length !== slots!.length || pecas.some((p, k) => assinatura(p) !== slots![k]!.assinatura)) return false;
      for (const p of pecas) p.layers.mask = 0;   // continua existindo (matriz, animação), não desenha
      membros.push({ raiz, pecas, cache: [] }); versaoMembros = -1;
      return true;
    },
    remover(raiz) {
      const i = membros.findIndex((m) => m.raiz === raiz); if (i < 0) return;
      for (const p of membros[i]!.pecas) p.layers.set(0);
      membros.splice(i, 1); versaoMembros = -1;
    },
    atualizar() {
      if (!slots) return;
      // só refaz o que MUDOU: a matriz do mundo, a cor/opacidade do material, a visibilidade e a versão dos atributos
      // (as bases ficam paradas; o que anima é pouco — e longe a região nem anima). Mudou quem está no pool → refaz tudo.
      if (versaoMembros !== membros.length) { versaoMembros = membros.length; for (const mb of membros) mb.cache = []; }
      const visRaiz = membros.map((mb) => { for (let k: THREE.Object3D | null = mb.raiz; k; k = k.parent) if (!k.visible) return false; return true; });
      slots.forEach((s, k) => {
        if (s.tipo === "mesh" || s.tipo === "inst") {
          const im = s.desenho as THREE.InstancedMesh, M = im.instanceMatrix.array as Float32Array, Cc = im.instanceColor!.array as Float32Array;
          let n = 0, sujo = false;
          membros.forEach((mb, j) => {
            const p = mb.pecas[k]!, vis = visRaiz[j]! && visivel(p, mb.raiz), mt = matDe(p), pi = p as THREE.InstancedMesh, qtd = s.tipo === "inst" ? pi.count : 1;
            const fator = s.cor === "aditivo" ? mt.opacity : 1;
            if (s.cor === "emissivo") cor.copy(mt.emissive!).multiplyScalar(mt.emissiveIntensity ?? 1); else if (mt.color) cor.copy(mt.color).multiplyScalar(fator); else cor.set(1, 1, 1);
            const c = (mb.cache[k] ??= { m: new Float64Array(16).fill(NaN), r: NaN, g: NaN, b: NaN, vis: null, vM: -1, vC: -1, vP: -1 });
            const e = p.matrixWorld.elements; let igual = c.vis === vis && c.r === cor.r && c.g === cor.g && c.b === cor.b;
            for (let q = 0; q < 16 && igual; q++) if (c.m[q] !== e[q]) igual = false;
            if (s.tipo === "inst" && igual) igual = c.vM === pi.instanceMatrix.version && c.vC === (pi.instanceColor?.version ?? -1);
            if (!igual) {
              sujo = true; c.vis = vis; c.r = cor.r; c.g = cor.g; c.b = cor.b; c.m.set(e as unknown as ArrayLike<number>);
              if (s.tipo === "mesh") { (vis ? p.matrixWorld : zero).toArray(M, n * 16); Cc[n * 3] = cor.r; Cc[n * 3 + 1] = cor.g; Cc[n * 3 + 2] = cor.b; }
              else {
                c.vM = pi.instanceMatrix.version; c.vC = pi.instanceColor?.version ?? -1;
                const cr = cor.r, cg = cor.g, cb = cor.b, IC = pi.instanceColor?.array as Float32Array | undefined;
                for (let i = 0; i < qtd; i++) {
                  if (vis) { mA.fromArray(pi.instanceMatrix.array as Float32Array, i * 16); mB.multiplyMatrices(p.matrixWorld, mA).toArray(M, (n + i) * 16); } else zero.toArray(M, (n + i) * 16);
                  const o3 = (n + i) * 3;
                  if (IC && s.cor === "instancia") { Cc[o3] = IC[i * 3]!; Cc[o3 + 1] = IC[i * 3 + 1]!; Cc[o3 + 2] = IC[i * 3 + 2]!; }
                  else if (IC) { Cc[o3] = IC[i * 3]! * cr; Cc[o3 + 1] = IC[i * 3 + 1]! * cg; Cc[o3 + 2] = IC[i * 3 + 2]! * cb; }
                  else { Cc[o3] = cr; Cc[o3 + 1] = cg; Cc[o3 + 2] = cb; }
                }
              }
            }
            n += qtd;
          });
          if (im.count !== n) { im.count = n; sujo = true; }
          if (sujo) { im.instanceMatrix.needsUpdate = true; im.instanceColor!.needsUpdate = true; }
          return;
        }
        // linhas e pontos: as de todas as bases numa geometria só (no mundo), cor RGBA por vértice
        const d = s.desenho as THREE.LineSegments, P = d.geometry.attributes.position as THREE.BufferAttribute, C = d.geometry.attributes.color as THREE.BufferAttribute;
        const PA = P.array as Float32Array, CA = C.array as Float32Array;
        let o2 = 0, sujoP = false, sujoC = false;
        membros.forEach((mb, j) => {
          const p = mb.pecas[k]!, src = p.geometry.attributes.position as THREE.BufferAttribute, mt = matDe(p), vis = visRaiz[j]! && visivel(p, mb.raiz);
          const c = (mb.cache[k] ??= { m: new Float64Array(16).fill(NaN), r: NaN, g: NaN, b: NaN, vis: null, vM: -1, vC: -1, vP: -1, a: NaN });
          const e = p.matrixWorld.elements, n = src.count;
          let mesmaM = true; for (let q = 0; q < 16 && mesmaM; q++) if (c.m[q] !== e[q]) mesmaM = false;
          // (escondida, nem as posições precisam: a cor vai com alfa 0)
          if (vis && (!mesmaM || c.vP !== src.version)) {
            c.m.set(e as unknown as ArrayLike<number>); c.vP = src.version; sujoP = true;
            const a = src.array as Float32Array, st = src.itemSize;
            for (let i = 0; i < n; i++) { const x = a[i * st]!, y = a[i * st + 1]!, z = a[i * st + 2]!; const w = 1 / (e[3]! * x + e[7]! * y + e[11]! * z + e[15]!);
              PA[(o2 + i) * 3] = (e[0]! * x + e[4]! * y + e[8]! * z + e[12]!) * w; PA[(o2 + i) * 3 + 1] = (e[1]! * x + e[5]! * y + e[9]! * z + e[13]!) * w; PA[(o2 + i) * 3 + 2] = (e[2]! * x + e[6]! * y + e[10]! * z + e[14]!) * w; }
          }
          const col = mt.color ?? cor.set(1, 1, 1), alfa = vis ? mt.opacity : 0;
          if (c.r !== col.r || c.g !== col.g || c.b !== col.b || c.a !== alfa) {
            c.r = col.r; c.g = col.g; c.b = col.b; c.a = alfa; sujoC = true;
            for (let i = 0; i < n; i++) { const q = (o2 + i) * 4; CA[q] = col.r; CA[q + 1] = col.g; CA[q + 2] = col.b; CA[q + 3] = alfa; }
          }
          o2 += n;
        });
        if (d.geometry.drawRange.count !== o2) d.geometry.setDrawRange(0, o2);
        if (sujoP) P.needsUpdate = true; if (sujoC) C.needsUpdate = true;
        if (s.tipo === "pontos" && membros[0]) (d.material as THREE.PointsMaterial).size = (matDe(membros[0].pecas[k]!) as unknown as THREE.PointsMaterial).size ?? 1;
      });
    },
    dispose() {
      for (const mb of [...membros]) for (const p of mb.pecas) p.layers.set(0);
      membros.length = 0;
      for (const s of slots ?? []) { const d = s.desenho as THREE.Mesh; d.geometry.dispose(); if (s.proprio) (d.material as THREE.Material).dispose(); if ((d as THREE.InstancedMesh).isInstancedMesh) (d as THREE.InstancedMesh).dispose(); }
      slots = null; grupo.clear(); grupo.removeFromParent();
    },
  };
}
