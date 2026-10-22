"use client";
// PRÉVIA LOCAL: o TRAJE ÚNICO (scripts/avatar/traje-unico.mjs) — o masculino, a FEMININA (o mesmo esqueleto e a mesma
// malha, ajeitada), a versão LEVE (os outros personagens) e sem capacete. Arraste pra girar.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { toon } from "@/components/cyber/AvatarAnime";
import { criarCabeca } from "@/components/cyber/CabecaAnime";
import { rostoDe } from "@/lib/cyber/rosto";
import { carregarModeloAvatar, criarAvatarLuz, type AvatarLuzHandle } from "@/components/cyber/AvatarLuz";
import { glowTex } from "@/components/cyber/CenaCosmica";
import { paletaFeminina } from "@/components/cyber/CorpoAstronauta";
import { criarMultidaoDeTraje, type MultidaoHandle } from "@/components/cyber/MultidaoGPU";

const ZONAS = [0xd0cece, 0x14162a, 0x2a2a2a];
function matZonas(cores: number[]) {
  const m = toon(0xffffff, { rim: new THREE.Color("#9fb7ff"), rimForca: 0.5, brilho: 0.35 });
  const antes = m.onBeforeCompile, u = { value: cores.map((c) => new THREE.Color(c).multiplyScalar(1.35)) };
  m.onBeforeCompile = (sh, r) => {
    antes.call(m, sh, r); sh.uniforms.uZonas = u;
    sh.vertexShader = "attribute float _zona;\nuniform vec3 uZonas[3];\nvarying vec3 vZona;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvZona = uZonas[int(_zona + 0.5)];");
    sh.fragmentShader = "varying vec3 vZona;\n" + sh.fragmentShader.replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse * vZona, opacity );");
  };
  return m;
}

