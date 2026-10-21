/**
 * DistritoTerra — os MIRANTES DA TERRA nas 4 quinas da Zaeon (layout puro em lib/cyber/terra; as pirâmides são os
 * marcos da Recepção — components/cyber/Landmark):
 *  - os ESTACIONAMENTOS de 4 motos ao lado de cada mirante (o piso é o mesmo do estacionamento da Zaeon);
 *  - PROBLEMA → SOLUÇÃO: o telão dos PROBLEMAS DA TERRA (mapa Blue Marble da NASA, domínio público, com os problemas
 *    pulsando e os eventos AO VIVO) e o telão das SOLUÇÕES PARA A TERRA (os projetos e ideias reais), com os CARDS dos
 *    temas colados no primeiro e um cabo de luz de cada card até o segundo;
 *  - os GLOBOS holográficos da Terra, um por mirante, pairando entre os dois telões (girando, com os pontos);
 *  - MOTORES DE ENERGIA: núcleo de plasma + 3 anéis-giroscópio — aceleram e acendem quando alguém chega perto;
 *  - SUPERTREES hídricas (Gardens by the Bay): tronco com jardim vertical + treliça de aço, galhos até a copa larga
 *    com aro de luz (o show de cores à noite), água caindo da copa num véu até o espelho d'água no pé.
 * Leve: as supertrees são UMA malha por material (fundidas), as zebras são instanciadas; texturas compartilhadas.
 * No modo LEVE (placa integrada): árvores simples (menos faces, sem a treliça e sem o véu d'água), sem o halo dos motores.
 * Os CARDS em pé dos temas saíram (lib/cyber/terra `CARDS_NA_ESTACAO`).
 * Tudo no referencial da ILHA.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CABOS, GLOBOS, LIGACOES, MOTORES, PONTOS_TERRA, SUPERTREES, TELOES, TELOES_SOLUCAO, TEMAS, TOTENS, ehSolucao, noMapa, reacaoDoMotor, type PontoTerra } from "@/lib/cyber/terra";
import { haQuanto, intercalarTipos, type EventoTerra, type TipoEvento } from "@/lib/cyber/terraAoVivo";

/** a Terra AO VIVO (app/api/cyber/terra): eventos reais, atualizados a cada 10 min */
const URL_AO_VIVO = "/api/cyber/terra", A_CADA_MS = 10 * 60 * 1000, MAX_VIVO = 24;
const COR_EVENTO: Record<TipoEvento, string> = { terremoto: "#ffa53c", incendio: "#ff5a2c", tempestade: "#b98cff", vulcao: "#ff2c4a", gelo: "#dff6ff" };
const IDX_EVENTO: Record<TipoEvento, number> = { terremoto: 0, incendio: 1, tempestade: 2, vulcao: 3, gelo: 4 };

export type DistritoHandle = {
  group: THREE.Group;
  /** superfícies que entram no clique de andar (os pisos dos estacionamentos) */
  alvos: THREE.Object3D[];
  /** quem está na Zaeon agora (local da ilha) — os motores reagem */
  presencas(p: { x: number; z: number }[]): void;
  atualizar(dt: number, t: number): void;
  dispose(): void;
};

export const URL_TERRA = "/assets/cyber/terra-blue-marble.jpg";
const COR_TIPO = { problema: "#ff4a5a", regeneracao: "#5aff8a", desenvolvimento: "#45d6ff", evento: "#ffb45a" } as const;
const TIPO_IDX = { problema: 0, regeneracao: 1, desenvolvimento: 2, evento: 3 } as const;
/** os TOTENS: o tema, a cor e o problema que ele lembra */
const TEMA = {
  clima: { nome: "CLIMA", cor: "#ff8a4a", linhas: ["aquecimento global", "derretimento do gelo", "eventos extremos"] },
  florestas: { nome: "FLORESTAS", cor: "#5aff8a", linhas: ["desmatamento", "queimadas", "perda de espécies"] },
  oceanos: { nome: "OCEANOS", cor: "#45d6ff", linhas: ["corais branqueando", "lixo plástico", "acidificação"] },
  agua: { nome: "ÁGUA", cor: "#9fb8ff", linhas: ["secas", "rios e lagos secando", "desertificação"] },
} as const;

