import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/lib/auth';
import { PrismaClient } from '@prisma/client';
import { validarAvatar } from '@/lib/user/avatar';

const prisma = new PrismaClient();

/**
 * Troca a foto de perfil de quem está logado. #438: aceita PATCH (Workstation antiga) e POST (página de Perfil) —
 * antes só PATCH, e pelo Perfil a foto nunca salvava (405). Valida formato e tamanho (lib/user/avatar.ts).
 */
async function salvarAvatar(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const v = validarAvatar(body?.image);
        if (!v.ok) {
            return NextResponse.json({ error: v.erro }, { status: v.status });
        }

        // Salva a nova imagem diretamente no perfil do usuário no MongoDB
        await prisma.user.update({
            where: { email: session.user.email },
            data: { image: v.image }
        });

        return NextResponse.json({ success: true, message: "Avatar atualizado no Cérebro Central." });
    } catch (error) {
        console.error("Erro ao atualizar avatar:", error);
        return NextResponse.json({ error: "Falha ao sincronizar avatar." }, { status: 500 });
    }
}

export const PATCH = salvarAvatar;
export const POST = salvarAvatar;
