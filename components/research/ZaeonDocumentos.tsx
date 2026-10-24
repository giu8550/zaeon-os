"use client";

/**
 * ZaeonDocumentos — a AVATAR da IA no lugar dos documentos do laboratório (out/2026). O dono, depois da 1ª versão: "os
 * arquivos na mão dos modelos fica muito estranho, tire isso; ao colocarmos um arquivo lá, ele fica na seção do ícone
 * da pasta, igual antes; se jogarmos um arquivo na avatar, ela apenas reage lendo aquilo ou pensando; o tablet deve ser
 * uma tela holográfica, sem nada escrito (igual quando ele aparece no lounge); a avatar deve sempre ter animações,
 * clicando ou não; a troca de avatar é no seletor do canto superior esquerdo — e atenção máxima pra não deixar a
 * anterior presa em alguma tarefa".
 *  - QUEM: o agente do chat escolhido na sidebar (Aura · Zenita · Nina — components/research/usePersona); o VRM dela
 *    animado pelo personagem do open-annie (vendor/open-annie — Apache-2.0) com os 63 clipes CC0 do annie-blender: idles
 *    que se revezam, fidgets, gestos, expressões, piscada, olhar, cabelo. Por cima, um PILOTO que de tempos em tempos
 *    solta um gesto leve — ela nunca fica parada;
 *  - o HOLOGRAMA (o tablet do lounge na versão de luz — components/cyber/TabletLounge, mesmas partículas/estalo/halo):
 *    flutua SOZINHO à frente dela (é holograma: ninguém segura — os braços seguem nas animações do pacote). Aparece:
 *    · LENDO — um documento em análise, ou um arquivo que jogaram nela (`reagir`): a cabeça baixa, os olhos varrendo;
 *    · ESCREVENDO — a resposta da IA saindo (lib/research/zaeonEventos): ela dá toques leves no ar, rumo à tela
 *      (os gestos de toque do próprio pacote);
 *  - REAGIR a um arquivo jogado nela: ou lê (o holograma por uns segundos) ou pensa (o gesto de pensar);
 *  - clicar NELA: um gesto do pacote (aceno, risada, palmas, pensar, reverência…);
 *  - TROCAR de avatar: o corpo anterior sai na hora (com tudo que estava fazendo: holograma, leitura, gesto, timers) e
 *    um carregamento atrasado nunca entra por cima do novo.
 * Enquadrada da cintura pra cima. Só no computador (o VRM tem 12 MB); renderiza só visível.
 */
import { useEffect, useRef, useState } from "react";
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
import { EVT_ZAEON_ESCREVENDO, nomeDaPersona, type PersonaId } from "@/lib/research/zaeonEventos";

const PACOTE = "/zaeon/movimento/annie-blender/";
const CIANO = "#7fe8ff";
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

