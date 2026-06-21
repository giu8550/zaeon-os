/**
 * GET /api/admin/groups — grupos de convite (gateway de novos usuários).
 * Para cada CONVIDADOR (dono de um InviteCode), lista quem ele convidou
 * (User.referredBy === ownerId). Base para a promoção do Plus em GRUPO.
 * Super admin only.
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { isSuperAdmin } from "@/lib/auth/roles";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isSuperAdmin({ email: session?.user?.email, role: (session?.user as any)?.role })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const codes = await prisma.inviteCode.findMany({
      select: { code: true, ownerId: true, usedCount: true, maxUses: true },
    });
    const ownerIds = Array.from(new Set(codes.map((c) => c.ownerId).filter(Boolean))) as string[];

    const [owners, invitees] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true, email: true, plan: true } }),
      prisma.user.findMany({
        where: { referredBy: { in: ownerIds } },
        select: { id: true, name: true, email: true, plan: true, referredBy: true, createdAt: true },
      }),
    ]);

    const ownerById = new Map(owners.map((o) => [o.id, o]));
    const codeByOwner = new Map<string, { code: string; usedCount: number; maxUses: number }>();
    for (const c of codes) if (c.ownerId && !codeByOwner.has(c.ownerId)) {
      codeByOwner.set(c.ownerId, { code: c.code, usedCount: c.usedCount, maxUses: c.maxUses });
    }
    const membersByOwner = new Map<string, any[]>();
    for (const u of invitees) {
      const k = u.referredBy as string;
      if (!membersByOwner.has(k)) membersByOwner.set(k, []);
      membersByOwner.get(k)!.push({ id: u.id, name: u.name || "—", email: u.email || "—", plan: u.plan || "free", joinedAt: u.createdAt });
    }

    const groups = ownerIds
      .map((oid) => {
        const o = ownerById.get(oid);
        const code = codeByOwner.get(oid);
        const members = (membersByOwner.get(oid) || []).sort(
          (a, b) => new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime(),
        );
        return {
          ownerId: oid,
          ownerName: o?.name || "—",
          ownerEmail: o?.email || "—",
          ownerPlan: o?.plan || "free",
          code: code?.code || null,
          usedCount: code?.usedCount ?? members.length,
          maxUses: code?.maxUses ?? 3,
          members,
        };
      })
      .filter((g) => g.members.length > 0)
      .sort((a, b) => b.members.length - a.members.length);

    return NextResponse.json({
      groups,
      totalGroups: groups.length,
      totalInvited: invitees.length,
    });
  } catch {
    return NextResponse.json({ groups: [], totalGroups: 0, totalInvited: 0 });
  }
}
