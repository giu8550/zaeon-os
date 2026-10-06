/**
 * O SOM DO LOUNGE da Zaeon — o toca-discos do dono (lib/lounge3d/musica.ts):
 *  POST   multipart { file, dur?, nome? }  → sobe uma música (até 20 MB; mp3/ogg/wav/m4a/aac/webm/flac) pro fim da
 *                                           playlist; o arquivo fica no disco persistente (o mesmo do Studio);
 *  PATCH  { acao, i? }                    → tocar / pausar / parar / proxima / anterior / ir (faixa i);
 *  DELETE ?faixa=<id>                     → tira a faixa (e apaga o arquivo).
 * Só o DONO (fundador, pela SESSÃO) mexe; todo mundo da sala ouve. Cada mudança vai pro conteúdo da sala (quem entra
 * depois pega o estado) e é difundida na hora ("musica-lounge", com o relógio do servidor pra sincronizar).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { triggerSafe } from "@/lib/collab/realtime";
import { deleteStudioFile, writeStudioFile } from "@/lib/studio/storage";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { lerConteudo } from "@/lib/lounge3d/sala";
import { EV_MUSICA, canalSala } from "@/lib/lounge3d/tipos";
import { EXT_AUDIO, MAX_BYTES_FAIXA, MAX_FAIXAS, adicionarFaixa, controlar, nomeDoArquivo, removerFaixa, somVazio, type AcaoSom, type SomLounge } from "@/lib/lounge3d/musica";

const NEGADO = "Só o dono da Zaeon mexe no toca-discos.";
const ACOES = new Set<AcaoSom>(["tocar", "pausar", "parar", "proxima", "anterior", "ir"]);

type Me = NonNullable<Awaited<ReturnType<typeof eu>>>;
type Sala = NonNullable<Awaited<ReturnType<typeof salaDoMembro>>>;
async function preparar(req: Request, params: { id: string }): Promise<{ erro: Response } | { me: Me; s: Sala }> {
  const off = exigirFlag(); if (off) return { erro: off };
  const rl = await guard(req, "lounge3d-musica"); if (!rl.ok) return { erro: rl.response };
  const me = await eu(); if (!me) return { erro: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const s = await salaDoMembro(params.id, me.id); if (!s) return { erro: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!me.fundador) return { erro: NextResponse.json({ error: NEGADO }, { status: 403 }) };
  return { me, s };
}
async function salvar(salaId: string, content: unknown, som: SomLounge) {
  const conteudo = { ...lerConteudo(content), somLounge: som };
  await prisma.collabDoc.update({ where: { id: salaId }, data: { content: JSON.stringify(conteudo) } });
  const agora = Date.now();
  await triggerSafe(canalSala(salaId), EV_MUSICA, { som, agora });
  return NextResponse.json({ ok: true, som, agora });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const p = await preparar(req, params); if ("erro" in p) return p.erro as NextResponse;
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Esperado multipart/form-data." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof Blob) || !file.size) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  if (file.size > MAX_BYTES_FAIXA) return NextResponse.json({ error: "Música grande demais (máx 20 MB)." }, { status: 413 });
  const ext = EXT_AUDIO[file.type] ?? (/\.(mp3|ogg|wav|m4a|aac|webm|flac)$/i.exec((file as File).name ?? "")?.[1]?.toLowerCase());
  if (!ext) return NextResponse.json({ error: "Formato não suportado (use mp3, m4a, ogg, wav, aac, webm ou flac)." }, { status: 415 });
  const atual = lerConteudo(p.s.content).somLounge ?? somVazio();
  if (atual.faixas.length >= MAX_FAIXAS) return NextResponse.json({ error: `A playlist já tem ${MAX_FAIXAS} músicas.` }, { status: 409 });
  const hex = crypto.randomBytes(10).toString("hex"), id = `lm_${hex}`;
  try { await writeStudioFile(id, ext, Buffer.from(await file.arrayBuffer())); }
  catch (e) {   // disco sem permissão/cheio: diz o motivo (no log e pro dono) em vez de um 500 mudo
    const codigo = (e as { code?: string })?.code ?? "?";
    console.error("[lounge3d/musica] não gravou o arquivo:", codigo, e);
    return NextResponse.json({ error: codigo === "EACCES" || codigo === "EPERM" ? "O servidor está sem permissão pra guardar músicas (o deploy acerta isso)." : codigo === "ENOSPC" ? "O disco do servidor está cheio." : "Não deu pra guardar a música no servidor." }, { status: 507 });
  }
  const durRaw = Number(form.get("dur")), nome = String(form.get("nome") ?? "") || nomeDoArquivo((file as File).name ?? "");
  const faixa = { id: hex.slice(0, 16), nome: nomeDoArquivo(nome), arq: `${id}.${ext}`, dur: Number.isFinite(durRaw) && durRaw > 0 ? Math.min(4 * 3600, durRaw) : 0, deId: p.me.id };
  return salvar(p.s.id, p.s.content, adicionarFaixa(atual, faixa, Date.now()));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const p = await preparar(req, params); if ("erro" in p) return p.erro as NextResponse;
  const b = (await req.json().catch(() => ({}))) as { acao?: unknown; i?: unknown };
  if (typeof b.acao !== "string" || !ACOES.has(b.acao as AcaoSom)) return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  const atual = lerConteudo(p.s.content).somLounge ?? somVazio();
  return salvar(p.s.id, p.s.content, controlar(atual, b.acao as AcaoSom, Date.now(), typeof b.i === "number" ? b.i : undefined));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const p = await preparar(req, params); if ("erro" in p) return p.erro as NextResponse;
  const id = new URL(req.url).searchParams.get("faixa") ?? "";
  const atual = lerConteudo(p.s.content).somLounge ?? somVazio(), f = atual.faixas.find((x) => x.id === id);
  if (!f) return NextResponse.json({ error: "Faixa não encontrada." }, { status: 404 });
  const dot = f.arq.lastIndexOf(".");
  await deleteStudioFile(f.arq.slice(0, dot), f.arq.slice(dot + 1));
  return salvar(p.s.id, p.s.content, removerFaixa(atual, id, Date.now()));
}
