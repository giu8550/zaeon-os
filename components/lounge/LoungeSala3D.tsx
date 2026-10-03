"use client";
/**
 * LoungeSala3D — a porta do Lounge 3D: resolve QUAL sala (convite `?sala=<token>` → /api/collab/join;
 * senão a minha mais recente; senão cria), decide o modo (3D no desktop com WebGL; FALLBACK 2D no
 * celular/sem WebGL: notas + chat + presença, sem three) e monta a Cartolina3D (lazy, client-only).
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { temWebGL } from "@/lib/ui/globo";
import { useIsMobile } from "@/lib/ui/useIsMobile";
import { useSala3D } from "./useSala3D";
import { uid } from "@/lib/lounge3d/sala";

const Cartolina3D = dynamic(() => import("./Cartolina3D"), { ssr: false, loading: () => <div className="h-full w-full bg-[#0b1226]" /> });

export default function LoungeSala3D() {
  const [salaId, setSalaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mobile = useIsMobile();
  const [webgl, setWebgl] = useState(true);
  useEffect(() => { setWebgl(temWebGL()); }, []);

  const resolver = useCallback(async () => {
    try {
      const token = new URLSearchParams(location.search).get("sala");
      if (token) {
        const r = await fetch("/api/collab/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
        if (r.ok) { const d = await r.json(); if (d?.id) { setSalaId(d.id); return; } }
      }
      const r = await fetch("/api/lounge3d", { cache: "no-store" });
      if (r.status === 404) { setErro("off"); return; }
      if (r.status === 401) { setErro("login"); return; }
      const d = await r.json();
      if (Array.isArray(d.salas) && d.salas.length) { setSalaId(d.salas[0].id); return; }
      const c = await fetch("/api/lounge3d", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Minha sala de estudos" }) });
      if (!c.ok) throw new Error(String(c.status));
      setSalaId((await c.json()).sala.id);
    } catch { setErro("erro"); }
  }, []);
  useEffect(() => { void resolver(); }, [resolver]);

  if (erro === "login") return <Vazio>Entre na sua conta pra usar a sala de co-working.</Vazio>;
  if (erro === "off") return <Vazio>A sala 3D está desligada.</Vazio>;
  if (erro) return <Vazio>Não deu pra abrir a sala. <button onClick={() => { setErro(null); void resolver(); }} className="underline">Tentar de novo</button></Vazio>;
  if (!salaId) return <div className="h-full w-full bg-[#0b1226]" />;
  if (mobile || !webgl) return <Sala2D salaId={salaId} />;
  return <Cartolina3D salaId={salaId} />;
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full w-full items-center justify-center bg-[#0b1226] px-6 text-center text-[13px] text-[#9fb6e0]">{children}</div>;
}

/** Fallback 2D (celular / sem WebGL): mesma sala, sem cena — notas editáveis, chat, quem está. */
function Sala2D({ salaId }: { salaId: string }) {
  const sala = useSala3D(salaId);
  const [txt, setTxt] = useState("");
  const notas = sala.sala?.conteudo.notes ?? [];
  const presenca = sala.online.length ? sala.online : sala.eu ? [sala.eu] : [];
  if (sala.estado === "cheia") return <Vazio>Sala cheia (máximo 5).</Vazio>;
  return (
    <div className="flex h-full w-full flex-col bg-[#0b1226] text-[#dbe8ff]">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold">{sala.sala?.title ?? "Sala"}</p>
        <div className="flex items-center">{presenca.slice(0, 5).map((m) => <span key={m.id} className="-ml-1 grid h-6 w-6 place-items-center rounded-full border-2 border-[#0b1226] text-[10px] font-black text-[#0b1226]" style={{ background: m.color }}>{m.name.slice(0, 1).toUpperCase()}</span>)}<span className="ml-2 text-[11px] text-[#9fb6e0]">{presenca.length}/5</span></div>
        <button onClick={() => void sala.patch({ upsertNotes: [{ id: uid(), x: 0, z: 0, kind: "nota", src: "Você", text: "Nova nota" }] })} className="rounded-lg border border-white/15 px-2 py-1 text-[11px]">＋ Nota</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-2 text-[11px] text-[#9fb6e0]">Versão simplificada (sem 3D). As notas são as mesmas da sala.</p>
        {notas.length === 0 && <p className="text-[12px] text-[#9fb6e0]">Nenhuma nota ainda.</p>}
        {notas.map((n) => (
          <div key={n.id} className="mb-2 rounded-lg bg-[#fff8e1] p-2.5 text-[#3a2f1e]">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#6b5a3e]"><span>📌 {n.kind} · {n.src}</span><button onClick={() => void sala.patch({ removeNotes: [n.id] })}>✕</button></div>
            <textarea defaultValue={n.text} onBlur={(e) => { if (e.target.value !== n.text) void sala.patch({ upsertNotes: [{ ...n, text: e.target.value }] }); }} className="w-full resize-none bg-transparent font-serif text-[13px] outline-none" rows={3} />
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-2">
        <div className="max-h-[100px] overflow-y-auto px-1 text-[12px]">{sala.chat.slice(-20).map((m) => <div key={m.id}><b style={{ color: m.color }}>{m.name}:</b> {m.texto}</div>)}</div>
        <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && txt.trim()) { void sala.enviarChat(txt.trim()); setTxt(""); } }} placeholder="Falar na sala…" className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] outline-none" />
      </div>
    </div>
  );
}
