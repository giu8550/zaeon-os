/**
 * EscadaPiramide — as ESCADAS DE PEDRA da Zaeon (out/2026, no lugar dos fios de energia; pedido do dono: "uma escada
 * assim" — a de El Castillo, Chichén Itzá). Cada sala tem a sua: reta e íngreme, da borda da central até a porta, com
 * os DEGRAUS de pedra, as BALAUSTRADAS (as alfardas) dos dois lados, as CABEÇAS DE SERPENTE no pé (Kukulcán) e, por
 * baixo, uma massa maciça em forma de MURALHA. A SALA DO SABER (a biblioteca) fica no TOPO DE UMA PIRÂMIDE de 9
 * terraços — a sala é o templo lá em cima. Pedido do dono: a pirâmide e a muralha na cor das PLATAFORMAS (lisas, sem
 * detalhes); só a ESCADA tem cor própria — a de destaque da sala dela.
 *
 * O piso é a rampa da linha dos degraus (lib/cyber/ceu `alturaDaEscada`); a colisão é das balaustradas (`colisoresDaCidade`).
 * Tudo no referencial da ILHA (o grupo vai dentro dela, que flutua).
 */
import * as THREE from "three";
import { ALTURA_LOUNGE, CIDADE, DEGRAU, ESCADAS, type NomeSala } from "@/lib/cyber/ceu";

/** a pirâmide da Sala do Saber: 9 terraços, a meia-largura da base e a do topo (o disco da sala tem r 40), o recuo de
 *  cada terraço (o talude) e a raiz invertida que flutua embaixo */
export const PIRAMIDE = { terracos: 9, baseMeia: 107, topoMeia: 49, talude: 3, raiz: 30 } as const;
/** a balaustrada: a largura e quanto sobe acima da linha dos degraus */
const ALFARDA = { larg: 1.2, acima: 1.1, abaixo: 0.6 } as const;

/** a CABEÇA DE SERPENTE de pedra (o pé da balaustrada): a cabeça, as mandíbulas abertas, as presas, o penacho e os
 *  olhos acesos. Montada olhando pro +x (o grupo é girado pra fora da escada) */
function cabecaDeSerpente(pedra: THREE.Material, olho: THREE.Material, escuro: THREE.Material): THREE.Group {
  const g = new THREE.Group(), m = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const k = new THREE.Mesh(geo, mat); k.position.set(x, y, z); g.add(k); return k; };
  m(new THREE.BoxGeometry(2.4, 1.3, 1.5), pedra, 0, 0.95, 0);                              // o crânio
  m(new THREE.BoxGeometry(1.9, 0.42, 1.4), pedra, 1.35, 1.25, 0).rotation.z = 0.32;         // a mandíbula de cima (aberta)
  m(new THREE.BoxGeometry(1.9, 0.36, 1.3), pedra, 1.3, 0.35, 0).rotation.z = -0.22;         // a de baixo
  m(new THREE.BoxGeometry(1.5, 0.5, 1.1), escuro, 1.2, 0.8, 0);                             // a boca (o escuro dentro)
  for (const z of [-0.45, 0.45]) {
    m(new THREE.ConeGeometry(0.11, 0.5, 6), pedra, 2.05, 0.95, z).rotation.z = Math.PI;     // as presas
    m(new THREE.SphereGeometry(0.16, 10, 8), olho, 0.55, 1.42, z * 1.55);                    // os olhos
  }
  const penacho = m(new THREE.ConeGeometry(0.75, 1.6, 4), pedra, -0.7, 2.1, 0); penacho.rotation.set(0, Math.PI / 4, 0.5);   // o penacho
  return g;
}

