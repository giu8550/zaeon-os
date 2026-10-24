/**
 * A CENA da avatar do painel dos documentos — roda num WEB WORKER (components/research/avatar.worker) desenhando num
 * OffscreenCanvas: o 3D não divide a thread com o chat (o dono, out/2026: "a geração 3D não pode compartilhar essa
 * thread, isso vai matar nossa performance" — medido: ~5,6 ms por quadro na thread principal). Sem DOM aqui.
 *  - QUEM: o VRM da persona (Aura · Zenita · Nina) animado pelo personagem do open-annie (vendor/open-annie — Apache-2.0)
 *    com os 63 clipes CC0 do annie-blender; um PILOTO solta gestos leves de tempos em tempos (ela nunca fica parada);
 *  - o HOLOGRAMA (o tablet do lounge na versão de luz — components/cyber/TabletLounge) flutua à frente dela lendo (um
 *    documento em análise / um arquivo jogado nela);
 *  - GERANDO a resposta: as 3 SEQUÊNCIAS (components/research/avatarSequencias — o roteiro em lib/research/
 *    sequenciaAvatar): os olhos acendem pensando; ela flutua buscando na rede de hologramas com a aranha rastejando
 *    (a câmera abre); a árvore de habilidades ou o cérebro se forma — em laço até a resposta acabar;
 *  - TROCAR de persona: o corpo anterior sai na hora, com todo o estado; um carregamento atrasado é descartado.
 */
import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { Character } from "@/vendor/open-annie/core/character.js";
import { fetchPack } from "@/vendor/open-annie/core/motion.js";
import { tuneSprings } from "@/vendor/open-annie/core/cloth.js";
import { acabarVrm, carregarVrm, tingirVrm } from "@/components/cyber/AvatarVrm";
import { CORPOS_VRM } from "@/lib/cyber/estiloAvatar";
import { TABLET } from "@/lib/cyber/descanso";
import { COR_LUZ } from "@/lib/cyber/cores";
import { criarTabletLounge } from "@/components/cyber/TabletLounge";
import { glowTex } from "@/components/cyber/CenaCosmica";
import type { PersonaId } from "@/lib/research/zaeonEventos";
import type { DaCena } from "./avatarMensagens";
import { criarSequencias, type ResultadoSeq } from "./avatarSequencias";
import type { Sequencia } from "@/lib/research/sequenciaAvatar";

const PACOTE = "/zaeon/movimento/annie-blender/";
/** onde o HOLOGRAMA flutua (metros: x do centro do corpo; y e z a partir do peito, +z = pra frente) e quanto ela
 *  baixa a cabeça pra ele (graus) */
export const POSE = { holograma: [0, 0.02, 0.32] as const, cabecaLer: 14 };
/** o gesto e o rosto de quando cada sequência começa */
const NA_SEQUENCIA: Record<Sequencia, { clipe: string; rosto: string }> = {
  pensar: { clipe: "think", rosto: "thinking" },
  buscar: { clipe: "g_open_both", rosto: "curious" },
  arvore: { clipe: "g_offer_both", rosto: "happy" },
  cerebro: { clipe: "g_frame_both", rosto: "proud" },
};
/** os gestos de quando a clicam (clipes do pacote — todos existem nele) */
const AO_CLICAR = ["wave", "laugh", "clap", "think", "bow", "excited_bounce", "point_self", "shrug", "nod"] as const;
const ROSTO_DO_GESTO: Record<string, string> = { wave: "happy", laugh: "joyful", clap: "joyful", think: "thinking", bow: "tender", excited_bounce: "playful", point_self: "proud", shrug: "amused", nod: "happy", fidget_glance: "curious", g_minishrug: "amused", g_open_both: "happy", fidget_hair: "tender" };
/** o PILOTO: um gesto leve de vez em quando (além dos idles e fidgets do próprio personagem) */
const DE_VEZ_EM_QUANDO = ["fidget_glance", "think", "g_minishrug", "fidget_hair", "g_open_both", "wave", "nod"] as const;
/** quanto tempo ela lê um arquivo jogado nela (s) */
const LER_POR = 4.5;

type Modo = "ler";
export type CenaAvatar = {
  persona: (id: PersonaId) => void;
  sinais: (lendo: boolean, escrevendo: boolean) => void;
  reagir: () => void;
  gesto: () => void;
  tamanho: (largura: number, altura: number) => void;
  visivel: (v: boolean) => void;
  diag: () => DaCena;
  /** (dev) pula o roteiro da geração */
  saltar: (t: number) => void;
  destruir: () => void;
};