export default function ZaeonDocumentos({ persona, lendo, reagir = 0 }: {
  persona: PersonaId;
  /** um documento em análise agora (ela lê) */
  lendo?: boolean;
  /** cresce a cada arquivo jogado NELA: ela reage (lê ou pensa) */
  reagir?: number;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const nome = nomeDaPersona(persona);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const acoes = useRef<{ gesto: () => void; reagir: () => void } | null>(null);
  const trocarCorpo = useRef<((id: PersonaId) => void) | null>(null), personaRef = useRef(persona);
  useEffect(() => { personaRef.current = persona; trocarCorpo.current?.(persona); }, [persona]);
  // o que ela está fazendo (lido pelo laço a cada quadro)
  const sinais = useRef({ lendo: false, escrevendo: false });
  const [escrevendo, setEscrevendo] = useState(false);
  useEffect(() => { sinais.current.lendo = !!lendo; }, [lendo]);
  useEffect(() => {
    const ev = (e: Event) => { const v = !!(e as CustomEvent).detail; sinais.current.escrevendo = v; setEscrevendo(v); };
    window.addEventListener(EVT_ZAEON_ESCREVENDO, ev); return () => window.removeEventListener(EVT_ZAEON_ESCREVENDO, ev);
  }, []);
  const reagiu = useRef(reagir);
  useEffect(() => { if (reagir !== reagiu.current) { reagiu.current = reagir; acoes.current?.reagir(); } }, [reagir]);

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
    // o enquadramento: da CINTURA pra cima, sem cortar os ombros numa caixa estreita
    const enquadrar = () => {
      const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight); R.setSize(w, h, false); cam.aspect = w / h;
      const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), H = Math.max(0.92, 0.36 / cam.aspect), d = H / 2 / tv;
      const centro = alturaTopo - H / 2;
      cam.position.set(0, centro + 0.04, d); cam.lookAt(0, centro, 0); cam.updateProjectionMatrix();
    };
    enquadrar(); const ro = new ResizeObserver(enquadrar); ro.observe(el);

    // o HOLOGRAMA: o tablet do lounge na versão de luz (as mesmas partículas, o estalo e o halo)
    const estrela = glowTex("rgba(255,255,255,1)", "rgba(190,215,255,0.5)");
    const tab = criarTabletLounge({ luz: COR_LUZ, estrela, holograma: true, corpo: new THREE.MeshBasicMaterial() });
    cena.add(tab.tablet, tab.particulas);

    const qx = new THREE.Quaternion(), eul = new THREE.Euler();

    // ── o ESTADO de quem está no painel: TUDO que pode ficar "preso" mora aqui e é zerado na troca ──
    const D2R = Math.PI / 180;
    const st = { peso: { ler: 0, escrever: 0 } as Record<Modo, number>, wTab: 0, lerAte: 0, proxGesto: 0, proxToque: 0, rostoEm: 0 };
    const zerar = () => { st.peso.ler = 0; st.peso.escrever = 0; st.wTab = 0; st.lerAte = 0; st.proxGesto = performance.now() / 1000 + 6 + Math.random() * 6; st.proxToque = 0; st.rostoEm = 0; tab.animar(0, 0); };
    const pPeito = new THREE.Vector3();

    const pacote = fetchPack(new URL(PACOTE, location.origin).href);
    const descartar = (v: VRM) => v.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); for (const mt of Array.isArray(m.material) ? m.material : [m.material]) mt?.dispose(); } });
    const soltarCorpo = () => {
      if (c) c.overlay = undefined;
      if (vrm) { cena.remove(vrm.scene); descartar(vrm); }
      vrm = null; c = null; acoes.current = null; zerar();
    };
    let pedido = 0, carregado: PersonaId | null = null;
    const carregar = async (id: PersonaId) => {
      if (id === carregado) return;
      const meu = ++pedido; carregado = id;
      soltarCorpo(); setEstado("carregando");                 // a anterior sai NA HORA (com o que estava fazendo)
      const corpo = CORPOS_VRM[id] ?? CORPOS_VRM.aura!;
      const [v, pack] = await Promise.all([carregarVrm(corpo.url), pacote]);
      if (!vivo || meu !== pedido) { descartar(v); return; }  // trocaram de novo no meio: este corpo não entra
      tingirVrm(v, corpo.tintas ?? {}); acabarVrm(v, corpo);
      vrm = v; cena.add(v.scene); tuneSprings(v);
      const cabeca = v.humanoid.getRawBoneNode("head"); if (cabeca) { v.scene.updateMatrixWorld(true); alturaTopo = cabeca.getWorldPosition(new THREE.Vector3()).y + 0.24; enquadrar(); }
      const ch = new Character(v, cam, 7, { pack, talk: pack }); c = ch;
      ch.overlay = (_, now, dt) => {
        const s = sinais.current, k = 1 - Math.exp(-dt * 6);
        const quer: Modo | null = s.escrevendo ? "escrever" : s.lendo || now < st.lerAte ? "ler" : null;
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
      acoes.current = {
        gesto: () => gesto(AO_CLICAR[Math.floor(Math.random() * AO_CLICAR.length)]!),
        // jogaram um arquivo nela: ou LÊ (o holograma por uns segundos) ou PENSA
        reagir: () => { if (Math.random() < 0.55) { st.lerAte = performance.now() / 1000 + LER_POR; ch.setFace("curious", 0.8); } else gesto("think"); },
      };
      zerar();
      if (process.env.NODE_ENV !== "production") (window as unknown as { __zaeonDocs: unknown }).__zaeonDocs = { c: ch, cam, cena, R, vrm: v, POSE, sinais: sinais.current, st, acoes: acoes.current };
      setEstado("pronto"); tocar();
    };
    trocarCorpo.current = (id) => { void carregar(id).catch((e) => { console.warn("[zaeon-documentos] não carregou:", e); carregado = null; if (vivo) setEstado("erro"); }); };
    trocarCorpo.current(personaRef.current);

    const relogio = new THREE.Clock();
    const passo = () => {
      raf = 0; if (!vivo || !visivel || document.hidden) return;
      const dt = Math.min(0.05, relogio.getDelta()), agora = performance.now() / 1000;
      if (c && vrm) {
        const s = sinais.current, ocupada = s.escrevendo || s.lendo || agora < st.lerAte;
        // ESCREVENDO: um toque no ar de vez em quando, rumo à tela
        if (s.escrevendo && agora > st.proxToque && c.current?.idle !== false) { c.playClip(TOQUES[Math.floor(Math.random() * TOQUES.length)]!); st.proxToque = agora + 1.8 + Math.random() * 1.6; }
        // o PILOTO: sem nada pra fazer, de tempos em tempos um gesto leve (ela nunca fica parada)
        if (agora > st.proxGesto) {
          if (!ocupada && c.current?.idle !== false) { const g = DE_VEZ_EM_QUANDO[Math.floor(Math.random() * DE_VEZ_EM_QUANDO.length)]!; if (g === "nod") c.gesture("nod"); else c.playClip(g); c.setFace(ROSTO_DO_GESTO[g] ?? "happy", 0.6); }
          st.proxGesto = agora + 14 + Math.random() * 12;
        }
        c.update(agora, dt);
        // o ROSTO do modo (de vez em quando: o envelope das expressões cuida da transição)
        if (agora > st.rostoEm && ocupada) { c.setFace(s.escrevendo ? "thinking" : "curious", 0.7); st.rostoEm = agora + 3; }
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
      raf = requestAnimationFrame(passo);
    };
    function tocar() { if (!raf && vivo && visivel && !document.hidden) { relogio.getDelta(); raf = requestAnimationFrame(passo); } }
    const io = new IntersectionObserver(([e]) => { visivel = !!e?.isIntersecting; tocar(); }, { threshold: 0.01 }); io.observe(el);
    const aba = () => tocar(); document.addEventListener("visibilitychange", aba);
    tocar();
    return () => {
      vivo = false; pedido++; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", aba);
      trocarCorpo.current = null; soltarCorpo();
      tab.dispose(); estrela.dispose();
      R.dispose(); R.forceContextLoss(); R.domElement.remove();
    };
  }, []);

  return (
    <div ref={caixa} className="relative h-full min-h-[320px] w-full overflow-hidden" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 45%, ${CIANO}14, transparent 70%)` }}>
      <button type="button" aria-label={`Falar com a ${nome}`} title={nome} onClick={() => acoes.current?.gesto()} className="absolute inset-x-[18%] bottom-[20%] top-[2%] z-[1] cursor-pointer rounded-full" />
      {escrevendo && <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[2] text-center text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/70">a {nome} está escrevendo…</p>}
      {estado !== "pronto" && <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[2] text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/35">{estado === "erro" ? `a ${nome} não carregou` : `a ${nome} está chegando…`}</p>}
    </div>
  );
}
