/**
 * lib/octa/mobile/canal.ts — P6 do Pack Octa (§4). Canal celular ↔ tasks do Octa.
 *
 *   - HOST (a sessão Octa na VPS) só faz OUTBOUND (conecta no relay); nada de porta pública.
 *   - E2E: handshake no padrão Noise_IK (o celular já conhece a chave estática do host pelo QR) com
 *     X25519 + HKDF-SHA256 + ChaCha20-Poly1305 do node:crypto. É INSPIRADO no Noise, NÃO uma implementação
 *     certificada do Noise Protocol — o relay só vê bytes cifrados, e contador estrito barra replay.
 *   - Negociação de transporte LAN → P2P(WebRTC) → TURN(coturn) → Relay é infra (portão do dono); aqui
 *     fica a ordem e a interface. O relay é NOSSO — nunca o dsh.r2049.cn do ds-harness-remote.
 *   - Do celular: listar tasks, mandar instrução/imagem, responder pedido de permissão, abrir workspace.
 *     NÃO existe mensagem de shell: tipo desconhecido = rejeitado. Toda ação passa pelo permit() do host.
 */
import {
  createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync,
  createCipheriv, createDecipheriv, randomBytes, randomInt, createHash, timingSafeEqual, type KeyObject,
} from "node:crypto";
import type { ApproveFn } from "@/lib/agent/runtime";

export const ORDEM_TRANSPORTE = ["lan", "p2p", "turn", "relay"] as const;

// ───────────────────────────── chaves ─────────────────────────────
export type ParChaves = { privada: KeyObject; publica: Buffer };
export function gerarPar(): ParChaves {
  const { privateKey, publicKey } = generateKeyPairSync("x25519");
  return { privada: privateKey, publica: publicKey.export({ format: "der", type: "spki" }).subarray(-32) };
}
const SPKI_X25519 = Buffer.from("302a300506032b656e032100", "hex");
const pub = (raw: Buffer) => createPublicKey({ key: Buffer.concat([SPKI_X25519, raw]), format: "der", type: "spki" });
const dh = (priv: KeyObject, rawPub: Buffer) => diffieHellman({ privateKey: priv, publicKey: pub(rawPub) });
export const exportarPrivada = (k: KeyObject) => k.export({ format: "der", type: "pkcs8" }).toString("base64");
export const importarPrivada = (b64: string) => createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" });

// ───────────────────────────── sessão cifrada ─────────────────────────────
export class SessaoCifrada {
  private enviados = 0n;
  private recebidoAte = -1n;
  constructor(private kEnvio: Buffer, private kRecebe: Buffer) {}
  selar(msg: unknown): Buffer {
    const n = this.enviados++;
    const nonce = Buffer.alloc(12); nonce.writeBigUInt64BE(n, 4);
    const c = createCipheriv("chacha20-poly1305", this.kEnvio, nonce, { authTagLength: 16 });
    const ct = Buffer.concat([c.update(JSON.stringify(msg), "utf8"), c.final()]);
    return Buffer.concat([nonce.subarray(4), c.getAuthTag(), ct]);
  }
  abrir(pacote: Buffer): unknown {
    const n = pacote.readBigUInt64BE(0);
    if (n <= this.recebidoAte) throw new Error("replay");
    const nonce = Buffer.alloc(12); nonce.writeBigUInt64BE(n, 4);
    const d = createDecipheriv("chacha20-poly1305", this.kRecebe, nonce, { authTagLength: 16 });
    d.setAuthTag(pacote.subarray(8, 24));
    const pt = Buffer.concat([d.update(pacote.subarray(24)), d.final()]); // lança se adulterado
    this.recebidoAte = n;
    return JSON.parse(pt.toString("utf8"));
  }
}

function derivar(es: Buffer, ss: Buffer, transcript: Buffer): [Buffer, Buffer] {
  const okm = Buffer.from(hkdfSync("sha256", Buffer.concat([es, ss]), transcript, "octa-mobile-v1", 64));
  return [okm.subarray(0, 32), okm.subarray(32)]; // [celular→host, host→celular]
}
const transcriptDe = (hostPub: Buffer, devPub: Buffer, ePub: Buffer) => createHash("sha256").update(Buffer.concat([hostPub, devPub, ePub])).digest();

