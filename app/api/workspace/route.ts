// 1. FORÇA A ROTA A SER DINÂMICA (Resolve o erro da Vercel)
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma'; // Certifique-se de que este é o caminho correto para o seu cliente Prisma
import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/lib/auth';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // userId recebido do frontend (geralmente enviamos session.user.email)
        const { 
            userId, 
            schedule, 
            stickyNote, 
            chatHistory, 
            zaeonChat, 
            library, 
            personalModules, 
            layoutState,
            workTitle,
            workContent
        } = body;

        // 🔒 SEGURANÇA: o dono do workspace vem da SESSÃO, nunca do body (`userId` ignorado).
        const session = await getServerSession(authOptions);
        const sessionEmail = session?.user?.email?.toLowerCase();
        if (!sessionEmail) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }
        const user = await prisma.user.findFirst({ where: { email: sessionEmail } });

        if (!user) {
            return NextResponse.json({ error: 'Usuário não encontrado no banco de dados' }, { status: 404 });
        }

        // 2. Upsert: Atualiza se existir, cria se não existir usando o modelo UserSpaceData
        const workspace = await prisma.userSpaceData.upsert({
            where: { userId: user.id },
            update: {
                schedule,
                stickyNote,
                chatHistory,
                zaeonChat,
                library,
                personalModules,
                layoutState,
                workTitle,
                workContent
            },
            create: {
                userId: user.id,
                schedule,
                stickyNote,
                chatHistory,
                zaeonChat,
                library,
                personalModules,
                layoutState,
                workTitle,
                workContent
            }
        });

        return NextResponse.json({ success: true, data: workspace });

    } catch (error: any) {
        console.error("❌ Erro Prisma POST:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        // 🔒 SEGURANÇA: o dono do workspace vem da SESSÃO, nunca da query.
        const session = await getServerSession(authOptions);
        const sessionEmail = session?.user?.email?.toLowerCase();
        if (!sessionEmail) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }
        const user = await prisma.user.findFirst({ where: { email: sessionEmail } });

        if (!user) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
        }

        // Busca os dados do espaço do usuário
        const workspace = await prisma.userSpaceData.findUnique({
            where: { userId: user.id }
        });

        // Se não tiver nada salvo, retorna um objeto padrão limpo para o frontend não quebrar
        if (!workspace) {
            return NextResponse.json({
                data: {
                    schedule: [],
                    stickyNote: "",
                    chatHistory: [{ role: 'ai', text: "System online. I manage your schedule." }],
                    zaeonChat: [{ role: 'agent', text: "Zaeon initialized. Ready." }],
                    library: [],
                    personalModules: [
                        { id: 1, title: "Personal Backpack", items: [] },
                        { id: 2, title: "Project Archives", items: [] }
                    ],
                    layoutState: null,
                    workTitle: null,
                    workContent: null
                }
            });
        }

        return NextResponse.json({ data: workspace });

    } catch (error: any) {
        console.error("❌ Erro Prisma GET:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}