/** a supertree (local da árvore): tronco, treliça, galhos, copa e aro — geometrias pra fundir */
function supertree(alt: number, copa: number, low: boolean) {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) { const u = i / 12, r = u < 0.55 ? 2.4 - 1.1 * Math.sin(u / 0.55 * Math.PI / 2) : 1.3 + (u - 0.55) / 0.45 * (copa * 0.32 - 1.3) * ((u - 0.55) / 0.45); prof.push(new THREE.Vector2(r, u * alt * 0.86)); }
  const tronco = new THREE.LatheGeometry(prof, low ? 7 : 16);
  // a treliça de aço: hélices nos dois sentidos seguindo o perfil
  const trel: number[] = [], NH = low ? 6 : 10, NS = 24;
  for (const sent of [1, -1]) for (let h = 0; h < NH; h++) for (let i = 0; i < NS; i++) {
    const p = (k: number) => { const u = k / NS, pr = prof[Math.min(12, Math.round(u * 12))]!, a = (h / NH) * Math.PI * 2 + sent * u * Math.PI * 1.6; return [Math.cos(a) * (pr.x + 0.08), pr.y, Math.sin(a) * (pr.x + 0.08)]; };
    trel.push(...p(i), ...p(i + 1));
  }
  // os galhos (da parte de cima do tronco até a borda da copa) + a copa (guarda-chuva aberto, pra cima) + o aro
  const yT = alt * 0.86, galhos: THREE.BufferGeometry[] = [], NG = low ? 6 : 14;
  for (let k = 0; k < NG; k++) {
    const a = (k / NG) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(c * 1.6, yT - 3, s * 1.6), new THREE.Vector3(c * copa * 0.45, yT + 1.5, s * copa * 0.45), new THREE.Vector3(c * copa, yT + 4, s * copa));
    galhos.push(new THREE.TubeGeometry(curva, low ? 4 : 8, 0.18, low ? 3 : 5, false));
  }
  const copaG = new THREE.CylinderGeometry(copa, copa * 0.25, 4.2, low ? 8 : 20, 1, true); copaG.translate(0, yT + 2.1, 0);
  const aro = new THREE.TorusGeometry(copa, 0.28, low ? 3 : 6, low ? 16 : 40); aro.rotateX(Math.PI / 2); aro.translate(0, yT + 4.1, 0);
  const trelG = new THREE.BufferGeometry(); trelG.setAttribute("position", new THREE.Float32BufferAttribute(trel, 3));
  return { tronco, trel: trelG, galhos: mergeGeometries(galhos.map((g) => g.toNonIndexed()))!, copa: copaG, aro, yT };
}

