/**
 * Moto — a MOTO VOADORA (hover bike). Três CARENAGENS (uma por vaga, `estilo`), todas com o mesmo "esqueleto" (banco,
 * guidão, pedaleiras e propulsores nos mesmos lugares — o avatar encaixa igual em qualquer uma):
 *  - 0 RAIO (esportiva): bico afiado, rabeta alta, carenagens laterais em cunha, para-brisa alto;
 *  - 1 TUBARÃO (robusta): corpo largo, duas tomadas de ar no nariz, barbatana dorsal, guelras de luz;
 *  - 2 GOTA (arredondada): corpo em gota torneada, anéis de luz na cintura e no rabo.
 * Pintura na cor da vaga (clara, metálica — não mais "bloco preto"), detalhes escuros, frisos de luz.
 * PROPULSORES com CHAMA de verdade (shader): núcleo branco-amarelo no bocal, corpo na cor da moto, ponta alaranjada,
 * tremulando com ruído; no BOOST esticam, puxam pro azul-branco e mostram os "diamantes de choque".
 * SETAS âmbar nos 4 cantos: piscam do lado da curva (o engine manda qual lado está aceso). Nada de farol/lanterna fixa.
 * Frente = +z local (o mesmo rumo do voo). Voando: INCLINA nas curvas e aponta o nariz com a subida/descida; parada,
 * flutua de leve. `assento` = onde o avatar senta (montado).
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
  /** `inclina` (rad, a da pilotagem — lib/cyber/motoFisica) manda na rolagem; sem ela, sai do giro (`curva`, motos dos
   *  outros). `boost` (0..1) estica as chamas; `seta` = o pisca ACESO agora (−1 esquerda, 1 direita, 0 apagado) */
  atualizar(o: { dt: number; t: number; voando: boolean; vel: number; curva: number; vy?: number; inclina?: number; boost?: number; seta?: number }): void;
  dispose(): void;
};

export const ESTILOS_MOTO = ["raio", "tubarao", "gota"] as const;

