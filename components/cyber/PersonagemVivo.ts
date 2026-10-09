/**
 * PersonagemVivo — um personagem (a Nina…) VIVENDO na cidadela Zaeon: o corpo VRM próprio (lib/cyber/estiloAvatar
 * CORPOS_VRM, com o traço de anime, os acessórios e a pose feminina) seguindo a AGENDA de lib/cyber/vidaPersonagem —
 * que é uma função do relógio: todo cliente a vê no mesmo lugar, fazendo a mesma coisa, sem rede.
 * Anima com as MESMAS poses dos jogadores (AvatarLuz): andar, digitar na estação (`sentado`), dançar, meditar e
 * pilotar a moto (com a IK das mãos e dos pés nos pontos da moto). A pose feminina vale quando ela está parada em pé.
 * Leve: o VRM só baixa quando a câmera chega perto (e é solto quando ela se afasta); longe, anima menos vezes;
 * escondido, nem anima.
 */
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMUtils, type VRM } from "@pixiv/three-vrm";
import { criarAvatarLuz, type AvatarLuzHandle, type Montado } from "./AvatarLuz";
import { acabarVrm, carregarVrm, tingirVrm } from "./AvatarVrm";
import { vestirAcessorios, type AcessoriosHandle } from "./AcessoriosVrm";
import { criarMoto, loteMoto, type MotoHandle } from "./Moto";
import { matrizDoAvatar } from "./matrizes";
import { mundo } from "@/lib/cyber/ceu";
import { desviar, empurrao, type P2 } from "@/lib/cyber/colisaoAtores";
import type { CorpoVrm } from "@/lib/cyber/estiloAvatar";
import { POSES_VRM } from "@/lib/cyber/posesVrm";
import { estadoEm, type Bloco, type Estado, type PerfilVida } from "@/lib/cyber/vidaPersonagem";

export type PersonagemVivoHandle = {
  readonly id: string; readonly nome: string; readonly cor: string;
  group: THREE.Group;
  /** onde ela está (mundo) e a altura — pro nome em cima da cabeça */
  readonly pos: THREE.Vector3; readonly alt: number;
  readonly estado: Estado | null;
  /** `agora` = relógio de parede (s); `ilhaY` = a altura atual do piso da ilha (ela boia); `cam` = pra economizar longe */
  atualizar(dt: number, t: number, agora: number, ilhaY: number, cam: THREE.Vector3, obstaculos?: readonly P2[]): void;
  mostrar(on: boolean): void;
  dispose(): void;
};

const DIST_ANIMA_SEMPRE = 70, DIST_ESCONDE = 650, DIST_CARREGA = 160, DIST_SOLTA = 360;
/** de 25 a 70 m o esqueleto anima a cada ~2 quadros (como os corpos da frota): ~450 nós por VRM, 14 na cidadela */
const DIST_ANIMA_CHEIO = 25;
/** o CONTORNO do MToon (traço de 3,5–8,5 mm no mundo) vira menos de 1 pixel além de ~30 m — e custa 1 draw call por
 *  peça do VRM. Some além de `DIST_CONTORNO`, volta perto (histerese pra não piscar na fronteira) */
const DIST_CONTORNO = { some: 34, volta: 28 };

