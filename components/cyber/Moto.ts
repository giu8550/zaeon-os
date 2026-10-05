/**
 * Moto — a MOTO VOADORA (hover bike): corpo aerodinâmico com carenagem e para-brisa, guidão e banco, dois PODS de
 * flutuação (frente/trás) com PROPULSORES pra baixo, 2 propulsores principais atrás e 2 de manobra no nariz (nada
 * de farol/lanterna — só bocal + chama), aletas laterais, frisos na cor da vaga. Frente = +z local (o mesmo rumo do voo da nave). Voando: INCLINA nas curvas (rola) e aponta o nariz com a
 * subida/descida; parada, flutua de leve. `assento` = onde o avatar senta (montado).
 */
import * as THREE from "three";
import { ESCALA_MOTO, MOTO } from "@/lib/cyber/motos";

export type MotoHandle = {
  group: THREE.Group;
  /** ponto do banco (o QUADRIL do avatar montado vai aqui) */
  assento: THREE.Object3D;
  /** onde as mãos e os pés do piloto encaixam (IK): punhos do guidão e pedaleiras — E = esquerda do piloto (+x) */
  pontos: { maoE: THREE.Object3D; maoD: THREE.Object3D; peE: THREE.Object3D; peD: THREE.Object3D };
  /** o que dá pra clicar (montar) */
  alvos: THREE.Object3D[];
  atualizar(o: { dt: number; t: number; voando: boolean; vel: number; curva: number; vy?: number }): void;
  dispose(): void;
};

