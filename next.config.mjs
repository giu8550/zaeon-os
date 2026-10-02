/** @type {import('next').NextConfig} */
const nextConfig = {
    // 1. Autorização de domínios externos
    images: {
        remotePatterns: [
            // --- NOVOS DOMÍNIOS ADICIONADOS ---
            {
                protocol: 'https',
                hostname: 'lugaresdememoria.com.br',
            },
            {
                protocol: 'https',
                hostname: 'www.shutterstock.com',
            },
            {
                protocol: 'https',
                hostname: 'lukozo.com',
            },
            {
                protocol: 'https',
                hostname: 'www.criptofacil.com',
            },
            // -----------------------------------
            {
                protocol: 'https',
                hostname: '**', // Curinga mantido por precaução
            },
            {
                protocol: 'https',
                hostname: 'media.licdn.com',
            },
            {
                protocol: 'https',
                hostname: 'miro.medium.com',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
            {
                protocol: 'https',
                hostname: 'authjs.dev',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com',
            },
            {
                protocol: 'https',
                hostname: '**.googleusercontent.com',
            },
            {
                protocol: 'https',
                hostname: 'cdn.simpleicons.org',
            }
        ],
    },

    // 2. Otimização de pacotes (Barrel Imports)
    modularizeImports: {
        "@heroicons/react/24/outline": {
            transform: "@heroicons/react/24/outline/{{member}}",
        },
        "@heroicons/react/24/solid": {
            transform: "@heroicons/react/24/solid/{{member}}",
        },
        "lucide-react": {
            transform: "lucide-react/dist/esm/icons/{{member}}",
        },
    },

    // 3. Resolução de conflitos de Build (Canvas/PDF)
    webpack: (config) => {
        config.resolve.alias.canvas = false;
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false
        };
        return config;
    },

    // 4. Configurações Experimentais e de Performance
    experimental: {
        serverActions: {
            bodySizeLimit: '20mb',
        },
        // Liga o instrumentation.ts (Next 14) SÓ quando este processo é o worker
        // (SCHOLAR_WORKER=1). No dev/web normal fica desligado → o instrumentation não é
        // compilado e não arrasta Prisma/bullmq pro boot. O worker (container dedicado)
        // sobe com SCHOLAR_WORKER=1 e aí o hook liga.
        instrumentationHook: process.env.SCHOLAR_WORKER === "1",
        // @prisma/client + .prisma/client externos: o Next 14 tentava EMPACOTAR o Prisma
        // Client e puxava a variante wasm (erro "Can't resolve ./query_engine_bg.js"),
        // que estourou quando o instrumentation.ts passou a importar o Prisma no boot.
        // Marcá-los como externos = Next não empacota, usa o require de runtime (o correto).
        serverComponentsExternalPackages: ["canvas", "sharp", "bullmq", "ioredis", "@prisma/client", ".prisma/client", "prisma"],
        // Tree-shaking dos barrels pesados (framer-motion/recharts são usados em todo
        // lugar) → bundle inicial menor, telas abrindo mais rápido. lucide/heroicons já
        // têm o modularizeImports acima; incluí-los aqui também é seguro.
        optimizePackageImports: ["framer-motion", "recharts", "@heroicons/react", "lucide-react"],
    },

    // 5. Service worker (public/sw.js). O Cache-Control é o que importa: se o
    // próprio /sw.js ficasse em cache, o interruptor de emergência (DESLIGAR)
    // não chegaria no aparelho. Vale no servidor custom porque o server.js
    // delega tudo pro app.getRequestHandler().
    async headers() {
        return [
            {
                source: "/sw.js",
                headers: [
                    { key: "Content-Type", value: "application/javascript; charset=utf-8" },
                    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                    { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
                ],
            },
        ];
    },

    // 5b. Documentação (GitBook estático em public/docs/index.html): /docs serve o index.
    // (/docs/ cai aqui também — o Next normaliza a barra final antes dos rewrites.)
    async rewrites() {
        return [{ source: "/docs", destination: "/docs/index.html" }];
    },

    // 6. Build e Qualidade
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    }
};

export default nextConfig;