/** Lado do CELULAR: conhece a chave estática do host (QR). Manda `ePub` + `devPub`. */
export function iniciarHandshake(dispositivo: ParChaves, hostPub: Buffer) {
  const e = gerarPar();
  const [c2h, h2c] = derivar(dh(e.privada, hostPub), dh(dispositivo.privada, hostPub), transcriptDe(hostPub, dispositivo.publica, e.publica));
  return { hello: { ePub: e.publica.toString("base64"), devPub: dispositivo.publica.toString("base64") }, sessao: new SessaoCifrada(c2h, h2c) };
}

// ───────────────────────────── dispositivos ─────────────────────────────
export type Dispositivo = { id: string; nome: string; pub: string; pareadoEm: string; revogado: boolean };

export class RegistroDispositivos {
  private codigos = new Map<string, number>(); // código → expira (ms)
  private devs = new Map<string, Dispositivo>();
  constructor(private agora: () => number = Date.now) {}
  /** Código de pareamento de uso único (vai no QR junto com a chave pública do host). Vale 5 min. */
  novoCodigo(): string {
    const c = String(randomInt(0, 1_000_000)).padStart(6, "0");
    this.codigos.set(c, this.agora() + 5 * 60_000);
    return c;
  }
  parear(codigo: string, devPubB64: string, nome: string): Dispositivo {
    const exp = this.codigos.get(codigo);
    this.codigos.delete(codigo); // uso único, mesmo se falhar
    if (!exp || exp < this.agora()) throw new Error("código de pareamento inválido ou vencido");
    const d: Dispositivo = { id: randomBytes(8).toString("hex"), nome: nome.slice(0, 60), pub: devPubB64, pareadoEm: new Date(this.agora()).toISOString(), revogado: false };
    this.devs.set(d.id, d);
    return d;
  }
  revogar(id: string) { const d = this.devs.get(id); if (d) d.revogado = true; }
  porPub(devPubB64: string): Dispositivo | null {
    const alvo = Buffer.from(devPubB64, "base64");
    for (const d of this.devs.values()) {
      const p = Buffer.from(d.pub, "base64");
      if (!d.revogado && p.length === alvo.length && timingSafeEqual(p, alvo)) return d;
    }
    return null;
  }
  ativo(id: string) { const d = this.devs.get(id); return !!d && !d.revogado; }
  listar() { return [...this.devs.values()]; }
}

// ───────────────────────────── protocolo ─────────────────────────────
export type TaskResumo = { id: string; titulo: string; estado: "rodando" | "aguardando" | "concluida" | "falhou"; modo: string };
export type MsgCelular =
  | { t: "listar_tasks" }
  | { t: "instrucao"; taskId: string; texto: string; imagem?: { mime: "image/png" | "image/jpeg" | "image/webp"; base64: string } }
  | { t: "resposta_permissao"; pedidoId: string; aprovado: boolean }
  | { t: "abrir_workspace"; taskId: string };
export type MsgHost =
  | { t: "tasks"; tasks: TaskResumo[] }
  | { t: "pedido_permissao"; pedidoId: string; taskId?: string; tool: string; risco: string; resumo: string; expiraEm: string }
  | { t: "ok"; ref?: string }
  | { t: "erro"; code: string };

const MAX_IMG_B64 = 7_000_000; // ~5 MB
const IMG_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
/** Valida a mensagem do celular. Qualquer coisa fora do protocolo (inclusive "shell") → null. */
export function validarMsgCelular(m: any): MsgCelular | null {
  if (!m || typeof m !== "object") return null;
  const str = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max;
  switch (m.t) {
    case "listar_tasks": return { t: "listar_tasks" };
    case "abrir_workspace": return str(m.taskId, 100) ? { t: "abrir_workspace", taskId: m.taskId } : null;
    case "resposta_permissao": return str(m.pedidoId, 100) && typeof m.aprovado === "boolean" ? { t: "resposta_permissao", pedidoId: m.pedidoId, aprovado: m.aprovado } : null;
    case "instrucao": {
      if (!str(m.taskId, 100) || !str(m.texto, 8000)) return null;
      if (m.imagem !== undefined && !(IMG_MIMES.has(m.imagem?.mime) && str(m.imagem?.base64, MAX_IMG_B64))) return null;
      return { t: "instrucao", taskId: m.taskId, texto: m.texto, ...(m.imagem ? { imagem: { mime: m.imagem.mime, base64: m.imagem.base64 } } : {}) };
    }
    default: return null;
  }
}

