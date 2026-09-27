import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/src/lib/prisma";
import { convitesAtivos, CONVITES_OFF_PAYLOAD } from "@/lib/convite/flag";

export async function POST(req: Request) {
  // Convites de cadastro desligados (ver lib/convite/flag.ts). A rota continua aqui:
  // é só ligar CONVITES_ATIVOS=1 pra ela voltar a responder.
  if (!convitesAtivos()) return NextResponse.json(CONVITES_OFF_PAYLOAD, { status: 503 });

  const cookieToken = cookies().get("convite_session")?.value;
  if (!cookieToken) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  let body: {
    sessionToken: string;
    inviteCode: string;
    name: string;
    age: number;
    area: string;
    role: "student" | "teacher";
    subject?: string;
    institution: string;
    gender?: "f" | "m";
    verificationDoc?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const {
    sessionToken,
    inviteCode,
    name,
    age,
    area,
    role,
    subject,
    institution,
    gender,
    verificationDoc,
  } = body;

  if (cookieToken !== sessionToken) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  if (!name || !age || !area || !role || !institution || !inviteCode) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }

  await prisma.pendingRegistration.upsert({
    where: { sessionToken },
    create: {
      sessionToken,
      inviteCode,
      name: name.trim(),
      age: Number(age),
      area: area.trim(),
      role,
      subject: subject?.trim() ?? null,
      institution: institution.trim(),
      gender: gender === "f" || gender === "m" ? gender : null,
      verificationDoc: verificationDoc ?? null,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
    update: {
      name: name.trim(),
      age: Number(age),
      area: area.trim(),
      role,
      subject: subject?.trim() ?? null,
      institution: institution.trim(),
      gender: gender === "f" || gender === "m" ? gender : null,
      verificationDoc: verificationDoc ?? null,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  return NextResponse.json({ ok: true });
}
