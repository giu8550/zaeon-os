/**
 * /api/profile — perfil editável pelo próprio usuário.
 *   GET   → dados do usuário + o perfil de QUEM o convidou (referredBy).
 *   PATCH → atualiza nome e curso. MUDAR DE CURSO exige re-verificação:
 *           volta kycStatus="pending" + eduVerified=false (e guarda o novo comprovante).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const u = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, course: true, image: true, kycStatus: true, eduVerified: true, plan: true, academicLevel: true, referredBy: true },
  });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let inviter: { id: string; name: string | null; image: string | null; course: string | null } | null = null;
  if (u.referredBy) {
    try {
      const inv = await prisma.user.findUnique({
        where: { id: u.referredBy },
        select: { id: true, name: true, image: true, course: true },
      });
      if (inv) inviter = { id: inv.id, name: inv.name, image: inv.image, course: inv.course };
    } catch { /* referredBy inválido → ignora */ }
  }

  return NextResponse.json({
    name: u.name || "",
    course: u.course || "",
    image: u.image || null,
    kycStatus: u.kycStatus || "pending",
    eduVerified: !!u.eduVerified,
    plan: u.plan || "free",
    academicLevel: u.academicLevel || "Graduação",
    inviter,
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const course = typeof body.course === "string" ? body.course.trim() : undefined;
  const verificationDoc = typeof body.verificationDoc === "string" ? body.verificationDoc : undefined;

  const current = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { course: true },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (name) data.name = name.slice(0, 80);

  let reverify = false;
  if (course && course !== (current.course || "")) {
    data.course = course.slice(0, 80);
    // Mudou de curso → precisa comprovar de novo (perde a verificação até o admin aprovar).
    data.kycStatus = "pending";
    data.eduVerified = false;
    if (verificationDoc) data.verificationDoc = verificationDoc;
    reverify = true;
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true, reverify: false });

  const updated = await prisma.user.update({
    where: { email: session.user.email },
    data,
    select: { name: true, course: true, kycStatus: true },
  });

  return NextResponse.json({ ok: true, reverify, ...updated });
}
