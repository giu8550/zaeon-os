/**
 * A CENA do fundo do "Sobre nós" (out/2026, o dono: "um fundo com os nossos droids passeando em cima do lounge, perto
 * da pirâmide, e depois nos caminhos da esquerda, do centro e da direita — estilo cutscene, mas como fundo, assim como
 * a imagem PNG serve hoje"). Um pedaço LEVE do cyberespaço, montado só com o que aparece:
 *  - o TEMPLO CÓSMICO (components/cyber/TemploCosmico: o salão, a pirâmide, os lounges de estudo, o caminho do meio e o
 *    Rasta), a laje do LOUNGE e o templo dele (components/cyber/Templo) — no referencial da sala, espelhado como no jogo;
 *  - três DROIDS (components/cyber/Droid — o Ofanim de rodas) deslizando em formação pela curva de
 *    lib/about/percursoDroids;
 *  - a CÂMERA de cutscene: atrás e de lado do líder, com o lado e a altura variando devagar (o plano "respira").
 * Sem cidade, frota, som, rede ou avatar: nada do motor do jogo. 30 fps, 1 pixel por pixel, qualidade baixa.
 */
import * as THREE from "three";
import { criarSalaoCosmico } from "@/components/cyber/TemploCosmico";
import { criarTemplo } from "@/components/cyber/Templo";
import { criarDroid, type DroidHandle } from "@/components/cyber/Droid";
import { RASTA } from "@/lib/cyber/temploCosmico";
import { PARADAS, VOLTA_S } from "@/lib/about/percursoDroids";

export type FundoDroids = { tamanho(w: number, h: number): void; visivel(v: boolean): void; /** (dev) pula pro segundo `t` da volta */ saltar(t: number): void; destruir(): void };

const FPS = 30;
/** a formação: quanto cada droid vem atrás do líder (fração da volta) e pro lado (m) */
const FORMACAO = [{ atras: 0, lado: 0 }, { atras: 0.004, lado: -2.6 }, { atras: 0.0075, lado: 2.8 }] as const;
const ESCALA_DROID = 1.7;
const volta = (u: number) => ((u % 1) + 1) % 1;

