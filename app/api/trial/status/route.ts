import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { PrismaClient } from "@prisma/client";
import { effectivePlan, daysLeft, type PlanState } from "@/lib/plans";

const prisma = new PrismaClient();

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    const u = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { plan: true, plusUntil: true, trialGranted: true, eduVerified: true, email: true },
    });
    if (!u) return NextResponse.json({ error: "GHOST_SESSION" }, { status: 404 });

    const state: PlanState = {
        plan: (u.plan as any) || "free",
        plusUntil: u.plusUntil ?? null,
        trialGranted: !!u.trialGranted,
    };
    return NextResponse.json({
        plan: effectivePlan(state),
        plusUntil: u.plusUntil,
        daysLeft: daysLeft(state),
        trialGranted: !!u.trialGranted,
        eduVerified: !!u.eduVerified,
    });
}
