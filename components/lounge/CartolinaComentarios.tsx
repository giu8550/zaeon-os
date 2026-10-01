"use client";
/**
 * Painel lateral de comentários de UM card (thread de um nível). Tema Caderno.
 * A11y: é um <aside role="dialog">, Esc fecha, foco vai pro campo ao abrir, alvos ≥44px.
 */
import { useEffect, useRef, useState } from "react";
import type { Comentario } from "@/components/lounge/useCartolinaCowork";

// Mesma paleta do LoungeCartolina (tinta/papel do tema Caderno).
const INK = "#3a2f1e", INK_SOFT = "#6b5a3e", ACCENT = "#0e7490";

export function CartolinaComentarios({ cardTitulo, comentarios, podeComentar, onEnviar, onFechar }: {
  cardTitulo: string;
  comentarios: Comentario[];
  podeComentar: boolean;
  onEnviar: (texto: string, parentId?: string | null) => Promise<boolean>;
  onFechar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState<Comentario | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { campo.current?.focus(); }, [respondendo]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const raizes = comentarios.filter((c) => !c.parentId);
  const respostas = (id: string) => comentarios.filter((c) => c.parentId === id);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    const ok = await onEnviar(t, respondendo?.id ?? null);
    setEnviando(false);
    if (ok) { setTexto(""); setRespondendo(null); }
  };

  const Bolha = ({ c }: { c: Comentario }) => (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <Avatar nome={c.nome} imagem={c.imagem} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: INK_SOFT }}><strong style={{ color: INK }}>{c.nome}</strong> · {new Date(c.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
        <div style={{ fontSize: 14, color: INK, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.texto}</div>
      </div>
    </div>
  );

  return (
    <aside
      data-ui role="dialog" aria-label={`Comentários: ${cardTitulo}`}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ position: "absolute", top: 56, right: 0, bottom: 0, width: "min(380px, 100%)", zIndex: 30, background: "rgba(247,240,224,.98)", borderLeft: `1px solid ${INK_SOFT}44`, boxShadow: "-20px 0 50px -30px rgba(0,0,0,.5)", display: "flex", flexDirection: "column" }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "10px 12px", borderBottom: `1px solid ${INK_SOFT}33` }}>
        <div style={{ flex: 1, fontWeight: 700, color: INK, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💬 {cardTitulo}</div>
        <button type="button" onClick={onFechar} aria-label="Fechar comentários" style={{ minWidth: 44, minHeight: 44, background: "none", border: "none", fontSize: 20, color: INK_SOFT, cursor: "pointer" }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 14 }} aria-live="polite">
        {raizes.length === 0 && <div style={{ color: INK_SOFT, fontSize: 14 }}>Nenhum comentário ainda.</div>}
        {raizes.map((r) => (
          <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Bolha c={r} />
            {respostas(r.id).map((x) => <div key={x.id} style={{ marginLeft: 32 }}><Bolha c={x} /></div>)}
            {podeComentar && (
              <button type="button" onClick={() => setRespondendo(r)} style={{ alignSelf: "flex-start", marginLeft: 32, minHeight: 44, background: "none", border: "none", color: ACCENT, fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                responder
              </button>
            )}
          </div>
        ))}
      </div>
      {podeComentar ? (
        <div style={{ padding: 10, borderTop: `1px solid ${INK_SOFT}33` }}>
          {respondendo && (
            <div style={{ fontSize: 12, color: INK_SOFT, marginBottom: 6, display: "flex", alignItems: "center" }}>
              <span style={{ flex: 1 }}>respondendo a <strong>{respondendo.nome}</strong></span>
              <button type="button" onClick={() => setRespondendo(null)} aria-label="Cancelar resposta" style={{ minWidth: 44, minHeight: 32, background: "none", border: "none", color: INK_SOFT, cursor: "pointer" }}>×</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <label htmlFor="cart-coment" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Escreva um comentário</label>
            <textarea
              id="cart-coment" ref={campo} value={texto} rows={2} maxLength={2000}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
              placeholder={respondendo ? "Sua resposta…" : "Comente este card…"}
              style={{ flex: 1, resize: "none", background: "#fff", border: `1px solid ${INK_SOFT}55`, borderRadius: 10, padding: "8px 10px", color: INK, fontSize: 14 }}
            />
            <button type="button" onClick={() => void enviar()} disabled={enviando || !texto.trim()} style={{ minWidth: 64, minHeight: 44, background: ACCENT, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", opacity: enviando || !texto.trim() ? 0.5 : 1 }}>
              Enviar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: 12, fontSize: 13, color: INK_SOFT, borderTop: `1px solid ${INK_SOFT}33` }}>Você está como leitor nesta cartolina.</div>
      )}
    </aside>
  );
}

export function Avatar({ nome, imagem, size = 24 }: { nome: string; imagem: string | null; size?: number }) {
  const ini = (nome || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return imagem
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={imagem} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    : <span aria-hidden style={{ width: size, height: size, borderRadius: "50%", background: "#d9c9a8", color: "#2b2418", fontSize: size * 0.42, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{ini}</span>;
}
