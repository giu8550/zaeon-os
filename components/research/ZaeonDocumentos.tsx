"use client";

/**
 * ZaeonDocumentos — a ZAEON no lugar dos documentos do laboratório (out/2026, o dono: "coloque a Zaeon no local onde
 * ficam os documentos; os documentos ficam disponíveis saindo da mão dela, com animação — como se ela abrisse as mãos
 * levemente e tivesse aqueles arquivos lá; ao colocarmos documento lá, ela pega eles também; ela deve ter todas as
 * animações do repo de referência, além das habituais"; depois: "mais perto da tela, da cintura pra cima; animações
 * dela lendo documentos; e quando ela escrever algo, escrevendo no tablet").
 *  - o CORPO: o VRM da Zaeon (o mesmo da capela) animado pelo personagem do open-annie (vendor/open-annie — Apache-2.0):
 *    os 63 clipes CC0 do pacote annie-blender (idles, escuta, fidgets, os gestos de fala, os semânticos: aceno, risada,
 *    palmas, dança, reverência…) com troca por inércia, expressões com envelope, piscada, olhar, cabelo e saia;
 *  - por cima da pose, a camada das MÃOS, em MODOS (cada um com peso que entra e sai suave):
 *    · segurar — as mãos levemente abertas na frente do corpo (o meio do gesto de oferecer): os documentos ficam ali,
 *      em leque, como cartas na mão (os ícones de sempre: clicar, arrastar, apagar);
 *    · receber — um documento novo: o gesto inteiro de oferecer (ela estende as mãos e pega), contente, acenando a
 *      cabeça; o ícone sobe das mãos pro leque;
 *    · ler — um documento aberto/em análise: ela o ergue à frente do rosto, a cabeça baixa e os olhos varrendo as linhas;
 *    · escrever — a resposta da IA saindo (lib/research/zaeonEventos): o TABLET do lounge (components/cyber/AvatarLuz —
 *      o dono: "a mesma animação que já usamos no lounge") se materializa nas mãos — partículas espiralando, o halo
 *      acendendo, a tela ligando — e ela o segura com as duas mãos, olhando pra tela (que vai enchendo de linhas);
 *  - clicar NELA: um gesto do pacote (aceno, risada, palmas, pensar, reverência…).
 * Enquadrada da cintura pra cima. Só no computador (o VRM tem 12 MB); renderiza só visível.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { Character } from "@/vendor/open-annie/core/character.js";
import { ClipSampler, fetchPack } from "@/vendor/open-annie/core/motion.js";
import { tuneSprings } from "@/vendor/open-annie/core/cloth.js";
import { acabarVrm, carregarVrm, tingirVrm } from "@/components/cyber/AvatarVrm";
import { CORPOS_VRM } from "@/lib/cyber/estiloAvatar";
import { EVT_ZAEON_ESCREVENDO, nomeDaPersona, type PersonaId } from "@/lib/research/zaeonEventos";
import { usePersona } from "@/components/chat/SeletorPersona";

const PACOTE = "/zaeon/movimento/annie-blender/";
const CIANO = "#7fe8ff";
/** os ossos que a camada das MÃOS mexe (os braços, as mãos e os dedos) */
const OSSOS_MAOS = /^(left|right)(Shoulder|UpperArm|LowerArm|Hand|Thumb|Index|Middle|Ring|Little)/;
/** o quanto ela abre as mãos pra segurar (do gesto de oferecer inteiro, 1, pra só um pouco) */
const ABERTURA = 0.72;
/** onde as MÃOS vão em cada modo (metros, a partir do peito; +x = a esquerda DELA, +y = cima, +z = pra frente) —
 *  resolvidas por IK de dois ossos (braço + antebraço). `cabeca` = graus que ela baixa a cabeça.
 *  · segurar: as mãos abertas à frente da barriga, onde ficam os documentos;
 *  · ler: as duas mãos erguem o documento à frente do rosto;
 *  · escrever: as duas seguram o tablet à frente (o do lounge: ele fica no meio das mãos, virado pro rosto). */
