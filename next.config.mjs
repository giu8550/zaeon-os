/** @type {import('next').NextConfig} */
const nextConfig = {
    // Pasta de saída. Existe como variável porque `next build` e `next dev` compartilham
    // `.next` por padrão: rodar o build local com o dev de pé troca os chunks debaixo do
    // servidor e a página aberta passa a 404 em tudo — parece regressão do código e não é.
    // Em produção e no CI a variável não existe, então continua `.next`.
    distDir: process.env.NEXT_DIST_DIR || '.next',
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
        serverComponentsExternalPackages: ["canvas", "sharp"],
        // Tree-shaking dos barrels pesados (framer-motion/recharts são usados em todo
        // lugar) → bundle inicial menor, telas abrindo mais rápido. lucide/heroicons já
        // têm o modularizeImports acima; incluí-los aqui também é seguro.
        optimizePackageImports: ["framer-motion", "recharts", "@heroicons/react", "lucide-react"],
    },

    // 5. Build e Qualidade
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    }
};

export default nextConfig;