export default function Feminina() {
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState("");
  useEffect(() => {
    const el = ref.current!; const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setPixelRatio(Math.min(2, devicePixelRatio)); R.setSize(el.clientWidth, el.clientHeight); el.appendChild(R.domElement);
    const cena = new THREE.Scene(); cena.background = new THREE.Color(0x07091a);
    cena.add(new THREE.HemisphereLight(0x99aaff, 0x10101c, 0.9)); const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(2, 4, 3); cena.add(d);
    const cam = new THREE.PerspectiveCamera(30, el.clientWidth / el.clientHeight, 0.05, 100); cam.position.set(0, 1.2, 12);
    const oc = new OrbitControls(cam, R.domElement); oc.target.set(0, 0.95, 0); oc.enableDamping = true;
    // ?foco=<coluna 0..5>: a câmera de perto no rosto
    const foco = new URLSearchParams(location.search).get("foco");
    if (foco !== null) { const x = -3 + Number(foco) * 1.2; cam.position.set(x + 0.35, 1.7, 1.3); oc.target.set(x, 1.62, 0); }
    const chao = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x0e1430, roughness: 1 })); chao.rotation.x = -Math.PI / 2; cena.add(chao);
    const L = new GLTFLoader(); let vivo = true;
    const tag = (txt: string, x: number) => { const c = document.createElement("canvas"); c.width = 512; c.height = 96; const g = c.getContext("2d")!; g.fillStyle = "#cfd8ff"; g.font = "bold 40px system-ui"; g.textAlign = "center"; g.fillText(txt, 256, 60); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true })); s.scale.set(1.2, 0.22, 1); s.position.set(x, 2.15, 0); cena.add(s); };
    // ?bots=1: como as IAs da frota — o avatar do jogo com o traje LEVE, andando em roda; o capacete sobe e desce
    const bots: { av: AvatarLuzHandle; id: string; fem: boolean; a: number }[] = [];
    const multidoes: { mt: MultidaoHandle; modelo: "m" | "f" }[] = [];
    const comBots = new URLSearchParams(location.search).has("bots"), fila = new URLSearchParams(location.search).has("fila");
    if (comBots) void carregarModeloAvatar().then((gltf) => {
      if (!vivo) return;
      const starTex = glowTex("rgba(255,255,255,1)", "rgba(190,215,255,0.5)");
      const cores = ["#ff5fa2", "#4fc3ff", "#ffd24f", "#8b5cf6", "#5fffb0", "#ff8a4f", "#c0c8ff", "#ff4f4f"];
      cores.forEach((cor, i) => {
        const fem = i % 2 === 0, id = `ia-${i * 37 + 11}`;
        const av = criarAvatarLuz(cor, starTex, true, gltf, { anime: true }); cena.add(av.group);
        av.traje(true, { paleta: fem ? paletaFeminina(cor) : (cor as `#${string}`), modelo: fem ? "f" : "m", leve: true, rosto: rostoDe(id, fem) });
        bots.push({ av, id, fem, a: (i / cores.length) * Math.PI * 2 });
      });
      // ?multidao: a MULTIDÃO de longe (assada na placa de vídeo) com o traje novo — uma roda maior em volta
      if (new URLSearchParams(location.search).has("multidao")) void (async () => {
        for (const modelo of ["m", "f"] as const) {
          const t0 = performance.now(), mt = await criarMultidaoDeTraje({ gltf, starTex, max: 60, modelo });
          if (!vivo) { mt.dispose(); return; }
          console.info(`[prévia] multidão de traje ${modelo} em ${Math.round(performance.now() - t0)} ms`);
          cena.add(mt.malha); multidoes.push({ mt, modelo });
        }
      })();
      cam.position.set(0, 2.2, 6.5); oc.target.set(0, 1, 0);
      const foco = new URLSearchParams(location.search).get("foco");
      if (fila && foco !== null) { const x = (Number(foco) - 3.5) * 0.9; cam.position.set(x + 0.3, 1.75, 1.2); oc.target.set(x, 1.62, 0); }
    });
    if (!comBots) void Promise.all(["m", "f"].map((g) => L.loadAsync(`/avatars/traje/traje-${g}.glb`))).then(([m, f]) => {
      if (!vivo) return;
      const pecas = (fonte: THREE.Object3D, x: number, op: { leve?: boolean; semCasco?: boolean; cores?: number[]; rosto?: string; fem?: boolean }, nome: string) => {
        const c = skClone(fonte); const mat = matZonas(op.cores ?? ZONAS);
        c.traverse((o) => {
          const sm = o as THREE.SkinnedMesh; if (!sm.isSkinnedMesh) return; sm.frustumCulled = false;
          const leve = sm.name.endsWith("_leve"), base = sm.name.replace("_leve", "");
          sm.visible = leve === !!op.leve || base === "visera";
          if (base === "casco" || base === "visera") sm.visible &&= !op.semCasco;
          if (base !== "visera") sm.material = mat;
          else sm.material = new THREE.MeshBasicMaterial({ color: 0x3a2a14, transparent: true, opacity: 0.38, depthWrite: false });
        });
        // a altura de ~1,8 m
        c.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(c, true); const k = 1.8 / (bb.max.y - bb.min.y); c.scale.multiplyScalar(k);
        c.updateMatrixWorld(true); const bb2 = new THREE.Box3().setFromObject(c, true); c.position.set(x, -bb2.min.y, 0);
        cena.add(c); tag(nome, x);
        if (op.semCasco) {   // a CABEÇA de anime no osso da cabeça: no centro do capacete, olhando pra frente, em metros
          let cab: THREE.Object3D | null = null; c.traverse((o) => { if (!cab && (o as THREE.Bone).isBone && o.name === "mixamorigHead") cab = o; });
          const h = criarCabeca(rostoDe(op.rosto ?? nome, !!op.fem)), osso = cab! as THREE.Object3D;
          c.updateMatrixWorld(true); const p = osso.getWorldPosition(new THREE.Vector3()); p.y += 0.12; p.z += 0.015;
          osso.add(h.grupo); h.grupo.position.copy(osso.worldToLocal(p));
          h.grupo.quaternion.copy(osso.getWorldQuaternion(new THREE.Quaternion()).invert());
          const ws = osso.getWorldScale(new THREE.Vector3()); h.grupo.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
        }
      };
      pecas(m.scene, -3, {}, "masculino");
      pecas(f.scene, -1.8, { cores: [0xe6a7c8, 0x2a1830, 0x1d1d22] }, "feminina");
      pecas(f.scene, -0.6, { leve: true, cores: [0x9fd8e6, 0x14222a, 0x1d1d22] }, "leve");
      pecas(f.scene, 0.6, { semCasco: true, fem: true, cores: [0xf0d070, 0x2a2410, 0x1d1d22] }, "ana");
      pecas(f.scene, 1.8, { semCasco: true, fem: true, cores: [0x8a7cf0, 0x1a1830, 0x1d1d22] }, "bia");
      pecas(m.scene, 3, { semCasco: true, cores: [0x70d0a0, 0x10241a, 0x1d1d22] }, "caio");
    });
    (window as unknown as { __fem: unknown; __femCam: unknown }).__fem = cena; (window as unknown as { __femCam: unknown }).__femCam = { cam, oc, bots };
    const t0 = performance.now(); let tAnt = 0;
    let raf = 0; const loop = () => { raf = requestAnimationFrame(loop); oc.update();
      const t = (performance.now() - t0) / 1000, dt = Math.min(0.05, t - tAnt); tAnt = t;
      for (const { mt, modelo } of multidoes) {   // 20 de cada em roda (raio 6 m), andando
        mt.comecar();
        for (let i = 0; i < 20; i++) { const an = (i / 20) * Math.PI * 2 + (modelo === "f" ? 0.15 : 0) + t * 0.05; mt.adicionar(Math.cos(an) * 6, 0, Math.sin(an) * 6, -an, "andando", new THREE.Color().setHSL(i / 20, 0.6, 0.55), i * 0.37, i % 2 === 0); }
        mt.fechar(); mt.atualizar(t);
      }
      for (const b of bots) {   // andam em roda (raio 2,4 m); a cada 4 s metade põe o capacete
        if (fila) { const i = bots.indexOf(b); b.av.group.position.set((i - 3.5) * 0.9, 0, 0); b.av.olharPara(0); }   // (?fila: lado a lado, de frente pra câmera, andando no lugar)
        else { b.a += dt * 0.25; b.av.group.position.set(Math.cos(b.a) * 2.4, 0, Math.sin(b.a) * 2.4); b.av.olharPara(-b.a + Math.PI); }
        b.av.rostoTraje(Math.floor(t / 4) % 2 === (b.fem ? 0 : 1) ? null : rostoDe(b.id, b.fem));
        b.av.animar({ andando: true, dt, t });
      } R.render(cena, cam); setInfo(`chamadas ${R.info.render.calls} · triângulos ${R.info.render.triangles}`); };
    loop();
    const rs = () => { R.setSize(el.clientWidth, el.clientHeight); cam.aspect = el.clientWidth / el.clientHeight; cam.updateProjectionMatrix(); }; addEventListener("resize", rs);
    return () => { vivo = false; cancelAnimationFrame(raf); removeEventListener("resize", rs); R.dispose(); el.innerHTML = ""; };
  }, []);
  return <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#07091a" }}><div ref={ref} style={{ position: "absolute", inset: 0 }} /><div style={{ position: "absolute", left: 12, top: 10, zIndex: 1, color: "#cfd8ff", font: "13px system-ui" }}>{info}</div></div>;
}
