import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- GET: listar proxies ---
export async function GET() {
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
