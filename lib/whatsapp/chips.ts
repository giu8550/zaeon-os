/**
 * lib/whatsapp/chips.ts — os CHIPS de WhatsApp da Zaeon (out/2026): a estrutura da ChipFlow dentro da Zaeon.
 * Um chip nasce aqui (WaChip + sessão no whatsapp-adapter), conecta por QR no "Meu perfil" (CEO), ganha nome/
 * foto/recado e entra no RODÍZIO de envio — a lógica dos disparos do modo negócios (FlowShot): elegível = ativo
 * + conectado + abaixo do teto do dia; vai o que mandou há mais tempo (round-robin por uso).
 * Partes PURAS no topo (testadas); IO embaixo. Ver docs/WHATSAPP_CHIPS.md.
 */
import { randomUUID } from "crypto";
import type { WaChip } from "@prisma/client";

// ───────────────────────────── puro ─────────────────────────────
export type Papel = "zaeon" | "agente" | "pessoal";
export const PAPEIS: readonly Papel[] = ["zaeon", "agente", "pessoal"];
/** ids numéricos do adapter da Zaeon começam aqui (longe de qualquer id da frota da ChipFlow) */
export const PRIMEIRO_INSTANCE_ID = 900_001;
export const FOTO_MAX_BYTES = 1_500_000;

/** o dia (America/Sao_Paulo) do contador de envios — vira à meia-noite de Brasília, como o beat do FlowShot */
export const diaSp = (agora: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);

export const proximoInstanceId = (usados: number[]): number => Math.max(PRIMEIRO_INSTANCE_ID - 1, ...usados) + 1;

/** quanto o chip já mandou HOJE (contador de outro dia = 0) */
export const enviadosNoDia = (c: Pick<WaChip, "enviadosHoje" | "diaContagem">, dia: string): number =>
  c.diaContagem === dia ? c.enviadosHoje : 0;

type ChipRodizio = Pick<WaChip, "id" | "papel" | "agentKey" | "ativo" | "estado" | "limiteDia" | "enviadosHoje" | "diaContagem" | "ultimoEnvioEm">;

/**
 * O RODÍZIO (FlowShot `get_eligible_instances` + `idx % len`): dos chips do papel (e do agente, se pedido),
 * só os ativos, conectados e abaixo do teto do dia; ordena pelo que mandou há MAIS tempo (nunca mandou = 1º).
 * Agente sem chip próprio cai nos chips da Zaeon (a mensagem não fica sem sair).
 */
export function ordemDoRodizio<T extends ChipRodizio>(chips: T[], o: { papel: Papel; agentKey?: string | null; dia: string }): T[] {
  const apto = (c: T) => c.ativo && c.estado === "conectado" && enviadosNoDia(c, o.dia) < c.limiteDia;
  const porUso = (a: T, b: T) => (a.ultimoEnvioEm?.getTime() ?? 0) - (b.ultimoEnvioEm?.getTime() ?? 0);
  if (o.papel === "agente" && o.agentKey) {
    const doAgente = chips.filter((c) => c.papel === "agente" && c.agentKey === o.agentKey && apto(c)).sort(porUso);
    if (doAgente.length) return doAgente;
    return chips.filter((c) => c.papel === "zaeon" && apto(c)).sort(porUso);
  }
  return chips.filter((c) => c.papel === o.papel && apto(c)).sort(porUso);
}

/** valida a foto do perfil: data-URI/base64 de JPEG (o WhatsApp só aceita JPEG), até FOTO_MAX_BYTES */
export function fotoJpegValida(dataUriOuBase64: string): { ok: true; base64: string; dataUri: string } | { ok: false; erro: string } {
  const m = /^data:image\/jpe?g;base64,(.+)$/i.exec(dataUriOuBase64.trim());
  const b64 = (m ? m[1]! : dataUriOuBase64.trim()).replace(/\s+/g, "");
  let bytes: Buffer;
  try { bytes = Buffer.from(b64, "base64"); } catch { return { ok: false, erro: "foto ilegível" }; }
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return { ok: false, erro: "a foto precisa ser JPEG" };
  if (bytes.length > FOTO_MAX_BYTES) return { ok: false, erro: "foto grande demais (máx. 1,5 MB)" };
  return { ok: true, base64: b64, dataUri: `data:image/jpeg;base64,${b64}` };
}

/** o estado do adapter → o estado do chip */
export const estadoDoAdapter = (s: string): WaChip["estado"] =>
  s === "open" ? "conectado" : s === "connecting" ? "qr" : s === "logged_out" ? "desconectado" : "desconectado";

/** o que o painel mostra de um chip (sem o token da sessão) */
export function chipPublico(c: WaChip) {
  const { token: _t, ...resto } = c;
  return { ...resto, enviadosHoje: enviadosNoDia(c, diaSp()) };
}

// ───────────────────────────── IO ─────────────────────────────
const db = async () => (await import("@/src/lib/prisma")).prisma;
const op = () => import("@/lib/chipflow/operador");

export async function listarChips() {
  return (await db()).waChip.findMany({ orderBy: [{ papel: "asc" }, { createdAt: "asc" }] });
}

