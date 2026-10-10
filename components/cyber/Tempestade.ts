/**
 * Tempestade — a névoa + os relâmpagos (usada em cima da capela do TEMPLO, no ritual, e no LOUNGE, durante o show da
 * música — lib/cyber/showLounge): "um vendaval que não começa". As nuvens giram em volta de um centro (um disco largo,
 * mais alto na borda), relâmpagos estouram DENTRO delas e caem (num alvo, no abismo em volta ou correndo na nuvem), o
 * clarão acende a nuvem; quem toca o trovão é o engine. Sem chuva.
 *  - as nuvens: UM draw (billboards instanciados; o giro, o balanço, a formação e o clarão no shader);
 *  - os raios: segmentos instanciados (o miolo branco + o halo violeta aditivo), ~2 draws.
 * `definir(intensidade, raios)`: 0 = céu limpo (as nuvens vêm de longe e se juntam conforme a intensidade sobe);
 * `raioAgora(alvo?, vel?)`: um relâmpago já (em `alvo`, local do grupo), com a VELOCIDADE do piscar (1 = normal).
 */
import * as THREE from "three";

/** a textura de uma nuvem: vários tufos macios sobrepostos (canvas), alpha na borda */
export function texturaNuvem(): THREE.CanvasTexture {
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d")!;
  let x = 12345; const r = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 26; i++) {
    const cx = S / 2 + (r() - 0.5) * S * 0.5, cy = S / 2 + (r() - 0.5) * S * 0.36, rr = S * (0.12 + r() * 0.2);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); gr.addColorStop(0, `rgba(255,255,255,${0.22 + r() * 0.2})`); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
  }
  return new THREE.CanvasTexture(c);
}

/**
 * A TEMPESTADE em cima do templo — "um vendaval que não começa": a névoa girando em volta da ponta da capela (que fura as
 * nuvens), relâmpagos estourando DENTRO delas e caindo (no abismo ou na ponta), o clarão acendendo a nuvem em volta e o
 * trovão (quem ouve é o engine: `aoTrovao`). Sem chuva: o vento gira, a tempestade fica sempre armando.
 *  - as nuvens: UM draw (billboards instanciados; o giro, o balanço e o clarão no shader);
 *  - os raios: segmentos instanciados (o miolo branco + o halo violeta aditivo), ~2 draws.
 */