export function criarPersonagemVivo(o: { id: string; nome: string; cor: string; corMoto: string; corpo: CorpoVrm; perfil: PerfilVida; starTex: THREE.Texture; low: boolean; gltf: GLTF; cena: THREE.Scene }): PersonagemVivoHandle {
  const raiz = new THREE.Group(); raiz.name = `personagem-${o.id}`; o.cena.add(raiz);
  const av: AvatarLuzHandle = criarAvatarLuz(o.cor, o.starTex, o.low, o.gltf, { anime: true });
  av.semMochila(); av.esperarCorpo(true); raiz.add(av.group);
  const poseParada = o.corpo.pose ? POSES_VRM[o.corpo.pose] : null;
  // o corpo VRM (~10 MB cada) só baixa quando a câmera chega PERTO e é solto quando ela se afasta bem — com muitos
  // personagens na cidadela, ninguém baixa todos de uma vez
  let vrm: VRM | null = null, acessorios: AcessoriosHandle | null = null, vivo = true, carregando = false, geracao = 0;
  let tracos: THREE.Material[] = [], comTraco = true;
  const carregar = () => {
    if (vrm || carregando) return;
    carregando = true; const g = ++geracao;
    carregarVrm(o.corpo.url).then((v) => {
      carregando = false;
      if (!vivo || g !== geracao) { VRMUtils.deepDispose(v.scene); return; }
      tingirVrm(v, o.corpo.tintas); acabarVrm(v, o.corpo); av.usarVrm(v, { economico: true }); vrm = v;
      tracos = []; v.scene.traverse((n) => { const ms = (n as THREE.Mesh).material; for (const m of Array.isArray(ms) ? ms : ms ? [ms] : []) if ((m as { isOutline?: boolean }).isOutline) tracos.push(m); });
      comTraco = true;
      if (o.corpo.acessorios?.length) acessorios = vestirAcessorios(v, o.corpo.acessorios);
    }).catch((e) => { carregando = false; console.warn(`[cyber] corpo de ${o.nome} (VRM) não carregou:`, e); });
  };
  const soltar = () => {
    geracao++; carregando = false;
    if (!vrm) return;
    acessorios?.dispose(); acessorios = null; av.soltarVrm(); VRMUtils.deepDispose(vrm.scene); vrm = null; tracos = [];
  };

  // a moto dele (na cor do card): estacionada na vaga dele, ao lado do lote da Zaeon, quando não está voando
  const moto: MotoHandle = loteMoto(criarMoto({ cor: o.corMoto, low: o.low })); raiz.add(moto.group);

  const pos = new THREE.Vector3(), w = new THREE.Vector3();
  let alt = 0, cache: Bloco | null = null, estado: Estado | null = null, mostrado = true, pulo = 0, desvio: P2 = { x: 0, z: 0 };
  // as flags suaves (a pose não troca seca entre andar, digitar, dançar…)
  const s = { sentado: 0, danca: 0, meditando: 0 };
  const montado: Montado = { w: 1, maoE: new THREE.Vector3(), maoD: new THREE.Vector3(), peE: new THREE.Vector3(), peD: new THREE.Vector3() };
  const vagaW = mundo(o.perfil.vaga);

  return {
    id: o.id, nome: o.nome, cor: o.cor, group: raiz,
    get pos() { return pos; }, get alt() { return alt; }, get estado() { return estado; },
    mostrar(on) { mostrado = on; raiz.visible = on; },
    atualizar(dt, t, agora, ilhaY, cam, obstaculos = []) {
      if (!mostrado) return;
      const e = estadoEm(agora, o.perfil, cache); cache = e.bloco; estado = e;
      const p0 = mundo(e.pos);
      // DESVIA de quem está no caminho (o jogador, os outros) — o roteiro não muda, só o corpo contorna
      desvio = desviar(desvio, !e.moto && e.sentado < 0.5 ? empurrao(p0, obstaculos) : { x: 0, z: 0 }, dt);
      const p = { x: p0.x + desvio.x, z: p0.z + desvio.z }; pos.set(p.x, 0, p.z);
      const dist = Math.hypot(cam.x - p.x, cam.z - p.z);
      if (dist < DIST_CARREGA) carregar(); else if (dist > DIST_SOLTA) soltar();
      raiz.visible = dist < DIST_ESCONDE; if (!raiz.visible) return;
      // o contorno de tinta só onde ele aparece (de longe é menor que um pixel)
      const querTraco = comTraco ? dist < DIST_CONTORNO.some : dist < DIST_CONTORNO.volta;
      if (querTraco !== comTraco) { comTraco = querTraco; for (const m of tracos) m.visible = querTraco; }
      // longe, anima a cada 3 quadros; no meio, a cada ~2 (acumulando o dt)
      pulo += dt; const cada = dist > DIST_ANIMA_SEMPRE ? 0.05 : dist > DIST_ANIMA_CHEIO ? 1 / 40 : 0;
      if (pulo < cada) { matrizDoAvatar(raiz, false); return; }   // nada mudou: o esqueleto (~450 nós) não recalcula
      matrizDoAvatar(raiz, true);
      const dtA = Math.min(0.2, pulo); pulo = 0;
      const k = Math.min(1, dtA * 3);
      s.sentado += (e.sentado - s.sentado) * k; s.danca += (e.danca - s.danca) * k; s.meditando += (e.meditando - s.meditando) * k;
      let m: Montado | null = null;
      if (e.moto) {
        moto.group.position.set(p.x, ilhaY + e.moto.y, p.z); moto.group.rotation.y = e.moto.rumo;
        moto.atualizar({ dt: dtA, t, voando: e.moto.voando, vel: e.moto.vel, curva: e.moto.curva });
        moto.group.updateMatrixWorld(true);
        moto.assento.getWorldPosition(w); av.group.position.copy(w); av.olharPara(e.moto.rumo);
        moto.pontos.maoE.getWorldPosition(montado.maoE); moto.pontos.maoD.getWorldPosition(montado.maoD);
        moto.pontos.peE.getWorldPosition(montado.peE); moto.pontos.peD.getWorldPosition(montado.peD);
        m = montado; alt = w.y;
      } else {
        moto.group.position.set(vagaW.x, ilhaY, vagaW.z); moto.group.rotation.y = o.perfil.vaga.rumo;
        moto.atualizar({ dt: dtA, t, voando: false, vel: 0, curva: 0 });
        alt = ilhaY + e.y; av.group.position.set(p.x, alt, p.z); av.olharPara(e.rumo);
      }
      // a pose feminina quando parada em pé (passeando, olhando o telão); nas outras, o esqueleto manda
      const parada = !e.andando && !e.moto && e.sentado === 0 && e.danca === 0 && e.meditando === 0;
      av.poseVrm(parada ? poseParada : null);
      av.animar({ andando: e.andando, correndo: false, sentado: s.sentado, meditando: s.meditando, danca: s.danca, montado: m, dt: dtA, t });
    },
    dispose() {
      vivo = false; soltar(); av.dispose(); moto.dispose();
      raiz.removeFromParent();
    },
  };
}
