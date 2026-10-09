/**
 * lib/solana/credentials.ts — TODA conquista da Zaeon vira credencial soulbound na Solana.
 *
 * Fluxo: conquista (nó dominado / trabalho concluído / aula concluída / certificação de mentor)
 *   → issueCredential() grava Credential{pending} → Crossmint cunha pra "email:<aluno>:solana"
 *     (wallet custodial criada na hora, gasless, sem seed phrase) → Credential{minting}
 *   → refreshCredential() faz polling → Credential{issued, assetId, walletAddress}.
 *
 * Regras duras:
 *  - NUNCA lança: qualquer erro vira Credential{status:"error"}. A conquista do aluno NÃO
 *    depende do mint (degrada). Os ganchos chamam fire-and-forget.
 *  - Idempotente por (userId, type, refId): não cunha 2× a mesma conquista.
 *  - `metadata` carrega a trilha de evidência (provenance do harness) → credencial auditável.
 *
 * `db` é injetável (subset estrutural do PrismaClient) pra testar sem Mongo.
 */
import { prisma } from "@/src/lib/prisma";
import {
  CREDENTIAL_TYPES,
  credentialsConfigured,
  crossmintCollectionId,
  defaultStandardFor,
  explorerUrl,
  publicBaseUrl,
  recipientForEmail,
  solanaNetwork,
  type CredentialStandard,
  type CredentialType,
} from "./config";
import { createCrossmintClient, type CrossmintClient, type NftMetadata } from "./crossmint";
import { createHeliusClient } from "./helius";

export type CredentialStatus = "pending" | "minting" | "issued" | "error";

export type CredentialRecord = {
  id: string;
  userId: string;
  type: string;
  refId: string;
  title: string;
  chain: string;
  standard: string;
  network: string;
  assetId: string | null;
  mintTx: string | null;
  crossmintId: string | null;
  crossmintActionId: string | null;
  walletAddress: string | null;
  status: string;
  error: string | null;
  metadata: unknown;
  issuedAt: Date | null;
  createdAt: Date;
  updatedAt?: Date;
};

