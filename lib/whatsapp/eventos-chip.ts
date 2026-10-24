/**
 * lib/whatsapp/eventos-chip.ts — o que os CHIPS da Zaeon ouvem: os eventos não-solicitados do whatsapp-adapter
 * no bridge Redis (wa:evt:{shard}). Grupo de consumo PRÓPRIO ("zaeon-inbound"), então não briga com o XREAD
 * de quem está esperando a confirmação de um envio (bridge.ts) — grupos são independentes.
 *   message_inbound   → alguém mandou mensagem pro chip → handleInbound (o mesmo da conversa: conectar, PARE,
 *                       resposta da Zaeon), com a resposta saindo pelo MESMO chip. Dedupe pelo message_id.
 *   connection_state  → estado do chip (conectado/caiu) sem esperar o painel perguntar.
 * Um TICK por chamada (lê o que chegou, processa, dá ACK): o server.js chama /api/whatsapp/chips/eventos a cada
 * poucos segundos — o mesmo desenho do scheduler do dispatch (sem processo novo pra manter vivo).
 */
import type { BridgeRedis } from "@/lib/chipflow/bridge";

export const GRUPO = "zaeon-inbound";
export type RedisGrupo = BridgeRedis & {
  xgroup(...args: (string | number)[]): Promise<unknown>;
  xreadgroup(...args: (string | number)[]): Promise<[string, [string, string[]][]][] | null>;
  xack(...args: (string | number)[]): Promise<number>;
};

export type EventoInbound = { instanceId: number; de: string; texto: string; messageId: string; tipo: string };
export type EventoEstado = { instanceId: number; estado: string; jid?: string };
export type EventoLido = { inbound?: EventoInbound; estado?: EventoEstado };

/** campos do XREADGROUP → o que interessa (puro). Comando respondido (sent/failed…) e o resto: ignora. */
export function lerEvento(campos: Record<string, string>): EventoLido {
  let v: any = null;
  try { v = JSON.parse(campos.v ?? "null"); } catch { return {}; }
  if (!v || typeof v !== "object") return {};
  const instanceId = Number(v.instance_id ?? campos.instance_id);
  if (!Number.isFinite(instanceId)) return {};
  const r = (v.result ?? {}) as Record<string, unknown>;
  if (v.kind === "message_inbound") {
    const de = String(r.from ?? "").replace(/\D/g, "");
    const texto = String(r.text ?? r.caption ?? "").trim();
    if (!de || !texto) return {};   // mídia sem legenda: nada pra responder (fase 2 = áudio)
    return { inbound: { instanceId, de, texto, messageId: String(r.message_id ?? v.event_id ?? ""), tipo: String(r.type ?? "text") } };
  }
  if (v.kind === "connection_state") {
    const estado = String(r.state ?? r.connection_state ?? v.status ?? "").toLowerCase();
    if (!estado) return {};
    return { estado: { instanceId, estado, jid: typeof r.jid === "string" ? r.jid : undefined } };
  }
  return {};
}

type Deps = {
  redis?: RedisGrupo;
  shards?: number;
  consumidor?: string;
  ehNosso?: (instanceId: number) => Promise<{ id: string } | null>;
  jaVisto?: (messageId: string) => Promise<boolean>;
  aoReceber?: (e: EventoInbound, chipId: string) => Promise<unknown>;
  aoMudarEstado?: (e: EventoEstado) => Promise<unknown>;
};

/** Um tick: lê até 50 eventos novos por shard, processa e dá ACK. Devolve o que fez (pra log/teste). */
export async function tickEventos(d: Deps = {}): Promise<{ lidos: number; respondidos: number; estados: number; ignorados: number }> {
  const conta = { lidos: 0, respondidos: 0, estados: 0, ignorados: 0 };
  let redis = d.redis;
  if (!redis) {
    const { conexaoDoBridge } = await import("@/lib/chipflow/bridge");
    const c = conexaoDoBridge();
    if (!c) return conta;
    redis = (await c) as RedisGrupo;
  }
  const { numShards } = await import("@/lib/chipflow/bridge-request");
  const n = d.shards ?? numShards(process.env);
  const chips = await import("./chips");
  const ehNosso = d.ehNosso ?? chips.chipPorInstancia;
  const jaVisto = d.jaVisto ?? (async (mid: string) => !!mid && !!(await (await import("@/src/lib/prisma")).prisma.whatsAppMessage.findFirst({ where: { waMsgId: mid }, select: { id: true } })));
  const aoReceber = d.aoReceber ?? (async (e: EventoInbound, chipId: string) => {
    const { handleInbound } = await import("./service");
    const { toE164 } = await import("./phone");
    return handleInbound({ phone: toE164(`+${e.de}`) ?? `+${e.de}`, text: e.texto, messageId: e.messageId, chipId });
  });
  const aoMudarEstado = d.aoMudarEstado ?? ((e: EventoEstado) => chips.estadoDoBridge(e.instanceId, e.estado, e.jid));
  const consumidor = d.consumidor ?? `zaeon-${process.pid}`;

  for (let s = 0; s < Math.max(1, n); s++) {
    const stream = `wa:evt:${s}`;
    // o grupo nasce no FIM do stream ($): não reprocessa a história inteira na 1ª vez
    try { await redis.xgroup("CREATE", stream, GRUPO, "$", "MKSTREAM"); } catch { /* BUSYGROUP: já existe */ }
    const resp = await redis.xreadgroup("GROUP", GRUPO, consumidor, "COUNT", 50, "STREAMS", stream, ">");
    if (!resp) continue;
    for (const [, entradas] of resp) {
      for (const [id, plano] of entradas) {
        conta.lidos++;
        const campos: Record<string, string> = {};
        for (let i = 0; i + 1 < plano.length; i += 2) campos[plano[i]!] = plano[i + 1]!;
        try {
          const ev = lerEvento(campos);
          const instanceId = ev.inbound?.instanceId ?? ev.estado?.instanceId;
          const chip = instanceId != null ? await ehNosso(instanceId) : null;
          if (!chip) { conta.ignorados++; }
          else if (ev.inbound) {
            if (await jaVisto(ev.inbound.messageId)) conta.ignorados++;
            else { await aoReceber(ev.inbound, chip.id); conta.respondidos++; }
          } else if (ev.estado) { await aoMudarEstado(ev.estado); conta.estados++; }
          else conta.ignorados++;
        } catch (e) {
          console.warn("[chips] evento falhou:", String((e as Error)?.message ?? e).slice(0, 160));
        } finally {
          await redis.xack(stream, GRUPO, id).catch(() => 0);   // nunca trava a fila num evento ruim
        }
      }
    }
  }
  return conta;
}
