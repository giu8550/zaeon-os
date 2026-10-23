/**
 * /api/cyber/cofre — o COFRE da pessoa (lib/cyber/cofre + lib/cyber/cofreServidor): o fundo privado que os agentes de
 * trading operam, na DEVNET por enquanto. Logado; cada um só vê e mexe no seu.
 *  - GET → { cofre: null } ou o estado (endereço, valor, composição, configuração, operações) — sincroniza com a rede;
 *  - POST { acao: "criar" } → cria a carteira do cofre;
 *  - POST { acao: "config", config } → a pessoa decide as regras (quanto por operação, moedas, mesa, ligado, intervalo);
 *  - POST { acao: "airdrop" } → SOL de teste do faucet da devnet;
 *  - POST { acao: "rodada" } → a mesa decide e o cofre executa agora;
 *  - POST { acao: "sacar", destino, sol } → manda SOL do cofre pra um endereço.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { eu } from "@/lib/lounge3d/server";
import { enderecoValido } from "@/lib/cyber/carteira";
import { airdrop, criarCofre, estadoDoCofre, lerCofre, rodada, sacar, salvarConfig, sincronizar } from "@/lib/cyber/cofreServidor";

const falha = (e: unknown, status = 400) => NextResponse.json({ error: (e as Error)?.message?.slice(0, 200) ?? "falhou" }, { status });

export async function GET() {
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await lerCofre(me.id); if (!c) return NextResponse.json({ cofre: null });
  return NextResponse.json({ cofre: await estadoDoCofre(await sincronizar(c)) }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(req: Request) {
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (b.acao === "criar") return NextResponse.json({ cofre: await estadoDoCofre(await criarCofre(me.id)) });
    const c = await lerCofre(me.id); if (!c) return NextResponse.json({ error: "Crie o cofre primeiro." }, { status: 404 });
    if (b.acao === "config") return NextResponse.json({ cofre: await estadoDoCofre(await salvarConfig(c, b.config)) });
    if (b.acao === "airdrop") { const rl = await guard(req, "cofre-airdrop", "ai-heavy"); if (!rl.ok) return rl.response; return NextResponse.json({ assinatura: await airdrop(c) }); }
    if (b.acao === "rodada") {
      const rl = await guard(req, "cofre-rodada", "ai-light"); if (!rl.ok) return rl.response;
      const r = await rodada(c, me.id); return NextResponse.json({ ...r, cofre: await estadoDoCofre((await lerCofre(me.id))!) });
    }
    if (b.acao === "sacar") {
      if (!enderecoValido(b.destino)) return NextResponse.json({ error: "Endereço de destino inválido." }, { status: 400 });
      return NextResponse.json({ assinatura: await sacar(c, b.destino, Number(b.sol)) });
    }
    return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
  } catch (e) { return falha(e); }
}
