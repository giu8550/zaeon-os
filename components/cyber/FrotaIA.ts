/**
 * FrotaIA — a FROTA DE IAs vivendo no cyberespaço (lib/cyber/frota): centenas de "jogadores" que estudam no tablet,
 * andam de moto, voam de mochila, vão pra festa e conversam com os amigos. Ninguém disso passa pela rede: cada IA é uma
 * função do relógio (o plano do dia — o mesmo em todo cliente). Aqui só o DESENHO:
 *  - a cada ~0,4 s escolhe as IAs mais PERTO da câmera (as de longe nem existem em 3D) e dá a elas um corpo de um
 *    POOL (o avatar anime na cor de cada uma, o nome em cima da cabeça, a moto quando está nela);
 *  - todo quadro, o corpo segue o estado exato (lib/cyber/frota/corpo, com o A*) e DESVIA de quem está no caminho;
 *  - os BALÕES das conversas: "..." pra quem está em cloak; o texto das outras vem do servidor na 1ª vez que alguém vê
 *    (/api/cyber/frota/conversa — o mesmo pra todos);
 *  - um usuário puxou assunto perto de uma IA: ela responde (/api/cyber/frota/responder) — seca e depois corta.
 */
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { criarAvatarLuz, type AvatarLuzHandle, type Montado } from "./AvatarLuz";
import { criarMoto, type MotoHandle } from "./Moto";
import { gerarFrota, type AgenteIA } from "@/lib/cyber/frota/frota";
import { planejarDia, type PlanoDia } from "@/lib/cyber/frota/plano";
import { diaDe, minutoDoDia } from "@/lib/cyber/frota/agenda";
import { estadoDaIA, type EstadoIA } from "@/lib/cyber/frota/corpo";
import { episodiosDoDia, type Episodio } from "@/lib/cyber/frota/conversas";
import type { ConfigSalva } from "@/lib/cyber/frota/config";
import { desviar, empurrao, type P2 } from "@/lib/cyber/colisaoAtores";

export type FrotaHandle = {
  configurar(c: ConfigSalva, agoraServidor: number): void;
  atualizar(dt: number, t: number, ctx: CtxFrota): void;
  /** os corpos das IAs desenhadas (pro meu avatar colidir) — mundo, com a altura dos pés */
  corpos(): (P2 & { y: number })[];
  /** eu falei no chat: a IA mais perto (até 6 m) responde */
  ouvir(texto: string, eu: P2 & { y: number }): void;
  /** quantas estão online agora (pro HUD, se quiser) */
  online(): number;
  mostrar(on: boolean): void;
  dispose(): void;
};
export type CtxFrota = { cam: THREE.Vector3; camera: THREE.Camera; largura: number; altura: number; ilhaY: number; pisoY: number; musica: boolean; obstaculos: P2[] };

const ESCOLHE_A_CADA = 0.4, ALCANCE = 95, ALCANCE_MOTO = 160;
const TAG = "position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:700 11px system-ui,sans-serif;padding:2px 8px;border-radius:999px;background:rgba(10,8,30,.62);border:1px solid rgba(160,140,255,.3);white-space:nowrap;pointer-events:none;";
const BALAO = "position:absolute;left:0;top:0;transform:translate(-50%,-100%);max-width:220px;font:500 12.5px system-ui,sans-serif;line-height:1.3;padding:6px 10px;border-radius:14px 14px 14px 4px;background:rgba(255,255,255,.94);color:#0b1020;box-shadow:0 4px 18px rgba(0,0,0,.35);pointer-events:none;display:none;";

type Corpo = { av: AvatarLuzHandle; tag: HTMLDivElement; balao: HTMLDivElement; moto: MotoHandle | null; id: string | null; desvio: P2; yAnt: number };

