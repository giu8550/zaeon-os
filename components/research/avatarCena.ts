/**
 * A CENA da avatar do painel dos documentos — roda num WEB WORKER (components/research/avatar.worker) desenhando num
 * OffscreenCanvas: o 3D não divide a thread com o chat (o dono, out/2026: "a geração 3D não pode compartilhar essa
 * thread, isso vai matar nossa performance" — medido: ~5,6 ms por quadro na thread principal). Sem DOM aqui.
 *  - QUEM: o VRM da persona (Aura · Zenita · Nina) animado pelo personagem do open-annie (vendor/open-annie — Apache-2.0)
 *    com os 63 clipes CC0 do annie-blender; um PILOTO solta gestos leves de tempos em tempos (ela nunca fica parada);
 *  - o HOLOGRAMA (o tablet do lounge na versão de luz — components/cyber/TabletLounge) flutua à frente dela lendo (um
 *    documento em análise / um arquivo jogado nela) e escrevendo (a resposta da IA saindo: toques leves no ar);
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

const PACOTE = "/zaeon/movimento/annie-blender/";
/** onde o HOLOGRAMA flutua (metros: x do centro do corpo; y e z a partir do peito, +z = pra frente) e quanto ela
 *  baixa a cabeça pra ele (graus) */
export const POSE = { holograma: [0, 0.02, 0.32] as const, cabecaLer: 14, cabecaEscrever: 9 };
/** escrevendo: os toques no ar, rumo à tela (gestos do pacote) */
const TOQUES = ["g_tap_r", "g_beats3_r", "g_tap_both", "g_pinch_r"] as const;
/** os gestos de quando a clicam (clipes do pacote — todos existem nele) */
const AO_CLICAR = ["wave", "laugh", "clap", "think", "bow", "excited_bounce", "point_self", "shrug", "nod"] as const;
const ROSTO_DO_GESTO: Record<string, string> = { wave: "happy", laugh: "joyful", clap: "joyful", think: "thinking", bow: "tender", excited_bounce: "playful", point_self: "proud", shrug: "amused", nod: "happy", fidget_glance: "curious", g_minishrug: "amused", g_open_both: "happy", fidget_hair: "tender" };
/** o PILOTO: um gesto leve de vez em quando (além dos idles e fidgets do próprio personagem) */
const DE_VEZ_EM_QUANDO = ["fidget_glance", "think", "g_minishrug", "fidget_hair", "g_open_both", "wave", "nod"] as const;
/** quanto tempo ela lê um arquivo jogado nela (s) */
const LER_POR = 4.5;

