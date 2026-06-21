// Modo de runtime — a chave da arquitetura dual (Vercel limitado ↔ Container potente).
// Tudo que tem "versão leve" (voz, RAG, WhatsApp) lê as capabilities daqui.
// Trocar de modo = uma env (NEXT_PUBLIC_RUNTIME_MODE), sem mexer na UI.
//
// VPS (2026-06): rodamos num container persistente (server.js + Socket.IO, 8GB).
// Por isso o default mudou para "container" — voz neural no servidor, RAG pesado, etc.
// Cada capability ainda pode ser sobrescrita por env, pra ligar/desligar feature sem
// serviço por trás (ex.: WhatsApp fica OFF até existir o backend, mesmo em container).

export type RuntimeMode = "vercel" | "container";

export function runtimeMode(): RuntimeMode {
    // Default = container (VPS). Para forçar o modo leve, NEXT_PUBLIC_RUNTIME_MODE=vercel.
    const m = (process.env.NEXT_PUBLIC_RUNTIME_MODE || "container").toLowerCase();
    return m === "vercel" ? "vercel" : "container";
}

export interface Capabilities {
    /** "browser" = TTS grátis no navegador (Vercel); "server" = TTS HQ via API (container/Kokoro). */
    voiceTts: "browser" | "server";
    /** assistente no WhatsApp — só liga com backend (env ZAEON_WHATSAPP=on). */
    whatsapp: boolean;
    /** RAG pesado (PDF inteiro/embeddings) — ligado no container; leve no Vercel. */
    heavyRag: boolean;
}

// Helper: lê um override "on"/"off" de env (NEXT_PUBLIC_* p/ rodar no cliente também).
function envFlag(name: string): boolean | undefined {
    const v = (process.env[name] || "").toLowerCase();
    if (v === "on" || v === "true" || v === "1") return true;
    if (v === "off" || v === "false" || v === "0") return false;
    return undefined;
}

export function capabilities(mode: RuntimeMode = runtimeMode()): Capabilities {
    const container = mode === "container";
    // Defaults por modo, com override fino por env (cada flag).
    const voiceServer = envFlag("NEXT_PUBLIC_TTS_SERVER") ?? container;
    const heavy = envFlag("NEXT_PUBLIC_HEAVY_RAG") ?? container;
    // WhatsApp NÃO segue o modo: precisa de backend dedicado → só liga com env explícita.
    const whatsapp = envFlag("NEXT_PUBLIC_WHATSAPP") ?? false;
    return {
        voiceTts: voiceServer ? "server" : "browser",
        whatsapp,
        heavyRag: heavy,
    };
}
