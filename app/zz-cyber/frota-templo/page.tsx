"use client";
// PRÉVIA LOCAL: o MAPA da frota no Templo Cósmico visto de cima (lib/cyber/frota/templo) — as plataformas e as pontes,
// os colisores, os lugares (rodas de pé, sentadas, cabines) por sala e uns caminhos a pé sorteados. Roda do mouse = zoom.
import { useEffect, useRef, useState } from "react";
import { PLATS, PONTES, colisoresDoComplexo, postoDaGuardia, PIRAMIDE, ALCANCE_DUELO } from "@/lib/cyber/temploCosmico";
import { CIDADE } from "@/lib/cyber/ceu";
import { caminhoNoTemplo, noLayout, spotsDoTemplo } from "@/lib/cyber/frota/templo";

const COR: Record<string, string> = { pe: "#5fe3ff", piso: "#ffd24f", cabine: "#ff6ad5" };

export default function FrotaTemplo() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState("");
  useEffect(() => {
    const cv = ref.current!, g = cv.getContext("2d")!, spots = spotsDoTemplo(), cs = colisoresDoComplexo(CIDADE.salas.lounge.r);
    let zoom = 1.6, cx = -230, cz = -60, sorteio = 1;
    const caminhos = () => { const out: { x: number; z: number; salto: boolean }[][] = []; for (let k = 0; k < 14; k++) { const a = spots[(k * 97 + sorteio * 31) % spots.length]!, b = spots[(k * 53 + sorteio * 71 + 7) % spots.length]!;
      for (const t of caminhoNoTemplo({ q: a.templo!.q, no: a.templo! }, { q: b.templo!.q, no: b.templo! })) out.push(t.pts.map((p) => ({ ...noLayout(p), salto: t.salto }))); } return out; };
    let linhas = caminhos();
    const desenha = () => {
      cv.width = cv.clientWidth * devicePixelRatio; cv.height = cv.clientHeight * devicePixelRatio;
      g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); g.fillStyle = "#07091a"; g.fillRect(0, 0, cv.clientWidth, cv.clientHeight);
      const X = (x: number) => cv.clientWidth / 2 + (x - cx) * zoom, Z = (z: number) => cv.clientHeight / 2 + (z - cz) * zoom;
      g.fillStyle = "#151c3d"; g.beginPath(); g.arc(X(0), Z(0), 70 * zoom, 0, 7); g.fill();
      for (const p of PLATS) { g.fillStyle = p.h > 100 ? "rgba(90,110,200,.25)" : "#1d2650"; g.beginPath(); g.arc(X(p.x), Z(p.z), p.r * zoom, 0, 7); g.fill(); }
      for (const p of PONTES) { g.strokeStyle = "#1d2650"; g.lineWidth = p.meia * 2 * zoom; g.beginPath(); g.moveTo(X(p.a.x), Z(p.a.z)); g.lineTo(X(p.b.x), Z(p.b.z)); g.stroke(); }
      g.fillStyle = "#3a2a5a"; g.fillRect(X(PIRAMIDE.x - PIRAMIDE.meia), Z(PIRAMIDE.z - PIRAMIDE.meia), PIRAMIDE.meia * 2 * zoom, PIRAMIDE.meia * 2 * zoom);
      g.fillStyle = "rgba(255,90,90,.5)"; for (const c of cs) { g.beginPath(); g.arc(X(c.x), Z(c.z), Math.max(0.6, c.r * zoom), 0, 7); g.fill(); }
      const ex = postoDaGuardia(); g.strokeStyle = "#ff4f4f"; g.lineWidth = 2; g.beginPath(); g.arc(X(ex.x), Z(ex.z), ALCANCE_DUELO * zoom, 0, 7); g.stroke();
      for (const l of linhas) { g.strokeStyle = l[0]?.salto ? "rgba(255,255,255,.35)" : "#9affd0"; g.setLineDash(l[0]?.salto ? [4, 4] : []); g.lineWidth = 1.4; g.beginPath(); l.forEach((p, i) => (i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z)))); g.stroke(); }
      g.setLineDash([]);
      for (const s of spots) { const q = s.templo!.q; g.fillStyle = COR[s.tipo] ?? "#fff"; g.globalAlpha = s.templo!.andar > 0 ? 0.55 : 1; g.beginPath(); g.arc(X(q.x), Z(q.z), Math.max(1.5, 0.45 * zoom), 0, 7); g.fill(); }
      g.globalAlpha = 1;
    };
    const porSala: Record<string, number> = {}; for (const s of spots) porSala[s.templo!.sala] = (porSala[s.templo!.sala] ?? 0) + 1;
    setInfo(`${spots.length} lugares · ${Object.entries(porSala).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    desenha();
    const roda = (e: WheelEvent) => { e.preventDefault(); zoom *= e.deltaY < 0 ? 1.15 : 1 / 1.15; desenha(); };
    let arr: { x: number; y: number } | null = null;
    const down = (e: MouseEvent) => { arr = { x: e.clientX, y: e.clientY }; }, up = () => { arr = null; };
    const move = (e: MouseEvent) => { if (!arr) return; cx -= (e.clientX - arr.x) / zoom; cz -= (e.clientY - arr.y) / zoom; arr = { x: e.clientX, y: e.clientY }; desenha(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === " ") { sorteio++; linhas = caminhos(); desenha(); } };
    cv.addEventListener("wheel", roda, { passive: false }); cv.addEventListener("mousedown", down); addEventListener("mouseup", up); addEventListener("mousemove", move); addEventListener("keydown", tecla); addEventListener("resize", desenha);
    (window as unknown as { __mapa: unknown }).__mapa = { set(z: number, x: number, zz: number) { zoom = z; cx = x; cz = zz; desenha(); }, outros() { sorteio++; linhas = caminhos(); desenha(); } };
    return () => { cv.removeEventListener("wheel", roda); removeEventListener("mouseup", up); removeEventListener("mousemove", move); removeEventListener("keydown", tecla); removeEventListener("resize", desenha); };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#07091a", font: "12px system-ui", color: "#cfd8ff" }}>
      <canvas ref={ref} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", left: 10, top: 8, right: 10 }}>{info}<br />azul = roda de pé · amarelo = sentados com o tablet · rosa = cabine (codar) · verde = caminhos a pé · tracejado = salto de mochila · vermelho = colisores / Examiner — espaço sorteia outros caminhos</div>
    </div>
  );
}
