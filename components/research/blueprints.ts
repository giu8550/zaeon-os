/**
 * Os BLUEPRINTS dos entregáveis — a fase GERAR da vitrine do hero (o roteiro: lib/research/roteiroVitrine). O dono:
 * "blueprints que representam foguete, motor, PCB, fontes, bateria, energia solar — coisas que possam ser entregáveis".
 * Cada um é um desenho TÉCNICO em traço de luz (LineSegments, em 3D: gira devagar), que se DESENHA traço a traço (o
 * drawRange cresce, com uma faísca na ponta da "caneta"), numa folha de blueprint com cantoneiras e a etiqueta. Ao
 * ALIMENTAR, ele encolhe e voa pro pé da árvore de habilidades. Roda no worker da avatar (sem DOM: o canvas da
 * etiqueta é um OffscreenCanvas — lib/cyber/canvas2d).
 */
import * as THREE from "three";
import { ctx2d, novoCanvas } from "@/lib/cyber/canvas2d";
import { ENTREGAVEIS, type FaseVitrine, type IdEntregavel } from "@/lib/research/roteiroVitrine";
import { caderno, DESENHOS } from "@/lib/landing/desenhosBlueprint";

const CIANO = new THREE.Color("#7fe8ff");
const sstep = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
/** a folha do blueprint: a moldura com as CANTONEIRAS e a grade fina (um quadro de frente, atrás do desenho) */
function folha(): number[] {
  const k = caderno(), L = 0.56, c = 0.08, z = -0.02;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { k.linha([sx * L, sy * L, z], [sx * (L - c), sy * L, z]); k.linha([sx * L, sy * L, z], [sx * L, sy * (L - c), z]); }
  return k.pts;
}
function grade(): number[] {
  const k = caderno(), L = 0.52, z = -0.03;
  for (let i = -4; i <= 4; i++) { const d = (i / 4) * L; k.linha([d, -L, z], [d, L, z]); k.linha([-L, d, z], [L, d, z]); }
  return k.pts;
}

