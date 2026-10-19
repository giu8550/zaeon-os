"use client";
// PRÉVIA LOCAL: o TRAJE ESPACIAL (components/cyber/TrajeEspacial) na fundadora — placas no esqueleto mixamo, o rosto de
// anime dentro do capacete — com o RIFLE e as animações dele (public/anim/rifle). Arraste pra girar a câmera.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { carregarModeloAvatar, criarAvatarLuz, type AvatarLuzHandle } from "@/components/cyber/AvatarLuz";
import { carregarVrm, tingirVrm } from "@/components/cyber/AvatarVrm";
import { glowTex } from "@/components/cyber/CenaCosmica";
import { criarRifleCosmico } from "@/components/cyber/RifleCosmico";
import { CORPO_DO_FUNDADOR } from "@/lib/cyber/estiloAvatar";
import type { NomeClipeRifle } from "@/lib/cyber/rifle";

type Andar = "parado" | "frente" | "tras" | "esq" | "dir";
const ANDARES: [Andar, string][] = [["parado", "Parado"], ["frente", "Andar ↑"], ["tras", "Ré ↓"], ["esq", "Lado ←"], ["dir", "Lado →"]];
const CLIPES: [NomeClipeRifle, string][] = [["gira", "Virar"], ["freia", "Frear"], ["cambaleia", "Cambalear"], ["morre", "Morrer"], ["morreDir", "Morrer (lado)"]];

export default function Traje() {
  const ref = useRef<HTMLDivElement>(null);
  const [traje, setTraje] = useState(true), [rifle, setRifle] = useState(true), [mira, setMira] = useState(false), [andar, setAndar] = useState<Andar>("parado");
  const [pronto, setPronto] = useState(false);
  const est = useRef({ traje, rifle, mira, andar }); est.current = { traje, rifle, mira, andar };
  const avRef = useRef<AvatarLuzHandle | null>(null);

  useEffect(() => {
    const el = ref.current!; const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setPixelRatio(Math.min(2, devicePixelRatio)); R.setSize(el.clientWidth, el.clientHeight); el.appendChild(R.domElement);
    const cena = new THREE.Scene(); cena.background = new THREE.Color(0x07091a);
    const pm = new THREE.PMREMGenerator(R); cena.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    cena.add(new THREE.HemisphereLight(0x99aaff, 0x10101c, 0.9)); const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(2, 4, 3); cena.add(d);
    const cam = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, 0.05, 100); cam.position.set(1.8, 1.6, 3.6);
    const oc = new OrbitControls(cam, R.domElement); oc.target.set(0, 1.15, 0); oc.enableDamping = true;
    const chao = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshStandardMaterial({ color: 0x0e1430, roughness: 1 })); chao.rotation.x = -Math.PI / 2; cena.add(chao);
    cena.add(new THREE.GridHelper(8, 16, 0x5a6cc0, 0x1b2550));

    const starTex = glowTex("rgba(255,255,255,1)", "rgba(190,215,255,0.5)");
    const arma = criarRifleCosmico({ low: false });
    let av: AvatarLuzHandle | null = null, vivo = true;
    void carregarModeloAvatar().then((gltf) => {
      if (!vivo) return;
      const a = criarAvatarLuz("#8b5cf6", starTex, false, gltf, { anime: true }); a.olharPara(0); cena.add(a.group); av = a; avRef.current = a;
      a.esperarCorpo(true);
      carregarVrm(CORPO_DO_FUNDADOR.url).then((vrm) => { if (!vivo) return; tingirVrm(vrm, CORPO_DO_FUNDADOR.tintas); a.usarVrm(vrm); setPronto(true); })
        .catch(() => { a.esperarCorpo(false); setPronto(true); });
    }).catch(() => {});

    const alvo = new THREE.Vector3(); const t0 = performance.now(); let tAnt = 0, raf = 0, naMao = 0, wMira = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = (performance.now() - t0) / 1000, dt = Math.min(0.05, t - tAnt); tAnt = t;
      const e = est.current;
      naMao += ((e.rifle ? 1 : 0) - naMao) * Math.min(1, dt * 6); wMira += ((e.rifle && e.mira ? 1 : 0) - wMira) * Math.min(1, dt * 8);
      if (av) {
        av.traje(e.traje);
        const fr = e.andar === "frente" ? 1 : e.andar === "tras" ? -1 : 0, la = e.andar === "esq" ? -1 : e.andar === "dir" ? 1 : 0, anda = e.andar !== "parado";
        alvo.set(0, 1.45, 20);   // (ela olha pro +Z)
        av.rifle(naMao > 0.01 ? { naMao, mira: wMira, frente: fr, lado: la, coice: 0, alvo, arma: arma.group } : null);
        av.animar({ andando: anda, correndo: false, dt, t });
      }
      arma.atualizar(t, dt, { revela: naMao, calor: 0 });
      oc.update(); R.render(cena, cam);
    };
    loop();
    const onR = () => { cam.aspect = el.clientWidth / el.clientHeight; cam.updateProjectionMatrix(); R.setSize(el.clientWidth, el.clientHeight); };
    window.addEventListener("resize", onR);
    (window as unknown as { __traje: unknown }).__traje = { get av() { return av; }, cam, oc, R, cena };
    return () => { vivo = false; cancelAnimationFrame(raf); window.removeEventListener("resize", onR); av?.dispose(); arma.dispose(); R.dispose(); R.domElement.remove(); };
  }, []);

  const B = (on: boolean) => ({ padding: "7px 11px", borderRadius: 8, border: "1px solid #3b4280", background: on ? "#6d5cff" : "#121633", color: "#fff", fontSize: 13, cursor: "pointer" });
  return (
    <div style={{ position: "fixed", inset: 0, background: "#07091a", fontFamily: "system-ui, sans-serif" }}>
      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", left: 12, top: 12, right: 12, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <b style={{ color: "#cfd6ff", marginRight: 6 }}>Traje espacial {pronto ? "" : "· carregando…"}</b>
        <button style={B(traje)} onClick={() => setTraje(!traje)}>Traje {traje ? "ON" : "OFF"}</button>
        <button style={B(rifle)} onClick={() => setRifle(!rifle)}>Rifle {rifle ? "na mão" : "guardado"}</button>
        <button style={B(mira)} onClick={() => setMira(!mira)}>Mira {mira ? "ON" : "OFF"}</button>
      </div>
      <div style={{ position: "absolute", left: 12, bottom: 12, right: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {ANDARES.map(([k, r]) => <button key={k} style={B(andar === k)} onClick={() => setAndar(k)}>{r}</button>)}
        <span style={{ width: 10 }} />
        {CLIPES.map(([k, r]) => <button key={k} style={B(false)} onClick={() => avRef.current?.tocarClipe(k, k.startsWith("morre") ? { segurar: true } : undefined)}>{r}</button>)}
        <button style={B(false)} onClick={() => avRef.current?.soltarClipe()}>Soltar clipe</button>
      </div>
    </div>
  );
}
