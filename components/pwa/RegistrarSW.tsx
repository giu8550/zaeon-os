"use client";

import { useEffect } from "react";

/**
 * Registra o /sw.js — só em produção.
 *
 * Em desenvolvimento, além de não registrar, DESREGISTRA o que houver: quem
 * roda `npm start` e depois `npm run dev` na mesma porta herda o SW do build de
 * produção, e ele serviria chunk velho do cache (em dev os chunks não têm hash).
 *
 * `updateViaCache: "none"` anda junto com o `Cache-Control: no-cache` do /sw.js
 * no next.config: sem os dois, o interruptor de emergência pode não chegar.
 *
 * Registra no `load`, não no mount: o SW não disputa banda com a primeira pintura.
 */
export function RegistrarSW() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;

        if (process.env.NODE_ENV !== "production") {
            navigator.serviceWorker
                .getRegistrations()
                .then((regs) => regs.forEach((r) => r.unregister()))
                .catch(() => {});
            return;
        }

        // O update() explícito não é redundante: register() com um SW já
        // instalado NÃO confere se o /sw.js mudou, e a checagem automática do
        // Chrome na navegação só roda depois de ~1s sem nenhum fetch — numa
        // página movimentada como a landing isso vai sendo adiado. Sem esta
        // linha, o interruptor de emergência chegava "uma hora"; com ela, chega
        // no próximo carregamento (medido antes do merge).
        const registrar = () =>
            navigator.serviceWorker
                .register("/sw.js", { scope: "/", updateViaCache: "none" })
                .then((reg) => reg.update())
                .catch(() => {
                    /* silêncio: SW é melhoria, nunca requisito */
                });

        // Se a hidratação acontecer depois do load, o evento já passou.
        if (document.readyState === "complete") {
            registrar();
            return;
        }
        window.addEventListener("load", registrar, { once: true });
        return () => window.removeEventListener("load", registrar);
    }, []);

    return null;
}