export const POSES = {
  segurar: { esq: [0.13, -0.2, 0.22], dir: [-0.13, -0.2, 0.22], cabeca: 6 },
  ler: { esq: [0.12, 0.02, 0.3], dir: [-0.12, 0.02, 0.3], cabeca: 16 },
  escrever: { esq: [0.12, -0.1, 0.26], dir: [-0.12, -0.1, 0.26], cabeca: 22 },
};
/** o TABLET se materializando / sumindo (s) — o mesmo tempo do lounge (lib/cyber/descanso TABLET) */
const TABLET = { materializa: 0.9, some: 0.6 } as const;
/** ease-out-back (o tablet "estala" no lugar) — o mesmo do lounge */
const voltaPraFora = (x: number) => { const c1 = 1.70158, c3 = c1 + 1, u = x - 1; return 1 + c3 * u * u * u + c1 * u * u; };
/** onde o cotovelo aponta (pra fora e pra baixo) */
const POLO = new THREE.Vector3(0.35, -0.6, -0.15);
/** os gestos de quando a clicam (clipes do pacote — todos existem nele) */
const AO_CLICAR = ["wave", "laugh", "clap", "think", "bow", "excited_bounce", "point_self", "shrug", "nod"] as const;
const ROSTO_DO_GESTO: Record<string, string> = { wave: "happy", laugh: "joyful", clap: "joyful", think: "thinking", bow: "tender", excited_bounce: "playful", point_self: "proud", shrug: "amused", nod: "happy" };
/** quantos documentos cabem no leque das mãos (o resto: "+N", que abre a lista) */
const NO_LEQUE = 4;

export type DocNaMao = { id: string; node: ReactNode };
type Modo = "segurar" | "receber" | "ler" | "escrever";

