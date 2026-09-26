import type { Metadata } from "next";

import { BORDA, LEITURA, Rotulo, TituloSecao } from "@/components/layout/secao";
import { TentarDeNovo } from "@/components/pwa/TentarDeNovo";

/**
 * Fallback do service worker (public/sw.js): é o que aparece quando uma
 * navegação falha por falta de rede. Estática de propósito — sem fetch, sem
 * sessão — porque é guardada no cache uma vez e servida pra qualquer pessoa.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
    title: "Sem conexão — Zaeon",
    robots: { index: false },
};

export default function OfflinePage() {
    return (
        <main className={`${BORDA} flex min-h-[100svh] flex-col justify-center py-32`}>
            <Rotulo>Sem conexão</Rotulo>
            <TituloSecao forte="Você está offline." fraco="A Zaeon volta assim que a rede voltar." />
            <p className={`mt-6 ${LEITURA} text-[15px] leading-relaxed text-slate-600 dark:text-slate-400`}>
                Não deu pra carregar esta página agora. Confira o Wi-Fi ou os dados móveis e tente
                de novo.
            </p>
            <div>
                <TentarDeNovo />
            </div>
        </main>
    );
}
