/**
 * lib/user/fotoNoLogin.ts — #438: a foto do Gmail atualiza na Zaeon a cada login com o Google.
 *
 * Antes a Zaeon só pegava a foto do Google no PRIMEIRO login (quem cria a conta é o adapter do NextAuth) e nunca
 * mais: a giu dev trocou a foto no Gmail e a Zaeon continuou com a antiga. Agora, em todo login com o Google, a
 * foto nova entra — a não ser que a pessoa tenha posto uma foto PRÓPRIA na Zaeon (essa o Google nunca
 * sobrescreve). Regra em lib/user/avatar.ts (fotoDoGoogleParaSalvar).
 *
 * NUNCA derruba o login: qualquer erro aqui é engolido (só um aviso no log).
 */
import { fotoDoGoogleParaSalvar } from "./avatar";

/**
 * #440: a foto que o login entrega. O NextAuth passa pro evento de login o perfil JÁ CONVERTIDO pelo provider do
 * Google ({ id, name, email, image }) — a foto vem em `image`, não no `picture` cru do Google. O #438 lia só
 * `picture` e por isso nunca atualizava. Lê `image` (o formato real) e, por garantia, `picture`.
 */
export function fotoDoPerfil(profile: unknown): unknown {
  const p = (profile ?? {}) as { image?: unknown; picture?: unknown };
  return p.image ?? p.picture;
}

export type DepsFotoNoLogin = {
  /** a foto guardada hoje (null = sem foto / usuário não achado). */
  lerFoto: (email: string) => Promise<string | null>;
  salvarFoto: (email: string, image: string) => Promise<void>;
};

export async function atualizarFotoDoGoogle(
  e: { provider?: string | null; email?: string | null; picture?: unknown },
  deps: DepsFotoNoLogin,
): Promise<"atualizou" | "manteve"> {
  try {
    if (e.provider !== "google" || !e.email) return "manteve";
    const nova = fotoDoGoogleParaSalvar(await deps.lerFoto(e.email), e.picture);
    if (!nova) return "manteve";
    await deps.salvarFoto(e.email, nova);
    return "atualizou";
  } catch (err) {
    console.warn("[auth] não deu pra atualizar a foto do Google (login segue normal):", err);
    return "manteve";
  }
}
