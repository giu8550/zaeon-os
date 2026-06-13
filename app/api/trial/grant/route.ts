// Auto-grant: tenta conceder o trial pelo e-mail do LOGIN (caminho de atrito zero).
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { PrismaClient } from "@prisma/client";
import { checkEdu } from "@/lib/eduEligibility";
import { grantStudentTrial, daysLeft, type PlanState } from "@/lib/plans";

const prisma = new PrismaClient();

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    const u = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!u) return NextResponse.json({ error: "GHOST_SESSION" }, { status: 404 });

    if (u.trialGranted) {
        return NextResponse.json({ granted: false, reason: "already_granted" });
    }

    const edu = checkEdu(u.email || "");
    if (!edu.eligible) {
        // não é e-mail acadêmico → o front oferece o caminho de verificação manual
        return NextResponse.json({ granted: false, reason: "not_edu" });
    }

    const next = grantStudentTrial({
        plan: (u.plan as any) || "free",
        plusUntil: u.plusUntil ?? null,
        trialGranted: false,
    });
    await prisma.user.update({
        where: { id: u.id },
        data: {
            plan: next.plan, plusUntil: next.plusUntil, trialGranted: true,
            eduEmail: u.email, eduVerified: true,
        },
    });
    return NextResponse.json({
        granted: true, institution: edu.institution, daysLeft: daysLeft(next),
    });
}