export function criarFundoDroids(canvas: HTMLCanvasElement, o: { largura: number; altura: number }): FundoDroids {
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
  R.setPixelRatio(1); R.outputColorSpace = THREE.SRGBColorSpace; R.setClearColor(0x030014, 1);
  const cena = new THREE.Scene();
  cena.fog = new THREE.FogExp2(0x070418, 0.0042);
  const cam = new THREE.PerspectiveCamera(48, 1, 0.5, 2400);
  cena.add(new THREE.HemisphereLight(0xa9b8ff, 0x140a2e, 1.3));
  const sol = new THREE.DirectionalLight(0xffffff, 1.5); sol.position.set(-200, 400, 300); cena.add(sol);
  const contra = new THREE.DirectionalLight(0x7fe8ff, 0.8); contra.position.set(300, 200, -400); cena.add(contra);

  // o MUNDO no referencial da sala do lounge (y = 0 no pátio): virado e espelhado como no jogo (o lounge à esquerda)
  const mundo = new THREE.Group(); mundo.rotation.y = Math.PI; mundo.scale.x = -1; cena.add(mundo);
  const vidro = new THREE.MeshPhysicalMaterial({ color: 0x0a1830, emissive: 0x2a3a70, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.32, side: THREE.DoubleSide });
  // a laje do LOUNGE (a plataforma de gelo com o aro de luz)
  const lajeGeo = new THREE.CylinderGeometry(RASTA.r + 1, RASTA.r - 1, 1.8, 64), lajeMat = new THREE.MeshStandardMaterial({ color: 0x0a2440, emissive: 0x1d4f8f, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.25 });
  const laje = new THREE.Mesh(lajeGeo, lajeMat); laje.position.y = -0.95; mundo.add(laje);
  const aroGeo = new THREE.TorusGeometry(RASTA.r + 1, 0.3, 6, 96), aroMat = new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
  const aro = new THREE.Mesh(aroGeo, aroMat); aro.rotation.x = Math.PI / 2; aro.position.y = -0.1; mundo.add(aro);
  const templo = criarTemplo({ low: true, paredeMat: vidro }); mundo.add(templo.group);
  const salao = criarSalaoCosmico({ low: true, paredeMat: vidro }); mundo.add(salao.group);

  // as ESTRELAS (um céu só de pontos, longe)
  const NE = 1800, ep = new Float32Array(NE * 3);
  for (let i = 0; i < NE; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(900 + Math.random() * 400); ep.set([v.x + 200, Math.abs(v.y) * 0.9 - 120, v.z - 100], i * 3); }
  const estGeo = new THREE.BufferGeometry(); estGeo.setAttribute("position", new THREE.BufferAttribute(ep, 3));
  const estMat = new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8, fog: false });
  cena.add(new THREE.Points(estGeo, estMat));

  // os DROIDS e a curva
  const curva = new THREE.CatmullRomCurve3(PARADAS.map((p) => new THREE.Vector3(p.x, p.y, p.z)), true, "centripetal");
  const droids: DroidHandle[] = FORMACAO.map(() => { const d = criarDroid({ low: true }); d.group.scale.setScalar(ESCALA_DROID); mundo.add(d.group); d.aparecer(); return d; });

  const pL = new THREE.Vector3(), tL = new THREE.Vector3(), lado = new THREE.Vector3(), cima = new THREE.Vector3(0, 1, 0), aux = new THREE.Vector3();
  const camPos = new THREE.Vector3(), camOlhar = new THREE.Vector3(), alvoPos = new THREE.Vector3(), alvoOlhar = new THREE.Vector3();
  let primeiro = true;

  const posicionar = (t: number, dt: number) => {
    const u = volta(t / VOLTA_S);
    FORMACAO.forEach((f, i) => {
      const ui = volta(u - f.atras);
      curva.getPointAt(ui, pL); curva.getTangentAt(ui, tL);
      lado.crossVectors(tL, cima).normalize();
      const d = droids[i]!;
      d.group.position.copy(pL).addScaledVector(lado, f.lado); d.group.position.y += Math.sin(t * 1.3 + i * 2) * 0.35;
      d.atualizar(dt, t, Math.atan2(tL.x, tL.z));
    });
    // a CÂMERA: atrás do líder e de lado (o lado e a altura variam devagar), olhando um pouco à frente dele
    const uc = volta(u - 0.018);
    curva.getPointAt(uc, aux); curva.getTangentAt(uc, tL); lado.crossVectors(tL, cima).normalize();
    aux.addScaledVector(lado, 10 * Math.sin(t * 0.045 + 0.6) + 3).add(cima.clone().multiplyScalar(6 + 2.5 * Math.sin(t * 0.06)));
    alvoPos.copy(mundo.localToWorld(aux.clone()));
    curva.getPointAt(volta(u + 0.004), aux); alvoOlhar.copy(mundo.localToWorld(aux.clone()));
    if (primeiro) { camPos.copy(alvoPos); camOlhar.copy(alvoOlhar); primeiro = false; }
    const k = 1 - Math.exp(-dt * 1.6);
    camPos.lerp(alvoPos, k); camOlhar.lerp(alvoOlhar, k);
    cam.position.copy(camPos); cam.lookAt(camOlhar);
  };

  let larg = o.largura, alt = o.altura, vivo = true, ver = true, raf = 0, ultimo = 0, t = Math.random() * VOLTA_S;
  const tamanho = (w: number, h: number) => { larg = Math.max(1, w); alt = Math.max(1, h); R.setSize(larg, alt, false); cam.aspect = larg / alt; cam.updateProjectionMatrix(); };
  tamanho(larg, alt);
  const relogio = new THREE.Clock();
  const quadro = (agora: number) => {
    raf = 0; if (!vivo || !ver) return;
    raf = requestAnimationFrame(quadro);
    if (agora - ultimo < 1000 / FPS - 2) return;
    ultimo = agora;
    const dt = Math.min(0.1, relogio.getDelta()); t += dt;
    posicionar(t, dt);
    templo.atualizar(dt, t); salao.atualizar(dt, t);
    R.render(cena, cam);
  };
  const tocar = () => { if (!raf && vivo && ver) { relogio.getDelta(); raf = requestAnimationFrame(quadro); } };
  tocar();

  return {
    tamanho,
    visivel: (v) => { ver = v; if (v) tocar(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    saltar: (s) => { t = s; primeiro = true; },
    destruir: () => {
      vivo = false; if (raf) cancelAnimationFrame(raf);
      for (const d of droids) d.dispose();
      salao.dispose(); templo.dispose();
      lajeGeo.dispose(); lajeMat.dispose(); aroGeo.dispose(); aroMat.dispose(); vidro.dispose(); estGeo.dispose(); estMat.dispose();
      R.dispose(); R.forceContextLoss();
    },
  };
}
