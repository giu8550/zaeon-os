/**
 * lib/admin/assertAdmin.ts — gate founder/super-admin das rotas de admin (gateway de agentes).
 * Mesma regra do app/api/admin/route.ts (allowlist de fundadores + role super_admin).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";

export type AdminCheck = { ok: true; email: string } | { ok: false; status: 401 | 403 };

export async function assertAdmin(): Promise<AdminCheck> {
  const session = await getServerSession(authOptions).catch(() => null);
  const email = session?.user?.email ?? null;
  if (!email) return { ok: false, status: 401 };
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  return isSuperAdmin({ email, role }) ? { ok: true, email } : { ok: false, status: 403 };
}