type Modo = "ler" | "escrever";
export type CenaAvatar = {
  persona: (id: PersonaId) => void;
  sinais: (lendo: boolean, escrevendo: boolean) => void;
  reagir: () => void;
  gesto: () => void;
  tamanho: (largura: number, altura: number) => void;
  visivel: (v: boolean) => void;
  diag: () => DaCena;
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
  const enquadrar = () => {
    const w = Math.max(1, larg), h = Math.max(1, alt); R.setSize(w, h, false); cam.aspect = w / h;
    const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), H = Math.max(0.92, 0.36 / cam.aspect), d = H / 2 / tv;
    const centro = alturaTopo - H / 2;
    cam.position.set(0, centro + 0.04, d); cam.lookAt(0, centro, 0); cam.updateProjectionMatrix();
  };
  enquadrar();

  // o HOLOGRAMA: o tablet do lounge na versão de luz (as mesmas partículas, o estalo e o halo)
  const estrela = glowTex("rgba(255,255,255,1)", "rgba(190,215,255,0.5)");
  const tab = criarTabletLounge({ luz: COR_LUZ, estrela, holograma: true, corpo: new THREE.MeshBasicMaterial() });
  cena.add(tab.tablet, tab.particulas);
  const qx = new THREE.Quaternion(), eul = new THREE.Euler(), pPeito = new THREE.Vector3();
  const D2R = Math.PI / 180;

  // o que o chat diz que ela está fazendo
  const sinais = { lendo: false, escrevendo: false };
  // ── o ESTADO de quem está no painel: TUDO que pode ficar "preso" mora aqui e é zerado na troca ──
  const st = { peso: { ler: 0, escrever: 0 } as Record<Modo, number>, wTab: 0, lerAte: 0, proxGesto: 0, proxToque: 0, rostoEm: 0 };
  const zerar = () => { st.peso.ler = 0; st.peso.escrever = 0; st.wTab = 0; st.lerAte = 0; st.proxGesto = performance.now() / 1000 + 6 + Math.random() * 6; st.proxToque = 0; st.rostoEm = 0; tab.animar(0, 0); };
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
      const k = 1 - Math.exp(-dt * 6);
      const quer: Modo | null = sinais.escrevendo ? "escrever" : sinais.lendo || now < st.lerAte ? "ler" : null;
      for (const m of ["ler", "escrever"] as const) st.peso[m] += ((m === quer ? 1 : 0) - st.peso[m]) * k;
      if (st.peso.ler + st.peso.escrever < 0.01) return;
      // a CABEÇA baixa pro holograma (lendo, os olhos varrem as linhas)
      const cab = v.humanoid.getNormalizedBoneNode("head");
      if (cab) {
        const baixa = POSE.cabecaLer * st.peso.ler + POSE.cabecaEscrever * st.peso.escrever, varre = Math.sin(now * 1.7) * 7 * st.peso.ler;
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
      const ocupada = sinais.escrevendo || sinais.lendo || agora < st.lerAte;
      // ESCREVENDO: um toque no ar de vez em quando, rumo à tela
      if (sinais.escrevendo && agora > st.proxToque && c.current?.idle !== false) { c.playClip(TOQUES[Math.floor(Math.random() * TOQUES.length)]!); st.proxToque = agora + 1.8 + Math.random() * 1.6; }
      // o PILOTO: sem nada pra fazer, de tempos em tempos um gesto leve (ela nunca fica parada)
      if (agora > st.proxGesto) {
        if (!ocupada && c.current?.idle !== false) { const g = DE_VEZ_EM_QUANDO[Math.floor(Math.random() * DE_VEZ_EM_QUANDO.length)]!; if (g === "nod") c.gesture("nod"); else c.playClip(g); c.setFace(ROSTO_DO_GESTO[g] ?? "happy", 0.6); }
        st.proxGesto = agora + 14 + Math.random() * 12;
      }
      c.update(agora, dt);
      // o ROSTO do modo (de vez em quando: o envelope das expressões cuida da transição)
      if (agora > st.rostoEm && ocupada) { c.setFace(sinais.escrevendo ? "thinking" : "curious", 0.7); st.rostoEm = agora + 3; }
      // o HOLOGRAMA: materializa como o tablet do lounge, à frente do peito, virado pra quem vê
      st.wTab = Math.max(0, Math.min(1, st.wTab + (ocupada ? dt / TABLET.materializa : -dt / TABLET.some)));
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
    sinais: (lendo, escrevendo) => { sinais.lendo = lendo; sinais.escrevendo = escrevendo; },
    reagir: () => acoes?.reagir(),
    gesto: () => acoes?.gesto(),
    tamanho: (w, h) => { larg = w; alt = h; enquadrar(); },
    visivel: (v) => { visivel = v; if (v) tocar(); else if (raf) { cancelarQuadro(raf); raf = 0; } },
    diag: () => {
      const s = (performance.now() - medDesde) / 1000, r: DaCena = { tipo: "diag", quadros: medQuadros, msPorQuadro: medQuadros ? +(medMs / medQuadros).toFixed(2) : 0, fps: +(medQuadros / Math.max(0.001, s)).toFixed(1) };
      medQuadros = 0; medMs = 0; medDesde = performance.now(); return r;
    },
    destruir: () => {
      vivo = false; pedido++; if (raf) cancelarQuadro(raf); raf = 0;
      soltarCorpo(); tab.dispose(); estrela.dispose();
      R.dispose(); R.forceContextLoss();
    },
  };
}
