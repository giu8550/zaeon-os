/** #764 · o cartão de anatomia em português ("coração", não "heart") e o atlas abrindo na estrutura */
import { describe, it, expect } from "vitest";
import { nomeDaEstruturaNaTela } from "./nomeNaTela";
import { conceitoDaUrl } from "@/components/anatomia/AtlasDoCorpo";

describe("nomeDaEstruturaNaTela", () => {
  it("o termo curto em português vence o nome do atlas", () => {
    expect(nomeDaEstruturaNaTela("coração", "heart")).toBe("coração");
    expect(nomeDaEstruturaNaTela("sistema respiratório", "respiratory system")).toBe("sistema respiratório");
  });
  it("frase longa, vazia ou com número: fica o nome do atlas", () => {
    expect(nomeDaEstruturaNaTela("desenhe a anatomia do coração humano agora", "heart")).toBe("heart");
    expect(nomeDaEstruturaNaTela("", "heart")).toBe("heart");
    expect(nomeDaEstruturaNaTela("FMA7088", "heart")).toBe("heart");
  });
});

describe("conceitoDaUrl", () => {
  it("lê ?conceito= e recusa lixo", () => {
    expect(conceitoDaUrl("?conceito=FMA7088")).toBe("FMA7088");
    expect(conceitoDaUrl("")).toBeNull();
    expect(conceitoDaUrl("?conceito=<script>")).toBeNull();
  });
});
