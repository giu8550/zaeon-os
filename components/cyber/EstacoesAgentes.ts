/**
 * EstacoesAgentes — as ESTAÇÕES DE TRABALHO dos agentes, em anel em volta do pátio central da capela (lib/cyber/coracao
 * `estacoesLocais`), viradas pro coração. No idioma da estação de estudo da praça (components/cyber/BaseEstudo:
 * plataforma redonda com aro de luz, estrado em degraus, telas "tecnológicas", painel holográfico na altura das mãos,
 * cristal no topo), só que MAIS ROBUSTAS e com MAIS TELAS: um paredão de 3 telas grandes em arco, 2 telas altas, 2
 * monitores verticais nas asas, 2 torres de servidor com luzes correndo e um console curvo. Ainda sem ninguém: é aqui
 * que os agentes vão trabalhar.
 *
 * Leve: cada TIPO de peça é UM InstancedMesh pras 8 estações (≈ 15 chamadas de desenho no total); as telas rolam por
 * deslocamento de textura (compartilhada) e brilham no compasso do coração.
 * Local de cada estação: +z = a frente das telas (rumo ao coração); o operador fica em (0, +0.3).
 */
import * as THREE from "three";
import { ESTACOES, estacoesLocais } from "@/lib/cyber/coracao";

export type EstacoesHandle = { group: THREE.Group; atualizar(dt: number, t: number, batida: number): void; dispose(): void };

type Peca = { x: number; y: number; z: number; rx?: number; ry?: number; s?: [number, number, number] };

/** a "tela de agente" (canvas): painel de status, gráficos, código e uma onda — `codigo` troca o layout */
function texTela(codigo: boolean): THREE.CanvasTexture {
  const W = 256, H = 160, c = document.createElement("canvas"); c.width = W; c.height = H * 2; const g = c.getContext("2d")!;
  for (const y0 of [0, H]) {   // 2 alturas iguais: rolar em v (offset) não tem emenda
    g.fillStyle = "#04121f"; g.fillRect(0, y0, W, H);
    g.fillStyle = "#66e6ff"; g.fillRect(8, y0 + 8, W - 16, 4);
    if (codigo) {
      for (let i = 0; i < 12; i++) { g.fillStyle = i % 4 === 0 ? "rgba(185,140,255,.85)" : "rgba(143,232,255,.7)"; g.fillRect(14 + (i % 3) * 10, y0 + 22 + i * 11, 40 + ((i * 53) % 150), 4); }
    } else {
      g.strokeStyle = "rgba(143,232,255,.85)"; g.lineWidth = 2; g.beginPath();
      for (let x = 0; x <= 150; x += 4) g.lineTo(12 + x, y0 + 70 - 22 * Math.sin(x * 0.09) * Math.exp(-((x - 75) ** 2) / 2600)); g.stroke();
      for (let i = 0; i < 7; i++) { g.fillStyle = "rgba(102,230,255,.75)"; const h = 12 + ((i * 37) % 40); g.fillRect(176 + i * 10, y0 + 110 - h, 6, h); }
      for (let i = 0; i < 4; i++) { g.fillStyle = "rgba(143,232,255,.55)"; g.fillRect(12, y0 + 100 + i * 12, 60 + ((i * 41) % 80), 4); }
      g.strokeStyle = "rgba(154,255,208,.8)"; g.beginPath(); g.arc(205, y0 + 48, 22, -Math.PI / 2, Math.PI * 0.9); g.stroke();
    }
    g.strokeStyle = "#9fe8ff"; g.lineWidth = 2; g.strokeRect(2, y0 + 2, W - 4, H - 4);
  }
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 0.5); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** a fita de luzes de um servidor (pontinhos que correm) */
function texServidor(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 16; c.height = 128; const g = c.getContext("2d")!;
  g.fillStyle = "#020812"; g.fillRect(0, 0, 16, 128);
  for (let i = 0; i < 16; i++) { g.fillStyle = ["#66e6ff", "#9affd0", "#b98cff", "#66e6ff"][i % 4]!; g.globalAlpha = 0.3 + ((i * 7) % 10) / 14; g.fillRect(4, i * 8 + 2, 8, 3); }
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; return t;
}

