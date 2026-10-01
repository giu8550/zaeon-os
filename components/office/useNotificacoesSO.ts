"use client";

/**
 * useNotificacoesSO — a parte DOM das notificações do canal: permissão da Notification API
 * (pedida UMA vez, no 1º envio — nunca na carga), disparo com agrupamento, badge no título da
 * aba e visibilidade. As decisões (prioridade / deve notificar) vivem em lib/canal/notificacoes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Agrupador, tituloComBadge, tituloBase, trecho, type Prioridade } from "@/lib/canal/notificacoes";

export function useNotificacoesSO() {
  const [visivel, setVisivel] = useState(true);
  const agrupador = useRef(new Agrupador(4000));
  const tituloOriginal = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => setVisivel(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("blur", sync);
    return () => { document.removeEventListener("visibilitychange", sync); window.removeEventListener("focus", sync); window.removeEventListener("blur", sync); };
  }, []);

  /** Pede permissão 1x (só em gesto do usuário). Falha/negado = silêncio. */
  const pedirPermissao = useCallback(async () => {
    try {
      if (typeof Notification === "undefined") return false;
      if (Notification.permission === "granted") return true;
      if (Notification.permission === "denied") return false;
      return (await Notification.requestPermission()) === "granted";
    } catch { return false; }
  }, []);

  /** Badge "(n)" no título da aba; n=0 limpa. */
  const badgeTitulo = useCallback((naoLidas: number) => {
    try {
      if (tituloOriginal.current === null) tituloOriginal.current = tituloBase(document.title);
      document.title = tituloComBadge(tituloOriginal.current, naoLidas);
    } catch { /* ignore */ }
  }, []);

  /** Notificação do SO (se permitida), agrupada por canal. `onClick` foca o canal. */
  const notificar = useCallback((args: { canalId: string; prioridade: Prioridade; titulo: string; corpo: string; onClick?: () => void }) => {
    try {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
      if (!agrupador.current.deveDisparar(args.canalId, args.prioridade)) return false;
      const n = new Notification(args.titulo, { body: trecho(args.corpo), tag: `canal-${args.canalId}`, silent: args.prioridade !== "alta" });
      n.onclick = () => { try { window.focus(); } catch { /* ignore */ } args.onClick?.(); n.close(); };
      return true;
    } catch { return false; }
  }, []);

  return { visivel, pedirPermissao, badgeTitulo, notificar };
}
