export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import connectToDatabase from "@/src/lib/db"; 
import User from "@/src/models/User"; 
import { authOptions } from "@/src/lib/auth";
import { grantStudentTrial, normalizePlan, type Plan } from "@/lib/plans";
import { isSuperAdmin } from "@/lib/auth/roles";
import { purgeUser } from "@/lib/admin/purgeUser";

// Admin = super admin (allowlist de fundadores em lib/auth/roles + role no banco).
const checkIsAdmin = (email: string | null | undefined, role?: string | null) => {
    return isSuperAdmin({ email, role });
};

// --- GET: LISTAR TODOS OS NODES ---
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        // 🔒 SEGURANÇA: era só `!session` → qualquer logado baixava PII/KYC de todos.
        if (!checkIsAdmin(session?.user?.email, (session?.user as any)?.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        await connectToDatabase();

        const users = await User.find({
            email: { $ne: session?.user?.email }
        }).sort({ createdAt: -1 });

        const formattedRequests = users.map((user) => ({
            id: user._id.toString(),
            name: user.name || "Usuário Zaeon",
            email: user.email,
            phone: user.phone || "Não informado",
            course: user.course || "Undeclared",
            age: user.age || 0,
            gender: user.gender || "Não informado",
            countryCode: user.countryCode || "br",
            role: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Student",
            kycStatus: user.kycStatus || "pending",
            plan: normalizePlan(user.plan || "free"),
            plusUntil: user.plusUntil ? new Date(user.plusUntil).toISOString() : null,
            deepThinkEnabled: !!user.deepThinkEnabled,
            advancedVoiceEnabled: !!user.advancedVoiceEnabled,
            projectsEnabled: !!user.projectsEnabled,
            tourDone: !!user.tourDone, // fez o onboarding guiado da Zaeon?
            institution: user.institution || "",
            verificationDoc: user.verificationDoc || null,
            inviteCodeUsed: user.inviteCodeUsed || null,
            submittedAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
        }));

        return NextResponse.json(formattedRequests);

    } catch (error) {
        console.error("ERRO ADMIN GET:", error);
        return NextResponse.json({ error: "Falha ao carregar usuários" }, { status: 500 });
    }
}

// --- PATCH: APROVAR OU REPROVAR (Mudar kycStatus) ---
export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        
        // NOVA TRAVA DE SEGURANÇA À PROVA DE FALHAS
        if (!checkIsAdmin(session?.user?.email, (session?.user as any)?.role)) {
            return NextResponse.json({ error: "Acesso Negado: Privilégios insuficientes." }, { status: 403 });
        }

        await connectToDatabase();
        const { userId, status, academicLevel, deepThinkEnabled, advancedVoiceEnabled, projectsEnabled, plan } = await req.json();

        // Toggles avulsos (modo econômico / voz avançada / sala Projetos) e mudança
        // direta de plano. Atualização isolada — não exige mexer no kycStatus.
        const flags: Record<string, unknown> = {};
        if (typeof deepThinkEnabled === "boolean") flags.deepThinkEnabled = deepThinkEnabled;
        if (typeof advancedVoiceEnabled === "boolean") flags.advancedVoiceEnabled = advancedVoiceEnabled;
        if (typeof projectsEnabled === "boolean") flags.projectsEnabled = projectsEnabled;
        if (typeof plan === "string") {
            const p: Plan = normalizePlan(plan);
            flags.plan = p;
            // Mudança manual de plano pelo admin não expira (controle manual).
            flags.plusUntil = null;
        }
        if (Object.keys(flags).length > 0) {
            const u = await User.findByIdAndUpdate(userId, flags, { new: true });
            if (!u) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
            return NextResponse.json({
                success: true,
                plan: normalizePlan(u.plan || "free"),
                deepThinkEnabled: !!u.deepThinkEnabled,
                advancedVoiceEnabled: !!u.advancedVoiceEnabled,
                projectsEnabled: !!u.projectsEnabled,
            });
        }

        const update: Record<string, unknown> = { kycStatus: status };
        if (academicLevel) update.academicLevel = academicLevel;
        // Aprovar (verified) = conceder o Plano Plus de estudante (30 dias).
        if (status === "verified") {
            const grant = grantStudentTrial({ plan: "free", plusUntil: null, trialGranted: false });
            update.plan = grant.plan;
            update.plusUntil = grant.plusUntil;
            update.trialGranted = true;
            update.eduVerified = true;
        }

        const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true });

        if (!updatedUser) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

        return NextResponse.json({ success: true, status: updatedUser.kycStatus, plan: updatedUser.plan ?? "free" });
    } catch (error) {
        return NextResponse.json({ error: "Falha ao atualizar status" }, { status: 500 });
    }
}

// --- DELETE: PURGA TOTAL (Apagar do MongoDB) ---
export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        
        // NOVA TRAVA DE SEGURANÇA À PROVA DE FALHAS
        if (!checkIsAdmin(session?.user?.email, (session?.user as any)?.role)) {
            return NextResponse.json({ error: "Acesso Negado: Privilégios insuficientes." }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('id');

        if (!userId) return NextResponse.json({ error: "ID Inválido" }, { status: 400 });

        // Purga COMPLETA (cascata): User + dados ligados + auth (accounts/sessions) →
        // some de vez, sem órfãos, e o próximo login Google nasce fresh.
        const purged = await purgeUser({ id: userId });
        if (!purged.ok) {
            return NextResponse.json({ error: "Nó não encontrado no banco" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Nó desintegrado com sucesso", removed: purged.removed });
    } catch (error) {
        console.error("ERRO NA PURGA:", error);
        return NextResponse.json({ error: "Erro interno ao deletar" }, { status: 500 });
    }
}