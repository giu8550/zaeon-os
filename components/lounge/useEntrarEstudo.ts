"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LAB_ROTA, ehMsgEntrarEstudo, ehMsgSessaoIniciada, msgConfiavel } from "@/lib/ui/loungeHub";

/**
 * Contrato cyberespaço → app (postMessage do cosmic-map.html, mesma origem):
 *  - "zaeon:enter-study": botão Estudar → leva à Sala de Estudos (laboratório);
 *  - "zaeon:menu": a sessão começou (opção do monitor ou ESPAÇO) → `aoIniciarSessao`.
 */
export function useEntrarEstudo(aoIniciarSessao?: () => void) {
  const router = useRouter();
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!msgConfiavel(e, window.location.origin)) return;
      if (ehMsgEntrarEstudo(e.data)) router.push(LAB_ROTA);
      else if (ehMsgSessaoIniciada(e.data)) aoIniciarSessao?.();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router, aoIniciarSessao]);
}
