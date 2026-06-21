/**
 * DELETE /api/account — o usuário apaga a PRÓPRIA conta (reset fresh).
 * Purga completa (User + dados + auth). Depois o cliente faz signOut(); o próximo
 * login Google nasce do zero. Qualquer usuário logado pode apagar a sua conta.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { purgeUser } from "@/lib/admin/purgeUser";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = await purgeUser({ email });
  if (!res.ok) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true, removed: res.removed });
}
