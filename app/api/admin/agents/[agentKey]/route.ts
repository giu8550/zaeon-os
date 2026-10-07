/**
 * PATCH /api/admin/agents/[agentKey] { nome?, bio?, avatarUrl?, ativo?, ordem?, área/entrega/emoji/
 * whatsapp/instagram/facebook (o CRACHÁ da landing + Assistentes) } — upsert do
 * AgentProfile (o roster continua sendo o cérebro; aqui só a identidade). avatarUrl aceita
 * data:image/* (mesmo padrão do /api/user/avatar) ou https. DELETE: remove o profile (volta ao roster).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { agentsAdmin } from "@/lib/canal/flags";
import { rosterComMentores, isAgentKey } from "@/lib/agents/roster";
import { validarAvatar } from "../route";
import { validarArea, validarEmoji, validarEntrega, validarFacebook, validarInstagram, validarWhatsapp } from "@/lib/agents/vitrine";

async function gate(): Promise<NextResponse | null> {
  if (!agentsAdmin()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: a.status === 401 ? "Unauthorized" : "Forbidden" }, { status: a.status });
  return null;
}

export async function PATCH(req: Request, { params }: { params: { agentKey: string } }) {
  const g = await gate(); if (g) return g;
  const agentKey = String(params.agentKey || "").toLowerCase();
  if (!isAgentKey(agentKey)) return NextResponse.json({ error: "agentKey inválido" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b?.nome === "string" && b.nome.trim()) data.nome = b.nome.trim().slice(0, 60);
  if (typeof b?.bio === "string") data.bio = b.bio.trim().slice(0, 240) || null;
  if (b?.avatarUrl !== undefined) {
    const av = validarAvatar(b.avatarUrl);
    if (av === undefined) return NextResponse.json({ error: "Avatar inválido (data:image/* ≤ 1.2MB ou https)." }, { status: 400 });
    data.avatarUrl = av;
  }
  // crachá: cada campo só entra se veio; inválido → 400 dizendo qual
  const cracha: [string, (v: unknown) => unknown, string][] = [
    ["area", validarArea, "Área até 40 caracteres."],
    ["entrega", validarEntrega, "Entrega: até 4 itens de até 28 caracteres, separados por vírgula."],
    ["emoji", validarEmoji, "Emoji: até 4 caracteres."],
    ["whatsapp", validarWhatsapp, "WhatsApp: número com DDD (ex.: 11 99999-8888) ou link wa.me."],
    ["instagram", validarInstagram, "Instagram: @perfil ou link do perfil."],
    ["facebook", validarFacebook, "Facebook: nome da página ou link."],
  ];
  for (const [campo, validar, erro] of cracha) {
    if (b?.[campo] === undefined) continue;
    const v = validar(b[campo]);
    if (v === undefined) return NextResponse.json({ error: erro }, { status: 400 });
    data[campo] = v;
  }
  if (typeof b?.ativo === "boolean") data.ativo = b.ativo;
  if (Number.isFinite(b?.ordem)) data.ordem = Math.trunc(Number(b.ordem));
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nada pra alterar." }, { status: 400 });

  // criar sob demanda: precisa saber o tipo/nome default a partir do roster (ou do banco)
  const mentores = await prisma.mentorTemplate.findMany({ select: { slug: true, name: true, course: true, emoji: true, personaText: true, order: true } });
  const base = rosterComMentores(mentores).find((a) => a.agentKey === agentKey);
  const existente = await prisma.agentProfile.findUnique({ where: { agentKey } });
  if (!existente && !base) return NextResponse.json({ error: "Agente desconhecido — crie com POST /api/admin/agents." }, { status: 404 });
  const profile = await prisma.agentProfile.upsert({
    where: { agentKey },
    update: data,
    create: {
      agentKey, tipo: base?.tipo ?? "persona", nome: (data.nome as string) ?? base!.nome, bio: (data.bio as string | null) ?? base?.bio ?? null,
      avatarUrl: (data.avatarUrl as string | null) ?? null, ativo: (data.ativo as boolean) ?? true, ordem: (data.ordem as number) ?? base?.ordem ?? 0,
      area: (data.area as string | null) ?? null, entrega: (data.entrega as string[]) ?? [], emoji: (data.emoji as string | null) ?? null,
      whatsapp: (data.whatsapp as string | null) ?? null, instagram: (data.instagram as string | null) ?? null, facebook: (data.facebook as string | null) ?? null,
    },
  });
  return NextResponse.json({ profile });
}

export async function DELETE(_req: Request, { params }: { params: { agentKey: string } }) {
  const g = await gate(); if (g) return g;
  const agentKey = String(params.agentKey || "").toLowerCase();
  if (!isAgentKey(agentKey)) return NextResponse.json({ error: "agentKey inválido" }, { status: 400 });
  await prisma.agentProfile.deleteMany({ where: { agentKey } });
  return NextResponse.json({ ok: true });
}