/** Subset estrutural do PrismaClient que a camada usa (injetável nos testes). */
export type CredentialDb = {
  credential: {
    findUnique(args: any): Promise<any>;
    findMany(args: any): Promise<any[]>;
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
  user: {
    findUnique(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
};

export type IssueInput = {
  type: CredentialType;
  refId: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  standard?: CredentialStandard;
};

export type Deps = {
  db?: CredentialDb;
  crossmint?: CrossmintClient;
  helius?: ReturnType<typeof createHeliusClient>;
  now?: () => Date;
  log?: (msg: string, extra?: unknown) => void;
};

const TYPE_LABEL: Record<CredentialType, string> = {
  skill: "Habilidade dominada",
  work: "Trabalho concluído",
  course: "Aula concluída",
  "mentor-cert": "Certificação de mentor",
  academic: "Título acadêmico verificado",
};

function resolveDeps(d: Deps = {}) {
  return {
    db: d.db ?? (prisma as unknown as CredentialDb),
    crossmint: d.crossmint ?? createCrossmintClient(),
    helius: d.helius ?? createHeliusClient(),
    now: d.now ?? (() => new Date()),
    log: d.log ?? ((msg: string, extra?: unknown) => console.warn(`[credentials] ${msg}`, extra ?? "")),
  };
}

function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.slice(0, 500);
}

/**
 * Metadados do NFT (o que o aluno/jurado vê no explorer). Sem jargão cripto no título.
 * PRIVACIDADE: nada de dado pessoal aqui — isto vai pro IPFS/cadeia (público). Só o quê (título da
 * conquista), o ponteiro (refId) e quando. Nome, e-mail e documento do aluno ficam fora da cadeia.
 */
export function buildNftMetadata(input: {
  type: CredentialType;
  title: string;
  refId: string;
  standard: CredentialStandard;
  network: string;
  description?: string;
  issuedAt: Date;
}): NftMetadata {
  const label = TYPE_LABEL[input.type];
  const badge = new URL(`${publicBaseUrl()}/api/credentials/badge`);
  badge.searchParams.set("type", input.type);
  badge.searchParams.set("title", input.title.slice(0, 80));
  return {
    name: `${label}: ${input.title}`.slice(0, 32 * 4),
    image: badge.toString(),
    description:
      input.description ||
      `${label} na Zaeon. Credencial soulbound (intransferível), emitida pela Zaeon e verificável na Solana.`,
    attributes: [
      { trait_type: "Tipo", value: label },
      { trait_type: "Origem", value: input.refId },
      { trait_type: "Emissor", value: "Zaeon" },
      { trait_type: "Rede", value: `solana-${input.network}` },
      { trait_type: "Padrão", value: input.standard === "cnft" ? "cNFT (Bubblegum V2)" : "token-2022 non-transferable" },
      { trait_type: "Soulbound", value: "sim" },
      { trait_type: "Emitida em", value: input.issuedAt.toISOString().slice(0, 10) },
    ],
  };
}

export function isCredentialType(v: unknown): v is CredentialType {
  return typeof v === "string" && (CREDENTIAL_TYPES as readonly string[]).includes(v);
}

/**
 * Emite (ou reaproveita) a credencial da conquista. Nunca lança.
 * Retorna o registro (status pending|minting|issued|error) ou null se nem gravar deu.
 */
export async function issueCredential(userId: string, input: IssueInput, deps: Deps = {}): Promise<CredentialRecord | null> {
  const { db, crossmint, now, log } = resolveDeps(deps);
  let rec: CredentialRecord | null = null;
  try {
    if (!userId || !isCredentialType(input.type) || !input.refId?.trim() || !input.title?.trim()) {
      log("issue ignorado: input inválido", { userId, type: input?.type, refId: input?.refId });
      return null;
    }
    const type = input.type;
    const refId = input.refId.trim();
    const title = input.title.trim().slice(0, 120);
    const standard: CredentialStandard = input.standard ?? defaultStandardFor(type);
    const network = solanaNetwork();
    const where = { userId_type_refId: { userId, type, refId } };

    // Idempotência: já emitida/em andamento → devolve. "error" → tenta de novo.
    const existing = await db.credential.findUnique({ where });
    if (existing && existing.status !== "error") return existing;

    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, solanaWallet: true } });
    const baseData = {
      title,
      standard,
      network,
      chain: "solana",
      status: "pending",
      error: null,
      metadata: (input.metadata ?? undefined) as any,
      walletAddress: user?.solanaWallet ?? null,
    };
    try {
      rec = existing
        ? await db.credential.update({ where: { id: existing.id }, data: baseData })
        : await db.credential.create({ data: { userId, type, refId, ...baseData } });
    } catch (e: any) {
      // Corrida: outro gancho criou o mesmo (userId,type,refId) entre o find e o create.
      if (e?.code === "P2002") return (await db.credential.findUnique({ where })) ?? null;
      throw e;
    }
    if (!rec) return null;

    const fail = async (message: string) => {
      log(`mint falhou (${type}/${refId}): ${message}`);
      rec = await db.credential.update({ where: { id: rec!.id }, data: { status: "error", error: message } });
      return rec;
    };

    if (!user?.email) return fail("usuário sem e-mail — não dá pra criar a wallet custodial");
    if (!credentialsConfigured()) return fail("camada Solana não configurada (CROSSMINT_SERVER_KEY / CROSSMINT_COLLECTION_ID)");

    const collectionId = crossmintCollectionId(standard);
    const metadata = buildNftMetadata({
      type, title, refId, standard, network,
      description: input.description,
      issuedAt: now(),
    });

    try {
      const minted = await crossmint.mint({
        collectionId,
        recipient: recipientForEmail(user.email),
        metadata,
        // cNFT (Bubblegum V2 soulbound) = barato em escala. mentor-cert = NÃO comprimido na coleção
        // token-2022 non-transferable (garantia soulbound mais forte; vale o rent).
        compressed: standard === "cnft",
        sendNotification: true,
      });
      rec = await db.credential.update({
        where: { id: rec.id },
        data: { status: "minting", crossmintId: minted.id, crossmintActionId: minted.actionId ?? null, error: null },
      });
      return rec;
    } catch (e) {
      return fail(errMsg(e));
    }
  } catch (e) {
    log("issue: erro inesperado", errMsg(e));
    try {
      if (rec) rec = await db.credential.update({ where: { id: rec.id }, data: { status: "error", error: errMsg(e) } });
    } catch { /* degrada */ }
    return rec;
  }
}