export function criarFrotaIA(o: { cena: THREE.Scene; overlay: HTMLElement; gltf: GLTF | null; starTex: THREE.Texture; low: boolean; max?: number }): FrotaHandle {
  const MAX = o.max ?? (o.low ? 8 : 16);
  const corpos: Corpo[] = [];
  let config: ConfigSalva | null = null, offset = 0, frota: AgenteIA[] = [], porId = new Map<string, AgenteIA>();
  let plano: PlanoDia | null = null, eps = new Map<string, Episodio[]>(), dia = -1, calculando = false;
  let escolherEm = 0, escolhidos: string[] = [], online = 0, visivel = true;
  const textos = new Map<string, (string | null)[] | "carregando">(), respostas = new Map<string, { n: number; texto: string | null; ate: number }>();
  const montado: Montado = { w: 1, maoE: new THREE.Vector3(), maoD: new THREE.Vector3(), peE: new THREE.Vector3(), peD: new THREE.Vector3() };
  const w = new THREE.Vector3(), proj = new THREE.Vector3();

  /** o plano do dia (uma vez por dia, fora do quadro) */
  function recalcular(d: number) {
    if (!config || calculando) return;
    calculando = true;
    const fazer = () => {
      try {
        const p = planejarDia(frota, d, config!.flags), m = new Map<string, Episodio[]>();
        for (const e of episodiosDoDia(p, config!.flags)) for (const id of new Set(e.falas.map((f) => f.agente))) (m.get(id) ?? m.set(id, []).get(id)!).push(e);
        plano = p; eps = m; dia = d;
      } finally { calculando = false; }
    };
    const ric = (globalThis as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (ric) ric(fazer, { timeout: 1500 }); else setTimeout(fazer, 0);
  }
  /** um corpo novo pro pool (o avatar é pesado: no máximo um por quadro) */
  function novoCorpo(): Corpo {
    const av = criarAvatarLuz("#7fd3ff", o.starTex, o.low, o.gltf, { anime: true }); o.cena.add(av.group); av.group.visible = false;
    const tag = document.createElement("div"); tag.style.cssText = TAG + "display:none;"; o.overlay.appendChild(tag);
    const balao = document.createElement("div"); balao.style.cssText = BALAO; o.overlay.appendChild(balao);
    return { av, tag, balao, moto: null, id: null, desvio: { x: 0, z: 0 }, yAnt: 0 };
  }
  const agoraMs = () => Date.now() + offset;
  /** o balão de uma IA agora: "..." (cloak ou sem texto ainda), o texto, ou nada */
  function balaoDe(id: string, minuto: number): string | null {
    const r = respostas.get(id); if (r && r.texto && Date.now() < r.ate) return r.texto;
    for (const e of eps.get(id) ?? []) {
      if (minuto < e.ini - 0.1 || minuto > e.falas.at(-1)!.em + 0.2) continue;
      for (let i = 0; i < e.falas.length; i++) {
        const f = e.falas[i]!, prox = e.falas[i + 1]?.em ?? f.em + 0.1;
        if (f.agente !== id || minuto < f.em || minuto > Math.min(prox, f.em + 0.09)) continue;
        if (f.cloak) return "...";
        const t = textos.get(e.id);
        if (!t) { textos.set(e.id, "carregando"); void fetch(`/api/cyber/frota/conversa?ep=${encodeURIComponent(e.id)}`).then((x) => (x.ok ? x.json() : null)).then((j) => { textos.set(e.id, Array.isArray(j?.falas) ? j.falas : e.falas.map(() => null)); }).catch(() => textos.set(e.id, e.falas.map(() => null))); }
        if (t === "carregando" || !t) return "...";
        return t[i] ?? null;
      }
    }
    return null;
  }

  return {
    configurar(c, agoraServidor) {
      config = c; offset = agoraServidor - Date.now();
      frota = gerarFrota(c.frota); porId = new Map(frota.map((a) => [a.id, a])); plano = null; dia = -1; escolhidos = [];
      for (const k of corpos) k.id = null;
      recalcular(diaDe(agoraMs()));
    },
    atualizar(dt, t, ctx) {
      if (!config || !visivel) { for (const k of corpos) { k.av.group.visible = false; k.tag.style.display = "none"; k.balao.style.display = "none"; if (k.moto) k.moto.group.visible = false; } return; }
      const ms = agoraMs(), d = diaDe(ms), minuto = minutoDoDia(ms);
      if (d !== dia) recalcular(d);
      if (!plano) return;
      // 1) escolher quem desenhar (as mais perto da câmera)
      escolherEm -= dt;
      if (escolherEm <= 0) {
        escolherEm = ESCOLHE_A_CADA;
        const cand: { id: string; d: number }[] = []; let n = 0;
        for (const { agente, blocos } of plano.agentes.values()) {
          const e = estadoDaIA(agente.id, blocos, minuto, config.flags, ctx.musica, false);
          if (!e.visivel) continue; n++;
          const y = e.zaeon ? e.y + (ctx.ilhaY - ctx.pisoY) : e.y, dist = Math.hypot(e.x - ctx.cam.x, y - ctx.cam.y, e.z - ctx.cam.z);
          if (dist < (e.pose === "moto" ? ALCANCE_MOTO : ALCANCE)) cand.push({ id: agente.id, d: dist });
        }
        online = n; cand.sort((a, b) => a.d - b.d); escolhidos = cand.slice(0, MAX).map((c) => c.id);
        // solta quem saiu; os que ficam mantêm o corpo
        for (const k of corpos) if (k.id && !escolhidos.includes(k.id)) k.id = null;
        let criou = false;   // (um avatar novo por rodada: criar é pesado — o pool enche aos poucos)
        for (const id of escolhidos) if (!corpos.some((k) => k.id === id)) {
          let k = corpos.find((x) => !x.id);
          if (!k && corpos.length < MAX && !criou) { k = novoCorpo(); corpos.push(k); criou = true; }
          if (!k) break;
          const a = porId.get(id)!; k.id = id; k.av.recolorir(a.cor); k.tag.textContent = a.nome; k.tag.style.color = a.cor; k.desvio = { x: 0, z: 0 };
        }
      }
      // 2) cada corpo: o estado exato, o desvio, a pose
      const ocupados: P2[] = [];
      for (const k of corpos) {
        if (!k.id) { k.av.group.visible = false; k.tag.style.display = "none"; k.balao.style.display = "none"; if (k.moto) k.moto.group.visible = false; continue; }
        const p = plano.agentes.get(k.id)!, e: EstadoIA = estadoDaIA(k.id, p.blocos, minuto, config.flags, ctx.musica, true);
        if (!e.visivel) { k.id = null; continue; }
        const y = e.zaeon ? e.y + (ctx.ilhaY - ctx.pisoY) : e.y;
        // desvia de mim, dos outros jogadores e das outras IAs (só de pé/andando; sentada não sai do lugar)
        const livre = e.pose === "andando" || e.pose === "parado" || e.pose === "danca";
        k.desvio = desviar(k.desvio, livre ? empurrao({ x: e.x, z: e.z }, [...ctx.obstaculos, ...ocupados]) : { x: 0, z: 0 }, dt);
        const x = e.x + k.desvio.x, z = e.z + k.desvio.z; ocupados.push({ x, z });
        let m: Montado | null = null;
        if (e.pose === "moto") {
          if (!k.moto) { k.moto = criarMoto({ cor: porId.get(k.id)!.cor, low: o.low }); o.cena.add(k.moto.group); }
          k.moto.group.visible = true; k.moto.group.position.set(x, y, z); k.moto.group.rotation.y = e.rumo;
          k.moto.atualizar({ dt, t, voando: true, vel: e.moto?.vel ?? 30, curva: e.moto?.curva ?? 0 }); k.moto.group.updateMatrixWorld(true);
          k.moto.assento.getWorldPosition(w); k.av.group.position.copy(w); k.av.olharPara(e.rumo);
          k.moto.pontos.maoE.getWorldPosition(montado.maoE); k.moto.pontos.maoD.getWorldPosition(montado.maoD); k.moto.pontos.peE.getWorldPosition(montado.peE); k.moto.pontos.peD.getWorldPosition(montado.peD);
          m = montado;
        } else { if (k.moto) k.moto.group.visible = false; k.av.group.position.set(x, y, z); k.av.olharPara(e.rumo); }
        k.av.group.visible = true;
        const vy = (y - k.yAnt) / Math.max(dt, 1e-3); k.yAnt = y;
        const deitado = e.pose === "deitado";
        k.av.animar({
          andando: e.pose === "andando", correndo: false, montado: m,
          jato: e.pose === "mochila" ? 0.9 : 0, ar: e.pose === "mochila" ? { vy, movendo: true } : null,
          meditando: e.pose === "chao" ? e.sentar : 0, danca: e.pose === "danca" ? 1 : 0,
          descanso: { sentar: deitado || e.pose === "chao" ? 0 : e.sentar, deitar: deitado ? e.sentar : 0, assentoY: e.assentoY, relaxa: e.pose === "relaxa" ? 1 : 0 },
          tablet: e.tablet, dt, t,
        });
        // o nome e o balão em cima da cabeça
        proj.set(x, k.av.group.position.y + (deitado ? 1.2 : e.pose === "chao" ? 1.5 : 2.2), z).project(ctx.camera);
        const tela = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1, sx = (proj.x * 0.5 + 0.5) * ctx.largura, sy = (-proj.y * 0.5 + 0.5) * ctx.altura;
        const longe = Math.hypot(x - ctx.cam.x, z - ctx.cam.z) > 45;
        k.tag.style.display = tela && !longe ? "block" : "none"; if (tela) k.tag.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-100%)`;
        const fala = tela && !longe ? balaoDe(k.id, minuto) : null;
        k.balao.style.display = fala ? "block" : "none";
        if (fala) { if (k.balao.textContent !== fala) k.balao.textContent = fala; k.balao.style.transform = `translate(${sx}px,${sy - 22}px) translate(-50%,-100%)`; }
      }
    },
    corpos() {
      const out: (P2 & { y: number })[] = [];
      for (const k of corpos) if (k.id && k.av.group.visible) out.push({ x: k.av.group.position.x, z: k.av.group.position.z, y: k.av.group.position.y });
      return out;
    },
    ouvir(texto, eu) {
      if (!config?.flags.responderUsuarios || !texto.trim()) return;
      let alvo: Corpo | null = null, md = 6;
      for (const k of corpos) if (k.id && k.av.group.visible && Math.abs(k.av.group.position.y - eu.y) < 3) { const d = Math.hypot(k.av.group.position.x - eu.x, k.av.group.position.z - eu.z); if (d < md) { md = d; alvo = k; } }
      if (!alvo?.id) return;
      const id = alvo.id, a = porId.get(id)!, r = respostas.get(id) ?? { n: 0, texto: null, ate: 0 };
      r.n++; respostas.set(id, r);
      if (config.flags.cloak && a.cloak) { r.texto = "..."; r.ate = Date.now() + 2500; return; }
      void fetch("/api/cyber/frota/responder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agente: id, texto: texto.slice(0, 300), tentativa: r.n }) })
        .then((x) => (x.ok ? x.json() : null)).then((j) => { if (typeof j?.fala === "string" && j.fala) { r.texto = j.fala; r.ate = Date.now() + 4200; } }).catch(() => undefined);
    },
    online: () => online,
    mostrar(on) { visivel = on; },
    dispose() { for (const k of corpos) { k.av.dispose(); k.moto?.dispose(); k.tag.remove(); k.balao.remove(); } corpos.length = 0; },
  };
}