export type TempestadeHandle = ReturnType<typeof criarTempestade>;
export function criarTempestade(o: { low: boolean; yBase: number; yTopo: number; raioMax: number; alvoPonta: THREE.Vector3; /** a cor das nuvens (escura) e do clarão */ cor?: THREE.Color; /** sem o abismo em volta (o lounge): os raios à toa caem no alvo ou correm na nuvem */ semAbismo?: boolean; /** a densidade da névoa (1 = a do templo; o lounge usa menos: névoa LEVE) */ densidade?: number }) {
  const g = new THREE.Group(); g.name = "tempestade";
  const N = o.low ? 60 : 130, tex = texturaNuvem();
  const base = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.setAttribute("position", base.getAttribute("position")); geo.setAttribute("uv", base.getAttribute("uv"));
  const aN = new Float32Array(N * 4), aT = new Float32Array(N * 2);
  let sd = 777; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    const r = (0.15 + 0.85 * Math.sqrt(rnd())) * o.raioMax, y = o.yBase + (rnd() * 0.7 + 0.3 * (r / o.raioMax)) * (o.yTopo - o.yBase);   // um disco largo, mais alto na borda (a bigorna)
    aN.set([r, rnd() * Math.PI * 2, y, (0.05 + 0.12 * (1 - r / o.raioMax)) * (1 + rnd() * 0.4)], i * 4);   // o miolo gira mais rápido (o redemoinho)
    aT.set([26 + rnd() * 34, rnd() * 6.28], i * 2);
  }
  geo.setAttribute("aNuvem", new THREE.InstancedBufferAttribute(aN, 4)); geo.setAttribute("aTam", new THREE.InstancedBufferAttribute(aT, 2)); geo.instanceCount = N;
  const corNuvem = o.cor ?? new THREE.Color(0.16, 0.14, 0.24);
  const uni = { uT: { value: 0 }, uTex: { value: tex }, uFlashP: { value: new THREE.Vector3() }, uFlash: { value: 0 }, uI: { value: 0 }, uCor: { value: corNuvem }, uDens: { value: o.densidade ?? 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false,
    vertexShader: `attribute vec4 aNuvem; attribute vec2 aTam; uniform float uT, uI; varying vec2 vUv; varying vec3 vW; varying float vF;
      void main(){
        float a = aNuvem.y + uT * aNuvem.w * (0.6 + 0.8 * uI);
        float r = aNuvem.x * (1.7 - 0.7 * uI);   // se formando: as nuvens vêm de longe e se juntam em volta da ponta
        vec3 c = vec3(cos(a) * r, aNuvem.z + 12.0 * (1.0 - uI) + sin(uT * 0.3 + aTam.y) * 1.8, sin(a) * r);
        vec4 mv = modelViewMatrix * vec4(c, 1.0);
        float rot = aTam.y + uT * 0.04 * (mod(aTam.y * 3.0, 2.0) - 1.0);
        mv.xy += mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy * aTam.x;
        vUv = uv; vW = c; vF = aTam.y; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D uTex; uniform vec3 uFlashP, uCor; uniform float uFlash, uT, uI, uDens; varying vec2 vUv; varying vec3 vW; varying float vF;
      void main(){
        float a = texture2D(uTex, vUv).a;
        float d = length(vW - uFlashP), luz = uFlash * exp(-d * d / 1400.0);
        vec3 c = mix(uCor, uCor * 1.9, 0.5 + 0.5 * sin(vF * 4.0 + uT * 0.2));
        c += vec3(0.85, 0.8, 1.0) * luz * 2.6;
        gl_FragColor = vec4(c, a * (0.32 + 0.4 * luz) * uI * uDens);   // nevoa LEVE: da pra ver a ponta atravessando; uI = a tempestade se formando
      }`,
  });
  const nuvens = new THREE.Mesh(geo, mat); nuvens.frustumCulled = false; nuvens.renderOrder = 5; g.add(nuvens);

  // os RAIOS: até MAX segmentos (cilindro unitário esticado de ponto a ponto)
  const MAX = 90, cil = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); cil.translate(0, 0.5, 0);
  const miolo = new THREE.InstancedMesh(cil, new THREE.MeshBasicMaterial({ color: 0xf4eeff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), MAX);
  const halo = new THREE.InstancedMesh(cil, new THREE.MeshBasicMaterial({ color: 0x9a6bff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), MAX);
  for (const m of [miolo, halo]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 6; g.add(m); }
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sv = new THREE.Vector3(), dv = new THREE.Vector3();
  let n = 0;
  const seg = (a: THREE.Vector3, b: THREE.Vector3, esp: number) => {
    if (n >= MAX) return; dv.copy(b).sub(a); const L = dv.length(); q.setFromUnitVectors(up, dv.normalize());
    miolo.setMatrixAt(n, mm.compose(a, q, sv.set(esp, L, esp))); halo.setMatrixAt(n, mm.compose(a, q, sv.set(esp * 5, L, esp * 5))); n++;
  };
  /** um raio torto de `a` até `b` (deslocamento do ponto médio), com galhos */
  const raio = (a: THREE.Vector3, b: THREE.Vector3, esp: number, nivel: number) => {
    const pts = [a.clone(), b.clone()];
    for (let it = 0; it < 4; it++) for (let i = pts.length - 1; i > 0; i--) {
      const p0 = pts[i - 1]!, p1 = pts[i]!, L = p0.distanceTo(p1), m = p0.clone().lerp(p1, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * L * 0.45, (Math.random() - 0.5) * L * 0.2, (Math.random() - 0.5) * L * 0.45));
      pts.splice(i, 0, m);
    }
    for (let i = 1; i < pts.length; i++) {
      seg(pts[i - 1]!, pts[i]!, esp);
      if (nivel < 1 && Math.random() < 0.12) { const d = pts[i]!.clone().add(new THREE.Vector3((Math.random() - 0.5) * 22, -6 - Math.random() * 14, (Math.random() - 0.5) * 22)); raio(pts[i]!, d, esp * 0.55, nivel + 1); }
    }
  };
  let prox = 2 + Math.random() * 3, ini = -1, dur = 0.5, forcar: { alvo: THREE.Vector3 | null; vel: number } | null = null, intensidade = 0, comRaios = false, velAtual = 1;
  const flashP = uni.uFlashP.value;
  return {
    group: g,
    /** devolve onde caiu o raio (local do templo), se caiu um agora */
    /** a intensidade das nuvens (0..1) e se os raios caem — do ritual */
    definir(i: number, raios: boolean) { intensidade = i; comRaios = raios; uni.uI.value = i; g.visible = i > 0.005; },
    atualizar(t: number): THREE.Vector3 | null {
      uni.uT.value = t;
      let caiu: THREE.Vector3 | null = null;
      if (intensidade <= 0.005) { if (ini >= 0) { ini = -1; miolo.visible = halo.visible = false; uni.uFlash.value = 0; } return null; }
      if (!comRaios && !forcar) prox = Math.max(prox, t + 0.5);   // ainda só nuvens: os raios esperam
      if ((t >= prox || forcar) && ini < 0) {
        const alvoForcado = forcar?.alvo?.clone() ?? null; velAtual = forcar?.vel ?? 1; forcar = null;
        ini = t; dur = (0.35 + Math.random() * 0.35) / velAtual; n = 0;
        const a0 = Math.random() * Math.PI * 2, r0 = 8 + Math.random() * o.raioMax * 0.7, de = new THREE.Vector3(Math.cos(a0) * r0, o.yBase + Math.random() * (o.yTopo - o.yBase), Math.sin(a0) * r0);
        const tipo = Math.random();
        const para = alvoForcado ? alvoForcado : tipo < (o.semAbismo ? 0.55 : 0.3) ? o.alvoPonta.clone()   // na ponta da capela (o para-raio)
          : tipo < 0.75 && !o.semAbismo ? new THREE.Vector3(Math.cos(a0 + 0.6) * (48 + Math.random() * 30), -20 - Math.random() * 40, Math.sin(a0 + 0.6) * (48 + Math.random() * 30))   // caindo no abismo, por fora do templo
          : new THREE.Vector3(Math.cos(a0 + 2) * r0, de.y - 4 + Math.random() * 8, Math.sin(a0 + 2) * r0);   // correndo DENTRO da nuvem
        raio(de, para, 0.22 + Math.random() * 0.12, 0);
        for (const m of [miolo, halo]) { m.count = n; m.instanceMatrix.needsUpdate = true; }
        flashP.copy(de); caiu = de.clone();
        prox = t + (Math.random() < 0.25 ? 0.5 + Math.random() : 3 + Math.random() * 6);   // às vezes vem um logo atrás do outro
      }
      if (ini >= 0) {
        const k = (t - ini) / dur, piscar = k < 1 ? Math.max(0, Math.sin(k * Math.PI * 3)) * (1 - k * 0.6) : 0;
        uni.uFlash.value = piscar; miolo.visible = halo.visible = piscar > 0.05;
        (halo.material as THREE.MeshBasicMaterial).opacity = 0.35 * piscar; (miolo.material as THREE.MeshBasicMaterial).opacity = piscar;
        if (k >= 1) { ini = -1; miolo.visible = halo.visible = false; uni.uFlash.value = 0; }
      } else uni.uFlash.value = 0;
      return caiu;
    },
    /** um raio já — em `alvo` (local do templo) ou à toa */
    raioAgora(alvo?: THREE.Vector3, vel = 1) { forcar = { alvo: alvo ?? null, vel }; },
    dispose() { tex.dispose(); base.dispose(); geo.dispose(); mat.dispose(); cil.dispose(); (miolo.material as THREE.Material).dispose(); (halo.material as THREE.Material).dispose(); g.removeFromParent(); },
  };
}

