import { validateCodeFormat } from "@/lib/invite-codes";

/**
 * Returns a user-facing error message if the code string is invalid,
 * or null if the shape is acceptable (DB lookup still needed).
 * Normalises input to uppercase before checking.
 */
export function buildValidationError(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (!code) return "Por favor, insira um código de convite.";
  if (!validateCodeFormat(code)) {
    return "Formato inválido. O código deve ter 8 caracteres no formato XXXX-XXXX.";
  }
  return null;
}

/** Normalises a raw code string for DB lookup. */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase();
}