/** a etiqueta: "BLUEPRINT · FOGUETE" + a linha de status, em mono */
function etiqueta(nome: string, n: number) {
  const c = novoCanvas(512, 96), g = ctx2d(c);
  g.clearRect(0, 0, 512, 96);
  g.fillStyle = "rgba(127,232,255,0.95)"; g.font = "bold 30px monospace"; g.fillText(`BLUEPRINT · ${nome.toUpperCase()}`, 8, 40);
  g.fillStyle = "rgba(127,232,255,0.55)"; g.font = "22px monospace"; g.fillText(`ENTREGÁVEL ${String(n).padStart(2, "0")} · GERADO PELA ZAEON`, 8, 80);
  const t = new THREE.CanvasTexture(c as HTMLCanvasElement); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export type Blueprints = {
  /** a cada quadro: a fase do roteiro e o progresso nela; `peito` = onde o desenho aparece (mundo); `arvore` = pra onde
   *  ele voa ao alimentar */
  atualizar: (o: { agora: number; dt: number; fase: FaseVitrine; u: number; entregavel: IdEntregavel; peito: THREE.Vector3; arvore: THREE.Vector3; cam: THREE.Camera }) => void;
  /** o centro do desenho agora (pra onde ela olha gerando) — null = escondido */
  centro: () => THREE.Vector3 | null;
  dispose: () => void;
};

export function criarBlueprints(cena: THREE.Scene, estrela: THREE.Texture): Blueprints {
  const raiz = new THREE.Group(); raiz.visible = false; cena.add(raiz);
  const giro = new THREE.Group(); raiz.add(giro);
  const matTraco = new THREE.LineBasicMaterial({ color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const matFolha = new THREE.LineBasicMaterial({ color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const matGrade = new THREE.LineBasicMaterial({ color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const geoDe = (pts: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); return g; };
  const desenhos = new Map<IdEntregavel, { linhas: THREE.LineSegments; n: number; pos: Float32Array }>();
  for (const e of ENTREGAVEIS) {
    const pts = DESENHOS[e.id](), g = geoDe(pts), l = new THREE.LineSegments(g, matTraco);
    l.frustumCulled = false; l.visible = false; l.renderOrder = 7; giro.add(l);
    desenhos.set(e.id, { linhas: l, n: pts.length / 3, pos: g.attributes.position!.array as Float32Array });
  }
  const moldura = new THREE.LineSegments(geoDe(folha()), matFolha), malha = new THREE.LineSegments(geoDe(grade()), matGrade);
  moldura.renderOrder = 6; malha.renderOrder = 5; raiz.add(malha, moldura);
  // o fundo da folha: um azul fundo translúcido (o "papel" do blueprint)
  const papelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#0a3a5c"), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const papel = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 1.12), papelMat); papel.position.z = -0.04; papel.renderOrder = 4; raiz.add(papel);
  // a faísca da caneta e o brilho atrás
  const faisca = new THREE.Sprite(new THREE.SpriteMaterial({ map: estrela, color: new THREE.Color("#ffffff"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  faisca.scale.setScalar(0.09); faisca.renderOrder = 12; giro.add(faisca);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: estrela, color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(1.5); halo.renderOrder = 3; raiz.add(halo);
  // as etiquetas (uma por entregável, feitas uma vez)
  const etiquetas = new Map<IdEntregavel, THREE.CanvasTexture>(ENTREGAVEIS.map((e, i) => [e.id, etiqueta(e.nome, i + 1)]));
  const rotuloMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const rotulo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.17), rotuloMat); rotulo.position.set(0.04, -0.66, 0); rotulo.renderOrder = 8; raiz.add(rotulo);

  const ESCALA = 0.27;   // (m por unidade do desenho: a folha tem ~0,34 m)
  const LADO = 0.42;   // (m: quanto ele fica pro lado dela — longe o bastante pra manga não tampar)
  const centroAgora = new THREE.Vector3(), aux = new THREE.Vector3(), direita = new THREE.Vector3(), frente = new THREE.Vector3();
  let atual: IdEntregavel | null = null, visivelAgora = false;

  return {
    atualizar: ({ agora, fase, u, entregavel, peito, arvore, cam }) => {
      // GERAR: aparece e se desenha; ALIMENTAR: encolhe e voa pra árvore (no começo dela); o resto: escondido
      const gerando = fase === "gerar", alimentando = fase === "alimentar" && u < 0.4;
      visivelAgora = gerando || alimentando;
      raiz.visible = visivelAgora;
      if (!visivelAgora) return;
      if (entregavel !== atual) {
        for (const [id, d] of desenhos) d.linhas.visible = id === entregavel;
        rotuloMat.map = etiquetas.get(entregavel)!; rotuloMat.needsUpdate = true; atual = entregavel;
      }
      const d = desenhos.get(entregavel)!;
      // o traço: a caneta desenha nos primeiros 70% da fase (os segmentos em ordem), e o resto ele fica pronto
      const desenhado = gerando ? sstep(u / 0.7) : 1;
      const nSeg = d.n / 2, ate = Math.max(1, Math.floor(desenhado * nSeg));
      d.linhas.geometry.setDrawRange(0, ate * 2);
      const ponta = Math.min(d.n - 1, ate * 2 - 1);
      faisca.position.set(d.pos[ponta * 3]!, d.pos[ponta * 3 + 1]!, d.pos[ponta * 3 + 2]!);
      // entra/sai
      const entra = gerando ? sstep(u / 0.12) : 1;
      const voo = alimentando ? sstep(u / 0.4) : 0;
      const vis = entra * (1 - voo);
      matTraco.opacity = 0.95 * vis * (0.85 + 0.15 * Math.sin(agora * 9));
      matFolha.opacity = 0.7 * vis; matGrade.opacity = 0.1 * vis; papelMat.opacity = 0.1 * vis;
      rotuloMat.opacity = vis * sstep((gerando ? u : 1) / 0.25);
      (faisca.material as THREE.SpriteMaterial).opacity = gerando && desenhado < 0.999 ? 1 : 0;
      (halo.material as THREE.SpriteMaterial).opacity = 0.18 * vis;
      // onde: AO LADO dela (à esquerda de quem vê — o espaço entre o texto e o card), na altura do peito e um pouco à
      // frente, virado pra câmera; ao alimentar, voa (encolhendo) até a árvore
      cam.getWorldDirection(frente); direita.crossVectors(frente, cam.up).normalize();
      centroAgora.copy(peito).addScaledVector(direita, -LADO).add(aux.set(0, -0.03, 0.18));
      if (voo > 0) centroAgora.lerp(arvore, voo);
      raiz.position.copy(centroAgora);
      raiz.quaternion.copy(cam.quaternion);
      raiz.scale.setScalar(ESCALA * (0.85 + 0.15 * entra) * (1 - 0.9 * voo));
      // o desenho gira devagar (é 3D), com um balanço
      giro.rotation.set(0.18 + Math.sin(agora * 0.6) * 0.06, Math.sin(agora * 0.45) * 0.55 + (entregavel === "pcb" || entregavel === "solar" ? 0 : agora * 0.25), 0);
    },
    centro: () => (visivelAgora ? centroAgora : null),
    dispose: () => {
      cena.remove(raiz);
      for (const d of desenhos.values()) d.linhas.geometry.dispose();
      moldura.geometry.dispose(); malha.geometry.dispose(); papel.geometry.dispose(); rotulo.geometry.dispose();
      matTraco.dispose(); matFolha.dispose(); matGrade.dispose(); papelMat.dispose(); rotuloMat.dispose();
      (faisca.material as THREE.Material).dispose(); (halo.material as THREE.Material).dispose();
      for (const t of etiquetas.values()) t.dispose();
    },
  };
}