/** O que o host expõe ao celular. Instrução vira mensagem na task (o agente roda sob o próprio permit()). */
export interface FonteDeTasks {
  listar(): Promise<TaskResumo[]>;
  instruir(taskId: string, texto: string, imagem?: { mime: string; base64: string }): Promise<void>;
  linkWorkspace(taskId: string): Promise<string | null>;
}

type Pendente = { resolve: (ok: boolean) => void; timer: ReturnType<typeof setTimeout> };

/** O host: aceita handshakes de dispositivos pareados e despacha mensagens. Só outbound (fala pelo relay). */
export class HostMobile {
  private sessoes = new Map<string, { dev: string; s: SessaoCifrada }>(); // conexão → sessão
  private pendentes = new Map<string, Pendente>();
  constructor(private chave: ParChaves, private registro: RegistroDispositivos, private tasks: FonteDeTasks, private enviar: (conexao: string, pacote: Buffer) => void) {}

  /** Lado do HOST do handshake. Dispositivo não pareado/revogado = recusado. */
  aceitarHandshake(conexao: string, hello: { ePub: string; devPub: string }): boolean {
    const dev = this.registro.porPub(hello.devPub);
    if (!dev) return false;
    const ePub = Buffer.from(hello.ePub, "base64"), devPub = Buffer.from(hello.devPub, "base64");
    const [c2h, h2c] = derivar(dh(this.chave.privada, ePub), dh(this.chave.privada, devPub), transcriptDe(this.chave.publica, devPub, ePub));
    this.sessoes.set(conexao, { dev: dev.id, s: new SessaoCifrada(h2c, c2h) });
    return true;
  }

  async receber(conexao: string, pacote: Buffer): Promise<void> {
    const ses = this.sessoes.get(conexao);
    if (!ses) return;
    if (!this.registro.ativo(ses.dev)) { this.sessoes.delete(conexao); return; } // revogado: derruba
    let bruto: unknown;
    try { bruto = ses.s.abrir(pacote); } catch { return; } // adulterado/replay: descarta calado
    const m = validarMsgCelular(bruto);
    const responder = (r: MsgHost) => this.enviar(conexao, ses.s.selar(r));
    if (!m) return responder({ t: "erro", code: "mensagem_fora_do_protocolo" });
    switch (m.t) {
      case "listar_tasks": return responder({ t: "tasks", tasks: await this.tasks.listar() });
      case "instrucao": await this.tasks.instruir(m.taskId, m.texto, m.imagem); return responder({ t: "ok" });
      case "abrir_workspace": { const url = await this.tasks.linkWorkspace(m.taskId); return responder(url ? { t: "ok", ref: url } : { t: "erro", code: "task_inexistente" }); }
      case "resposta_permissao": {
        const p = this.pendentes.get(m.pedidoId);
        if (!p) return responder({ t: "erro", code: "pedido_inexistente_ou_expirado" });
        clearTimeout(p.timer); this.pendentes.delete(m.pedidoId); p.resolve(m.aprovado);
        return responder({ t: "ok" });
      }
    }
  }

  /** Um ApproveFn pro runTool: manda o pedido a todos os dispositivos ativos e espera; silêncio = NÃO. */
  aprovador(timeoutMs = 120_000): ApproveFn {
    return (def, args) => new Promise<boolean>((resolve) => {
      const conexoes = [...this.sessoes].filter(([, v]) => this.registro.ativo(v.dev));
      if (!conexoes.length) return resolve(false);
      const pedidoId = randomBytes(8).toString("hex");
      const timer = setTimeout(() => { this.pendentes.delete(pedidoId); resolve(false); }, timeoutMs);
      this.pendentes.set(pedidoId, { resolve, timer });
      const resumo = JSON.stringify(args ?? {}).slice(0, 300);
      const msg: MsgHost = { t: "pedido_permissao", pedidoId, tool: def.name, risco: def.risk, resumo, expiraEm: new Date(Date.now() + timeoutMs).toISOString() };
      for (const [con, v] of conexoes) this.enviar(con, v.s.selar(msg));
    });
  }
}
