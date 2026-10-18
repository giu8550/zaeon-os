/** #438 · foto de perfil: o que pode ser salvo e quando a foto do Google atualiza. */
import { describe, it, expect } from "vitest";
import { validarAvatar, ehFotoPropria, fotoDoGoogleParaSalvar, MAX_AVATAR_CHARS } from "./avatar";

const JPG = "data:image/jpeg;base64," + "A".repeat(20_000);
const GOOGLE_G = "https://lh3.googleusercontent.com/a/ACg8ocL-letra-g=s96-c";
const GOOGLE_AZULA = "https://lh3.googleusercontent.com/a/ACg8ocK-azula=s96-c";

describe("foto de perfil · validar", () => {
  it("aceita PNG, JPG, WEBP e GIF reduzidos pela tela", () => {
    for (const t of ["png", "jpeg", "jpg", "webp", "gif"]) expect(validarAvatar(`data:image/${t};base64,QUJD`).ok).toBe(true);
    expect(validarAvatar(JPG)).toEqual({ ok: true, image: JPG });
  });
  it("vazio → 400; grande demais → 413", () => {
    expect(validarAvatar("")).toMatchObject({ ok: false, status: 400 });
    expect(validarAvatar(undefined)).toMatchObject({ ok: false, status: 400 });
    expect(validarAvatar("data:image/png;base64," + "A".repeat(MAX_AVATAR_CHARS))).toMatchObject({ ok: false, status: 413 });
  });
  it("não é imagem (SVG com script, HTML, link) → 400", () => {
    expect(validarAvatar("data:image/svg+xml;base64,PHN2Zz4=")).toMatchObject({ ok: false, status: 400 });
    expect(validarAvatar("data:text/html;base64,PGgxPg==")).toMatchObject({ ok: false, status: 400 });
    expect(validarAvatar("https://exemplo.com/foto.png")).toMatchObject({ ok: false, status: 400 });
    expect(validarAvatar("data:image/png;base64,<script>")).toMatchObject({ ok: false, status: 400 });
  });
});

describe("foto do Google no login", () => {
  it("o caso da giu dev: trocou a foto no Gmail → a Zaeon atualiza no próximo login", () => {
    expect(fotoDoGoogleParaSalvar(GOOGLE_G, GOOGLE_AZULA)).toBe(GOOGLE_AZULA);
  });
  it("sem foto nenhuma na Zaeon → pega a do Google", () => {
    expect(fotoDoGoogleParaSalvar(null, GOOGLE_AZULA)).toBe(GOOGLE_AZULA);
  });
  it("o caso do Martinez: pôs foto própria na Zaeon → o Google NUNCA sobrescreve", () => {
    expect(ehFotoPropria(JPG)).toBe(true);
    expect(fotoDoGoogleParaSalvar(JPG, GOOGLE_AZULA)).toBeNull();
  });
  it("mesma foto → não mexe; foto do Google estranha → ignora", () => {
    expect(fotoDoGoogleParaSalvar(GOOGLE_AZULA, GOOGLE_AZULA)).toBeNull();
    expect(fotoDoGoogleParaSalvar(null, undefined)).toBeNull();
    expect(fotoDoGoogleParaSalvar(null, "http://inseguro/foto.png")).toBeNull();
    expect(fotoDoGoogleParaSalvar(null, "javascript:alert(1)")).toBeNull();
  });
});