export function criarEscadasDePedra(o: { low: boolean; cores: Record<NomeSala, number> }): { group: THREE.Group; alvos: THREE.Object3D[] } {
  const group = new THREE.Group(); group.name = "escadas-de-pedra";
  const alvos: THREE.Object3D[] = [], H = ALTURA_LOUNGE;
  // a PLATAFORMA (a pirâmide e a muralha sob a escada): o mesmo material da laje das salas (components/cyber/Cidade)
  const plataforma = new THREE.MeshStandardMaterial({ color: 0x0a2440, emissive: 0xbfe8ff, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.25 });
  // a ESCADA (degraus, balaustradas, cabeças de serpente): a cor de destaque da sala
  const corDaEscada = (cor: number) => new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0.2 });
  const olho = new THREE.MeshBasicMaterial({ color: 0xffffff }), boca = new THREE.MeshStandardMaterial({ color: 0x050a14, roughness: 0.9 });

  for (const nome of Object.keys(ESCADAS) as NomeSala[]) {
    const e = ESCADAS[nome], escada = corDaEscada(o.cores[nome]), g = new THREE.Group(); g.rotation.y = Math.PI - CIDADE.salas[nome].ang; group.add(g);   // −x local → o rumo da sala
    const larg = e.meia * 2, ang = Math.atan2(H, e.len), comp = Math.hypot(e.len, H);
    // 1) a MURALHA: o corpo maciço sob a escada (o triângulo do pé ao topo, descendo até o nível da central)
    const perfil = new THREE.Shape();
    perfil.moveTo(-e.ini + 0.4, -0.05); perfil.lineTo(-(e.ini + e.len), H - 0.35); perfil.lineTo(-(e.ini + e.len), -0.05); perfil.closePath();
    const corpoGeo = new THREE.ExtrudeGeometry(perfil, { depth: larg + ALFARDA.larg * 2, bevelEnabled: false });
    corpoGeo.translate(0, 0, -(larg / 2 + ALFARDA.larg));
    const corpo = new THREE.Mesh(corpoGeo, plataforma); g.add(corpo); alvos.push(corpo);
    // 2) os DEGRAUS (instanciados): a rampa (o piso) cruza o meio de cada um — o pé fica a ±½ degrau
    const n = Math.round(H / DEGRAU), passo = e.len / n;
    const degraus = new THREE.InstancedMesh(new THREE.BoxGeometry(passo + 0.02, DEGRAU * 1.6, larg), escada, n);
    const m4 = new THREE.Matrix4();
    for (let k = 0; k < n; k++) { const u = (k + 0.5) * passo, topo = (k + 0.5) * (H / n); m4.makeTranslation(-(e.ini + u), topo - DEGRAU * 0.8, 0); degraus.setMatrixAt(k, m4); }
    degraus.instanceMatrix.needsUpdate = true; g.add(degraus); alvos.push(degraus);
    // 3) as BALAUSTRADAS (as alfardas) dos dois lados, inclinadas com a escada — o topo a `acima` m da linha dos degraus
    for (const s of [-1, 1]) {
      const alt = ALFARDA.acima + ALFARDA.abaixo, b = new THREE.Mesh(new THREE.BoxGeometry(comp + 1.2, alt, ALFARDA.larg), escada);
      b.rotation.z = -ang; b.position.set(-(e.ini + e.len / 2), H / 2 + ALFARDA.acima - alt / (2 * Math.cos(ang)), s * (e.meia + ALFARDA.larg / 2));
      g.add(b);
      // 4) a CABEÇA DE SERPENTE no pé da balaustrada, olhando pra quem chega (o +x local = pra central)
      const cab = cabecaDeSerpente(escada, olho, boca); cab.position.set(-e.ini + 1.6, 0, s * (e.meia + ALFARDA.larg / 2)); g.add(cab);
    }
  }

  // 5) a PIRÂMIDE da Sala do Saber: 9 terraços lisos (troncos de base quadrada, com o talude) e a RAIZ invertida embaixo
  //    (ela flutua no hiperespaço, como as salas). A escada encosta na face da frente
  {
    const L = CIDADE.salas.biblioteca, P = PIRAMIDE, gP = new THREE.Group();
    gP.position.set(L.x, 0, L.z); gP.rotation.y = Math.PI - L.ang + Math.PI / 4; group.add(gP);   // (o +π/4: o tronco de 4 lados tem as faces nas diagonais)
    const th = (H - 0.3) / P.terracos, passoMeia = (P.baseMeia - P.topoMeia) / (P.terracos - 1), R2 = Math.SQRT2;
    for (let k = 0; k < P.terracos; k++) {
      const hb = P.baseMeia - k * passoMeia, t = new THREE.Mesh(new THREE.CylinderGeometry((hb - P.talude) * R2, hb * R2, th, 4, 1), plataforma);
      t.position.y = k * th + th / 2; gP.add(t); alvos.push(t);
    }
    const raiz = new THREE.Mesh(new THREE.CylinderGeometry(P.baseMeia * R2, 18 * R2, P.raiz, 4, 1), plataforma); raiz.position.y = -P.raiz / 2; gP.add(raiz);
  }
  return { group, alvos };
}
