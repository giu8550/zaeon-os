"use client";
/**
 * Coworking da cartolina por POLLING leve (2s): board, comentários e membros. Pusher fica como
 * upgrade (presença/cursores ao vivo) — o polling já valida o fluxo e não exige infra nova.
 *
 * Pausa com a aba escondida (document.hidden): ninguém paga request de quem não está olhando.
 * Board: só re-renderiza quando o `rev` muda. Comentários: busca só os novos (?desde=).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type Comentario = { id: string; cardId: string; userId: string; nome: string; imagem: string | null; texto: string; parentId: string | null; createdAt: string };
export type Membro = { userId: string; nome: string; imagem: string | null; papel: "dono" | "editor" | "leitor" };

export const POLL_MS = 2000;

export function useCartolinaCowork(opts: {
  ativo: boolean;
  boardId: string | null;
  onBoard: (b: { cards: any[]; rev: number; papel: string; titulo: string }) => void;
}) {
  const { ativo, boardId, onBoard } = opts;
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const revRef = useRef<number>(-1);
  const desdeRef = useRef<string | null>(null);
  const onBoardRef = useRef(onBoard);
  onBoardRef.current = onBoard;

  // trocou de board: zera o que era do anterior
  useEffect(() => { revRef.current = -1; desdeRef.current = null; setComentarios([]); setMembros([]); }, [boardId]);

  const puxar = useCallback(async () => {
    if (!boardId || (typeof document !== "undefined" && document.hidden)) return;
    const q = desdeRef.current ? `?desde=${encodeURIComponent(desdeRef.current)}` : "";
    const [rb, rc] = await Promise.all([
      fetch(`/api/cartolina/${boardId}`).catch(() => null),
      fetch(`/api/cartolina/${boardId}/comentarios${q}`).catch(() => null),
    ]);
    const b = rb?.ok ? (await rb.json().catch(() => null))?.board : null;
    if (b && b.rev !== revRef.current) { revRef.current = b.rev; onBoardRef.current(b); }
    const novos: Comentario[] = rc?.ok ? (await rc.json().catch(() => null))?.comentarios ?? [] : [];
    if (novos.length) {
      desdeRef.current = novos[novos.length - 1].createdAt;
      setComentarios((cs) => {
        const ids = new Set(cs.map((c) => c.id));
        return [...cs, ...novos.filter((c) => !ids.has(c.id))];
      });
    }
  }, [boardId]);

  const puxarMembros = useCallback(async () => {
    if (!boardId) return;
    const r = await fetch(`/api/cartolina/${boardId}/membros`).catch(() => null);
    const d = r?.ok ? await r.json().catch(() => null) : null;
    if (Array.isArray(d?.membros)) setMembros(d.membros);
  }, [boardId]);

  useEffect(() => {
    if (!ativo || !boardId) return;
    void puxar(); void puxarMembros();
    const t = setInterval(() => void puxar(), POLL_MS);
    const tm = setInterval(() => void puxarMembros(), POLL_MS * 10); // membros mudam raramente
    const voltou = () => { if (!document.hidden) void puxar(); };
    document.addEventListener("visibilitychange", voltou);
    return () => { clearInterval(t); clearInterval(tm); document.removeEventListener("visibilitychange", voltou); };
  }, [ativo, boardId, puxar, puxarMembros]);

  /** Envia e já puxa (quem comentou vê na hora, sem esperar o próximo tick). */
  const comentar = useCallback(async (cardId: string, texto: string, parentId?: string | null): Promise<boolean> => {
    if (!boardId) return false;
    const r = await fetch(`/api/cartolina/${boardId}/comentarios`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId, texto, parentId: parentId ?? undefined }),
    }).catch(() => null);
    if (r?.ok) void puxar();
    return !!r?.ok;
  }, [boardId, puxar]);

  const compartilhar = useCallback(async (papel: "editor" | "leitor"): Promise<string | null> => {
    if (!boardId) return null;
    const r = await fetch(`/api/cartolina/${boardId}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ papel }) }).catch(() => null);
    const d = r?.ok ? await r.json().catch(() => null) : null;
    return d?.url ? new URL(d.url, window.location.origin).toString() : null;
  }, [boardId]);

  return { comentarios, membros, comentar, compartilhar, puxarAgora: puxar };
}
