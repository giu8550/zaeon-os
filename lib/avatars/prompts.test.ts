import { describe, it, expect } from "vitest";
import { promptBase, promptEdicao, ORDEM_GERACAO } from "./prompts";
import { AVATAR_LOOKS } from "./looks";
import { PERSONAS } from "@/lib/ai/personas";

describe("avatares · prompts de consistência", () => {
  it("base leva personagem, cores do fundo e o enquadramento fixo", () => {
    const p = promptBase(AVATAR_LOOKS.aura.personagem, AVATAR_LOOKS.aura.cor);
    expect(p).toContain("lavender-violet hair");
    expect(p).toContain("#a78bfa");
    expect(p).toMatch(/close-up bust portrait/);
    expect(p).toMatch(/Single adult character/);
  });
  it("edição muda UMA coisa e manda manter o resto; ajuste do estúdio entra", () => {
    const e = promptEdicao("blink", "olhos mais fechados");
    expect(e).toMatch(/^Edit this exact image\./);
    expect(e).toContain("Keep EVERYTHING else exactly identical");
    expect(e).toContain("olhos mais fechados");
    expect(promptEdicao("talk")).not.toContain("Extra direction");
  });
  it("blink/talk saem primeiro (o card já vive se a cota acabar)", () => {
    expect(ORDEM_GERACAO.slice(0, 2)).toEqual(["blink", "talk"]);
    expect(ORDEM_GERACAO).not.toContain("idle");
  });
  it("todo look é de uma persona do roster", () => {
    for (const id of Object.keys(AVATAR_LOOKS)) expect(PERSONAS[id], id).toBeTruthy();
  });
});
