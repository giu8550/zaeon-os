/**
 * Pequena camada de cifragem para tokens de usuário (GitHub/Vercel OAuth) em
 * repouso no banco. AES-256-GCM (autenticada). A chave vem de TOKEN_ENC_KEY
 * (32 bytes em hex/base64) ou, na falta, é derivada do NEXTAUTH_SECRET — só fora de
 * produção. Em NODE_ENV=production sem TOKEN_ENC_KEY lança TokenKeyAusente (falha fechado).
 *
 * Formato do ciphertext: base64( iv(12) | tag(16) | data ).
 * Só roda no servidor (runtime nodejs).
 */
import crypto from "crypto";

/** Produção sem TOKEN_ENC_KEY: não cifra nem decifra (nada de fallback para NEXTAUTH_SECRET). */
export class TokenKeyAusente extends Error {
  constructor() {
    super("TOKEN_ENC_KEY ausente em produção.");
    this.name = "TokenKeyAusente";
  }
}

function keyBytes(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY || "";
  if (raw) {
    // aceita hex (64), base64, ou texto — sempre normaliza para 32 bytes via sha256
    try {
      if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
    } catch { /* fall through */ }
    return crypto.createHash("sha256").update(raw).digest();
  }
  if (process.env.NODE_ENV === "production") throw new TokenKeyAusente();
  const secret = process.env.NEXTAUTH_SECRET || "zaeon-dev-fallback-secret";
  return crypto.createHash("sha256").update("zaeon-token::" + secret).digest();
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