/** Cria o chip e a sessão no adapter (que já começa a gerar o QR). */
export async function criarChip(o: { nome: string; papel: Papel; agentKey?: string | null; criadoPor?: string | null }) {
  const p = await db();
  const usados = (await p.waChip.findMany({ select: { instanceId: true } })).map((c) => c.instanceId);
  const chip = await p.waChip.create({
    data: {
      instanceId: proximoInstanceId(usados), token: randomUUID(), nome: o.nome.trim().slice(0, 60) || "Chip",
      papel: o.papel, agentKey: o.papel === "agente" ? (o.agentKey ?? null) : null, criadoPor: o.criadoPor ?? null, estado: "qr",
    },
  });
  const r = await (await op()).criarInstancia({ instanceId: chip.instanceId, token: chip.token, nome: chip.nome });
  if (!r.ok) return p.waChip.update({ where: { id: chip.id }, data: { estado: "erro", ultimoErro: r.erro } });
  return chip;
}

/**
 * Conectar = o painel pergunta a cada ~3 s: conectado? (sincroniza número/jid) : o QR da vez.
 * Sessão sumida do adapter (404) é recriada pelo token (create idempotente) e volta a dar QR.
 */
export async function conectarChip(id: string): Promise<{ estado: WaChip["estado"]; qr?: string | null; numero?: string | null; erro?: string }> {
  const p = await db();
  const chip = await p.waChip.findUnique({ where: { id } });
  if (!chip) return { estado: "erro", erro: "chip não existe" };
  const o = await op();
  let st = await o.lerEstado(chip.instanceId);
  if (!st.ok && st.status === 404) {
    const c = await o.criarInstancia({ instanceId: chip.instanceId, token: chip.token, nome: chip.nome });
    if (!c.ok) return { estado: "erro", erro: c.erro };
    st = await o.lerEstado(chip.instanceId);
  }
  if (!st.ok) {
    await p.waChip.update({ where: { id }, data: { ultimoErro: st.erro } });
    return { estado: "erro", erro: st.erro };
  }
  if (st.valor.state === "open") {
    const numero = o.numeroDoJid(st.valor.jid) ?? chip.numero;
    const virouAgora = chip.estado !== "conectado";
    await p.waChip.update({
      where: { id },
      data: { estado: "conectado", jid: st.valor.jid || chip.jid, numero, ultimoErro: null, ...(virouAgora ? { conectadoEm: new Date() } : {}) },
    });
    // conectou agora com perfil já escolhido no painel: aplica (nome/recado/foto) sem o admin precisar salvar de novo
    if (virouAgora && (chip.perfilNome || chip.perfilRecado || chip.fotoUrl)) void aplicarPerfil(id).catch(() => undefined);
    return { estado: "conectado", numero };
  }
  const qr = await o.lerQr(chip.instanceId);
  if (!qr.ok && qr.status === 409) return conectarChip(id); // conectou entre as duas chamadas
  await p.waChip.update({ where: { id }, data: { estado: "qr" } });
  return { estado: "qr", qr: qr.ok ? qr.valor : null, erro: qr.ok ? undefined : qr.erro };
}

export type PatchChip = { nome?: string; papel?: Papel; agentKey?: string | null; ativo?: boolean; limiteDia?: number; perfilNome?: string; perfilRecado?: string; foto?: string | null };

/** Edita o chip; o que é PERFIL (nome de exibição, recado, foto) vai pro WhatsApp se o chip estiver conectado. */
export async function editarChip(id: string, patch: PatchChip): Promise<{ ok: true; chip: WaChip; perfil?: string } | { ok: false; erro: string }> {
  const p = await db();
  const data: Record<string, unknown> = {};
  if (patch.nome !== undefined) data.nome = patch.nome.trim().slice(0, 60) || "Chip";
  if (patch.papel !== undefined) { if (!PAPEIS.includes(patch.papel)) return { ok: false, erro: "papel inválido" }; data.papel = patch.papel; }
  if (patch.agentKey !== undefined) data.agentKey = patch.agentKey || null;
  if (patch.ativo !== undefined) data.ativo = !!patch.ativo;
  if (patch.limiteDia !== undefined) data.limiteDia = Math.max(1, Math.min(100_000, Math.round(patch.limiteDia)));
  if (patch.perfilNome !== undefined) { const n = patch.perfilNome.trim(); if (n.length > 25) return { ok: false, erro: "nome de exibição: até 25 caracteres" }; data.perfilNome = n || null; }
  if (patch.perfilRecado !== undefined) { if (patch.perfilRecado.length > 139) return { ok: false, erro: "recado: até 139 caracteres" }; data.perfilRecado = patch.perfilRecado; }
  if (patch.foto !== undefined && patch.foto !== null) { const f = fotoJpegValida(patch.foto); if (!f.ok) return { ok: false, erro: f.erro }; data.fotoUrl = f.dataUri; }
  const chip = await p.waChip.update({ where: { id }, data });
  const mexeuNoPerfil = patch.perfilNome !== undefined || patch.perfilRecado !== undefined || (patch.foto !== undefined && patch.foto !== null);
  if (!mexeuNoPerfil || chip.estado !== "conectado") return { ok: true, chip, perfil: mexeuNoPerfil ? "fica guardado e vai pro WhatsApp quando o chip conectar" : undefined };
  const r = await aplicarPerfil(id, { nome: patch.perfilNome !== undefined, recado: patch.perfilRecado !== undefined, foto: patch.foto !== undefined && patch.foto !== null });
  return { ok: true, chip, perfil: r.ok ? "aplicado no WhatsApp" : `não foi pro WhatsApp: ${r.erro}` };
}

