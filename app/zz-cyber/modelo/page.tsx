"use client";
// PRÉVIA LOCAL: um GLB qualquer de public/ (?url=/avatars/...), girando na luz — pra conferir a forma de um modelo
// novo antes de virar personagem (scripts/avatar). Arraste pra girar.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export default function Modelo() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!, R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    R.setPixelRatio(Math.min(2, devicePixelRatio)); R.setSize(el.clientWidth, el.clientHeight); el.appendChild(R.domElement);
    const cena = new THREE.Scene(); cena.background = new THREE.Color(0x0b0d1c);
    cena.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(), 0.04).texture;
    cena.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.2)); const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(2, 3, 2); cena.add(d);
    const cam = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, 0.01, 100);
    const oc = new OrbitControls(cam, R.domElement); oc.enableDamping = true;
    const url = new URLSearchParams(location.search).get("url");
    if (url) new GLTFLoader().load(url, (g) => {
      cena.add(g.scene);
      const box = new THREE.Box3().setFromObject(g.scene), c = box.getCenter(new THREE.Vector3()), t = box.getSize(new THREE.Vector3());
      oc.target.copy(c); cam.position.set(c.x, c.y + t.y * 0.1, c.z + Math.max(t.x, t.y) * 2.4);
    });
    let raf = 0; const loop = () => { raf = requestAnimationFrame(loop); oc.update(); R.render(cena, cam); }; loop();
    (window as unknown as { __modelo: unknown }).__modelo = { cam, oc, cena };
    return () => { cancelAnimationFrame(raf); R.dispose(); R.domElement.remove(); };
  }, []);
  return <div ref={ref} style={{ position: "fixed", inset: 0, background: "#0b0d1c" }} />;
}
