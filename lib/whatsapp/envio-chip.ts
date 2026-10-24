/**
 * lib/whatsapp/envio-chip.ts — mandar UMA mensagem por um chip da Zaeon, com a lógica dos disparos do modo
 * negócios (FlowShot `async_run_campaign_batch`): chip do rodízio → "digitando…" (send_presence) → espera de
 * 1,2–2,8 s → send_text pelo bridge Redis do whatsapp-adapter → conta no chip. Idempotente pelo `idemKey`
 * (o adapter descarta comando repetido: ignored_duplicate).
 */
import type { WaChip } from "@prisma/client";

export type EnvioChip = { ok: boolean; chipId?: string; instanceId?: number; error?: string; status?: string };
type Deps = {
  escolher?: (o: { papel?: "zaeon" | "agente" | "pessoal"; agentKey?: string | null }) => Promise<WaChip | null>;
  porId?: (id: string) => Promise<WaChip | null>;
  presenca?: (instanceId: number, phone: string) => Promise<unknown>;
  enviar?: (i: { instanceId: number; phone: string; text: string; idemKey?: string }) => Promise<{ ok: boolean; status: string; error?: string }>;
  registrar?: (id: string, r: { ok: boolean; erro?: string }) => Promise<void>;
  dormir?: (ms: number) => Promise<void>;
  sorteio?: () => number;
};

/** a pausa de "digitando" do FlowShot: uniforme em [1,2 s; 2,8 s] */
export const pausaDigitando = (sorteio: () => number = Math.random) => Math.round(1200 + sorteio() * 1600);

export async function enviarPorChip(
  o: { phone: string; text: string; agentKey?: string | null; papel?: "zaeon" | "agente" | "pessoal"; chipId?: string; idemKey?: string },
  d: Deps = {},
): Promise<EnvioChip> {
  const chips = await import("./chips");
  const bridge = await import("@/lib/chipflow/bridge");
  const escolher = d.escolher ?? chips.escolherChip;
  const chip = o.chipId ? await (d.porId ?? (async (id: string) => (await import("@/src/lib/prisma")).prisma.waChip.findUnique({ where: { id } })))(o.chipId) : await escolher({ papel: o.papel, agentKey: o.agentKey });
  if (!chip) return { ok: false, error: "nenhum chip conectado e apto (conecte um chip no Meu perfil)" };
  if (chip.estado !== "conectado") return { ok: false, chipId: chip.id, error: `chip ${chip.nome} não está conectado` };

  // "digitando…" — enfeite: falhar aqui nunca impede a mensagem
  await (d.presenca ?? ((instanceId: number, phone: string) => bridge.presencaViaBridge({ instanceId, phone })))(chip.instanceId, o.phone).catch(() => undefined);
  await (d.dormir ?? ((ms: number) => new Promise((r) => setTimeout(r, ms))))(pausaDigitando(d.sorteio));

  const r = await (d.enviar ?? bridge.sendTextViaBridge)({ instanceId: chip.instanceId, phone: o.phone, text: o.text, idemKey: o.idemKey });
  const ok = r.ok || r.status === "ignored_duplicate";   // duplicado = já tinha saído antes
  await (d.registrar ?? chips.registrarEnvioChip)(chip.id, { ok: r.ok, erro: r.error }).catch(() => undefined);
  return { ok, chipId: chip.id, instanceId: chip.instanceId, status: r.status, error: ok ? undefined : r.error };
}
