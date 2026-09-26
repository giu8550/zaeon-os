import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";

// 🔒 Só super-admin acessa proxies (eles expõem usuário/senha).
async function assertAdmin() {
    const session = await getServerSession(authOptions);
    return isSuperAdmin({ email: session?.user?.email, role: (session?.user as any)?.role });
}

// --- GET: listar proxies ---
export async function GET() {
    if (!(await assertAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    try {
        const proxies = await prisma.proxy.findMany({ orderBy: { createdAt: "desc" } });
        return NextResponse.json(proxies);
    } catch (error) {
        console.error("ZAEON DB ERROR (PROXY GET):", error);
        return NextResponse.json({ error: "Falha ao ler proxies." }, { status: 500 });
    }
}

// --- POST: criar ou atualizar proxy (upsert por ObjectId) ---
export async function POST(req: Request) {
    if (!(await assertAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    try {
        const body = await req.json();
        const {
            id, label, host, port, username, password,
            type, region, status, assignedEmail, assignedInstance,
        } = body;

        if (!label || !host || !port) {
            return NextResponse.json(
                { error: "Label, host e porta são obrigatórios." },
                { status: 400 },
            );
        }

        const data = {
            label: String(label),
            host: String(host),
            port: parseInt(String(port), 10) || 0,
            username: username ? String(username) : null,
            password: password ? String(password) : null,
            type: type ? String(type) : "socks5",
            region: region ? String(region) : "BR",
            status: assignedEmail ? "assigned" : (status ? String(status) : "free"),
            assignedEmail: assignedEmail ? String(assignedEmail) : null,
            assignedInstance: assignedInstance ? String(assignedInstance) : null,
        };

        let proxy;
        if (id && id.length === 24) {
            proxy = await prisma.proxy.update({ where: { id: String(id) }, data });
        } else {
            proxy = await prisma.proxy.create({ data });
        }
        return NextResponse.json(proxy, { status: 200 });
    } catch (error: any) {
        console.error("ZAEON DB ERROR (PROXY POST):", error);
        return NextResponse.json(
            { error: "Erro ao salvar proxy.", details: error.message },
            { status: 500 },
        );
    }
}

// --- DELETE: remover proxy por id ---
export async function DELETE(req: Request) {
    if (!(await assertAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id || id.length !== 24) {
            return NextResponse.json({ error: "ID inválido." }, { status: 400 });
        }
        await prisma.proxy.delete({ where: { id } });
        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error: any) {
        console.error("ZAEON DB ERROR (PROXY DELETE):", error);
        return NextResponse.json({ error: "Erro ao deletar proxy." }, { status: 500 });
    }
}
