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
    webpack: (config, { isServer }) => {
        config.resolve.alias.canvas = false;
        // Nodebox (Sustainable Use License, proíbe uso comercial) fora do bundle do navegador: o Sandpack só o
        // carrega no template vite-react/node, que a prévia do Octa nunca usa (ruling P3: só o template `react`).
        if (!isServer) config.resolve.alias['@codesandbox/nodebox'] = false;
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
        // instrumentation.ts SEMPRE compilado. Antes era `process.env.SCHOLAR_WORKER === "1"`, mas isso
        // é decidido no BUILD — e nem o web nem o worker recebem SCHOLAR_WORKER no build (só no runtime,
        // via `environment` do compose), então NENHUM worker de fundo subia em prod (chores, canal,
        // scholar). O register() já sai sem fazer nada sem as flags de runtime (CHORES_WORKER,
        // CANAL_WORKER, SCHOLAR_WORKER) e só carrega Prisma/bullmq por import() dinâmico, então o boot
        // do web sem flag fica igual. Ver instrumentation.ts.
        instrumentationHook: true,
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

    // 6. Build e Qualidade
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    }
};

export default nextConfig;