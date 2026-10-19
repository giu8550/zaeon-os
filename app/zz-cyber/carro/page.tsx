"use client";
// PRÉVIA LOCAL (não versionar): a VITRINE do carro voador (components/cyber/CarroHex) — estúdio cinza como as referências,
// girando; botões pra abrir/fechar a cabine e as vistas. E o SOM (lib/cyber/somCarro): ligar/desligar, ACELERAR (segurar
// o botão ou W — a velocidade sobe com inércia; S freia) e os sons das portas e dos vidros. Clique na tela pra liberar o áudio.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { criarCarroHex } from "@/components/cyber/CarroHex";
import { criarAudioCyber, type LoopSom } from "@/components/cyber/AudioCyber";
import { DISTANCIA } from "@/lib/cyber/audio";
import { LOOPS_CARRO, mixDoCarro, sonsDaCabine } from "@/lib/cyber/somCarro";

const botao = (cor: string): React.CSSProperties => ({ padding: "8px 14px", borderRadius: 999, border: `1px solid ${cor}`, background: "#111b", color: "#fff", font: "600 13px system-ui", userSelect: "none", touchAction: "none" });

export default function VitrineCarro() {
  const ref = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false); const abertoRef = useRef(aberto); abertoRef.current = aberto;
  const [ligado, setLigado] = useState(false); const ligadoRef = useRef(ligado); ligadoRef.current = ligado;
  const [som, setSom] = useState(false);
  const [kmh, setKmh] = useState(0);
  const acel = useRef({ botao: false, w: false, s: false });
  const vistaRef = useRef<(v: "frente" | "lado" | "tres" | "cima") => void>(() => {});
  const tocarRef = useRef<(n: "carro-liga" | "carro-desliga") => void>(() => {});
  useEffect(() => {
    const el = ref.current!; const R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(Math.min(2, devicePixelRatio)); R.setSize(el.clientWidth, el.clientHeight);
    R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace; el.appendChild(R.domElement);
    const cena = new THREE.Scene(); cena.background = new THREE.Color(0x8a9099);
    const pm = new THREE.PMREMGenerator(R); cena.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    const d = new THREE.DirectionalLight(0xffffff, 1.2); d.position.set(3, 6, 4); cena.add(d); cena.add(new THREE.HemisphereLight(0xdfe6f0, 0x4a4f58, 0.6));
    const chao = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x80868f, roughness: 0.9 })); chao.rotation.x = -Math.PI / 2; chao.position.y = -0.6; cena.add(chao);
    const cam = new THREE.PerspectiveCamera(32, el.clientWidth / el.clientHeight, 0.1, 200); cam.position.set(5.5, 2.2, 7);
    const oc = new OrbitControls(cam, R.domElement); oc.target.set(0, 0.8, -0.7); oc.autoRotate = true; oc.autoRotateSpeed = 0.7; oc.enableDamping = true;
    const carro = criarCarroHex({ low: false }); cena.add(carro.group);
    // (em pé — o painel estreito — a câmera recua pra caber o carro inteiro)
    const recuo = () => Math.max(1.25, 1.75 / Math.max(0.3, el.clientWidth / el.clientHeight));
    vistaRef.current = (v) => { oc.autoRotate = false; const p = v === "frente" ? [2.2, 1.6, 8.5] : v === "lado" ? [9, 1.2, 0] : v === "cima" ? [3, 7.5, 3.5] : [5.5, 2.2, 7]; const k = recuo(); cam.position.set(p[0]! * k, p[1]! * k, p[2]! * k); oc.update(); };
    { const k = recuo(); cam.position.multiplyScalar(k); }
    // o SOM: os loops presos no carro (posicionais — girando a câmera, o som muda de lado) e os one-shots
    const audio = criarAudioCyber({ camera: cam, cena, low: false });
    const loops = Object.fromEntries(LOOPS_CARRO.map((n) => [n, audio.loop(n, carro.group, { dist: DISTANCIA.perto })])) as Record<(typeof LOOPS_CARRO)[number], LoopSom>;
    const liberar = () => { audio.ativar(); setSom(true); };
    el.addEventListener("pointerdown", liberar);
    tocarRef.current = (n) => { liberar(); audio.tocar(n, carro.group.position, { dist: DISTANCIA.perto }); };
    const kd = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (k === "w") acel.current.w = true; if (k === "s") acel.current.s = true; liberar(); };
    const ku = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (k === "w") acel.current.w = false; if (k === "s") acel.current.s = false; };
    addEventListener("keydown", kd); addEventListener("keyup", ku);
    const w = window as unknown as { __carro?: unknown; __som?: () => unknown };
    w.__carro = carro;
    let k = 0, raf = 0, l = 0, vel = 0, pot = 0, hudT = 0; const clock = new THREE.Clock();
    w.__som = () => ({ ativo: audio.ativo, ligado: l, vel, pot, k, mix: mixDoCarro({ ligado: l, vel, potencia: pot }) });
    const loop = () => { raf = requestAnimationFrame(loop); const dt = Math.min(0.1, clock.getDelta()), t = clock.elapsedTime;
      const kAnt = k; k = Math.max(0, Math.min(1, k + (abertoRef.current ? 1 : -1) * dt / 1.6)); carro.abrir(k);
      for (const n of sonsDaCabine(kAnt, k, carro.nVidros)) audio.tocar(n, carro.group.position, { dist: DISTANCIA.perto, taxa: 0.96 + Math.random() * 0.08 });
      // o "dirigir" da vitrine: acelerando a velocidade sobe com inércia (até 45 m/s); solto, cai devagar; S freia
      l += ((ligadoRef.current ? 1 : 0) - l) * Math.min(1, dt * 2.5);
      const quer = ligadoRef.current && (acel.current.botao || acel.current.w) ? 1 : 0;
      pot += (quer - pot) * Math.min(1, dt * 4);
      vel = Math.max(0, Math.min(45, vel + (quer ? 9 : acel.current.s ? -18 : -4) * dt));
      if (!ligadoRef.current) vel = Math.max(0, vel - 10 * dt);
      const mx = mixDoCarro({ ligado: l, vel, potencia: pot });
      for (const n of LOOPS_CARRO) { audio.volumeLoop(loops[n], mx[n].vol); audio.taxaLoop(loops[n], mx[n].taxa); }
      carro.atualizar(t, dt, { vel, ligado: ligadoRef.current });
      hudT += dt; if (hudT > 0.15) { hudT = 0; setKmh(Math.round(vel * 3.6)); }
      oc.update(); R.render(cena, cam); };
    loop();
    const rs = () => { R.setSize(el.clientWidth, el.clientHeight); cam.aspect = el.clientWidth / el.clientHeight; cam.updateProjectionMatrix(); }; addEventListener("resize", rs);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", rs); removeEventListener("keydown", kd); removeEventListener("keyup", ku); el.removeEventListener("pointerdown", liberar); for (const n of LOOPS_CARRO) audio.soltarLoop(loops[n]); carro.dispose(); R.dispose(); el.innerHTML = ""; };
  }, []);
  const segurar = (on: boolean) => () => { acel.current.botao = on; };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", left: 12, top: 12, display: "flex", gap: 8, flexWrap: "wrap", right: 12 }}>
        {(["tres", "frente", "lado", "cima"] as const).map((v) => <button key={v} onClick={() => vistaRef.current(v)} style={botao("#fff6")}>{v === "tres" ? "¾" : v}</button>)}
        <button onClick={() => setAberto((a) => !a)} style={{ ...botao("#ffb02e"), background: "#ff7a2acc", fontWeight: 700 }}>{aberto ? "Fechar cabine" : "Abrir cabine"}</button>
      </div>
      <div style={{ position: "absolute", left: 12, bottom: 16, right: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => { const on = !ligado; setLigado(on); tocarRef.current(on ? "carro-liga" : "carro-desliga"); }} style={{ ...botao(ligado ? "#3dff7a" : "#fff6"), background: ligado ? "#0d3a1fcc" : "#111b" }}>{ligado ? "⏻ Desligar" : "⏻ Ligar"}</button>
        <button onPointerDown={segurar(true)} onPointerUp={segurar(false)} onPointerLeave={segurar(false)} onPointerCancel={segurar(false)} disabled={!ligado} style={{ ...botao("#7fd8ff"), opacity: ligado ? 1 : 0.4 }}>Segure pra acelerar (W)</button>
        <span style={{ color: "#fff", font: "700 15px system-ui", textShadow: "0 1px 3px #000", minWidth: 80 }}>{kmh} km/h</span>
        {!som && <span style={{ color: "#fff", font: "600 12px system-ui", textShadow: "0 1px 3px #000" }}>clique na tela pra liberar o som</span>}
      </div>
    </div>
  );
}