/** Polling: Credential{minting} → consulta Crossmint → issued (assetId/wallet/tx) | error. Nunca lança. */
export async function refreshCredential(id: string, deps: Deps = {}): Promise<CredentialRecord | null> {
  const { db, crossmint, now, log } = resolveDeps(deps);
  try {
    const rec: CredentialRecord | null = await db.credential.findUnique({ where: { id } });
    if (!rec) return null;
    if (rec.status !== "minting") return rec;
    if (!rec.crossmintId && !rec.crossmintActionId) {
      return db.credential.update({ where: { id }, data: { status: "error", error: "sem id da Crossmint pra consultar" } });
    }
    const collectionId = crossmintCollectionId((rec.standard as CredentialStandard) || "cnft");
    let onChain = rec.crossmintId
      ? await crossmint.getNft(collectionId, rec.crossmintId)
      : await crossmint.getAction(rec.crossmintActionId!);
    // txId costuma vir só no action; completa best-effort.
    if (onChain.status === "success" && !onChain.txId && rec.crossmintActionId) {
      try {
        const act = await crossmint.getAction(rec.crossmintActionId);
        onChain = { ...onChain, txId: act.txId ?? onChain.txId, mintHash: onChain.mintHash ?? act.mintHash, owner: onChain.owner ?? act.owner };
      } catch { /* opcional */ }
    }
    if (onChain.status === "success") {
      const updated = await db.credential.update({
        where: { id },
        data: {
          status: "issued",
          assetId: onChain.mintHash ?? null,
          mintTx: onChain.txId ?? null,
          walletAddress: onChain.owner ?? rec.walletAddress ?? null,
          issuedAt: now(),
          error: null,
        },
      });
      // Cacheia a wallet custodial no User (1º mint cria a wallet).
      if (onChain.owner) {
        try {
          const u = await db.user.findUnique({ where: { id: rec.userId }, select: { solanaWallet: true } });
          if (!u?.solanaWallet) await db.user.update({ where: { id: rec.userId }, data: { solanaWallet: onChain.owner } });
        } catch (e) { log("cache da wallet falhou", errMsg(e)); }
      }
      return updated;
    }
    if (onChain.status === "failed") {
      return db.credential.update({ where: { id }, data: { status: "error", error: onChain.error || "mint falhou na Crossmint" } });
    }
    return rec; // pending/unknown → continua minting
  } catch (e) {
    log(`refresh(${id}) falhou`, errMsg(e));
    return null;
  }
}

/** Faz polling de tudo que está `minting` do usuário (limite pra não estourar a rota). */
export async function refreshPending(userId: string, deps: Deps = {}, limit = 20): Promise<CredentialRecord[]> {
  const { db } = resolveDeps(deps);
  const minting: CredentialRecord[] = await db.credential.findMany({ where: { userId, status: "minting" }, take: limit });
  const out: CredentialRecord[] = [];
  for (const c of minting) {
    const r = await refreshCredential(c.id, deps);
    if (r) out.push(r);
  }
  return out;
}

export type CredentialView = CredentialRecord & {
  explorerUrl: string | null;
  /** true = Helius DAS confirmou que o asset existe, não foi queimado e está na wallet do aluno. */
  verified: boolean | null; // null = verificação indisponível (sem HELIUS_API_KEY / ainda não emitida)
  onChain: { owner?: string; burnt: boolean; compressed: boolean; nonTransferable?: boolean } | null;
};

/**
 * Mural do aluno: Mongo + leitura on-chain (Helius DAS) pra confirmar posse.
 * Antes, atualiza as `minting` (polling barato). Nunca lança.
 */
export async function listCredentials(userId: string, deps: Deps = {}): Promise<{ credentials: CredentialView[]; verification: "helius" | "unavailable" }> {
  const { db, helius, log } = resolveDeps(deps);
  try { await refreshPending(userId, deps); } catch (e) { log("refreshPending", errMsg(e)); }
  const rows: CredentialRecord[] = await db.credential.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  const ids = rows.map((r) => r.assetId).filter((x): x is string => Boolean(x));
  let assets = new Map<string, { owner?: string; burnt: boolean; compressed: boolean; nonTransferable?: boolean }>();
  let verification: "helius" | "unavailable" = helius.configured && ids.length ? "helius" : "unavailable";
  if (verification === "helius") {
    try { assets = await helius.getAssetBatch(ids); } catch (e) { log("helius DAS", errMsg(e)); verification = "unavailable"; }
  }
  const credentials: CredentialView[] = rows.map((r) => {
    const a = r.assetId ? assets.get(r.assetId) : undefined;
    const verified = verification !== "helius" || !r.assetId ? null
      : Boolean(a && !a.burnt && (!r.walletAddress || !a.owner || a.owner === r.walletAddress));
    return {
      ...r,
      explorerUrl: r.assetId ? explorerUrl(r.assetId, (r.network as any) || solanaNetwork()) : null,
      verified,
      onChain: a ? { owner: a.owner, burnt: a.burnt, compressed: a.compressed, nonTransferable: a.nonTransferable } : null,
    };
  });
  return { credentials, verification };
}
