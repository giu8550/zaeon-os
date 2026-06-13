// Confirmar código → verifica o .edu e concede o trial.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { PrismaClient } from "@prisma/client";
import { checkEdu } from "@/lib/eduEligibility";
import { grantStudentTrial, daysLeft, type PlanState } from "@/lib/plans";

const prisma = new PrismaClient();

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    const { eduEmail, code } = await req.json();
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: "GHOST_SESSION" }, { status: 404 });

    const rec = await prisma.eduVerification.findFirst({
        where: { userId: user.id, eduEmail },
        orderBy: { createdAt: "desc" },
    });
    if (!rec || rec.code !== String(code) || rec.expiresAt < new Date()) {
        return NextResponse.json({ error: "invalid_code", message: "Código inválido ou expirado." }, { status: 400 });
    }

    const edu = checkEdu(eduEmail);
    const next: PlanState = user.trialGranted
        ? { plan: (user.plan as any) || "free", plusUntil: user.plusUntil ?? null, trialGranted: true }
        : grantStudentTrial({ plan: (user.plan as any) || "free", plusUntil: user.plusUntil ?? null, trialGranted: false });

    await prisma.user.update({
        where: { id: user.id },
        data: {
            plan: next.plan, plusUntil: next.plusUntil, trialGranted: true,
            eduEmail, eduVerified: true,
        },
    });
    await prisma.eduVerification.deleteMany({ where: { userId: user.id } });

    return NextResponse.json({
        granted: !user.trialGranted, institution: edu.institution, daysLeft: daysLeft(next),
    });
}
