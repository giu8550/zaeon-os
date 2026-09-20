/**
 * GET /api/credentials — Mural de Conquistas do aluno.
 * Junta Credential (Mongo) + leitura on-chain via Helius DAS (assetIds) pra confirmar posse.
 * Antes, faz polling do que está `minting`. Nunca 500 por falha de rede/indexer (degrada).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { resolveUserId } from "@/lib/agent/transcript";
import { listCredentials } from "@/lib/solana/credentials";
import { claimWalletUrl, credentialsConfigured, heliusConfigured, solanaNetwork } from "@/lib/solana/config";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const userId = await resolveUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { credentials, verification } = await listCredentials(userId);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { solanaWallet: true } }).catch(() => null);
    const wallet = user?.solanaWallet ?? credentials.find((c) => c.walletAddress)?.walletAddress ?? null;
    return NextResponse.json({
      credentials,
      verification,
      wallet,
      network: solanaNetwork(),
      claimUrl: claimWalletUrl(),
      configured: credentialsConfigured(),
      heliusConfigured: heliusConfigured(),
    });
  } catch (e: any) {
    console.error("CREDENTIALS GET:", e);
    return NextResponse.json({ error: e?.message ?? "list failed" }, { status: 500 });
  }
}