/** a CHAMA (aditiva, sem textura): `nucleo` = o miolo branco curto; uT/uBoost compartilhados pela moto toda */
function materialChama(cor: THREE.Color, nucleo: boolean, u: { uT: { value: number }; uBoost: { value: number } }) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: u.uT, uBoost: u.uBoost, uCor: { value: cor }, uNucleo: { value: nucleo ? 1 : 0 } },
    vertexShader: `
      uniform float uT; varying vec2 vUv; varying float vFrente;
      void main() {
        vUv = uv; vec3 p = position;
        // tremula: a chama "respira" de lado, mais na ponta
        float tremor = 1.0 + 0.14 * sin(uT * 41.0 + p.y * 13.0) * uv.y + 0.06 * sin(uT * 67.0 + p.y * 29.0);
        p.xz *= tremor;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vFrente = pow(abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))), 1.4);   // borda some macia
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uT, uBoost, uNucleo; uniform vec3 uCor; varying vec2 vUv; varying float vFrente;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float y = vUv.y;   // 0 = bocal, 1 = ponta
        float n = ruido(vec2(vUv.x * 7.0, y * 5.0 - uT * 11.0)) * 0.6 + ruido(vec2(vUv.x * 15.0, y * 11.0 - uT * 19.0)) * 0.4;
        float corpo = pow(1.0 - y, 1.6) * (0.55 + 0.75 * n) * vFrente;
        vec3 cor = mix(uCor, vec3(0.65, 0.85, 1.0), uBoost * 0.6);
        vec3 quente = mix(vec3(1.0, 0.98, 0.88), vec3(1.0, 0.78, 0.35), smoothstep(0.0, 0.3, y));
        vec3 c = mix(quente, cor, smoothstep(0.12, 0.55, y));
        c = mix(c, vec3(1.0, 0.42, 0.12), smoothstep(0.55, 1.0, y) * 0.55 * (1.0 - uBoost));   // ponta alaranjada
        if (uNucleo > 0.5) { c = mix(vec3(1.0), vec3(0.8, 0.93, 1.0), y); corpo *= 1.4 * (1.0 - smoothstep(0.0, 0.55, y)); }
        // boost: DIAMANTES DE CHOQUE (anéis brilhantes correndo pela chama)
        corpo += uBoost * smoothstep(0.82, 1.0, sin(y * 26.0 - uT * 34.0)) * (1.0 - y) * 0.9 * vFrente;
        corpo *= mix(0.62, 0.42, uBoost);   // aditiva e em camadas: sem isso, satura em branco
        gl_FragColor = vec4(c * corpo, corpo);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

export function criarMoto(o: { cor: string; low: boolean; estilo?: number }): MotoHandle {
  const g = new THREE.Group(), corpo = new THREE.Group(); g.add(corpo);
  corpo.scale.setScalar(ESCALA_MOTO);   // proporção de moto de verdade pro avatar (~2 m): tudo (inclusive as âncoras) escala junto
  const estilo = ESTILOS_MOTO[(((o.estilo ?? 0) % 3) + 3) % 3]!;
  const acento = new THREE.Color(o.cor), seg = o.low ? 8 : 16;
  // PINTURA na cor da vaga (clara e metálica), detalhes escuros, cromado dos bocais, frisos de luz, vidro, banco
  const pintura = new THREE.MeshStandardMaterial({ color: acento.clone().lerp(new THREE.Color(0xffffff), 0.3), roughness: 0.26, metalness: 0.55, emissive: acento, emissiveIntensity: 0.16 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x1c2436, roughness: 0.38, metalness: 0.7, emissive: 0x0a1020, emissiveIntensity: 0.6 });
  const cromado = new THREE.MeshStandardMaterial({ color: 0x9aa4ba, roughness: 0.16, metalness: 0.95, emissive: 0x141a28, emissiveIntensity: 0.4 });
  const brilho = new THREE.MeshBasicMaterial({ color: acento, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
  const vidro = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, emissive: 0x2a6bd0, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const couro = new THREE.MeshStandardMaterial({ color: 0x10131c, roughness: 0.85, metalness: 0.1 });
  const peca = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number, pai: THREE.Object3D = corpo) => { m.position.set(x, y, z); pai.add(m); return m; };
  const alvos: THREE.Object3D[] = [];

  /** um PERFIL lateral (pontos [z, y], curva suave) extrudado na largura (x), centrado em `x` */
  const perfil = (pts: [number, number][], largura: number, mat: THREE.Material, x = 0, chanfro = 0.05) => {
    const s = new THREE.Shape(); s.moveTo(pts[0]![0], pts[0]![1]); s.splineThru(pts.slice(1).map(([a, b]) => new THREE.Vector2(a, b))); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.005, largura - 2 * chanfro), bevelEnabled: chanfro > 0, bevelThickness: chanfro, bevelSize: chanfro, bevelSegments: o.low ? 1 : 3, curveSegments: o.low ? 10 : 20 });
    geo.translate(0, 0, -(largura - 2 * chanfro) / 2); geo.rotateY(-Math.PI / 2);   // shape x → +z (frente), extrusão → x
    return peca(new THREE.Mesh(geo, mat), x, 0, 0);
  };
  /** os dois lados (x e −x) */
  const par = (f: (s: number) => THREE.Object3D) => [f(1), f(-1)];

  // ───────────── CARENAGEM ─────────────
  if (estilo === "raio") {
    alvos.push(perfil([[1.72, 0.8], [1.35, 0.97], [0.95, 1.1], [0.45, 1.15], [0.12, 1.04], [-0.55, 1.02], [-1.1, 1.16], [-1.58, 1.12], [-1.64, 0.95], [-1.2, 0.78], [-0.4, 0.66], [0.5, 0.62], [1.3, 0.66]], 0.38, pintura, 0, 0.07));
    par((s) => perfil([[1.38, 0.9], [0.9, 0.98], [0.25, 0.82], [-0.35, 0.56], [0.4, 0.5], [1.2, 0.6]], 0.06, escuro, s * 0.2, 0.02));   // carenagens laterais em cunha
    par((s) => perfil([[1.6, 0.86], [0.95, 1.05], [0.42, 1.11], [0.42, 1.08], [0.95, 1.01], [1.6, 0.83]], 0.012, brilho, s * 0.19, 0));   // frisos
    par((s) => perfil([[-0.6, 1.0], [-1.15, 1.13], [-1.55, 1.1], [-1.55, 1.07], [-1.15, 1.1], [-0.6, 0.97]], 0.012, brilho, s * 0.17, 0));
    perfil([[1.02, 1.07], [0.8, 1.38], [0.64, 1.4], [0.8, 1.1]], 0.34, vidro, 0, 0.01);   // para-brisa alto
  } else if (estilo === "tubarao") {
    alvos.push(perfil([[1.62, 0.74], [1.55, 1.0], [1.08, 1.13], [0.4, 1.13], [0.06, 1.04], [-0.6, 1.04], [-1.35, 1.09], [-1.62, 0.98], [-1.58, 0.7], [-0.6, 0.6], [0.6, 0.6], [1.42, 0.62]], 0.54, pintura, 0, 0.09));
    perfil([[-0.72, 1.03], [-1.22, 1.46], [-1.45, 1.43], [-1.22, 1.06]], 0.05, pintura, 0, 0.015);   // barbatana dorsal
    for (const s of [-1, 1]) {   // tomadas de ar no nariz
      const tomada = peca(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.32, seg, 1, true), escuro), s * 0.15, 0.84, 1.52); tomada.rotation.x = Math.PI / 2;
      const aro = peca(new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.018, 6, seg * 2), brilho), s * 0.15, 0.84, 1.68); aro.rotation.y = 0;
      for (let k = 0; k < 3; k++) peca(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.035, 0.14), brilho), s * 0.27, 0.88, 0.78 - k * 0.17).rotation.x = -0.5;   // guelras de luz
    }
    par((s) => perfil([[1.3, 0.66], [0.6, 0.64], [-0.7, 0.66], [-0.7, 0.7], [0.6, 0.69], [1.3, 0.7]], 0.04, escuro, s * 0.28, 0.01));   // saia lateral
    perfil([[1.12, 1.1], [0.95, 1.27], [0.8, 1.28], [0.92, 1.12]], 0.4, vidro, 0, 0.01);   // para-brisa baixo
  } else {
    // GOTA: corpo torneado (lathe) deitado ao longo de z
    const raio: [number, number][] = [[0.001, 1.64], [0.17, 1.52], [0.29, 1.22], [0.34, 0.72], [0.33, 0.1], [0.3, -0.6], [0.24, -1.2], [0.12, -1.5], [0.001, -1.6]];
    const geo = new THREE.LatheGeometry(raio.map(([r, y]) => new THREE.Vector2(r, y)), o.low ? 12 : 24); geo.rotateX(Math.PI / 2);
    const gota = peca(new THREE.Mesh(geo, pintura), 0, 0.86, 0); gota.scale.set(1.05, 0.82, 1); alvos.push(gota);
    // anéis de luz na cintura e no rabo
    const anel = peca(new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.018, 6, seg * 2), brilho), 0, 0.86, -0.2); anel.scale.set(1.05, 0.82, 1);
    const anel2 = peca(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.015, 6, seg * 2), brilho), 0, 0.86, -1.1); anel2.scale.set(1.05, 0.82, 1);
    perfil([[1.08, 1.06], [0.95, 1.22], [0.82, 1.22], [0.92, 1.07]], 0.3, vidro, 0, 0.01);
  }
  // BANCO (o mesmo nas três: o quadril encaixa igual)
  perfil([[0.24, 1.05], [0.04, 1.13], [-0.72, 1.12], [-0.95, 1.2], [-1.06, 1.12], [-0.78, 1.03], [0.18, 0.99]], 0.32, couro, 0, 0.04);
  // apoios dos pés + guidão (coluna, barra e punhos)
  for (const s of [-1, 1]) peca(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.22), escuro), s * 0.34, 0.5, 0.0);
  peca(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), cromado), 0, 1.16, 0.62).rotation.x = -0.4;
  const barra = peca(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.74, 8), cromado), 0, 1.24, 0.6); barra.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) { const p = peca(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), couro), s * 0.37, 1.24, 0.6); p.rotation.z = Math.PI / 2; }

  // ───────────── PROPULSORES com CHAMA ─────────────
  const u = { uT: { value: 0 }, uBoost: { value: 0 } };
  const chamaMat = materialChama(acento, false, u), nucleoMat = materialChama(acento, true, u);
  const garganta = new THREE.MeshBasicMaterial({ color: acento.clone().lerp(new THREE.Color(0xffffff), 0.5) });
  type Prop = { chama: THREE.Group; tam: number; tipo: "principal" | "sustenta" | "manobra"; lado: number };
  const props: Prop[] = [];
  /** um propulsor em (x,y,z), apontando pra `dir` ("tras" = −z, "baixo" = −y, "lado" = ±x pra fora) */
  const propulsor = (x: number, y: number, z: number, r: number, dir: "tras" | "baixo" | "lado", tam: number) => {
    const g2 = new THREE.Group(); g2.position.set(x, y, z); corpo.add(g2);
    // o +y local do grupo aponta pra saída
    if (dir === "tras") g2.rotation.x = -Math.PI / 2; else if (dir === "baixo") g2.rotation.x = Math.PI; else g2.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    const bocal = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r, r * 1.5, seg, 1, true), cromado); bocal.position.y = r * 0.25; g2.add(bocal);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(r * 0.94, r * 0.13, 6, seg + 4), escuro); aro.rotation.x = Math.PI / 2; aro.position.y = r * 1.0; g2.add(aro);
    const fundo = new THREE.Mesh(new THREE.CircleGeometry(r * 0.76, seg), garganta); fundo.rotation.x = -Math.PI / 2; fundo.position.y = r * 0.55; g2.add(fundo);
    // a chama: cone com a BASE no bocal e a ponta pra fora (comprimento 1 → escala `tam × força`)
    const chama = new THREE.Group(); chama.position.y = r * 0.95; g2.add(chama);
    const fora = new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, 1, seg, 1, true), chamaMat); fora.position.y = 0.5; chama.add(fora);
    const miolo = new THREE.Mesh(new THREE.ConeGeometry(r * 0.5, 0.55, seg, 1, true), nucleoMat); miolo.position.y = 0.275; chama.add(miolo);
    props.push({ chama, tam, tipo: dir === "tras" ? "principal" : dir === "baixo" ? "sustenta" : "manobra", lado: Math.sign(x) });
  };
  for (const s of [-1, 1]) propulsor(s * 0.16, 0.86, -1.58, 0.12, "tras", 1.3);   // os 2 principais, na traseira
  for (const z of [0.95, -0.9]) {   // pods de flutuação (frente/trás) com os de sustentação embaixo
    const carc = peca(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.33, 0.12, o.low ? 12 : 24), escuro), 0, 0.5, z); carc.scale.set(1, 1, 1.25); alvos.push(carc);
    peca(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 4, seg * 2), brilho), 0, 0.53, z).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) propulsor(s * 0.13, 0.44, z, 0.075, "baixo", 0.5);
  }
  for (const s of [-1, 1]) {   // de MANOBRA nas laterais do nariz: acendem na curva, do lado de fora
    peca(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.16), escuro), s * 0.17, 0.8, 1.38);
    propulsor(s * 0.21, 0.8, 1.38, 0.04, "lado", 0.4);
  }

  // ───────────── SETAS (pisca) ─────────────
  // lente âmbar apagada (fica) + a luz acesa e o halo (ligam no pisca) — frente e trás, dos dois lados
  const lente = new THREE.MeshStandardMaterial({ color: 0x3a2610, roughness: 0.25, metalness: 0.4, emissive: 0x1a0d00, emissiveIntensity: 1 });
  const luz = new THREE.MeshBasicMaterial({ color: 0xffb22e });
  const halo = new THREE.MeshBasicMaterial({ color: 0xff9a1a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  // o aceso de cada LADO num grupo só (frente + trás piscam juntos): liga/desliga o grupo — e o lote junta as peças dele
  const setas: Record<number, THREE.Group> = { 1: new THREE.Group(), [-1]: new THREE.Group() };   // −1 = esquerda do piloto = +x
  for (const gS of Object.values(setas)) { gS.visible = false; corpo.add(gS); }
  const largura = estilo === "tubarao" ? 0.29 : estilo === "gota" ? 0.27 : 0.24;
  for (const s of [-1, 1]) for (const [z, y] of [[1.3, 0.93], [-1.42, 1.02]] as const) {
    const x = s * largura, gS = setas[s > 0 ? -1 : 1]!;
    peca(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.1), lente), x, y, z);   // embutida (só a pontinha aparece)
    peca(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.034, 0.105), luz), x, y, z, gS);
    peca(new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), halo), x + s * 0.02, y, z, gS);
  }

  // ancoragem do PILOTO (frente da moto = +z; a esquerda de quem pilota = +x): quadril no banco, mãos nos punhos,
  // pés nas pedaleiras — o avatar encaixa nesses pontos por IK (AvatarLuz `montado`)
  const ancora = (x: number, y: number, z: number) => { const a = new THREE.Object3D(); a.position.set(x, y, z); corpo.add(a); return a; };
  const assento = ancora(0, MOTO.banco / ESCALA_MOTO, -0.36);   // (dentro do corpo já escalado)
  const pontos = { maoE: ancora(0.37, 1.24, 0.6), maoD: ancora(-0.37, 1.24, 0.6), peE: ancora(0.34, 0.54, 0.16), peD: ancora(-0.34, 0.54, 0.16) };

  let rola = 0, nariz2 = 0, boostSuave = 0;
  return {
    group: g, assento, pontos, alvos,
    atualizar({ dt, t, voando, vel, curva, vy = 0, inclina, boost = 0, seta = 0 }) {
      const k = Math.min(1, dt * 4);
      if (inclina !== undefined) rola = inclina;   // a pilotagem já suaviza
      else rola += (Math.max(-0.5, Math.min(0.5, -curva * 0.55)) * (voando ? 1 : 0) - rola) * k;
      nariz2 += ((voando ? Math.max(-0.25, Math.min(0.25, -vy * 0.02)) - Math.min(1.8, vel) * 0.07 : 0) - nariz2) * k;
      corpo.rotation.set(nariz2, 0, rola);
      corpo.position.y = ESCALA_MOTO * (voando ? Math.sin(t * 3.1) * 0.03 : 0.05 + Math.sin(t * 1.7) * 0.04);   // parada: flutua de leve
      boostSuave += (boost - boostSuave) * Math.min(1, dt * 6);
      u.uT.value = t; u.uBoost.value = boostSuave;
      // chamas: principais crescem com a velocidade (e MUITO no boost); as de sustentação, com o voo; as de manobra, na curva
      props.forEach((p, i) => {
        const forca = p.tipo === "principal" ? (voando ? 0.3 + 0.7 * Math.min(1, vel) + 0.75 * boostSuave : 0.06)
          : p.tipo === "sustenta" ? (voando ? 0.65 + 0.35 * Math.min(1, Math.abs(vy) / 8) : 0.14)
          : (voando ? 0.1 + 0.9 * Math.max(0, -curva * p.lado) : 0.03);
        const tremor = 0.9 + 0.1 * Math.sin(t * 31 + i * 1.7) + 0.05 * Math.sin(t * 57 + i);
        p.chama.scale.set(1 + 0.25 * boostSuave * (p.tipo === "principal" ? 1 : 0), Math.max(0.02, p.tam * forca * tremor), 1 + 0.25 * boostSuave * (p.tipo === "principal" ? 1 : 0));
      });
      setas[-1]!.visible = seta === -1; setas[1]!.visible = seta === 1;
    },
    dispose() {
      g.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); const mt = m.material as THREE.Material | undefined; mt?.dispose?.(); });
      g.removeFromParent();
    },
  };
}
