import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, JetBrains_Mono, Outfit, Inter_Tight } from "next/font/google";

import { siteConfig } from "@/config";
import { cn } from "@/lib/utils";

// --- PROVIDERS ---
import AuthProvider from "@/src/providers/SessionProvider";
import { ThemeProvider } from "./providers";
// 1. IMPORT THE WEB3 PROVIDER
import { Web3Provider } from "@/src/context/Web3Context";

// --- COMPONENTES GLOBAIS ---
import GlobalClickSound from "@/components/main/GlobalClickSound";
import { Navbar } from "@/components/main/navbar";
// 🔥 Chat global da Zaeon (IA + Colegas/Professores, troca de lado).
import { LoungeChatWidget } from "@/components/sub/LoungeChatWidget";

import "../src/i18n";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space",
    weight: ["300", "400", "500", "600", "700"],
    display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-code",
    weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
    display: "swap",
});

const outfit = Outfit({
    subsets: ["latin"],
    variable: "--font-outfit",
    weight: ["300", "400", "500", "600", "700", "800", "900"],
    display: "swap",
});

// Fonte "tech" fina — usada no co-working da Sala de Estudos (pill de agente, composer).
const interTight = Inter_Tight({
    subsets: ["latin"],
    variable: "--font-tech",
    weight: ["300", "400", "500", "600", "700"],
    display: "swap",
});

// Tipografia do Modo Revista (Sala de Estudos). Servidas pelo next/font — o canvas
// mede a MESMA fonte que desenha, então elas precisam existir localmente, não num CDN.
const fraunces = Fraunces({
    subsets: ["latin"],
    variable: "--font-revista-display",
    weight: ["300", "600", "700"],
    style: ["normal", "italic"],
    display: "swap",
});

const newsreader = Newsreader({
    subsets: ["latin"],
    variable: "--font-revista-corpo",
    weight: ["400", "600"],
    display: "swap",
});

/**
 * `viewportFit: "cover"` e o que faz a pagina ocupar a tela inteira em aparelho
 * com entalhe/ilha; sem ele o iOS deixa duas tarjas da cor de fundo em cima e
 * embaixo quando o app roda instalado. O preco disso sao os `env(safe-area-inset-*)`
 * na navbar e no body (globals.css) -- os dois andam juntos: pedir `cover` sem
 * tratar as bordas coloca a navbar embaixo do relogio.
 *
 * NAO existe `maximumScale`/`userScalable` aqui de proposito: bloquear o zoom
 * deixa o app inacessivel para quem enxerga mal, e o iOS ignora mesmo assim.
 *
 * `themeColor` e um valor so, escuro, e nao um par por `prefers-color-scheme`:
 * a Zaeon abre no escuro por padrao, entao um par pintaria a barra do navegador
 * de branco para quem esta no claro do SO -- que e o descasamento pior.
 */
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: "#030014",
};

export const metadata: Metadata = {
    ...siteConfig,
    applicationName: "Zaeon",
    // O manifesto vive em app/manifest.ts; o Next serve e linka sozinho.
    appleWebApp: {
        capable: true,
        title: "Zaeon",
        // "black-translucent" deixa o conteudo correr por baixo da barra de
        // status; so e honesto porque a navbar recua com safe-area-inset-top.
        statusBarStyle: "black-translucent",
    },
    icons: {
        icon: [
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="pt-BR" className="scroll-smooth" suppressHydrationWarning>
            <body
                className={cn(
                    "relative bg-white dark:bg-background text-foreground overflow-x-hidden overflow-y-scroll",
                    spaceGrotesk.variable,
                    jetbrainsMono.variable,
                    outfit.variable,
                    interTight.variable,
                    "font-sans"
                )}
            >
                {/* Injetamos o som aqui para que ele escute os eventos de clique 
                  em qualquer lugar da aplicação (acima de todos os providers).
                */}
                <GlobalClickSound />

                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    disableTransitionOnChange
                >
                    <AuthProvider>
                        <Web3Provider>
                            <Navbar />
                            {children}

                            {/* 🔥 CHAT GLOBAL DA ZAEON (IA + Colegas/Professores) 🔥 */}
                            <LoungeChatWidget />

                        </Web3Provider>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}