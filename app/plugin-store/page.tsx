"use client";
/**
 * /plugin-store — a Loja (hoje "Assistentes"). O corpo vive em components/mentors/LojaMentores.tsx (PR-A2).
 * Com NEXT_PUBLIC_MENTORES_TAB ligada, redireciona para /mentores PRESERVANDO a query (?from=, deep-links antigos).
 * Flag off = renderiza a loja exatamente como antes (categoria inicial "Todos").
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LojaMentores from "@/components/mentors/LojaMentores";
import { destinoDaLoja, mentoresTab } from "@/lib/mentores/rota";

export default function PluginStorePage() {
    const router = useRouter();
    const [redirecionando, setRedirecionando] = useState<boolean>(() => mentoresTab());
    useEffect(() => {
        const destino = typeof window !== "undefined" ? destinoDaLoja(mentoresTab(), window.location.search) : null;
        if (destino) router.replace(destino); else setRedirecionando(false);
    }, [router]);
    if (redirecionando) return null;
    return <LojaMentores initialCategory="Todos" />;
}
