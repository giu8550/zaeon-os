import { describe, it, expect } from "vitest";
import { assinarPresenca, definirPresenca, lerPresenca, sinalDoChat } from "./presenca";
import { quadroDaBoca } from "./estados";

describe("avatares · presença (o rosto espelha o chat)", () => {
  it("sinal do chat: erro > pensando > falando > ouvindo (digitando) > idle", () => {
    expect(sinalDoChat({ pensando: true, falando: true, digitando: true, erro: true })).toBe("erro");
    expect(sinalDoChat({ pensando: true, falando: false, digitando: true })).toBe("pensando");
    expect(sinalDoChat({ pensando: false, falando: true, digitando: true })).toBe("falando");
    expect(sinalDoChat({ pensando: false, falando: false, digitando: true })).toBe("ouvindo");
    expect(sinalDoChat({ pensando: false, falando: false, digitando: false })).toBe("idle");
  });
  it("publica → avisa quem assina; repetir o mesmo estado não avisa", () => {
    let n = 0;
    const sair = assinarPresenca("teste", () => n++);
    definirPresenca("teste", { sinal: "falando" });
    definirPresenca("teste", { sinal: "falando" });
    expect(n).toBe(1);
    expect(lerPresenca("teste")).toEqual({ sinal: "falando", boca: null });
    sair();
    definirPresenca("teste", { sinal: "idle" });
    expect(n).toBe(1);
    expect(lerPresenca("outro").sinal).toBe("idle");
  });
  it("modo voz: nível do áudio escolhe o quadro da boca", () => {
    const todos = () => true;
    expect(quadroDaBoca(0.05, todos)).toBe("idle");
    expect(quadroDaBoca(0.3, todos)).toBe("talk_half");
    expect(quadroDaBoca(0.8, todos)).toBe("talk");
    expect(quadroDaBoca(0.8, (e) => e !== "talk")).toBe("talk_half");
  });
});
