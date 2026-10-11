"use client";
/**
 * LivroHolograma — o 3D de um livro de pesquisa no inventário (lib/cyber/livroHolograma), no estilo BLUEPRINT do
 * Marketplace (components/estudos/modelos3d): vidro azul-escuro translúcido com as ARESTAS acesas na cor da raridade,
 * a capa com o título, as páginas em leque com as linhas de texto, um halo embaixo e partículas subindo. Gira devagar e
 * flutua. Um canvas WebGL pequeno (só o item escolhido aparece por vez).
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { anguloDasFolhas } from "@/lib/cyber/livroHolograma";

const LARG = 1.0, ALT = 1.38;

function texturaDaCapa(titulo: string, cor: string): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 352; const g = c.getContext("2d")!;
  g.fillStyle = "rgba(6,20,40,.85)"; g.fillRect(0, 0, 256, 352);
  g.strokeStyle = cor; g.lineWidth = 4; g.strokeRect(14, 14, 228, 324); g.lineWidth = 1.5; g.strokeRect(24, 24, 208, 304);
  g.fillStyle = cor; g.font = "700 18px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("◆ PESQUISA ◆", 128, 70);
  g.fillStyle = "#e8f6ff"; g.font = "800 24px system-ui, sans-serif";
  const palavras = titulo.split(/\s+/); let linha = "", y = 140; const linhas: string[] = [];
  for (const p of palavras) { const t = linha ? `${linha} ${p}` : p; if (g.measureText(t).width > 190 && linha) { linhas.push(linha); linha = p; } else linha = t; }
  if (linha) linhas.push(linha);
  for (const l of linhas.slice(0, 5)) { g.fillText(l, 128, y); y += 32; }
  g.strokeStyle = cor; g.beginPath(); g.arc(128, 290, 18, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(128, 272); g.lineTo(128, 308); g.moveTo(110, 290); g.lineTo(146, 290); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function LivroHolograma({ titulo, paginas, cor = "#7fe8ff", altura = 220 }: { titulo: string; paginas: number; cor?: string; altura?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    let R: THREE.WebGLRenderer;
    try { R = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); } catch { return; }   // (sem WebGL: só o texto)
    R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); R.setClearColor(0x000000, 0);
    const cena = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    cam.position.set(0, 0.45, 4.4); cam.lookAt(0, 0.0, 0);
    const c = new THREE.Color(cor), descartar: { dispose(): void }[] = [];
    const vidro = new THREE.MeshBasicMaterial({ color: 0x0b2c4d, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    const aresta = new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.95 });
    const linhaTexto = new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.45 });
    descartar.push(vidro, aresta, linhaTexto);
    const livro = new THREE.Group(); livro.rotation.x = 1.12; cena.add(livro);   // aberto DE FRENTE pra quem olha (a lombada em pé)
    // a CAPA, deitada aberta à esquerda (o título de frente pra quem olha)
    const capaTex = texturaDaCapa(titulo, cor), capaMat = new THREE.MeshBasicMaterial({ map: capaTex, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false });
    const capaGeo = new THREE.PlaneGeometry(LARG, ALT), capa = new THREE.Mesh(capaGeo, capaMat);
    capa.position.set(-LARG / 2 - 0.02, 0, 0); capa.rotation.x = -Math.PI / 2;
    const capaBorda = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(LARG, 0.05, ALT)), aresta); capaBorda.position.set(-LARG / 2 - 0.02, -0.03, 0);
    livro.add(capa, capaBorda); descartar.push(capaTex, capaMat, capaGeo, capaBorda.geometry);
    // a LOMBADA
    const lomb = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.06, 0.08, ALT)), aresta); lomb.position.y = -0.02; livro.add(lomb); descartar.push(lomb.geometry);
    // as PÁGINAS em leque, à direita (cada uma gira em volta da lombada)
    const folhaGeo = new THREE.PlaneGeometry(LARG * 0.96, ALT * 0.96); folhaGeo.translate(LARG * 0.48, 0, 0); folhaGeo.rotateX(-Math.PI / 2);
    const bordaGeo = new THREE.EdgesGeometry(folhaGeo); descartar.push(folhaGeo, bordaGeo);
    const angs = anguloDasFolhas(paginas);
    angs.forEach((a, i) => {
      const piv = new THREE.Group(); piv.rotation.z = a; livro.add(piv);
      piv.add(new THREE.Mesh(folhaGeo, vidro), new THREE.LineSegments(bordaGeo, aresta));
      if (i === angs.length - 1) {   // as linhas de texto na de cima
        const pts: number[] = [];
        for (let k = 0; k < 9; k++) { const z = -ALT * 0.38 + k * ALT * 0.09, x1 = 0.12, x2 = LARG * (k % 3 === 2 ? 0.6 : 0.86); pts.push(x1, 0.004, z, x2, 0.004, z); }
        const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); descartar.push(g);
        piv.add(new THREE.LineSegments(g, linhaTexto));
      }
    });
    // o HALO embaixo e as PARTÍCULAS de luz subindo
    const haloGeo = new THREE.RingGeometry(0.55, 0.95, 48), halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = -0.95; cena.add(halo); descartar.push(haloGeo, halo.material as THREE.Material);
    const N = 70, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const r = 0.2 + Math.random() * 1.1, a = Math.random() * Math.PI * 2; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = -0.7 + Math.random() * 1.8; pos[i * 3 + 2] = Math.sin(a) * r; }
    const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({ color: c, size: 0.035, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    const pontos = new THREE.Points(pGeo, pMat); cena.add(pontos); descartar.push(pGeo, pMat);
    let raf = 0; const t0 = performance.now(), reduz = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const quadro = (agora: number) => {
      raf = requestAnimationFrame(quadro);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * R.getPixelRatio()) || cv.height !== Math.round(h * R.getPixelRatio())) { R.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
      const t = (agora - t0) / 1000;
      if (!reduz) {
        livro.rotation.y = Math.sin(t * 0.45) * 0.32; livro.position.y = 0.08 + Math.sin(t * 1.3) * 0.05;
        const p = pGeo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < N; i++) { let y = p.getY(i) + 0.006; if (y > 1.1) y = -0.7; p.setY(i, y); } p.needsUpdate = true;
        (halo.material as THREE.MeshBasicMaterial).opacity = 0.14 + 0.05 * Math.sin(t * 2);
      }
      R.render(cena, cam);
    };
    raf = requestAnimationFrame(quadro);
    return () => { cancelAnimationFrame(raf); for (const d of descartar) d.dispose(); R.dispose(); };
  }, [titulo, paginas, cor]);
  return <canvas ref={ref} className="block w-full" style={{ height: altura }} aria-label={`Holograma do livro “${titulo}” — ${paginas} página${paginas === 1 ? "" : "s"}`} role="img" />;
}
