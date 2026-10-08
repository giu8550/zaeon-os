"use client";
/**
 * TunelBuracoNegro — o TUNELAMENTO dentro de um buraco negro (lib/cyber/buracos): ao pisar no anel, a tela é sugada
 * (o vórtice fecha), e lá DENTRO, no túnel, a pessoa escolhe pra onde vai (as universidades, a Solana House, a praça,
 * a Zaeon). Escolheu: o túnel acelera (estrelas esticando, anéis passando), o teletransporte acontece com a tela
 * coberta e o túnel abre no destino. No modo "dono" (o par nave ↔ cabine do DJ) não há escolha: só a travessia.
 * Desenho em canvas 2D (leve) — a cena 3D fica PAUSADA enquanto o túnel cobre a tela.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type DestinoTunel = { id: string; nome: string; desc: string };
export type ModoTunel = { tipo: "escolher"; origem: string; nomeOrigem: string; destinos: DestinoTunel[] } | { tipo: "dono"; para: "dj" | "nave" };

type Fase = "entrando" | "aberto" | "viajando" | "saindo";
const DUR: Record<Exclude<Fase, "aberto">, number> = { entrando: 0.75, viajando: 1.5, saindo: 0.7 };
const LOGO: Record<string, string> = { ufc: "/assets/cyber/logo-ufc.svg", unifor: "/assets/cyber/logo-unifor.svg", uece: "/assets/cyber/logo-uece.png" };
const ICONE: Record<string, string> = { zaeon: "✦", praca: "◎", univ: "🎓", solana: "◈" };

export default function TunelBuracoNegro(p: {
  modo: ModoTunel;
  /** a tela ficou toda coberta (pausar a cena) / vai começar a abrir (despausar) */
  onCoberto(coberto: boolean): void;
  /** escolheu (ou desistiu: null) — chamado com a tela COBERTA (o teletransporte some atrás do túnel) */
  onEscolher(id: string | null): void;
  /** acabou de abrir: some o overlay */
  onFim(): void;
}) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [fase, setFase] = useState<Fase>("entrando");
  const faseRef = useRef<Fase>("entrando"), t0 = useRef(0), escolha = useRef<string | null>(null), cb = useRef(p); cb.current = p;
  const ir = useCallback((f: Fase) => { faseRef.current = f; t0.current = performance.now(); setFase(f); }, []);
  const escolher = useCallback((id: string | null) => {
    if (faseRef.current !== "aberto") return;
    escolha.current = id;
    if (id === null) { cb.current.onEscolher(null); cb.current.onCoberto(false); ir("saindo"); } else ir("viajando");
  }, [ir]);

  useEffect(() => {
    const c = cv.current; if (!c) return;
    const g = c.getContext("2d")!; let raf = 0, ultimo = performance.now();
    const reduzido = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // estrelas: ângulo + distância do centro (crescem: o túnel corre em direção a quem olha)
    const N = 220, est = Array.from({ length: N }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), v: 0.25 + Math.random() * 0.75, cor: Math.random() < 0.3 ? "255,190,120" : "200,215,255" }));
    const aneis = Array.from({ length: 9 }, (_, i) => i / 9);
    let rot = 0, vel = 1;
    t0.current = performance.now();
    const quadro = (agora: number) => {
      raf = requestAnimationFrame(quadro);
      const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const f = faseRef.current, k = (agora - t0.current) / 1000;
      // a fase manda: entrando (o vórtice fecha a tela), aberto (o túnel), viajando (acelera), saindo (abre)
      let cobre = 1, alvoVel = 1;
      if (f === "entrando") { cobre = Math.min(1, k / DUR.entrando); alvoVel = 1 + 3 * (1 - cobre); if (k >= DUR.entrando) { cb.current.onCoberto(true); if (cb.current.modo.tipo === "dono") ir("viajando"); else ir("aberto"); } }
      if (f === "viajando") { alvoVel = 1 + 9 * Math.min(1, k / DUR.viajando); if (k >= DUR.viajando) { cb.current.onEscolher(escolha.current ?? (cb.current.modo.tipo === "dono" ? cb.current.modo.para : null)); cb.current.onCoberto(false); ir("saindo"); } }
      if (f === "saindo") { cobre = 1 - Math.min(1, k / DUR.saindo); alvoVel = 4 * cobre; if (k >= DUR.saindo) { cancelAnimationFrame(raf); cb.current.onFim(); return; } }
      vel += (alvoVel - vel) * Math.min(1, dt * 4); if (reduzido) vel = Math.min(vel, 1.5);
      rot += dt * 0.35 * vel;
      const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
      g.clearRect(0, 0, W, H); g.globalAlpha = cobre;
      // o fundo do túnel
      const fundo = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      fundo.addColorStop(0, "#000"); fundo.addColorStop(0.18, "#12061f"); fundo.addColorStop(0.55, "#1c0b33"); fundo.addColorStop(1, "#03020a");
      g.fillStyle = fundo; g.fillRect(0, 0, W, H);
      // os braços do disco de acreção girando (o redemoinho)
      g.save(); g.translate(cx, cy); g.globalCompositeOperation = "lighter";
      for (let b = 0; b < 5; b++) {
        g.rotate((Math.PI * 2) / 5);
        const gr = g.createLinearGradient(0, 0, R, 0); gr.addColorStop(0, "rgba(255,200,120,0)"); gr.addColorStop(0.15, "rgba(255,160,80,.35)"); gr.addColorStop(0.6, "rgba(160,90,255,.12)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.strokeStyle = gr; g.lineWidth = 26;
        g.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40, rr = 30 + u * R, aa = rot * 2 + u * 3.2; g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } g.stroke();
      }
      // os anéis do túnel passando (vêm do fundo e crescem)
      for (let i = 0; i < aneis.length; i++) {
        aneis[i] = (aneis[i]! + dt * 0.12 * vel) % 1; const u = aneis[i]!, rr = 20 + Math.pow(u, 2.2) * R * 1.1;
        g.strokeStyle = `rgba(${i % 2 ? "120,200,255" : "190,140,255"},${(0.5 * Math.sin(u * Math.PI)).toFixed(3)})`; g.lineWidth = 1 + u * 3;
        g.beginPath(); g.ellipse(0, 0, rr, rr * 0.92, rot * 0.5, 0, Math.PI * 2); g.stroke();
      }
      // as estrelas esticando (mais rápido = traço mais longo)
      for (const s of est) {
        s.r += dt * s.v * 0.32 * vel * (0.2 + s.r); if (s.r > 1.2) { s.r = 0.02 + Math.random() * 0.1; s.a = Math.random() * Math.PI * 2; }
        const r1 = s.r * R, r0 = Math.max(0, r1 - (6 + vel * 14) * (0.3 + s.r)), a = s.a + rot * 0.6;
        g.strokeStyle = `rgba(${s.cor},${Math.min(1, s.r * 1.4).toFixed(3)})`; g.lineWidth = 0.6 + s.r * 1.6;
        g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
      }
      g.globalCompositeOperation = "source-over";
      // o horizonte (no fundo do túnel) com o anel de fótons
      const rh = 26 + 8 * Math.sin(agora * 0.002);
      g.fillStyle = "#000"; g.beginPath(); g.arc(0, 0, rh, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,236,200,.9)"; g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, rh + 2, 0, Math.PI * 2); g.stroke();
      g.restore(); g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [ir]);

  // teclado: Esc desiste, 1..9 escolhe
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (p.modo.tipo !== "escolher" || faseRef.current !== "aberto") return;
      if (e.key === "Escape") { e.preventDefault(); escolher(null); return; }
      const n = Number(e.key); if (n >= 1 && n <= p.modo.destinos.length) { e.preventDefault(); escolher(p.modo.destinos[n - 1]!.id); }
    };
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true);
  }, [p.modo, escolher]);

  const titulo = p.modo.tipo === "dono" ? (p.modo.para === "dj" ? "Cabine do DJ" : "A bordo da nave") : null;
  return (
    <div role="dialog" aria-modal="true" aria-label={p.modo.tipo === "escolher" ? "Túnel do buraco negro: escolha o destino" : "Atravessando o buraco negro"} className="absolute inset-0 z-[55] select-none">
      <canvas ref={cv} className="absolute inset-0 h-full w-full" />
      {p.modo.tipo === "escolher" && fase === "aberto" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/70">Buraco negro · {p.modo.nomeOrigem}</p>
            <p className="mt-1 text-2xl font-extrabold text-white drop-shadow-[0_0_18px_rgba(255,180,90,.6)]">Para onde?</p>
          </div>
          <div className="grid w-[min(94vw,760px)] grid-cols-2 gap-2.5 sm:grid-cols-3">
            {p.modo.destinos.map((d, i) => (
              <button key={d.id} type="button" onClick={() => escolher(d.id)} className="group flex min-h-[84px] items-start gap-3 rounded-2xl border border-amber-200/25 bg-[#0d0618]/70 p-3 text-left backdrop-blur transition hover:border-amber-200/70 hover:bg-[#1a0c2c]/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">
                <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-lg text-amber-100">
                  {LOGO[d.id] ? <img src={LOGO[d.id]} alt="" className={`h-8 w-12 object-contain ${d.id === "ufc" ? "invert" : ""}`} /> : ICONE[d.id] ?? "●"}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-amber-50"><kbd className="hidden rounded bg-white/10 px-1 font-mono text-[10px] text-amber-100/70 sm:inline">{i + 1}</kbd>{d.nome}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-violet-100/65">{d.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => escolher(null)} className="min-h-[40px] rounded-full border border-white/15 bg-black/40 px-5 text-xs text-white/75 hover:text-white">Ficar aqui <span className="text-white/40">(Esc)</span></button>
        </div>
      )}
      {titulo && fase !== "saindo" && <p className="absolute left-1/2 top-[18%] -translate-x-1/2 text-sm font-semibold tracking-wide text-amber-100/85">Atravessando → {titulo}</p>}
      {p.modo.tipo === "escolher" && fase === "viajando" && <p className="absolute left-1/2 top-[18%] -translate-x-1/2 text-sm font-semibold tracking-wide text-amber-100/85">→ {p.modo.destinos.find((d) => d.id === escolha.current)?.nome}</p>}
    </div>
  );
}
