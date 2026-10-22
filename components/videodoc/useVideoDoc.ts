"use client";
/** useVideoDoc — o estado de um vídeo de documento (GET /api/videodoc/:id); enquanto gera, confere a cada 5 s */
import { useEffect, useState } from "react";
import type { Roteiro } from "@/lib/videodoc/roteiro";

export type VideoDocCliente = { status: "queued" | "running" | "done" | "error"; titulo: string; documento: { titulo: string; tipo: string; url?: string } | null; roteiro: Roteiro | null; tempos: number[] | null; duracao: number | null; erro: string | null };

export function useVideoDoc(id: string | null | undefined) {
  const [v, setV] = useState<VideoDocCliente | null>(null), [falhou, setFalhou] = useState(false);
  useEffect(() => {
    if (!id) return;
    let vivo = true, t: ReturnType<typeof setTimeout> | undefined;
    const ler = async () => {
      try {
        const r = await fetch(`/api/videodoc/${id}`, { cache: "no-store" });
        if (!r.ok) { if (vivo) setFalhou(true); return; }
        const j = (await r.json()) as VideoDocCliente;
        if (!vivo) return;
        setV(j);
        if (j.status === "queued" || j.status === "running") t = setTimeout(ler, 5000);
      } catch { if (vivo) t = setTimeout(ler, 8000); }
    };
    void ler();
    return () => { vivo = false; if (t) clearTimeout(t); };
  }, [id]);
  return { video: v, falhou };
}

export const MOTIVO_ERRO: Record<string, string> = {
  sem_texto: "sem texto aberto (artigo pago ou sem PDF) — a Zaeon não resume só pelo título",
};
export const duracaoTexto = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");
