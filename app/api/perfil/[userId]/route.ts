/**
 * GET /api/perfil/[userId] — o perfil de OUTRA pessoa (#427), aberto pelo "Ver perfil" da foto no escritório.
 * Só pra quem divide algum escritório com ela (ou a própria pessoa). Só leitura.
 *
 * Os CÉREBROS são privados e nem saem daqui: a rota não lê os mapas, não manda o contador "cérebros
 * completos", tira do extrato as linhas que vêm dos cérebros e, das validações de estudo, manda só o número.
 * Regras em lib/perfil/visitante.ts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { isSuperAdmin } from "@/lib/auth/roles";
import { corpoDoUsuario } from "@/lib/lounge3d/corposDeUsuario";
import { corDaArmadura } from "@/lib/cyber/cores";
import { auraEnabled, levelFromAura } from "@/lib/aura/rules";
import { somaEventos } from "@/lib/aura/ledger";
import { viewPublica } from "@/lib/aura/academico";
import { explorerUrl, type SolanaNetwork } from "@/lib/solana/config";
import { mapHarnessOn } from "@/lib/map/tipos";
import { CAMPOS_USUARIO_VISITANTE, podeVerPerfil, recentesSemCerebro } from "@/lib/perfil/visitante";

const OID = /^[a-f0-9]{24}$/i;

export async function GET(_req: Request, { params }: { params: { userId: string } }): Promise<NextResponse> {
  const s = await getServerSession(authOptions).catch(() => null);
  const email = s?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OID.test(params.userId || "")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const eu = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!eu) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // só quem divide um escritório com a pessoa (ou ela mesma)
  const canais = eu.id === params.userId ? [] : await prisma.canal.findMany({
    where: { OR: [{ ownerId: eu.id }, { membros: { has: eu.id } }, { dmCom: eu.id }] },
    select: { ownerId: true, membros: true, dmCom: true },
  });
  if (!podeVerPerfil(canais, eu.id, params.userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const u = await prisma.user.findUnique({ where: { id: params.userId }, select: CAMPOS_USUARIO_VISITANTE });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let convidadoPor: { name: string | null; image: string | null; course: string | null } | null = null;
  if (u.referredBy && OID.test(u.referredBy)) {
    convidadoPor = await prisma.user.findUnique({ where: { id: u.referredBy }, select: { name: true, image: true, course: true } }).catch(() => null);
  }

  const pessoa = {
    id: u.id,
    name: u.name || "",
    course: u.course || "",
    image: u.image || null,
    eduVerified: !!u.eduVerified,
    plan: u.plan || "free",
    academicLevel: u.academicLevel || "Graduação",
    inviter: convidadoPor,
    fundador: isSuperAdmin({ email: u.email, role: u.role }),
    corpo: corpoDoUsuario(u.id) ?? null,
    corArmadura: corDaArmadura(u.id),
  };

  // AURA (se a economia está ligada): os mesmos números do perfil, SEM nada dos cérebros
  let aura = null;
  if (auraEnabled()) {
    const [eventos, academicas, atestados] = await Promise.all([
      prisma.auraEvent.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
      prisma.academicCredential.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
      prisma.credential.findMany({ where: { userId: u.id, status: "issued" }, orderBy: { issuedAt: "desc" }, select: { id: true, type: true, title: true, assetId: true, network: true, issuedAt: true } }),
    ]);
    const total = somaEventos(eventos);
    aura = {
      aura: total, ...levelFromAura(total),
      validatedSkills: eventos.filter((e) => e.source === "node_validated").length,
      academicLevel: u.academicLevel ?? null,
      academicas: academicas.map(viewPublica),
      parede: atestados.map((a) => ({
        ...a,
        issuedAt: a.issuedAt ? a.issuedAt.toISOString() : null,
        explorerUrl: a.assetId ? explorerUrl(a.assetId, (a.network as SolanaNetwork) || undefined) : null,
        validadoPor: null,
      })),
      recent: recentesSemCerebro(eventos).map((e) => ({ id: e.id, source: e.source, amount: e.amount, reason: e.reason, at: e.createdAt.toISOString() })),
    };
  }

  // validações de estudo: só o NÚMERO (a lista são passos dos cérebros de outros alunos)
  const validacoesPendentes = mapHarnessOn()
    ? await prisma.mapaValidacao.count({ where: { validadorId: u.id, status: "pendente" } }).catch(() => null)
    : null;

  return NextResponse.json({ pessoa, aura, validacoesPendentes });
}