export default function ZaeonDocumentos({ docs, onVerTodos, vazio, lendo, escrevendo: escrevendoProp }: { docs: readonly DocNaMao[]; /** abrir a lista de todos */ onVerTodos: () => void; vazio?: ReactNode; /** o documento que ela está lendo agora (aberto/em análise) */ lendo?: string | null; /** escrevendo por fora do evento (quem já sabe) */ escrevendo?: boolean }) {
  const caixa = useRef<HTMLDivElement>(null), leque = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const zaeon = useRef<{ receber: () => void; gesto: () => void } | null>(null);
  // QUEM está no painel (Aura · Zenita · Nina — escolhida no topo do chat): trocar recarrega só o corpo
  const persona = usePersona(), nome = nomeDaPersona(persona);
  const trocarCorpo = useRef<((id: PersonaId) => void) | null>(null), personaRef = useRef(persona);
  useEffect(() => { personaRef.current = persona; trocarCorpo.current?.(persona); }, [persona]);
  // o que ela está fazendo (lido pelo laço a cada quadro)
  const sinais = useRef({ lendo: false, escrevendo: false });
  const [escrevendo, setEscrevendo] = useState(false);
  // os documentos que ACABARAM de chegar (o ícone sobe das mãos)
  const vistos = useRef<Set<string> | null>(null), [novos, setNovos] = useState<Set<string>>(new Set());

  useEffect(() => { sinais.current.lendo = !!lendo; }, [lendo]);
  useEffect(() => { if (escrevendoProp !== undefined) { sinais.current.escrevendo = escrevendoProp; setEscrevendo(escrevendoProp); } }, [escrevendoProp]);
  useEffect(() => {
    const ev = (e: Event) => { const v = !!(e as CustomEvent).detail; sinais.current.escrevendo = v; setEscrevendo(v); };
    window.addEventListener(EVT_ZAEON_ESCREVENDO, ev); return () => window.removeEventListener(EVT_ZAEON_ESCREVENDO, ev);
  }, []);
  useEffect(() => {
    const ids = docs.map((d) => d.id);
    if (vistos.current === null) { vistos.current = new Set(ids); return; }   // (os que já estavam não "chegam")
    const chegaram = ids.filter((id) => !vistos.current!.has(id));
    for (const id of ids) vistos.current.add(id);
    if (!chegaram.length) return;
    zaeon.current?.receber();
    setNovos((s) => new Set([...s, ...chegaram]));
    const t = setTimeout(() => setNovos((s) => { const n = new Set(s); for (const id of chegaram) n.delete(id); return n; }), 1300);
    return () => clearTimeout(t);
  }, [docs]);

  useEffect(() => {
    const el = caixa.current; if (!el) return;
    let vivo = true, raf = 0, visivel = true, c: Character | null = null, vrm: VRM | null = null;
    let R: THREE.WebGLRenderer;
    try { R = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch { setEstado("erro"); return; }
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); R.outputColorSpace = THREE.SRGBColorSpace; R.setClearColor(0x000000, 0);
    R.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    el.prepend(R.domElement);
    const cena = new THREE.Scene(), cam = new THREE.PerspectiveCamera(22, 1, 0.1, 40);
    cena.add(new THREE.HemisphereLight(0xe6f2ff, 0x241c3a, 2.1));
    const sol = new THREE.DirectionalLight(0xffffff, 2.1); sol.position.set(-1.2, 2.6, 3.5); cena.add(sol);
    const contra = new THREE.DirectionalLight(0x7fe8ff, 1.4); contra.position.set(1.5, 2, -2.5); cena.add(contra);

    let alturaTopo = 1.76;   // o topo do quadro (acima da cabeça — cada corpo tem a sua altura)
    // o enquadramento: da CINTURA pra cima (a janela vertical de ~0,92 a 1,8 m), sem cortar os ombros numa caixa estreita
    const enquadrar = () => {
      const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight); R.setSize(w, h, false); cam.aspect = w / h;
      const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), H = Math.max(0.92, 0.36 / cam.aspect), d = H / 2 / tv;
      const topo = alturaTopo, centro = topo - H / 2;
      cam.position.set(0, centro + 0.04, d); cam.lookAt(0, centro, 0); cam.updateProjectionMatrix();
    };
    enquadrar(); const ro = new ResizeObserver(enquadrar); ro.observe(el);

    // o TABLET do lounge (components/cyber/AvatarLuz): corpo fino escuro, a tela acesa, o halo atrás; materializa de
    // PARTÍCULAS que espiralam pras mãos. A tela é a do laboratório, enchendo de linhas enquanto a resposta sai
    const tcv = document.createElement("canvas"); tcv.width = 256; tcv.height = 176;
    const tg = tcv.getContext("2d")!, ttex = new THREE.CanvasTexture(tcv); ttex.colorSpace = THREE.SRGBColorSpace;
    const tablet = new THREE.Group(); tablet.visible = false; cena.add(tablet);
    const matTabCorpo = new THREE.MeshStandardMaterial({ color: 0x141a2c, roughness: 0.3, metalness: 0.7, emissive: 0x1a3a44, emissiveIntensity: 0.6 });
    const matTabTela = new THREE.MeshBasicMaterial({ map: ttex, transparent: true, opacity: 0, toneMapped: false });
    // (aqui a câmera fica NA FRENTE dela — no lounge, atrás): o halo é um brilho redondo do lado da tela, vazando pelas
    // bordas, e as costas do tablet têm a marca acesa
    const brilho = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!, gr = g.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, "rgba(127,232,255,.9)"); gr.addColorStop(0.45, "rgba(127,232,255,.35)"); gr.addColorStop(1, "rgba(127,232,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const costas = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 176; const g = c.getContext("2d")!; const gr = g.createLinearGradient(0, 0, 256, 176); gr.addColorStop(0, "#1a2340"); gr.addColorStop(1, "#0b1020"); g.fillStyle = gr; g.fillRect(0, 0, 256, 176); g.strokeStyle = "rgba(127,232,255,.75)"; g.lineWidth = 3; g.strokeRect(4, 4, 248, 168); g.fillStyle = "rgba(127,232,255,.9)"; g.font = "bold 22px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("⟁ ZAEON", 128, 96); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const matTabHalo = new THREE.MeshBasicMaterial({ map: brilho, color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const matTabCostas = new THREE.MeshBasicMaterial({ map: costas, transparent: true, opacity: 0, toneMapped: false });
    const geoTab = [new THREE.BoxGeometry(0.3, 0.21, 0.014), new THREE.PlaneGeometry(0.272, 0.186), new THREE.PlaneGeometry(0.62, 0.48), new THREE.PlaneGeometry(0.296, 0.206)] as const;
    tablet.add(new THREE.Mesh(geoTab[0], matTabCorpo));
    const telaTab = new THREE.Mesh(geoTab[1], matTabTela); telaTab.position.z = 0.0075; tablet.add(telaTab);
    const haloTab = new THREE.Mesh(geoTab[2], matTabHalo); haloTab.position.z = 0.03; tablet.add(haloTab);
    const costasTab = new THREE.Mesh(geoTab[3], matTabCostas); costasTab.position.z = -0.0075; costasTab.rotation.y = Math.PI; tablet.add(costasTab);
    const estrela = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d")!, gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "#fff"); gr.addColorStop(0.35, "rgba(160,240,255,.8)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
    const NPT = 36, ptPos = new Float32Array(NPT * 3), ptGeo = new THREE.BufferGeometry(); ptGeo.setAttribute("position", new THREE.BufferAttribute(ptPos, 3));
    const matPtTab = new THREE.PointsMaterial({ size: 0.05, map: estrela, color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const particulasTab = new THREE.Points(ptGeo, matPtTab); particulasTab.frustumCulled = false; particulasTab.visible = false; cena.add(particulasTab);
    let linhasTab = 0, wTab = 0;
    const desenharTela = (t: number) => {
      const gr = tg.createLinearGradient(0, 0, 0, 176); gr.addColorStop(0, "#0a1f3d"); gr.addColorStop(1, "#04101f"); tg.fillStyle = gr; tg.fillRect(0, 0, 256, 176);
      tg.fillStyle = "#66e6ff"; tg.fillRect(0, 0, 256, 22); tg.fillStyle = "#04101f"; tg.font = "bold 13px system-ui, sans-serif"; tg.fillText("ZAEON · LABORATÓRIO", 10, 15);
      const n = Math.floor(linhasTab);
      tg.fillStyle = "rgba(143,232,255,.85)";
      for (let i = 0; i < Math.min(n, 8); i++) { const w = 70 + ((i * 47) % 150); tg.fillRect(12, 36 + i * 17, i === n - 1 ? w * (linhasTab - n + 0.2) : w, 6); }
      if (Math.floor(t * 2) % 2) { tg.fillStyle = "#e8fbff"; tg.fillRect(14 + (70 + ((Math.max(0, n - 1) * 47) % 150)) * Math.min(1, linhasTab - n + 0.2), 33 + Math.max(0, Math.min(n, 8) - 1) * 17, 2, 11); }
      ttex.needsUpdate = true;
    };

    // os MODOS da camada das mãos
    let oferecer: ClipSampler | null = null, durReceber = 2;
    const alvo: Record<string, THREE.Quaternion> = {}, quadro: Record<string, THREE.Quaternion> = {}, qx = new THREE.Quaternion(), eul = new THREE.Euler();
    const alvoMao = new THREE.Vector3();
    // IK de DOIS OSSOS (ombro→cotovelo→punho) nos ossos normalizados: leva o punho ao alvo, o cotovelo pro lado do polo
    const S = new THREE.Vector3(), E = new THREE.Vector3(), W = new THREE.Vector3(), T = new THREE.Vector3(), pol = new THREE.Vector3(), eixo = new THREE.Vector3(), dirE = new THREE.Vector3();
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion(), q0 = new THREE.Quaternion();
    const girarPara = (osso: THREE.Object3D, de: THREE.Vector3, para: THREE.Vector3, peso: number) => {
      qa.setFromUnitVectors(de, para);                                   // a rotação no MUNDO
      osso.getWorldQuaternion(qw); osso.parent!.getWorldQuaternion(qp);
      q0.copy(osso.quaternion);
      osso.quaternion.copy(qp.invert()).multiply(qa).multiply(qw);       // local = pai⁻¹ · Δ · mundo
      if (peso < 1) osso.quaternion.copy(q0.slerp(osso.quaternion, peso));
      osso.updateMatrixWorld(true);
    };
    const ik = (h: VRM["humanoid"], lado: "left" | "right", alvoW: THREE.Vector3, peso: number) => {
      const up = h.getNormalizedBoneNode(`${lado}UpperArm`), lo = h.getNormalizedBoneNode(`${lado}LowerArm`), mao = h.getNormalizedBoneNode(`${lado}Hand`);
      if (!up || !lo || !mao) return;
      up.getWorldPosition(S); lo.getWorldPosition(E); mao.getWorldPosition(W);
      const a = S.distanceTo(E), b = E.distanceTo(W);
      T.copy(alvoW).sub(S); const d = Math.min(Math.max(T.length(), 0.05), (a + b) * 0.995); T.setLength(d);
      // o cotovelo: no plano (S, alvo, polo), no ângulo da lei dos cossenos
      const cosA = (a * a + d * d - b * b) / (2 * a * d), ang = Math.acos(Math.min(1, Math.max(-1, cosA)));
      pol.set(lado === "left" ? POLO.x : -POLO.x, POLO.y, POLO.z);
      const td = T.clone().normalize(); eixo.crossVectors(td, pol).normalize();
      if (eixo.lengthSq() < 1e-6) eixo.set(0, 0, 1);
      dirE.copy(td).applyAxisAngle(eixo, ang);                           // a direção ombro→cotovelo desejada
      // 1) o braço: do cotovelo de agora pro desejado
      girarPara(up, E.clone().sub(S).normalize(), dirE, peso);
      // 2) o antebraço: do punho de agora pro alvo
      lo.getWorldPosition(E); mao.getWorldPosition(W);
      girarPara(lo, W.clone().sub(E).normalize(), T.clone().add(S).sub(E).normalize(), peso);
    };
    const peso: Record<Modo, number> = { segurar: 0, receber: 0, ler: 0, escrever: 0 };
    let receberDesde = -1;
    const D2R = Math.PI / 180;
    const mL = new THREE.Vector3(), mR = new THREE.Vector3(), meio = new THREE.Vector3(), pPeito = new THREE.Vector3(), qx2 = new THREE.Vector3();

    const pacote = fetchPack(new URL(PACOTE, location.origin).href);
    const soltarCorpo = () => {
      if (!vrm) return;
      cena.remove(vrm.scene); vrm.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); for (const mt of Array.isArray(m.material) ? m.material : [m.material]) mt?.dispose(); } });
      vrm = null; c = null; zaeon.current = null;
    };
    let pedido = 0, carregado: PersonaId | null = null;
    const carregar = async (id: PersonaId) => {
      if (id === carregado) return;
      const meu = ++pedido; carregado = id; setEstado("carregando");
      const corpo = CORPOS_VRM[id] ?? CORPOS_VRM.aura!;
      const [v, pack] = await Promise.all([carregarVrm(corpo.url), pacote]);
      if (!vivo || meu !== pedido) return;
      soltarCorpo();
      tingirVrm(v, corpo.tintas ?? {}); acabarVrm(v, corpo);
      vrm = v; cena.add(v.scene); tuneSprings(v);
      const cabeca = v.humanoid.getRawBoneNode("head"); if (cabeca) { v.scene.updateMatrixWorld(true); alturaTopo = cabeca.getWorldPosition(new THREE.Vector3()).y + 0.24; enquadrar(); }
      c = new Character(v, cam, 7, { pack, talk: pack });
      const of = pack.clips.g_offer_both; if (of) { oferecer = new ClipSampler(v, of.data); durReceber = oferecer.duration; oferecer.sample((of.stroke ?? 0.75) + 0.1, alvo); }
      c.overlay = (ch, now, dt) => {
        const s = sinais.current, recebendo = receberDesde >= 0 && now - receberDesde < durReceber, livre = ch.current?.idle !== false && !ch.speaking;
        const quer: Modo | null = recebendo ? "receber" : s.escrevendo ? "escrever" : s.lendo ? "ler" : livre ? "segurar" : null;
        const k = 1 - Math.exp(-dt * 6);
        for (const m of Object.keys(peso) as Modo[]) peso[m] += ((m === quer ? 1 : 0) - peso[m]) * k;
        if (!oferecer) return;
        const h = ch.vrm.humanoid;
        // o RECEBER toca o gesto inteiro; os outros partem do meio dele, com os ajustes do modo
        if (peso.receber > 0.01) oferecer.sample(Math.max(0, now - receberDesde), quadro);
        // segurar = as mãos levemente abertas; ler/escrever partem da mão do gesto (os dedos segurando) e a IK leva os braços
        const pMao = peso.segurar * ABERTURA + peso.ler + peso.escrever;
        for (const b in alvo) {
          if (!OSSOS_MAOS.test(b)) continue;
          const n = h.getNormalizedBoneNode(b as never); if (n && pMao > 0.01) n.quaternion.slerp(alvo[b]!, Math.min(1, pMao));
        }
        const peito = h.getNormalizedBoneNode("upperChest") ?? h.getNormalizedBoneNode("chest");
        if (peito) {
          ch.vrm.scene.updateMatrixWorld(true); peito.getWorldPosition(pPeito);
          for (const m of ["segurar", "ler", "escrever"] as const) {
            if (peso[m] < 0.01) continue;
            const P = POSES[m], sobe = Math.sin(now * 1.3) * 0.006;
            ik(h, "left", alvoMao.set(P.esq[0], P.esq[1] + sobe, P.esq[2]).add(pPeito), peso[m]);
            ik(h, "right", alvoMao.set(P.dir[0], P.dir[1] + sobe, P.dir[2]).add(pPeito), peso[m]);
          }
        }
        for (const b in quadro) {
          if (peso.receber < 0.01 || !OSSOS_MAOS.test(b)) continue;
          h.getNormalizedBoneNode(b as never)?.quaternion.slerp(quadro[b]!, peso.receber);
        }
        // a CABEÇA baixa pro que ela lê/escreve (e varre as linhas lendo)
        const cab = h.getNormalizedBoneNode("head");
        if (cab) for (const m of ["ler", "escrever"] as const) {
          if (peso[m] < 0.01) continue;
          const varre = m === "ler" ? Math.sin(now * 1.7) * 7 : Math.sin(now * 3.1) * 2;
          cab.quaternion.multiply(qx.setFromEuler(eul.set(POSES[m].cabeca * D2R * peso[m], varre * D2R * peso[m], 0)));
        }
      };
      zaeon.current = {
        receber: () => { if (!c) return; receberDesde = performance.now() / 1000; c.setFace("happy", 0.9); c.gesture("nod"); },
        gesto: () => { if (!c) return; const g = AO_CLICAR[Math.floor(Math.random() * AO_CLICAR.length)]!; if (g === "nod") c.gesture("nod"); else c.playClip(g); c.setFace(ROSTO_DO_GESTO[g] ?? "happy", 0.9); },
      };
      if (process.env.NODE_ENV !== "production") (window as unknown as { __zaeonDocs: unknown }).__zaeonDocs = { c, cam, cena, R, vrm: v, POSES, sinais: sinais.current, peso };
      setEstado("pronto"); tocar();
    };
    trocarCorpo.current = (id) => { void carregar(id).catch((e) => { console.warn("[zaeon-documentos] não carregou:", e); carregado = null; if (vivo) setEstado("erro"); }); };
    trocarCorpo.current(personaRef.current);

    const relogio = new THREE.Clock();
    let rostoEm = 0;
    const passo = () => {
      raf = 0; if (!vivo || !visivel || document.hidden) return;
      const dt = Math.min(0.05, relogio.getDelta()), agora = performance.now() / 1000;
      if (c && vrm) {
        c.update(agora, dt);
        const h = vrm.humanoid, s = sinais.current;
        // o ROSTO do modo (de vez em quando: o envelope das expressões cuida da transição)
        if (agora > rostoEm && (s.lendo || s.escrevendo)) { c.setFace(s.escrevendo ? "thinking" : "curious", 0.7); rostoEm = agora + 3; }
        // o TABLET (como no lounge): no meio das mãos, um pouco rumo ao rosto, a tela virada pra cabeça; materializando,
        // as partículas espiralam até ele, o halo acende e a tela liga (piscando até firmar)
        wTab = Math.max(0, Math.min(1, wTab + (s.escrevendo ? dt / TABLET.materializa : -dt / TABLET.some)));
        const pTab = peso.escrever;
        tablet.visible = wTab > 0.01; particulasTab.visible = wTab > 0.01 && wTab < 0.985;
        const hE = h.getRawBoneNode("leftHand"), hD = h.getRawBoneNode("rightHand"), cab = h.getRawBoneNode("head");
        if (tablet.visible && hE && hD && cab) {
          hE.getWorldPosition(mL); hD.getWorldPosition(mR); cab.getWorldPosition(pPeito);
          meio.addVectors(mL, mR).multiplyScalar(0.5); meio.addScaledVector(qx2.copy(pPeito).sub(meio), 0.14);
          tablet.position.copy(meio); tablet.lookAt(pPeito);
          tablet.scale.setScalar(Math.max(0.001, voltaPraFora(wTab)));
          matTabTela.opacity = Math.max(0, Math.min(1, (wTab - 0.55) / 0.4)) * (wTab < 0.98 ? 0.75 + 0.25 * Math.sin(agora * 40) : 1);
          matTabHalo.opacity = 0.55 * Math.sin(Math.PI * wTab) + 0.12 * wTab; matTabCostas.opacity = matTabTela.opacity;
          if (particulasTab.visible) {
            const abre = 1 - wTab;
            for (let i = 0; i < NPT; i++) { const a = i * 2.39996 + agora * 5, r = 0.04 + abre * (0.3 + 0.18 * ((i * 7) % 5) / 5), y = (((i * 13) % 11) / 11 - 0.5) * abre * 0.6; ptPos[i * 3] = meio.x + Math.cos(a) * r; ptPos[i * 3 + 1] = meio.y + y; ptPos[i * 3 + 2] = meio.z + Math.sin(a) * r; }
            ptGeo.attributes.position!.needsUpdate = true; matPtTab.opacity = 0.9 * Math.min(1, abre * 3);
          }
          if (s.escrevendo) linhasTab = Math.min(8.9, linhasTab + dt * 1.6); else if (wTab < 0.1) linhasTab = 0;
          desenharTela(agora);
        }
        // o LEQUE segue o meio das mãos (um pouco acima); escrevendo, some (o tablet ocupa as mãos)
        const hl = h.getRawBoneNode("leftHand"), hr = h.getRawBoneNode("rightHand");
        if (hl && hr) {
          hl.getWorldPosition(mL); hr.getWorldPosition(mR); meio.addVectors(mL, mR).multiplyScalar(0.5); meio.y += 0.06; meio.project(cam);
          const lq = leque.current;
          if (lq) { lq.style.left = `${((meio.x + 1) / 2) * 100}%`; lq.style.top = `${((1 - meio.y) / 2) * 100}%`; lq.style.opacity = String(Math.max(0, 1 - pTab * 1.6)); }
        }
      }
      R.render(cena, cam);
      raf = requestAnimationFrame(passo);
    };
    function tocar() { if (!raf && vivo && visivel && !document.hidden) { relogio.getDelta(); raf = requestAnimationFrame(passo); } }
    const io = new IntersectionObserver(([e]) => { visivel = !!e?.isIntersecting; tocar(); }, { threshold: 0.01 }); io.observe(el);
    const aba = () => tocar(); document.addEventListener("visibilitychange", aba);
    tocar();
    return () => {
      vivo = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", aba);
      trocarCorpo.current = null; soltarCorpo();
      for (const g of geoTab) g.dispose(); matTabCorpo.dispose(); matTabTela.dispose(); matTabHalo.dispose(); matTabCostas.dispose(); brilho.dispose(); costas.dispose(); ttex.dispose(); ptGeo.dispose(); matPtTab.dispose(); estrela.dispose();
      R.dispose(); R.forceContextLoss(); R.domElement.remove();
    };
  }, []);

  // o LEQUE: até NO_LEQUE documentos como cartas na mão (abertos em leque; o que ela lê vai pra frente, maior)
  const ordem = lendo ? [...docs.filter((d) => d.id !== lendo), ...docs.filter((d) => d.id === lendo)] : docs;
  const mostra = ordem.slice(-NO_LEQUE), resto = docs.length - mostra.length, n = mostra.length;
  return (
    <div ref={caixa} className="relative h-full min-h-[320px] w-full overflow-hidden" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 45%, ${CIANO}14, transparent 70%)` }}>
      <button type="button" aria-label={`Falar com a ${nome}`} title={nome} onClick={() => zaeon.current?.gesto()} className="absolute inset-x-[18%] bottom-[30%] top-[2%] z-[1] cursor-pointer rounded-full" />
      <div ref={leque} className="pointer-events-none absolute z-[2] h-0 w-0 opacity-0 transition-opacity duration-300" style={{ left: "50%", top: "70%" }}>
        {mostra.map((d, i) => {
          const k = n === 1 ? 0 : i / (n - 1) - 0.5, ativo = d.id === lendo, novo = novos.has(d.id) || (vistos.current !== null && !vistos.current.has(d.id));
          // lendo: o documento dela vai pras mãos erguidas (o leque segue as mãos) e os outros quase somem
          const x = ativo ? 0 : k * 64, y = ativo ? 62 : 78 - (1 - Math.abs(k) * 2) * 10, giro = ativo ? 0 : k * 26, escala = ativo ? 1.25 : 0.82;
          return (
            <div key={d.id} className={`pointer-events-auto absolute w-[92px] ${ativo ? "rounded-[16px] bg-[rgba(6,12,28,0.88)] ring-1 ring-cyan-300/40" : ""}`}
              style={{ left: 0, top: 0, zIndex: ativo ? 5 : i, transformOrigin: "50% 100%", transform: novo ? "translate(-50%,-60%) scale(0.15)" : `translate(calc(-50% + ${x}px), calc(-100% + ${y}px)) rotate(${giro}deg) scale(${escala})`, opacity: novo ? 0 : lendo && !ativo ? 0.18 : 1, transition: "transform 800ms cubic-bezier(.2,.9,.2,1.15), opacity 500ms ease", filter: `drop-shadow(0 6px 14px ${CIANO}${ativo ? "88" : "44"})` }}>
              {d.node}
            </div>
          );
        })}
        {resto > 0 && (
          <button type="button" onClick={onVerTodos} className="pointer-events-auto absolute -translate-x-1/2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-100" style={{ left: 0, top: 18, borderColor: `${CIANO}66`, background: "rgba(4,10,24,.7)" }}>+{resto} documentos</button>
        )}
      </div>
      {escrevendo && <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[2] text-center text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/70">a {nome} está escrevendo…</p>}
      {!docs.length && vazio && <div className="pointer-events-none absolute inset-x-3 bottom-10 z-[2] text-center">{vazio}</div>}
      {estado !== "pronto" && <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[2] text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/35">{estado === "erro" ? `a ${nome} não carregou` : `a ${nome} está chegando…`}</p>}
    </div>
  );
}
