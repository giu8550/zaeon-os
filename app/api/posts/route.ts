import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { PrismaClient } from "@prisma/client";
import { redis } from "@/src/lib/redis"; // 🔥 1. IMPORT DO REDIS ADICIONADO

const prisma = new PrismaClient();

// --- 1. GET: PUXAR OS POSTS DA SALA E SEUS COMENTÁRIOS ---
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const room = searchParams.get("room") || "lounge";

        // 🔥 2. CHAVE DE CACHE ÚNICA PARA A SALA
        const cacheKey = `feed_posts_${room}`;

        // 🔥 3. TENTA LER DO REDIS PRIMEIRO (Hyper-Fast)
        // Só lê do Redis se NÃO for a sala de pesquisa (para respeitar a filtragem privada em tempo real)
        const session = await getServerSession(authOptions);
        const userEmail = session?.user?.email || "";

        if (room !== "research") {
            const cachedFeed = await redis.get(cacheKey);
            if (cachedFeed) {
                return NextResponse.json(cachedFeed);
            }
        }

        // Se não tem no Redis, bate no MongoDB
        const posts = await prisma.post.findMany({
            where: { room: room },
            orderBy: { createdAt: "desc" },
            include: {
                author: {
                    select: { id: true, email: true, image: true }
                },
                comments: {
                    include: {
                        author: { select: { id: true, email: true, image: true } }
                    },
                    orderBy: { createdAt: "asc" }
                }
            }
        });

        // Formatando para o frontend
        const formattedPosts = posts
            .filter(post => {
                if (post.room === "research" && post.tags && post.tags.includes("private")) {
                    return post.author?.email === userEmail;
                }
                return true;
            })
            .map(post => ({
                id: post.id,
                user: post.user,
                userId: post.author?.id || post.userId,
                userEmail: post.author?.email || "",
                userImage: post.author?.image || post.userImage,
                content: post.content,
                title: post.title,
                images: post.images || [],
                tags: post.tags || [],
                attachments: post.attachments,
                createdAt: post.createdAt ? post.createdAt.toISOString() : new Date().toISOString(),
                likes: post.likes || [],
                room: post.room,
                comments: post.comments.map(c => ({
                    id: c.id,
                    user: c.user,
                    userId: c.author?.id || c.userId,
                    userEmail: c.author?.email || "",
                    userImage: c.author?.image,
                    content: c.content,
                    createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString()
                }))
            }));

        // 🔥 4. SALVA O RESULTADO NO REDIS PARA OS PRÓXIMOS ACESSOS (apenas para salas normais)
        if (room !== "research") {
            await redis.set(cacheKey, formattedPosts, { ex: 60 });
        }

        return NextResponse.json(formattedPosts);
    } catch (error) {
        console.error("Erro ao buscar posts:", error);
        return NextResponse.json({ error: "Falha na conexão com a Matrix" }, { status: 500 });
    }
}

// --- 2. POST: CRIAR UM NOVO SINAL (POSTAGEM RÁPIDA) ---
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const { content, room, title, images, tags, attachments } = await req.json();

        if (!content || !room) {
            return NextResponse.json({ error: "Conteúdo e Sala são obrigatórios" }, { status: 400 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!dbUser) {
            return NextResponse.json({ error: "Usuário não encontrado no banco" }, { status: 404 });
        }

        const newPost = await prisma.post.create({
            data: {
                content,
                room,
                title: title || null,
                images: images || [],
                tags: tags || [],
                attachments: attachments || null,
                user: session.user.name || "Operative",
                userImage: session.user.image || "",
                userId: dbUser.id
            },
            include: {
                author: { select: { id: true, email: true, image: true } },
                comments: { include: { author: { select: { id: true, email: true, image: true } } } }
            }
        });

        // 🔥 5. CRÍTICO: DELETA O CACHE DA SALA APÓS NOVA POSTAGEM
        await redis.del(`feed_posts_${room}`);

        // Formata igual ao GET para a UI Otimista
        const formattedPost = {
            id: newPost.id,
            user: newPost.user,
            userId: newPost.author?.id || dbUser.id,
            userEmail: newPost.author?.email || "",
            userImage: newPost.author?.image || newPost.userImage,
            content: newPost.content,
            title: newPost.title,
            images: newPost.images || [],
            tags: newPost.tags || [],
            attachments: newPost.attachments,
            createdAt: newPost.createdAt ? newPost.createdAt.toISOString() : new Date().toISOString(),
            likes: newPost.likes || [],
            room: newPost.room,
            comments: []
        };

        return NextResponse.json(formattedPost);
    } catch (error) {
        console.error("Erro ao criar post:", error);
        return NextResponse.json({ error: "Falha ao transmitir sinal" }, { status: 500 });
    }
}

// --- 3. DELETE: DESINTEGRAR UM SINAL (LIXEIRA) ---
export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const postId = searchParams.get("id");

        if (!postId) return NextResponse.json({ error: "ID do post não fornecido" }, { status: 400 });

        const post = await prisma.post.findUnique({
            where: { id: postId },
            include: { author: true }
        });

        if (!post) return NextResponse.json({ error: "Sinal não encontrado" }, { status: 404 });

        // @ts-ignore
        const isSuperAdmin = session.user.isAdmin === true;
        const isOwner = post.author?.email === session.user.email;

        if (!isSuperAdmin && !isOwner) {
            return NextResponse.json({ error: "Privilégios insuficientes para desintegrar este sinal" }, { status: 403 });
        }

        await prisma.post.delete({
            where: { id: postId }
        });

        // 🔥 6. CRÍTICO: DELETA O CACHE DA SALA APÓS EXCLUSÃO
        await redis.del(`feed_posts_${post.room}`);

        return NextResponse.json({ success: true, message: "Sinal desintegrado." });
    } catch (error) {
        console.error("Erro ao apagar post:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}