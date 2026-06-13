// Pedir código: aluno com login Gmail pessoal informa o e-mail .edu → recebe código.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { PrismaClient } from "@prisma/client";
import { checkEdu } from "@/lib/eduEligibility";
import { sendEduCode } from "@/lib/email";

const prisma = new PrismaClient();

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    const { eduEmail } = await req.json();
    const edu = checkEdu(eduEmail || "");
    if (!edu.eligible) {
        return NextResponse.json(
            { error: "not_edu", message: "Esse e-mail não parece ser de uma instituição de ensino." },
            { status: 400 },
        );
    }
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "GHOST_SESSION" }, { status: 404 });

    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // limpa códigos antigos do usuário e cria o novo
    await prisma.eduVerification.deleteMany({ where: { userId: user.id } });
    await prisma.eduVerification.create({ data: { userId: user.id, eduEmail, code, expiresAt } });
    await sendEduCode(eduEmail, code);

    const body: any = { ok: true, institution: edu.institution };
    if (process.env.NODE_ENV !== "production") body.devCode = code; // DX até plugar e-mail
    return NextResponse.json(body);
}
