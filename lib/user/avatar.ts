/**
 * lib/user/avatar.ts — a foto de perfil (#438). PURO.
 *
 * Duas telas trocam a foto: o Perfil (manda POST) e a Workstation antiga (manda PATCH). A rota só aceitava PATCH,
 * então pelo Perfil a foto nunca salvava (405). Agora a rota aceita os dois, e aqui fica o que pode ser salvo.
 *
 * Foto ENVIADA pela pessoa = imagem inteira (data:image/...;base64). Foto do GOOGLE = link (https://...).
 * Essa diferença também decide se a foto do Google pode atualizar no login (fotoDoGoogleParaSalvar).
 */

/** As telas reduzem a foto pra até 512px antes de mandar (~20-100 KB); folga pra PNG. */
export const MAX_AVATAR_CHARS = 400_000;

const TIPOS = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export type ResultadoAvatar = { ok: true; image: string } | { ok: false; status: 400 | 413; erro: string };

export function validarAvatar(v: unknown): ResultadoAvatar {
  if (typeof v !== "string" || !v) return { ok: false, status: 400, erro: "Imagem não fornecida." };
  if (v.length > MAX_AVATAR_CHARS) return { ok: false, status: 413, erro: "Foto grande demais. Tente uma imagem menor." };
  if (!TIPOS.test(v)) return { ok: false, status: 400, erro: "Formato não suportado. Use PNG, JPG, WEBP ou GIF." };
  return { ok: true, image: v };
}

/** Foto enviada pela própria pessoa (imagem inteira guardada) — o Google nunca sobrescreve essa. */
export const ehFotoPropria = (image: string | null | undefined): boolean => typeof image === "string" && image.startsWith("data:");

/**
 * #438: no login com o Google, a foto do Gmail atualiza a da Zaeon? Só quando a pessoa NÃO pôs uma foto própria,
 * e só se mudou. Devolve o link novo a salvar, ou null (não mexe).
 */
export function fotoDoGoogleParaSalvar(atual: string | null | undefined, doGoogle: unknown): string | null {
  if (typeof doGoogle !== "string" || !/^https:\/\//.test(doGoogle) || doGoogle.length > 2048) return null;
  if (ehFotoPropria(atual)) return null;
  if (atual === doGoogle) return null;
  return doGoogle;
}