/** manda pro WhatsApp o perfil guardado (só os campos pedidos; sem filtro = tudo que houver) */
export async function aplicarPerfil(id: string, so?: { nome: boolean; recado: boolean; foto: boolean }) {
  const p = await db();
  const c = await p.waChip.findUnique({ where: { id } });
  if (!c) return { ok: false as const, erro: "chip não existe" };
  const quer = so ?? { nome: true, recado: true, foto: true };
  const r = await (await op()).editarPerfil(c.instanceId, {
    ...(quer.nome && c.perfilNome ? { nome: c.perfilNome } : {}),
    ...(quer.recado && c.perfilRecado != null ? { recado: c.perfilRecado } : {}),
    ...(quer.foto && c.fotoUrl ? { fotoJpegBase64: c.fotoUrl } : {}),
  });
  if (!r.ok) { await p.waChip.update({ where: { id }, data: { ultimoErro: `perfil: ${r.erro}` } }); return { ok: false as const, erro: r.erro }; }
  return { ok: true as const };
}

export async function desconectarChip(id: string) {
  const p = await db();
  const c = await p.waChip.findUnique({ where: { id } });
  if (!c) return { ok: false, erro: "chip não existe" };
  const r = await (await op()).sair(c.instanceId);
  await p.waChip.update({ where: { id }, data: { estado: "desconectado", ...(r.ok ? {} : { ultimoErro: r.erro }) } });
  return r.ok ? { ok: true } : { ok: false, erro: r.erro };
}

export async function apagarChip(id: string) {
  const p = await db();
  const c = await p.waChip.findUnique({ where: { id } });
  if (!c) return { ok: true };
  await (await op()).apagarInstancia(c.instanceId).catch(() => undefined);
  await p.waChip.delete({ where: { id } });
  return { ok: true };
}

/** o chip que vai mandar agora (rodízio); null = nenhum apto */
export async function escolherChip(o: { papel?: Papel; agentKey?: string | null } = {}): Promise<WaChip | null> {
  const chips = await (await db()).waChip.findMany({ where: { ativo: true, estado: "conectado" } });
  return ordemDoRodizio(chips, { papel: o.papel ?? (o.agentKey ? "agente" : "zaeon"), agentKey: o.agentKey, dia: diaSp() })[0] ?? null;
}

/** conta o envio no chip (contador do dia vira à meia-noite de Brasília) */
export async function registrarEnvioChip(id: string, r: { ok: boolean; erro?: string }) {
  const p = await db();
  const c = await p.waChip.findUnique({ where: { id }, select: { enviadosHoje: true, diaContagem: true } });
  if (!c) return;
  const dia = diaSp();
  await p.waChip.update({
    where: { id },
    data: r.ok
      ? { enviadosHoje: enviadosNoDia(c, dia) + 1, diaContagem: dia, totalEnviados: { increment: 1 }, ultimoEnvioEm: new Date(), ultimoErro: null }
      : { ultimoErro: (r.erro ?? "falha no envio").slice(0, 300) },
  });
}

/** o número que o aluno chama pra se conectar (wa.me): o chip da Zaeon conectado; senão o env antigo */
export async function numeroDaZaeon(): Promise<string | null> {
  const c = await (await db()).waChip.findFirst({ where: { papel: "zaeon", estado: "conectado", ativo: true, numero: { not: null } }, orderBy: { conectadoEm: "asc" } });
  return c?.numero ?? process.env.WHATSAPP_PLATFORM_PHONE?.replace(/\D/g, "") ?? null;
}

/** o chip pelo id numérico do adapter (eventos do bridge chegam com instance_id) */
export async function chipPorInstancia(instanceId: number) {
  return (await db()).waChip.findUnique({ where: { instanceId } });
}

/** evento connection_state do bridge → estado do chip (sem esperar o painel perguntar) */
export async function estadoDoBridge(instanceId: number, state: string, jid?: string) {
  const p = await db();
  const c = await p.waChip.findUnique({ where: { instanceId } });
  if (!c) return;
  const estado = estadoDoAdapter(state);
  if (estado === c.estado) return;
  const { numeroDoJid } = await op();
  await p.waChip.update({
    where: { instanceId },
    data: { estado, ...(estado === "conectado" ? { conectadoEm: c.conectadoEm ?? new Date(), ...(jid ? { jid, numero: numeroDoJid(jid) ?? c.numero } : {}) } : {}) },
  });
}