export function criarEstacoes(o: { low: boolean }): EstacoesHandle {
  const group = new THREE.Group(), es = estacoesLocais(), N = es.length;
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texs: THREE.Texture[] = [];
  const casco = new THREE.MeshStandardMaterial({ color: 0x0e1a33, roughness: 0.4, metalness: 0.55, emissive: 0x0b1a3c, emissiveIntensity: 0.55 }); mats.push(casco);
  const acento = new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); mats.push(acento);
  const texA = texTela(false), texB = texTela(true), texS = texServidor(); texs.push(texA, texB, texS);
  const telaA = new THREE.MeshBasicMaterial({ map: texA, transparent: true, opacity: 0.95, side: THREE.DoubleSide }), telaB = new THREE.MeshBasicMaterial({ map: texB, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
  const brilho = new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const luzes = new THREE.MeshBasicMaterial({ map: texS, transparent: true, opacity: 0.95 });
  const cristal = new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x66e6ff, emissiveIntensity: 1.2, roughness: 0.2, flatShading: true });
  const painel = new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  mats.push(telaA, telaB, brilho, luzes, cristal, painel);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), QE = new THREE.Quaternion();
  /** um tipo de peça repetido em todas as estações (e `pecas` vezes em cada uma) */
  const tipo = (geo: THREE.BufferGeometry, mat: THREE.Material, pecas: Peca[]) => {
    geos.push(geo);
    const im = new THREE.InstancedMesh(geo, mat, N * pecas.length); let k = 0;
    for (const e of es) {
      QE.setFromAxisAngle(up, e.rot);
      for (const p of pecas) {
        E.set(p.rx ?? 0, p.ry ?? 0, 0, "YXZ"); Q.setFromEuler(E).premultiply(QE);
        V.set(p.x, p.y, p.z).applyQuaternion(QE).add(new THREE.Vector3(e.x, 0, e.z));
        S.set(...(p.s ?? [1, 1, 1])); im.setMatrixAt(k++, M.compose(V, Q, S));
      }
    }
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); group.add(im); return im;
  };
  const R = ESTACOES.platR;
  // plataforma + aro de luz + estrado em degraus
  tipo(new THREE.CylinderGeometry(R, R + 0.2, 0.24, o.low ? 24 : 48), casco, [{ x: 0, y: 0.12, z: 0 }]);
  tipo(new THREE.TorusGeometry(R + 0.05, 0.06, 6, o.low ? 48 : 96), acento, [{ x: 0, y: 0.26, z: 0, rx: Math.PI / 2 }]);
  tipo(new THREE.BoxGeometry(1, 1, 1), casco, [
    { x: 0, y: 0.38, z: -2.1, s: [7.4, 0.28, 1.7] }, { x: 0, y: 0.6, z: -2.35, s: [6.2, 0.2, 1.1] },   // estrado
    { x: 0, y: 2.75, z: -2.75, s: [3.8, 4.5, 0.32] },                                                    // paredão central
    { x: -2.95, y: 2.55, z: -2.35, ry: 0.5, s: [2.6, 4.1, 0.3] }, { x: 2.95, y: 2.55, z: -2.35, ry: -0.5, s: [2.6, 4.1, 0.3] },   // paredões laterais (o arco)
    { x: -3.95, y: 1.9, z: -2.3, s: [0.95, 3.6, 0.95] }, { x: 3.95, y: 1.9, z: -2.3, s: [0.95, 3.6, 0.95] },   // torres de servidor
    { x: 0, y: 1.0, z: -0.95, rx: -0.32, s: [2.8, 0.12, 0.85] },                                        // tampo do console
    { x: 0, y: 0.55, z: -1.05, s: [1.6, 0.8, 0.5] },                                                    // pé do console
    { x: 0, y: 5.15, z: -2.75, s: [4.4, 0.3, 0.5] },                                                    // coroamento
  ]);
  // TELAS: 3 grandes em arco (A), 2 altas (B), 2 verticais nas asas (B)
  const telasGrandes: Peca[] = [{ x: 0, y: 2.7, z: -2.56, rx: 0.08, s: [3.3, 1.9, 1] }, { x: -2.85, y: 2.55, z: -2.17, ry: 0.5, rx: 0.06, s: [2.2, 1.6, 1] }, { x: 2.85, y: 2.55, z: -2.17, ry: -0.5, rx: 0.06, s: [2.2, 1.6, 1] }];
  const telasAltas: Peca[] = [{ x: -1.0, y: 4.35, z: -2.55, rx: 0.28, s: [1.7, 0.85, 1] }, { x: 1.0, y: 4.35, z: -2.55, rx: 0.28, s: [1.7, 0.85, 1] }];
  const telasAsas: Peca[] = [{ x: -4.2, y: 2.2, z: -1.1, ry: 1.05, s: [0.9, 1.9, 1] }, { x: 4.2, y: 2.2, z: -1.1, ry: -1.05, s: [0.9, 1.9, 1] }];
  const plano = new THREE.PlaneGeometry(1, 1);
  tipo(plano, telaA, telasGrandes);
  tipo(plano, telaB, [...telasAltas, ...telasAsas]);
  tipo(plano, brilho, [...telasGrandes, ...telasAltas, ...telasAsas].map((p) => ({ ...p, z: p.z - 0.05, s: [(p.s?.[0] ?? 1) * 1.15, (p.s?.[1] ?? 1) * 1.15, 1] as [number, number, number] })));
  tipo(new THREE.BoxGeometry(1, 1, 1), casco, telasAsas.map((p) => ({ ...p, z: p.z - 0.1, s: [(p.s?.[0] ?? 1) + 0.15, (p.s?.[1] ?? 1) + 0.15, 0.1] as [number, number, number] })));   // moldura das verticais
  // luzes dos servidores (nas 2 faces de cada torre que dão pra frente e pro lado de dentro)
  tipo(plano, luzes, [{ x: -3.95, y: 1.9, z: -1.81, s: [0.5, 3.2, 1] }, { x: 3.95, y: 1.9, z: -1.81, s: [0.5, 3.2, 1] }]);
  // console holográfico (as "teclas" de luz) + cristal no topo
  tipo(plano, painel, [{ x: 0, y: 1.08, z: -0.92, rx: -0.32 - Math.PI / 2, s: [2.5, 0.75, 1] }]);
  const cristais = tipo(new THREE.OctahedronGeometry(0.45, 0), cristal, [{ x: 0, y: 5.85, z: -2.75, s: [1, 1.7, 1] }]);

  return {
    group,
    atualizar(dt, t, batida) {
      texA.offset.y = (texA.offset.y + dt * 0.035) % 1; texB.offset.y = (texB.offset.y + dt * 0.06) % 1; texS.offset.y = (texS.offset.y - dt * 0.25) % 1;
      brilho.opacity = 0.1 + 0.16 * batida; acento.opacity = 0.45 + 0.4 * batida; painel.opacity = 0.14 + 0.12 * batida;
      cristal.emissiveIntensity = 1.0 + 0.9 * batida; cristais.rotation.y = 0; void t;
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose(); group.removeFromParent(); },
  };
}
