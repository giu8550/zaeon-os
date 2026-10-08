/**
 * PersonagemVivo — um personagem (a Nina…) VIVENDO na cidadela Zaeon: o corpo VRM próprio (lib/cyber/estiloAvatar
 * CORPOS_VRM, com o traço de anime, os acessórios e a pose feminina) seguindo a AGENDA de lib/cyber/vidaPersonagem —
 * que é uma função do relógio: todo cliente a vê no mesmo lugar, fazendo a mesma coisa, sem rede.
 * Anima com as MESMAS poses dos jogadores (AvatarLuz): andar, digitar na estação (`sentado`), dançar, meditar e
 * pilotar a moto (com a IK das mãos e dos pés nos pontos da moto). A pose feminina vale quando ela está parada em pé.
 * Leve: o VRM só baixa depois que a cena montou; longe da câmera, anima menos vezes; escondido, nem anima.
 */
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMUtils, type VRM } from "@pixiv/three-vrm";
import { criarAvatarLuz, type AvatarLuzHandle, type Montado } from "./AvatarLuz";
import { carregarVrm, tingirVrm } from "./AvatarVrm";
import { vestirAcessorios, type AcessoriosHandle } from "./AcessoriosVrm";
import { criarMoto, type MotoHandle } from "./Moto";
import { mundo } from "@/lib/cyber/ceu";
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
  atualizar(dt: number, t: number, agora: number, ilhaY: number, cam: THREE.Vector3): void;
  mostrar(on: boolean): void;
  dispose(): void;
};

const DIST_ANIMA_SEMPRE = 70, DIST_ESCONDE = 650;

export function criarPersonagemVivo(o: { id: string; nome: string; cor: string; corMoto: string; corpo: CorpoVrm; perfil: PerfilVida; starTex: THREE.Texture; low: boolean; gltf: GLTF; cena: THREE.Scene }): PersonagemVivoHandle {
  const raiz = new THREE.Group(); raiz.name = `personagem-${o.id}`; o.cena.add(raiz);
  const av: AvatarLuzHandle = criarAvatarLuz(o.cor, o.starTex, o.low, o.gltf, { anime: true });
  av.semMochila(); av.esperarCorpo(true); raiz.add(av.group);
  const poseParada = o.corpo.pose ? POSES_VRM[o.corpo.pose] : null;
  let vrm: VRM | null = null, acessorios: AcessoriosHandle | null = null, vivo = true;
  carregarVrm(o.corpo.url).then((v) => {
    if (!vivo) { VRMUtils.deepDispose(v.scene); return; }
    tingirVrm(v, o.corpo.tintas); av.usarVrm(v); vrm = v;
    if (o.corpo.acessorios?.length) acessorios = vestirAcessorios(v, o.corpo.acessorios);
  }).catch((e) => { console.warn(`[cyber] corpo de ${o.nome} (VRM) não carregou:`, e); av.esperarCorpo(false); });

  // a moto dele (na cor do card): estacionada na vaga dele, ao lado do lote da Zaeon, quando não está voando
  const moto: MotoHandle = criarMoto({ cor: o.corMoto, low: o.low }); raiz.add(moto.group);

  const pos = new THREE.Vector3(), w = new THREE.Vector3();
  let alt = 0, cache: Bloco | null = null, estado: Estado | null = null, mostrado = true, pulo = 0;
  // as flags suaves (a pose não troca seca entre andar, digitar, dançar…)
  const s = { sentado: 0, danca: 0, meditando: 0 };
  const montado: Montado = { w: 1, maoE: new THREE.Vector3(), maoD: new THREE.Vector3(), peE: new THREE.Vector3(), peD: new THREE.Vector3() };
  const vagaW = mundo(o.perfil.vaga);

  return {
    id: o.id, nome: o.nome, cor: o.cor, group: raiz,
    get pos() { return pos; }, get alt() { return alt; }, get estado() { return estado; },
    mostrar(on) { mostrado = on; raiz.visible = on; },
    atualizar(dt, t, agora, ilhaY, cam) {
      if (!mostrado) return;
      const e = estadoEm(agora, o.perfil, cache); cache = e.bloco; estado = e;
      const p = mundo(e.pos); pos.set(p.x, 0, p.z);
      const dist = Math.hypot(cam.x - p.x, cam.z - p.z);
      raiz.visible = dist < DIST_ESCONDE; if (!raiz.visible) return;
      // longe, anima a cada 3 quadros (acumulando o dt)
      pulo += dt; if (dist > DIST_ANIMA_SEMPRE && (pulo < 0.05)) return;
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
      vivo = false; acessorios?.dispose(); av.dispose(); moto.dispose();
      if (vrm) VRMUtils.deepDispose(vrm.scene);
      raiz.removeFromParent();
    },
  };
}