export function criarDistritoTerra(o: { low: boolean; parado?: boolean }): DistritoHandle {
  const { low } = o, group = new THREE.Group(), alvos: THREE.Object3D[] = [], liberar: { dispose(): void }[] = [];
  const guarda = <T extends { dispose(): void }>(x: T) => { liberar.push(x); return x; };

  // (as motos dos mirantes foram pra GARAGEM — a ala dos veículos)

  // ── a TERRA: textura compartilhada (telões + globo) ─────────────────────────────────────────────────────────────
  const texTerra = guarda(new THREE.TextureLoader().load(URL_TERRA)); texTerra.colorSpace = THREE.SRGBColorSpace;
  const PROBLEMAS = PONTOS_TERRA.filter((p) => !ehSolucao(p)), SOLUCOES = PONTOS_TERRA.filter(ehSolucao);
  const pontosU = (l: readonly PontoTerra[]) => l.map((p) => { const m = noMapa(p.lat, p.lon); return new THREE.Vector3(m.u, m.v, TIPO_IDX[p.tipo]); });
  const uT = { value: 0 };
  const vivoU = Array.from({ length: MAX_VIVO }, () => new THREE.Vector4());
  // ── TELÕES: o mapa (shader: tom holográfico + grade + pontos pulsando + varredura) + painel (canvas) ──
  // o PAINEL lateral (canvas): PROBLEMAS · O QUE ESTÁ SENDO FEITO · AO VIVO (redesenhado quando os eventos chegam)
  const cvPainel = document.createElement("canvas"); cvPainel.width = 640; cvPainel.height = 1300;
  const painel = guarda(new THREE.CanvasTexture(cvPainel)); painel.colorSpace = THREE.SRGBColorSpace;
  const corta = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const desenharPainel = (vivo: EventoTerra[] | null) => {
    const g = cvPainel.getContext("2d")!;
    g.fillStyle = "#04101c"; g.fillRect(0, 0, 640, 1300); g.strokeStyle = "#45d6ff"; g.lineWidth = 3; g.strokeRect(6, 6, 628, 1288);
    g.fillStyle = "#e6f6ff"; g.font = "bold 46px system-ui, sans-serif"; g.fillText("ESTADO DA TERRA", 30, 74);
    let y = 136;
    g.fillStyle = "#ff6a76"; g.font = "bold 26px system-ui, sans-serif"; g.fillText("● PROBLEMAS", 30, y); y += 38;
    for (const p of PROBLEMAS) { g.fillStyle = TEMA[p.tema].cor; g.beginPath(); g.arc(42, y - 7, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = "#e6f6ff"; g.font = "21px system-ui, sans-serif"; g.fillText(corta(p.nome, 44), 60, y); y += 33; }
    y += 14;
    g.fillStyle = "#ffb45a"; g.font = "bold 28px system-ui, sans-serif"; g.fillText("● AO VIVO", 30, y); y += 8;
    g.fillStyle = "rgba(230,246,255,.5)"; g.font = "17px system-ui, sans-serif"; g.fillText("USGS · NASA EONET — eventos reais", 190, y - 8); y += 30;
    if (!vivo) { g.fillStyle = "rgba(230,246,255,.6)"; g.font = "21px system-ui, sans-serif"; g.fillText("conectando às fontes públicas…", 30, y); }
    else if (!vivo.length) { g.fillStyle = "rgba(230,246,255,.6)"; g.font = "21px system-ui, sans-serif"; g.fillText("sem eventos agora", 30, y); }
    else for (const e of intercalarTipos(vivo, 9)) {
      g.fillStyle = COR_EVENTO[e.tipo]; g.beginPath(); g.moveTo(42, y - 16); g.lineTo(50, y - 7); g.lineTo(42, y + 2); g.lineTo(34, y - 7); g.closePath(); g.fill();
      g.fillStyle = "#f2f8ff"; g.font = "bold 20px system-ui, sans-serif"; g.fillText(corta(e.titulo, 42), 60, y);
      g.fillStyle = "rgba(200,225,245,.55)"; g.font = "16px system-ui, sans-serif"; g.fillText(haQuanto(e.quando, Date.now()), 60, y + 20); y += 46;
    }
    painel.needsUpdate = true;
  };
  desenharPainel(null);
  // o painel das SOLUÇÕES (fixo): os projetos e ideias, por tema (a cor do card que liga o problema a eles)
  const cvSol = document.createElement("canvas"); cvSol.width = 640; cvSol.height = 1300;
  const painelSol = guarda(new THREE.CanvasTexture(cvSol)); painelSol.colorSpace = THREE.SRGBColorSpace;
  { const g = cvSol.getContext("2d")!;
    g.fillStyle = "#03140f"; g.fillRect(0, 0, 640, 1300); g.strokeStyle = "#5aff8a"; g.lineWidth = 3; g.strokeRect(6, 6, 628, 1288);
    g.fillStyle = "#eafff2"; g.font = "bold 44px system-ui, sans-serif"; g.fillText("SOLUÇÕES", 30, 74);
    g.fillStyle = "rgba(234,255,242,.6)"; g.font = "19px system-ui, sans-serif"; g.fillText("projetos e ideias que já ajudam a Terra", 30, 104);
    let y = 166;
    for (const tema of TEMAS) {
      const T = TEMA[tema]; g.fillStyle = T.cor; g.font = "bold 26px system-ui, sans-serif"; g.fillText(`● ${T.nome}`, 30, y); y += 38;
      for (const p of SOLUCOES.filter((q) => q.tema === tema)) { g.fillStyle = COR_TIPO[p.tipo]; g.beginPath(); g.arc(42, y - 7, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = "#eafff2"; g.font = "21px system-ui, sans-serif"; g.fillText(corta(p.nome, 44), 60, y); y += 33; }
      y += 22;
    }
    g.fillStyle = "#7dffa6"; g.font = "bold 24px system-ui, sans-serif"; g.fillText("E a sua ideia?", 30, y + 20);
    g.fillStyle = "rgba(234,255,242,.7)"; g.font = "20px system-ui, sans-serif"; g.fillText("Leve pro laboratório e transforme em projeto.", 30, y + 52);
    painelSol.needsUpdate = true; }
  const criarMatMapa = (pontos: THREE.Vector3[]) => guarda(new THREE.ShaderMaterial({
    uniforms: { uMapa: { value: texTerra }, uT, uP: { value: pontos }, uV: { value: vivoU }, uNV: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform sampler2D uMapa; uniform float uT; uniform vec3 uP[${pontos.length}]; uniform vec4 uV[${MAX_VIVO}]; uniform float uNV; varying vec2 vUv;
      void main() {
        vec3 m = texture2D(uMapa, vUv).rgb;
        float lum = dot(m, vec3(0.3, 0.55, 0.15));
        vec3 cor = mix(vec3(0.02, 0.07, 0.16), vec3(0.25, 0.75, 1.0), smoothstep(0.08, 0.6, lum)) + m * 0.25;
        vec2 gr = abs(fract(vUv * vec2(36.0, 18.0)) - 0.5); cor += vec3(0.12, 0.35, 0.55) * (1.0 - smoothstep(0.0, 0.035, min(gr.x, gr.y))) * 0.35;
        float varre = exp(-pow((vUv.x - fract(uT * 0.06)) * 40.0, 2.0)); cor += vec3(0.3, 0.8, 1.0) * varre * 0.45;
        for (int i = 0; i < ${pontos.length}; i++) {
          vec3 p = uP[i]; vec2 d = (vUv - p.xy) * vec2(2.0, 1.0);
          if (abs(d.x) > 0.065 || abs(d.y) > 0.065) continue;   // (LEVE: longe do ponto, nada a somar — o grosso dos pixels sai aqui)
          float r = length(d);
          float onda = fract(uT * 0.5 + float(i) * 0.13); float anel = exp(-pow((r - onda * 0.06) * 160.0, 2.0)) * (1.0 - onda);
          vec3 c = p.z < 0.5 ? vec3(1.0, 0.25, 0.3) : (p.z < 1.5 ? vec3(0.35, 1.0, 0.55) : (p.z < 2.5 ? vec3(0.27, 0.84, 1.0) : vec3(1.0, 0.7, 0.35)));
          float forte = p.z < 0.5 ? 1.5 : 1.0;   // os PROBLEMAS pulsam mais forte
          cor += c * (exp(-r * r * 9000.0) * 1.6 + anel) * forte;
        }
        // AO VIVO: os eventos reais — um losango piscando + anel de onda, na cor do tipo (os mais novos mais fortes)
        for (int i = 0; i < ${MAX_VIVO}; i++) {
          if (float(i) >= uNV) break;
          vec4 e = uV[i]; vec2 d = (vUv - e.xy) * vec2(2.0, 1.0);
          if (abs(d.x) > 0.055 || abs(d.y) > 0.055) continue;
          float r = abs(d.x) + abs(d.y);
          vec3 c = e.z < 0.5 ? vec3(1.0, 0.65, 0.24) : (e.z < 1.5 ? vec3(1.0, 0.36, 0.17) : (e.z < 2.5 ? vec3(0.73, 0.55, 1.0) : (e.z < 3.5 ? vec3(1.0, 0.17, 0.29) : vec3(0.88, 0.96, 1.0))));
          float pisca = 0.6 + 0.4 * sin(uT * 4.0 + float(i) * 1.7);
          float onda = fract(uT * 0.35 + float(i) * 0.21); float anel = exp(-pow((length(d) - onda * 0.05) * 170.0, 2.0)) * (1.0 - onda);
          cor += c * ((1.0 - smoothstep(0.004, 0.009, r)) * 1.8 * pisca + anel * 0.9) * e.w;
        }
        float cl = 0.92 + 0.08 * sin(vUv.y * 900.0); gl_FragColor = vec4(cor * cl, 1.0);
      }`,
  }));
  /** o mapa dos PROBLEMAS (com os eventos ao vivo) e o das SOLUÇÕES (sem eventos: uNV fica 0) */
  const matMapa = criarMatMapa(pontosU(PROBLEMAS)), matMapaSol = criarMatMapa(pontosU(SOLUCOES));
  const matPainel = guarda(new THREE.MeshBasicMaterial({ map: painel })), matPainelSol = guarda(new THREE.MeshBasicMaterial({ map: painelSol }));
  // busca a Terra AO VIVO agora e a cada 10 min (falhou: mantém o que tinha)
  let vivo = true, timerVivo: ReturnType<typeof setTimeout> | null = null;
  const aplicarVivo = (evs: EventoTerra[]) => {
    const agora = Date.now(), lista = evs.slice(0, MAX_VIVO);
    lista.forEach((e, i) => { const m = noMapa(e.lat, e.lon), idade = (agora - e.quando) / 86400000; vivoU[i]!.set(m.u, m.v, IDX_EVENTO[e.tipo], Math.max(0.45, 1 - idade * 0.12)); });
    matMapa.uniforms.uNV!.value = lista.length; desenharPainel(lista);
  };
  const buscarVivo = async () => {
    try { const r = await fetch(URL_AO_VIVO); if (r.ok) { const j = (await r.json()) as { eventos?: EventoTerra[] }; if (vivo && Array.isArray(j.eventos)) aplicarVivo(j.eventos); } }
    catch { /* sem rede: fica o que tinha */ }
    if (vivo) timerVivo = setTimeout(() => void buscarVivo(), A_CADA_MS);
  };
  void buscarVivo();
  liberar.push({ dispose: () => { vivo = false; if (timerVivo) clearTimeout(timerVivo); } });
  const matMoldura = guarda(new THREE.MeshStandardMaterial({ color: 0x141c2e, roughness: 0.3, metalness: 0.85, emissive: 0x0a1630, emissiveIntensity: 0.6 }));
  const matAura = guarda(new THREE.MeshBasicMaterial({ color: 0x45d6ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  // o DESTAQUE do telão: palco elevado com bordas de luz, colunas de luz dos lados, aro de neon na moldura, holofote no
  // chão na frente e o letreiro flutuante
  const matPalco = guarda(new THREE.MeshStandardMaterial({ color: 0x0c1424, roughness: 0.35, metalness: 0.7, emissive: 0x0a1a36, emissiveIntensity: 0.7 }));
  const matNeon = guarda(new THREE.MeshBasicMaterial({ color: 0x7fe8ff })), matNeonSol = guarda(new THREE.MeshBasicMaterial({ color: 0x6dff9a }));
  const matColuna = guarda(new THREE.MeshBasicMaterial({ color: 0x45d6ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const matHolofote = guarda(new THREE.MeshBasicMaterial({ color: 0x45d6ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  const letreiro = (texto: string, brilho: string) => { const c = document.createElement("canvas"); c.width = 1024; c.height = 160; const g = c.getContext("2d")!; g.font = "900 80px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.shadowColor = brilho; g.shadowBlur = 26; g.fillStyle = "#e9fbff"; g.fillText(texto, 512, 84); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return guarda(t); };
  const matLetreiro = guarda(new THREE.MeshBasicMaterial({ map: letreiro("PROBLEMAS DA TERRA", "#ff5a6a"), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const matLetreiroSol = guarda(new THREE.MeshBasicMaterial({ map: letreiro("SOLUÇÕES PARA A TERRA", "#5aff8a"), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const auras: THREE.MeshBasicMaterial[] = [matAura, matColuna, matHolofote];
  const telas = [
    ...TELOES.map((t) => ({ t, mapa: matMapa, painel: matPainel, neon: matNeon, titulo: matLetreiro })),
    ...TELOES_SOLUCAO.map((t) => ({ t, mapa: matMapaSol, painel: matPainelSol, neon: matNeonSol, titulo: matLetreiroSol })),
  ];
  for (const { t, mapa: mMapa, painel: mPainel, neon: mNeon, titulo: mTitulo } of telas) {
    const g = new THREE.Group(); g.position.set(t.x, 0, t.z); g.rotation.y = t.rot; group.add(g);
    const W = t.larg, H = t.alt, wMapa = W * 0.72, wPain = W - wMapa;
    // o palco: 2 degraus com fio de luz na borda
    for (const [w, d, h, y] of [[W + 10, 12, 0.6, 0.3], [W + 5, 8, 0.6, 0.9]] as const) {
      const pl = new THREE.Mesh(guarda(new THREE.BoxGeometry(w, h, d)), matPalco); pl.position.set(0, y, 0.5); g.add(pl);
      const fio = new THREE.Mesh(guarda(new THREE.BoxGeometry(w + 0.1, 0.08, 0.08)), mNeon); fio.position.set(0, y + h / 2, 0.5 + d / 2); g.add(fio);
    }
    const mold = new THREE.Mesh(guarda(new THREE.BoxGeometry(W + 1.4, H + 1.4, 1.0)), matMoldura); mold.position.set(0, t.y, -0.55); g.add(mold);
    // o aro de NEON em volta da tela
    for (const [w, h, x, y] of [[W + 1.6, 0.25, 0, t.y + H / 2 + 0.75], [W + 1.6, 0.25, 0, t.y - H / 2 - 0.75], [0.25, H + 1.6, -W / 2 - 0.75, t.y], [0.25, H + 1.6, W / 2 + 0.75, t.y]] as const) {
      const n = new THREE.Mesh(guarda(new THREE.BoxGeometry(w, h, 0.3)), mNeon); n.position.set(x, y, 0.05); g.add(n);
    }
    const mapa = new THREE.Mesh(guarda(new THREE.PlaneGeometry(wMapa, H)), mMapa); mapa.position.set(-W / 2 + wMapa / 2, t.y, 0.0); g.add(mapa);
    const pain = new THREE.Mesh(guarda(new THREE.PlaneGeometry(wPain, H)), mPainel); pain.position.set(W / 2 - wPain / 2, t.y, 0.0); g.add(pain);
    const aura = new THREE.Mesh(guarda(new THREE.PlaneGeometry(W + 7, H + 7)), matAura); aura.position.set(0, t.y, -1.2); g.add(aura);
    for (const s of [-1, 1]) {
      const pe = new THREE.Mesh(guarda(new THREE.BoxGeometry(1.6, t.y - H / 2 - 1.2, 1.6)), matMoldura); pe.position.set((s * W) / 2.6, 1.2 + (t.y - H / 2 - 1.2) / 2, -0.5); g.add(pe);
      const col = new THREE.Mesh(guarda(new THREE.CylinderGeometry(0.9, 1.3, t.y + H / 2 + 6, 16, 1, true)), matColuna); col.position.set(s * (W / 2 + 3.4), (t.y + H / 2 + 6) / 2, 0.5); g.add(col);
      const base = new THREE.Mesh(guarda(new THREE.CylinderGeometry(1.4, 1.6, 1.2, 16)), matPalco); base.position.set(s * (W / 2 + 3.4), 0.6, 0.5); g.add(base);
    }
    const holofote = new THREE.Mesh(guarda(new THREE.CircleGeometry(W * 0.62, 48)), matHolofote); holofote.rotation.x = -Math.PI / 2; holofote.scale.set(1, 0.42, 1); holofote.position.set(0, 0.06, 10); g.add(holofote);
    const tit = new THREE.Mesh(guarda(new THREE.PlaneGeometry(W * 0.8, W * 0.125)), mTitulo); tit.position.set(0, t.y + H / 2 + 3.4, 0.2); g.add(tit);
  }

  // ── os GLOBOS da Terra (holográficos), ao lado de cada telão, num pedestal com anel — alimentados pelos cabos ──
  const matGlobo = guarda(new THREE.ShaderMaterial({
    uniforms: { uMapa: { value: texTerra }, uT },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main() { vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform sampler2D uMapa; uniform float uT; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() { vec3 m = texture2D(uMapa, vUv).rgb; float lum = dot(m, vec3(0.3, 0.55, 0.15));
        vec3 cor = mix(vec3(0.02, 0.09, 0.2), vec3(0.3, 0.85, 1.0), smoothstep(0.08, 0.6, lum)) + m * 0.3;
        float fr = pow(1.0 - max(dot(vN, vV), 0.0), 2.5); cor += vec3(0.35, 0.8, 1.0) * fr * 1.2;
        cor *= 0.9 + 0.1 * sin(vUv.y * 600.0 + uT * 2.0);
        gl_FragColor = vec4(cor, 0.9); }`,
    transparent: true,
  }));
  const geoGlobo = guarda(new THREE.SphereGeometry(1, low ? 32 : 64, low ? 20 : 40)), geoPino = guarda(new THREE.SphereGeometry(0.035, 8, 6));
  const matFeixe = guarda(new THREE.MeshBasicMaterial({ color: 0x45d6ff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const matPinos = Object.fromEntries(Object.entries(COR_TIPO).map(([k, c]) => [k, guarda(new THREE.MeshBasicMaterial({ color: c }))]));
  const globos = GLOBOS.map((G) => {
    const globo = new THREE.Mesh(geoGlobo, matGlobo); globo.scale.setScalar(G.r); globo.position.set(G.x, G.y, G.z); group.add(globo);
    for (const p of PONTOS_TERRA) {
      const fi = (90 - p.lat) * Math.PI / 180, te = (p.lon + 180) * Math.PI / 180, r = 1.02;
      const pino = new THREE.Mesh(geoPino, matPinos[p.tipo]!); pino.position.set(-r * Math.sin(fi) * Math.cos(te), r * Math.cos(fi), r * Math.sin(fi) * Math.sin(te)); globo.add(pino);
    }
    const alt = G.y - G.r - 1, feixe = new THREE.Mesh(guarda(new THREE.CylinderGeometry(1.6, 2.6, alt, 20, 1, true)), matFeixe); feixe.position.set(G.x, alt / 2, G.z); group.add(feixe);
    const ped = new THREE.Mesh(guarda(new THREE.CylinderGeometry(3.4, 4.2, 1.4, 24)), matPalco); ped.position.set(G.x, 0.7, G.z); group.add(ped);
    const anelP = new THREE.Mesh(guarda(new THREE.TorusGeometry(G.r * 1.25, 0.12, 6, 64)), matNeon); anelP.rotation.x = Math.PI / 2 - 0.3; anelP.position.set(G.x, G.y, G.z); group.add(anelP);
    return globo;
  });

  // ── os CABOS ALIMENTADORES: dos motores até o globo e o telão, no chão, com a energia correndo por dentro ──
  const matCabo = guarda(new THREE.ShaderMaterial({
    uniforms: { uT },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uT; varying vec2 vUv;
      void main() { float pulso = pow(max(0.0, sin((vUv.x * 14.0 - uT * 3.0) * 3.14159)), 6.0);
        vec3 cor = mix(vec3(0.05, 0.12, 0.22), vec3(0.45, 0.9, 1.0), 0.25 + 0.75 * pulso);
        gl_FragColor = vec4(cor, 1.0); }`,
  }));
  {
    const tubos = CABOS.map(({ de, para }) => {
      const a = new THREE.Vector3(de.x, 0.35, de.z), b = new THREE.Vector3(para.x, 0.35, para.z), m = a.clone().lerp(b, 0.5);
      const lateral = new THREE.Vector3(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar(a.distanceTo(b) * 0.12); m.add(lateral);
      return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 24, 0.32, 6, false);
    });
    group.add(new THREE.Mesh(guarda(mergeGeometries(tubos)!), matCabo)); for (const t of tubos) t.dispose();
  }
  // ── as LIGAÇÕES PROBLEMA → SOLUÇÃO: de cada card até o telão das soluções, um cabo na cor do tema com o pulso
  //    correndo do problema pra solução (as pontas se abrem ao longo do pé do telão) ──
  const matLiga = Object.fromEntries(TEMAS.map((tema) => [tema, guarda(new THREE.ShaderMaterial({
    uniforms: { uT, uCor: { value: new THREE.Color(TEMA[tema].cor) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uT; uniform vec3 uCor; varying vec2 vUv;
      void main() { float pulso = pow(max(0.0, sin((vUv.x * 10.0 - uT * 2.2) * 3.14159)), 5.0);
        gl_FragColor = vec4(mix(uCor * 0.18, uCor * 1.6, 0.2 + 0.8 * pulso), 1.0); }`,
  }))]));
  {
    const porTema = new Map<string, THREE.BufferGeometry[]>();
    LIGACOES.forEach((l, k) => {
      const S = TELOES_SOLUCAO[Math.floor(k / TEMAS.length)]!, j = k % TEMAS.length, off = (j - 1.5) * 5;
      const a = new THREE.Vector3(l.de.x, 0.3, l.de.z), b = new THREE.Vector3(l.para.x + Math.cos(S.rot) * off, 0.3, l.para.z - Math.sin(S.rot) * off);
      const m = a.clone().lerp(b, 0.5); m.y = 1.6 + j * 0.5;   // um arco baixo (um por cima do outro, sem se embolar)
      const tubo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 28, 0.22, 6, false);
      (porTema.get(l.tema) ?? porTema.set(l.tema, []).get(l.tema)!).push(tubo);
    });
    for (const [tema, l] of porTema) { group.add(new THREE.Mesh(guarda(mergeGeometries(l)!), matLiga[tema]!)); for (const t of l) t.dispose(); }
  }

  // ── os TOTENS dos temas (clima, florestas, oceanos, água): placas de luz com os problemas de cada um ──
  const texTotem = !TOTENS.length ? {} as Record<string, THREE.Texture> : Object.fromEntries(Object.entries(TEMA).map(([k, T]) => [k, guarda((() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 512; const g = c.getContext("2d")!;
    g.fillStyle = "#04101c"; g.fillRect(0, 0, 256, 512); g.strokeStyle = T.cor; g.lineWidth = 6; g.strokeRect(6, 6, 244, 500);
    g.fillStyle = T.cor; g.font = "900 40px system-ui, sans-serif"; g.textAlign = "center"; g.fillText(T.nome, 128, 70);
    g.beginPath(); g.arc(128, 170, 52, 0, Math.PI * 2); g.lineWidth = 8; g.stroke();
    g.font = "bold 22px system-ui, sans-serif"; g.fillStyle = "#e6f6ff"; T.linhas.forEach((l, i) => g.fillText(l, 128, 290 + i * 46));
    g.fillStyle = "rgba(255,106,118,.85)"; g.font = "bold 20px system-ui, sans-serif"; g.fillText("PROBLEMA", 128, 452);
    g.fillStyle = "rgba(125,255,166,.9)"; g.fillText("→ veja as soluções", 128, 482);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })())]));
  for (const tt of TOTENS) {
    const g = new THREE.Group(); g.position.set(tt.x, 0, tt.z); g.rotation.y = tt.rot; group.add(g);
    const corpo = new THREE.Mesh(guarda(new THREE.BoxGeometry(2.6, 5.4, 0.5)), matMoldura); corpo.position.y = 3.6; g.add(corpo);
    const face = new THREE.Mesh(guarda(new THREE.PlaneGeometry(2.3, 4.6)), guarda(new THREE.MeshBasicMaterial({ map: texTotem[tt.tema]! }))); face.position.set(0, 3.6, 0.26); g.add(face);
    const base = new THREE.Mesh(guarda(new THREE.CylinderGeometry(1.5, 1.7, 0.9, 16)), matPalco); base.position.y = 0.45; g.add(base);
  }

  // ── MOTORES DE ENERGIA: núcleo de plasma + 3 anéis-giroscópio — acordam com gente perto ──
  const motores = MOTORES.map((m, i) => {
    const g = new THREE.Group(); g.position.set(m.x, 0, m.z); group.add(g);
    const base = new THREE.Mesh(guarda(new THREE.CylinderGeometry(m.r, m.r + 0.8, 1.6, 20)), matMoldura); base.position.y = 0.8; g.add(base);
    const nucleoMat = guarda(new THREE.MeshBasicMaterial({ color: 0x66e6ff })), nucleo = new THREE.Mesh(guarda(new THREE.IcosahedronGeometry(1.3, 2)), nucleoMat); nucleo.position.y = 5; g.add(nucleo);
    const aneisMat = guarda(new THREE.MeshStandardMaterial({ color: 0x1a2440, metalness: 0.9, roughness: 0.25, emissive: 0x45d6ff, emissiveIntensity: 0.3 }));
    const aneis = [2.4, 3.0, 3.6].map((r, k) => { const a = new THREE.Mesh(guarda(new THREE.TorusGeometry(r, 0.16, 8, 48)), aneisMat); a.position.y = 5; a.rotation.set(k * 0.9, k * 0.5, 0); g.add(a); return a; });
    const brilho = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: brilhoTex(), color: 0x66e6ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }))); brilho.position.y = 5; brilho.scale.setScalar(6); if (!low) g.add(brilho);   // (leve: sem o halo)
    return { m, nucleo, nucleoMat, aneis, aneisMat, brilho, vel: 0.2, fase: i };
  });
  function brilhoTex() { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(220,250,255,1)"); gr.addColorStop(0.4, "rgba(102,230,255,.5)"); gr.addColorStop(1, "rgba(40,120,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return guarda(new THREE.CanvasTexture(c)); }

  // ── SUPERTREES hídricas (fundidas: 1 malha por material) ──
  const partes = { tronco: [] as THREE.BufferGeometry[], trel: [] as THREE.BufferGeometry[], galhos: [] as THREE.BufferGeometry[], copa: [] as THREE.BufferGeometry[], aro: [] as THREE.BufferGeometry[], espelho: [] as THREE.BufferGeometry[] };
  const veus: { x: number; z: number; y: number; r: number }[] = [];
  for (const s of SUPERTREES) {
    const st = supertree(s.alt, s.copa, low), mv = (g: THREE.BufferGeometry) => g.translate(s.x, 0, s.z);
    partes.tronco.push(mv(st.tronco.toNonIndexed())); partes.trel.push(mv(st.trel)); partes.galhos.push(mv(st.galhos)); partes.copa.push(mv(st.copa.toNonIndexed())); partes.aro.push(mv(st.aro.toNonIndexed()));
    const esp = new THREE.CircleGeometry(s.copa * 0.7, 32); esp.rotateX(-Math.PI / 2); esp.translate(s.x, 0.08, s.z); partes.espelho.push(esp.toNonIndexed());
    veus.push({ x: s.x, z: s.z, y: st.yT + 4, r: s.copa });
  }
  const fundir = (l: THREE.BufferGeometry[]) => guarda(mergeGeometries(l)!);
  const matTronco = guarda(new THREE.MeshStandardMaterial({ color: 0x2c5a3a, roughness: 0.85, metalness: 0.05, emissive: 0x12331f, emissiveIntensity: 0.7 }));
  const matTrel = guarda(new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55 }));
  const matGalho = guarda(new THREE.MeshStandardMaterial({ color: 0x3a4a5e, roughness: 0.4, metalness: 0.75, emissive: 0x6a3cff, emissiveIntensity: 0.35 }));
  const matCopa = guarda(new THREE.MeshStandardMaterial({ color: 0x1a2440, roughness: 0.5, metalness: 0.6, emissive: 0x6a3cff, emissiveIntensity: 0.45, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
  const matAro = guarda(new THREE.MeshBasicMaterial({ color: 0xb98cff }));
  const matEspelho = guarda(new THREE.MeshStandardMaterial({ color: 0x0a2a44, roughness: 0.08, metalness: 0.4, emissive: 0x1f6dff, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 }));
  group.add(new THREE.Mesh(fundir(partes.tronco), matTronco), new THREE.Mesh(fundir(partes.galhos), matGalho),
    new THREE.Mesh(fundir(partes.copa), matCopa), new THREE.Mesh(fundir(partes.aro), matAro), new THREE.Mesh(fundir(partes.espelho), matEspelho));
  if (!low) group.add(new THREE.LineSegments(fundir(partes.trel), matTrel));   // (leve: árvore SIMPLES — sem a treliça de linhas)
  // o VÉU d'água: gotas caindo da borda da copa até o espelho (uma nuvem de pontos pra todas as árvores)
  const PORV = low ? 0 : 110, NV = veus.length * PORV, vPos = new Float32Array(NV * 3), gotas = Array.from({ length: NV }, (_, i) => { const v = veus[Math.floor(i / PORV)]!, a = Math.random() * Math.PI * 2, rr = v.r * (0.75 + Math.random() * 0.25); return { v, x: v.x + Math.cos(a) * rr, z: v.z + Math.sin(a) * rr, y: Math.random() * v.y, vel: 9 + Math.random() * 6 }; });
  const vGeo = guarda(new THREE.BufferGeometry()); vGeo.setAttribute("position", new THREE.BufferAttribute(vPos, 3));
  const veu = new THREE.Points(vGeo, guarda(new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.45, map: brilhoTex(), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }))); veu.frustumCulled = false; if (NV) group.add(veu);   // (leve: sem o véu d'água — partículas somadas por cima de tudo)

  let perto: { x: number; z: number }[] = [];
  return {
    group, alvos,
    presencas(p) { perto = p; },
    atualizar(dt, t) {
      uT.value = t;
      for (const g of globos) g.rotation.y += dt * 0.08;
      { const p = 0.5 + 0.5 * Math.sin(t * 1.6); matAura.opacity = 0.16 + 0.12 * p; matColuna.opacity = 0.28 + 0.2 * p; matHolofote.opacity = 0.16 + 0.12 * p; void auras; }
      // motores: o mais perto acorda o motor (gira mais rápido, o núcleo e os anéis acendem)
      for (const m of motores) {
        let d = Infinity; for (const p of perto) d = Math.min(d, Math.hypot(p.x - m.m.x, p.z - m.m.z));
        const alvo = 0.2 + 2.6 * reacaoDoMotor(d); m.vel += (alvo - m.vel) * Math.min(1, dt * 2);
        const e = (m.vel - 0.2) / 2.6;
        m.aneis.forEach((a, k) => { a.rotation.x += dt * m.vel * (0.6 + k * 0.35); a.rotation.y += dt * m.vel * (0.4 + k * 0.25) * (k % 2 ? -1 : 1); });
        m.aneisMat.emissiveIntensity = 0.3 + 1.6 * e; m.nucleo.scale.setScalar(1 + 0.25 * e + 0.06 * Math.sin(t * (3 + 9 * e) + m.fase));
        m.nucleoMat.color.setHSL(0.53 - 0.06 * e, 1, 0.55 + 0.25 * e); (m.brilho.material as THREE.SpriteMaterial).opacity = 0.35 + 0.6 * e; m.brilho.scale.setScalar(6 + 6 * e);
      }
      // supertrees: o show de luz (as cores das copas variando devagar) e o véu d'água caindo
      const h = (t * 0.02) % 1; matAro.color.setHSL(h, 0.8, 0.65); matCopa.emissive.setHSL((h + 0.08) % 1, 0.8, 0.35); matGalho.emissive.setHSL((h + 0.04) % 1, 0.8, 0.3);
      for (let i = 0; i < gotas.length; i++) { const g = gotas[i]!; g.y -= g.vel * dt; if (g.y < 0.2) g.y = g.v.y; vPos[i * 3] = g.x; vPos[i * 3 + 1] = g.y; vPos[i * 3 + 2] = g.z; }
      vGeo.attributes.position!.needsUpdate = true;
    },
    dispose() { for (const x of liberar) x.dispose(); group.removeFromParent(); },
  };
}
