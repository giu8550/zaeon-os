/** #631 · o cronômetro da troca de blueprint (desligado por padrão; liga no console). */
import { describe, it, expect, vi, afterEach } from "vitest";
import { comecarTroca, servidorRespondeu, telaDesenhou } from "./cronometro";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("#631 · cronômetro", () => {
  it("mede servidor e tela; só imprime se ligado", () => {
    const mem: Record<string, string> = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => mem[k] ?? null });
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    let t = 1000; vi.spyOn(performance, "now").mockImplementation(() => t);
    comecarTroca("abc123", false); t = 1180; servidorRespondeu("abc123"); t = 1250;
    expect(telaDesenhou("abc123")).toBe("[blueprint] abc123 · servidor 180 ms · na tela em 250 ms");
    expect(log).not.toHaveBeenCalled();                       // desligado: não suja o console de ninguém
    mem["zaeon.debug.blueprint"] = "1";
    comecarTroca("abc123", true); t = 1260;
    expect(telaDesenhou("abc123")).toMatch(/guardado.*na tela em 10 ms/);
    expect(log).toHaveBeenCalledOnce();
  });
  it("desenho de outro blueprint não fecha a troca", () => {
    comecarTroca("aaa", false);
    expect(telaDesenhou("bbb")).toBeNull();
  });
});