export function criarMoto(o: { cor: string; low: boolean }): MotoHandle {
  const g = new THREE.Group(), corpo = new THREE.Group(); g.add(corpo);
  corpo.scale.setScalar(ESCALA_MOTO);   // proporção de moto de verdade pro avatar (~2 m): tudo (inclusive as âncoras) escala junto
  const acento = new THREE.Color(o.cor);
  const casco = new THREE.MeshStandardMaterial({ color: 0x141a2a, roughness: 0.32, metalness: 0.75, emissive: 0x070b18, emissiveIntensity: 0.6 });
  const cascoClaro = new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.3, metalness: 0.7, emissive: 0x0d1430, emissiveIntensity: 0.5 });
  const brilho = new THREE.MeshBasicMaterial({ color: acento, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
  const vidro = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, emissive: 0x2a6bd0, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const peca = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number, pai: THREE.Object3D = corpo) => { m.position.set(x, y, z); pai.add(m); return m; };
  const alvos: THREE.Object3D[] = [];

  // corpo (cápsula deitada ao longo de z) + carenagem dianteira em cunha + traseira afinando
  const tronco = peca(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.7, 6, o.low ? 10 : 16), casco), 0, 0.74, 0); tronco.rotation.x = Math.PI / 2; tronco.scale.set(1.15, 1, 0.78); alvos.push(tronco);
  const nariz = peca(new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.0, o.low ? 6 : 10), cascoClaro), 0, 0.8, 1.38); nariz.rotation.x = Math.PI / 2; nariz.scale.set(1.1, 0.6, 1); alvos.push(nariz);
  const rabo = peca(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.75, o.low ? 6 : 10), cascoClaro), 0, 0.86, -1.3); rabo.rotation.x = -Math.PI / 2; rabo.scale.set(1.1, 0.5, 1);
  // tanque/costas do carenado (onde o piloto "abraça" a moto)
  const tanque = peca(new THREE.Mesh(new THREE.SphereGeometry(0.26, o.low ? 10 : 16, 10), cascoClaro), 0, 0.96, 0.42); tanque.scale.set(1, 0.6, 1.5);
  // para-brisa
  const brisa = peca(new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.26), vidro), 0, 1.13, 0.86); brisa.rotation.x = -0.85;
  // banco + apoios dos pés
  peca(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.72), new THREE.MeshStandardMaterial({ color: 0x0a0d16, roughness: 0.85 })), 0, 1.0, -0.32);
  for (const s of [-1, 1]) peca(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.22), casco), s * 0.34, 0.5, 0.0);
  // guidão (barra + punhos) e a coluna
  peca(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), casco), 0, 1.16, 0.62).rotation.x = -0.4;
  const barra = peca(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.74, 8), casco), 0, 1.24, 0.6); barra.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) { const p = peca(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0x080a12, roughness: 0.9 })), s * 0.37, 1.24, 0.6); p.rotation.z = Math.PI / 2; }
  // frisos de luz na cor da vaga (laterais) + aletas traseiras
  for (const s of [-1, 1]) {
    const friso = peca(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 1.6), brilho), s * 0.25, 0.74, 0.05); friso.rotation.y = s * 0.03;
    const aleta = peca(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.42), cascoClaro), s * 0.22, 1.0, -1.18); aleta.rotation.set(-0.5, 0, s * 0.35);
    peca(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.32), brilho), s * 0.25, 1.08, -1.2).rotation.set(-0.5, 0, s * 0.35);
  }
  // PROPULSORES de verdade (sem "bola de luz"): bocal metálico + chama em camadas (casca na cor da vaga, miolo
  // branco) que cresce com a velocidade e tremula; parada, fica só a chama-piloto curtinha.
  const bocalMat = new THREE.MeshStandardMaterial({ color: 0x3a4258, roughness: 0.25, metalness: 0.95, emissive: 0x0a0e1a, emissiveIntensity: 0.4 });
  const chamaFora = new THREE.MeshBasicMaterial({ color: acento, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const chamaMiolo = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  type Prop = { chama: THREE.Group; tam: number; tipo: "principal" | "sustenta" | "manobra"; lado: number };
  const props: Prop[] = [];
  /** um propulsor em (x,y,z), apontando pra `dir` ("tras" = −z, "baixo" = −y, "lado" = ±x pra fora) */
  const propulsor = (x: number, y: number, z: number, raio: number, dir: "tras" | "baixo" | "lado", tam: number) => {
    const g2 = new THREE.Group(); g2.position.set(x, y, z); corpo.add(g2);
    // o +y local do grupo aponta pra saída
    if (dir === "tras") g2.rotation.x = -Math.PI / 2; else if (dir === "baixo") g2.rotation.x = Math.PI; else g2.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    const bocal = new THREE.Mesh(new THREE.CylinderGeometry(raio * 0.8, raio, raio * 1.4, o.low ? 10 : 16, 1, true), bocalMat); bocal.position.y = raio * 0.2; g2.add(bocal);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(raio * 0.92, raio * 0.12, 6, 20), bocalMat); aro.rotation.x = Math.PI / 2; aro.position.y = raio * 0.9; g2.add(aro);
    const garganta = new THREE.Mesh(new THREE.CircleGeometry(raio * 0.75, 16), new THREE.MeshBasicMaterial({ color: acento, transparent: true, opacity: 0.9 })); garganta.rotation.x = -Math.PI / 2; garganta.position.y = raio * 0.5; g2.add(garganta);
    const chama = new THREE.Group(); chama.position.y = raio * 0.9; g2.add(chama);
    const fora = new THREE.Mesh(new THREE.ConeGeometry(raio * 0.85, 1, 12, 1, true), chamaFora); fora.rotation.x = Math.PI; fora.position.y = 0.5; chama.add(fora);
    const miolo = new THREE.Mesh(new THREE.ConeGeometry(raio * 0.4, 0.6, 10, 1, true), chamaMiolo); miolo.rotation.x = Math.PI; miolo.position.y = 0.3; chama.add(miolo);
    props.push({ chama, tam, tipo: dir === "tras" ? "principal" : dir === "baixo" ? "sustenta" : "manobra", lado: Math.sign(x) });
  };
  // 2 propulsores principais na traseira + os de sustentação embaixo dos pods (frente/trás)
  for (const s of [-1, 1]) propulsor(s * 0.15, 0.86, -1.5, 0.11, "tras", 1.1);
  for (const z of [0.95, -0.9]) {
    const carc = peca(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.33, 0.12, o.low ? 12 : 24), casco), 0, 0.5, z); carc.scale.set(1, 1, 1.25); alvos.push(carc);
    for (const s of [-1, 1]) propulsor(s * 0.13, 0.44, z, 0.075, "baixo", 0.45);
  }
  // 2 propulsores de MANOBRA nas laterais do nariz (onde seria o farol): acendem na curva, do lado de fora
  for (const s of [-1, 1]) {
    peca(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.16), cascoClaro), s * 0.17, 0.8, 1.38);
    propulsor(s * 0.21, 0.8, 1.38, 0.04, "lado", 0.35);
  }
  // ancoragem do PILOTO (frente da moto = +z; a esquerda de quem pilota = +x): quadril no banco, mãos nos punhos,
  // pés nas pedaleiras — o avatar encaixa nesses pontos por IK (AvatarLuz `montado`)
  const ancora = (x: number, y: number, z: number) => { const a = new THREE.Object3D(); a.position.set(x, y, z); corpo.add(a); return a; };
  const assento = ancora(0, MOTO.banco / ESCALA_MOTO, -0.36);   // (dentro do corpo já escalado)
  const pontos = { maoE: ancora(0.37, 1.24, 0.6), maoD: ancora(-0.37, 1.24, 0.6), peE: ancora(0.34, 0.54, 0.16), peD: ancora(-0.34, 0.54, 0.16) };

  let rola = 0, nariz2 = 0;
  return {
    group: g, assento, pontos, alvos,
    atualizar({ dt, t, voando, vel, curva, vy = 0 }) {
      const k = Math.min(1, dt * 4);
      rola += (-curva * 0.55 * (voando ? 1 : 0) - rola) * k;
      nariz2 += ((voando ? Math.max(-0.25, Math.min(0.25, -vy * 0.02)) - vel * 0.08 : 0) - nariz2) * k;
      corpo.rotation.set(nariz2, 0, rola);
      corpo.position.y = ESCALA_MOTO * ( voando ? Math.sin(t * 3.1) * 0.03 : 0.05 + Math.sin(t * 1.7) * 0.04);   // parada: flutua de leve
      // chamas: principais crescem com a velocidade; as de sustentação, com o voo (pairar também empurra)
      props.forEach((p, i) => {
        const forca = p.tipo === "principal" ? (voando ? 0.25 + 0.75 * Math.min(1, vel) : 0.05)
          : p.tipo === "sustenta" ? (voando ? 0.7 + 0.3 * Math.min(1, Math.abs(vy) / 10) : 0.12)
          : (voando ? 0.12 + 0.9 * Math.max(0, -curva * p.lado) : 0.04);   // manobra: o lado de fora da curva empurra
        const tremor = 0.88 + 0.12 * Math.sin(t * 31 + i * 1.7) + 0.06 * Math.sin(t * 57 + i);
        p.chama.scale.set(1, Math.max(0.02, p.tam * forca * tremor), 1);
      });
      chamaFora.opacity = 0.45 + 0.2 * Math.sin(t * 23);
    },
    dispose() {
      g.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); const mt = m.material as THREE.Material | undefined; mt?.dispose?.(); });
      g.removeFromParent();
    },
  };
}