/** o laço de quadros: no worker, o requestAnimationFrame dele (Chrome/Firefox/Safari 16.4+); senão, um timer */
const pedirQuadro: (f: () => void) => number = typeof requestAnimationFrame === "function" ? (f) => requestAnimationFrame(f) : (f) => setTimeout(f, 16) as unknown as number;
const cancelarQuadro = (id: number) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : clearTimeout(id));

export function criarCenaAvatar(canvas: OffscreenCanvas | HTMLCanvasElement, o: { largura: number; altura: number; dpr: number; persona: PersonaId; aoEstado: (e: "carregando" | "pronto" | "erro") => void }): CenaAvatar | null {
  let R: THREE.WebGLRenderer;
  try { R = new THREE.WebGLRenderer({ canvas: canvas as HTMLCanvasElement, antialias: true, alpha: true, powerPreference: "low-power" }); }
  catch { o.aoEstado("erro"); return null; }
  let vivo = true, raf = 0, visivel = true, c: Character | null = null, vrm: VRM | null = null, larg = o.largura, alt = o.altura;
  R.setPixelRatio(Math.min(o.dpr || 1, 1.5)); R.outputColorSpace = THREE.SRGBColorSpace; R.setClearColor(0x000000, 0);
  const cena = new THREE.Scene(), cam = new THREE.PerspectiveCamera(22, 1, 0.1, 40);
  cena.add(new THREE.HemisphereLight(0xe6f2ff, 0x241c3a, 2.1));
  const sol = new THREE.DirectionalLight(0xffffff, 2.1); sol.position.set(-1.2, 2.6, 3.5); cena.add(sol);
  const contra = new THREE.DirectionalLight(0x7fe8ff, 1.4); contra.position.set(1.5, 2, -2.5); cena.add(contra);

  let alturaTopo = 1.76;   // o topo do quadro (acima da cabeça — cada corpo tem a sua altura)
  // o enquadramento: da CINTURA pra cima, sem cortar os ombros numa caixa estreita
  // a câmera ABRE (0..1) e ORBITA (rad) quando ela busca na rede — o plano aberto, cinematográfico, com as telas
  // em volta; `subir` = quanto ela levitou (o quadro sobe junto: ela flutua sem cortar a cabeça)
  let abrir = 0, orbita = 0, subir = 0, tamanhoMudou = true;
  const enquadrar = () => {
    const w = Math.max(1, larg), h = Math.max(1, alt);
    if (tamanhoMudou) { R.setSize(w, h, false); tamanhoMudou = false; }
    cam.aspect = w / h;
    const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), H = Math.max(0.92, 0.36 / cam.aspect) * (1 + 1.05 * abrir), d = H / 2 / tv;
    // fechada: o topo do quadro acima da cabeça (da cintura pra cima); aberta: ELA no centro, com as telas em volta
    const centro = THREE.MathUtils.lerp(alturaTopo + subir - H / 2, alturaTopo + subir - 0.5, abrir), baixo = 0.1 * abrir;   // (aberta, um tiquinho de baixo pra cima)
    cam.position.set(Math.sin(orbita) * d, centro + 0.04 - baixo, Math.cos(orbita) * d); cam.lookAt(0, centro, 0); cam.updateProjectionMatrix();
  };
  enquadrar();

  // o HOLOGRAMA: o tablet do lounge na versão de luz (as mesmas partículas, o estalo e o halo)
  const estrela = glowTex("rgba(255,255,255,1)", "rgba(190,215,255,0.5)");
  const tab = criarTabletLounge({ luz: COR_LUZ, estrela, holograma: true, corpo: new THREE.MeshBasicMaterial() });
  cena.add(tab.tablet, tab.particulas);
  const seqs = criarSequencias(cena, estrela);
  let gerandoDesde: number | null = null;
  const qx = new THREE.Quaternion(), eul = new THREE.Euler(), pPeito = new THREE.Vector3();
  // o último resultado das sequências (o corpo — dentro do update do personagem — usa o do quadro anterior)
  let seqUlt: ResultadoSeq | null = null;
  // IK de DOIS OSSOS (ombro→cotovelo→punho) nos ossos normalizados: leva o punho ao alvo, o cotovelo pro lado do polo
  const POLO = new THREE.Vector3(0.35, -0.6, -0.15);
  const S = new THREE.Vector3(), E = new THREE.Vector3(), W = new THREE.Vector3(), T = new THREE.Vector3(), pol = new THREE.Vector3(), eixo = new THREE.Vector3(), dirE = new THREE.Vector3(), td = new THREE.Vector3(), aux = new THREE.Vector3();
  const qa = new THREE.Quaternion(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion(), q0 = new THREE.Quaternion();
  const girarPara = (osso: THREE.Object3D, de: THREE.Vector3, para: THREE.Vector3, peso: number) => {
    qa.setFromUnitVectors(de, para);
    osso.getWorldQuaternion(qw); osso.parent!.getWorldQuaternion(qp);
    q0.copy(osso.quaternion);
    osso.quaternion.copy(qp.invert()).multiply(qa).multiply(qw);   // local = pai⁻¹ · Δ · mundo
    if (peso < 1) osso.quaternion.copy(q0.slerp(osso.quaternion, peso));
    osso.updateMatrixWorld(true);
  };
  const ik = (h: VRM["humanoid"], lado: "left" | "right", alvoW: THREE.Vector3, peso: number) => {
    const up = h.getNormalizedBoneNode(`${lado}UpperArm`), lo = h.getNormalizedBoneNode(`${lado}LowerArm`), mao = h.getNormalizedBoneNode(`${lado}Hand`);
    if (!up || !lo || !mao) return;
    up.getWorldPosition(S); lo.getWorldPosition(E); mao.getWorldPosition(W);
    const a = S.distanceTo(E), b = E.distanceTo(W);
    T.copy(alvoW).sub(S); const d = Math.min(Math.max(T.length(), 0.05), (a + b) * 0.995); T.setLength(d);
    const cosA = (a * a + d * d - b * b) / (2 * a * d), ang = Math.acos(Math.min(1, Math.max(-1, cosA)));
    pol.set(lado === "left" ? POLO.x : -POLO.x, POLO.y, POLO.z);
    td.copy(T).normalize(); eixo.crossVectors(td, pol).normalize();
    if (eixo.lengthSq() < 1e-6) eixo.set(0, 0, 1);
    dirE.copy(td).applyAxisAngle(eixo, ang);
    girarPara(up, aux.copy(E).sub(S).normalize(), dirE, peso);
    lo.getWorldPosition(E); mao.getWorldPosition(W);
    girarPara(lo, aux.copy(W).sub(E).normalize(), T.add(S).sub(E).normalize(), peso);
  };
  /** a pose de LEVITAÇÃO (graus, por cima do clipe): as pernas recolhidas, assimétricas, as pontas dos pés esticadas */
  const LEVITA: [string, number, number, number][] = [
    ["leftUpperLeg", -48, 0, 8], ["leftLowerLeg", 118, 0, 0], ["leftFoot", 48, 0, 0],
    ["rightUpperLeg", -14, 0, -5], ["rightLowerLeg", 92, 0, 0], ["rightFoot", 52, 0, 0],
    ["spine", 5, 0, 0], ["hips", -6, 0, 0],
  ];
  const D2R = Math.PI / 180;

  // o que o chat diz que ela está fazendo
  const sinais = { lendo: false, escrevendo: false };
  // ── o ESTADO de quem está no painel: TUDO que pode ficar "preso" mora aqui e é zerado na troca ──
  const st = { peso: { ler: 0 } as Record<Modo, number>, wTab: 0, lerAte: 0, proxGesto: 0, rostoEm: 0 };
  const zerar = () => { st.peso.ler = 0; st.wTab = 0; st.lerAte = 0; st.proxGesto = performance.now() / 1000 + 6 + Math.random() * 6; st.rostoEm = 0; tab.animar(0, 0); seqs.zerar(); seqUlt = null; if (abrir || orbita || subir) { abrir = 0; orbita = 0; subir = 0; enquadrar(); } };
  let acoes: { gesto: () => void; reagir: () => void } | null = null;

  const pacote = fetchPack(new URL(PACOTE, self.location.origin).href);
  const descartar = (v: VRM) => v.scene.traverse((ob) => { const m = ob as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); for (const mt of Array.isArray(m.material) ? m.material : [m.material]) mt?.dispose(); } });
  const soltarCorpo = () => {
    if (c) c.overlay = undefined;
    if (vrm) { cena.remove(vrm.scene); descartar(vrm); }
    vrm = null; c = null; acoes = null; zerar();
  };
  let pedido = 0, carregado: PersonaId | null = null;
  const carregar = async (id: PersonaId) => {
    if (id === carregado) return;
    const meu = ++pedido; carregado = id;
    soltarCorpo(); o.aoEstado("carregando");                // a anterior sai NA HORA (com o que estava fazendo)
    const corpo = CORPOS_VRM[id] ?? CORPOS_VRM.aura!;
    const [v, pack] = await Promise.all([carregarVrm(corpo.url), pacote]);
    if (!vivo || meu !== pedido) { descartar(v); return; }  // trocaram de novo no meio: este corpo não entra
    tingirVrm(v, corpo.tintas ?? {}); acabarVrm(v, corpo);
    vrm = v; cena.add(v.scene); tuneSprings(v);
    const cabeca = v.humanoid.getRawBoneNode("head"); if (cabeca) { v.scene.updateMatrixWorld(true); alturaTopo = cabeca.getWorldPosition(new THREE.Vector3()).y + 0.24; enquadrar(); }
    const ch = new Character(v, cam, 7, { pack, talk: pack }); c = ch;
    ch.overlay = (_, now, dt) => {
      // GERANDO: levitando (as pernas recolhidas), digitando no teclado holográfico e olhando as telas
      const r = seqUlt, hu = v.humanoid;
      if (r && r.levitar > 0.01) for (const [b, x, y, z] of LEVITA) hu.getNormalizedBoneNode(b as never)?.quaternion.multiply(qx.setFromEuler(eul.set(x * D2R * r.levitar, y * D2R * r.levitar, z * D2R * r.levitar)));
      if (r && r.digitar > 0.01) {
        v.scene.updateMatrixWorld(true);
        ik(hu, "left", r.maos.esq, r.digitar * 0.92); ik(hu, "right", r.maos.dir, r.digitar * 0.92);
        const cab = hu.getNormalizedBoneNode("head"), pes = hu.getNormalizedBoneNode("neck");
        // a cabeça VARRE as telas (guinada), um pouco erguida — ela olha as telas, não o teclado
        pes?.quaternion.multiply(qx.setFromEuler(eul.set(-4 * D2R * r.digitar, r.olhar * 0.4 * r.digitar, 0)));
        cab?.quaternion.multiply(qx.setFromEuler(eul.set(-6 * D2R * r.digitar, r.olhar * 0.6 * r.digitar, 0)));
      }
      const k = 1 - Math.exp(-dt * 6);
      const quer: Modo | null = !sinais.escrevendo && (sinais.lendo || now < st.lerAte) ? "ler" : null;
      st.peso.ler += ((quer ? 1 : 0) - st.peso.ler) * k;
      if (st.peso.ler < 0.01) return;
      // a CABEÇA baixa pro holograma (lendo, os olhos varrem as linhas)
      const cab = v.humanoid.getNormalizedBoneNode("head");
      if (cab) {
        const baixa = POSE.cabecaLer * st.peso.ler, varre = Math.sin(now * 1.7) * 7 * st.peso.ler;
        cab.quaternion.multiply(qx.setFromEuler(eul.set(baixa * D2R, varre * D2R, 0)));
      }
    };
    const gesto = (g: string) => { if (g === "nod") ch.gesture("nod"); else ch.playClip(g); ch.setFace(ROSTO_DO_GESTO[g] ?? "happy", 0.85); };
    acoes = {
      gesto: () => gesto(AO_CLICAR[Math.floor(Math.random() * AO_CLICAR.length)]!),
      // jogaram um arquivo nela: ou LÊ (o holograma por uns segundos) ou PENSA
      reagir: () => { if (Math.random() < 0.55) { st.lerAte = performance.now() / 1000 + LER_POR; ch.setFace("curious", 0.8); } else gesto("think"); },
    };
    zerar();
    o.aoEstado("pronto"); tocar();
  };
  const trocar = (id: PersonaId) => { void carregar(id).catch((e) => { console.warn("[avatar] não carregou:", e); carregado = null; if (vivo) o.aoEstado("erro"); }); };

  // o laço (com a medida do custo por quadro — o diag)
  const relogio = new THREE.Clock();
  let medQuadros = 0, medMs = 0, medDesde = performance.now();
  const passo = () => {
    raf = 0; if (!vivo || !visivel) return;
    const t0 = performance.now();
    const dt = Math.min(0.05, relogio.getDelta()), agora = t0 / 1000;
    if (c && vrm) {
      const lendoAgora = !sinais.escrevendo && (sinais.lendo || agora < st.lerAte), ocupada = sinais.escrevendo || lendoAgora;
      // o PILOTO: sem nada pra fazer, de tempos em tempos um gesto leve (ela nunca fica parada)
      if (agora > st.proxGesto) {
        if (!ocupada && c.current?.idle !== false) { const g = DE_VEZ_EM_QUANDO[Math.floor(Math.random() * DE_VEZ_EM_QUANDO.length)]!; if (g === "nod") c.gesture("nod"); else c.playClip(g); c.setFace(ROSTO_DO_GESTO[g] ?? "happy", 0.6); }
        st.proxGesto = agora + 14 + Math.random() * 12;
      }
      c.update(agora, dt);
      // GERANDO: as 3 sequências (o gesto e o rosto de cada uma no começo dela; ela flutua; a câmera abre)
      const r = seqs.atualizar({ agora, dt, gerandoHa: gerandoDesde === null ? null : agora - gerandoDesde, vrm, cam }); seqUlt = r;
      if (r.nova && r.seq) { const n = NA_SEQUENCIA[r.seq]; c.playClip(n.clipe); c.setFace(n.rosto, 0.85); st.rostoEm = agora + 2.5; }
      // ela SOBE (levitando, balançando no ar) e a câmera acompanha
      vrm.scene.position.y = r.levitar * (0.24 + Math.sin(agora * 1.3) * 0.022);
      vrm.scene.rotation.z = r.levitar * Math.sin(agora * 0.9) * 0.025;
      const subirAgora = r.levitar * 0.2;
      if (Math.abs(r.abrir - abrir) > 0.001 || Math.abs(r.orbita - orbita) > 0.001 || Math.abs(subirAgora - subir) > 0.001) { abrir = r.abrir; orbita = r.orbita; subir = subirAgora; enquadrar(); }
      // o ROSTO do modo (de vez em quando: o envelope das expressões cuida da transição)
      if (agora > st.rostoEm && ocupada) { c.setFace(r.seq ? NA_SEQUENCIA[r.seq].rosto : "curious", 0.7); st.rostoEm = agora + 3; }
      // o HOLOGRAMA de LEITURA: materializa como o tablet do lounge, à frente do peito, virado pra quem vê
      st.wTab = Math.max(0, Math.min(1, st.wTab + (lendoAgora ? dt / TABLET.materializa : -dt / TABLET.some)));
      const peito = vrm.humanoid.getRawBoneNode("upperChest") ?? vrm.humanoid.getRawBoneNode("chest");
      if (st.wTab > 0.01 && peito) {
        peito.getWorldPosition(pPeito);
        tab.tablet.position.set(POSE.holograma[0], POSE.holograma[1] + Math.sin(agora * 1.3) * 0.006 + pPeito.y, POSE.holograma[2] + pPeito.z);
        tab.tablet.lookAt(cam.position);
      }
      tab.animar(st.wTab, agora);
      tab.tablet.scale.multiplyScalar(0.78);   // (um pouco menor que o do lounge: aqui a câmera está perto)
    }
    R.render(cena, cam);
    medQuadros++; medMs += performance.now() - t0;
    raf = pedirQuadro(passo);
  };
  function tocar() { if (!raf && vivo && visivel) { relogio.getDelta(); raf = pedirQuadro(passo); } }
  trocar(o.persona);
  tocar();

  return {
    persona: trocar,
    sinais: (lendo, escrevendo) => {
      if (escrevendo && !sinais.escrevendo) gerandoDesde = performance.now() / 1000;   // a resposta começou: o roteiro
      if (!escrevendo) gerandoDesde = null;
      sinais.lendo = lendo; sinais.escrevendo = escrevendo;
    },
    reagir: () => acoes?.reagir(),
    gesto: () => acoes?.gesto(),
    tamanho: (w, h) => { larg = w; alt = h; tamanhoMudou = true; enquadrar(); },
    visivel: (v) => { visivel = v; if (v) tocar(); else if (raf) { cancelarQuadro(raf); raf = 0; } },
    diag: () => {
      const s = (performance.now() - medDesde) / 1000, r: DaCena = { tipo: "diag", quadros: medQuadros, msPorQuadro: medQuadros ? +(medMs / medQuadros).toFixed(2) : 0, fps: +(medQuadros / Math.max(0.001, s)).toFixed(1), sequencias: { ...seqs.estado(), gerandoHa: gerandoDesde === null ? null : +(performance.now() / 1000 - gerandoDesde).toFixed(1) } };
      medQuadros = 0; medMs = 0; medDesde = performance.now(); return r;
    },
    saltar: (t) => { if (gerandoDesde !== null) gerandoDesde = performance.now() / 1000 - t; },
    destruir: () => {
      vivo = false; pedido++; if (raf) cancelarQuadro(raf); raf = 0;
      soltarCorpo(); seqs.dispose(); tab.dispose(); estrela.dispose();
      R.dispose(); R.forceContextLoss();
    },
  };
}
