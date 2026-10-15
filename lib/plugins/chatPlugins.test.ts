// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { plugar, desplugar, pluginsPlugados } from "./chatPlugins";

describe("plugins do chat", () => {
  beforeEach(() => localStorage.clear());
  it("plugar é idempotente e desplugar tira; avisa a tela por evento", () => {
    const vistos: unknown[] = [];
    window.addEventListener("zaeon:chat:plugins", (e) => vistos.push((e as CustomEvent).detail));
    plugar("octa-code"); plugar("octa-code");
    expect(pluginsPlugados()).toEqual(["octa-code"]);
    desplugar("octa-code");
    expect(pluginsPlugados()).toEqual([]);
    expect(vistos.at(-1)).toEqual([]);
  });
  it("storage corrompido = nada plugado, sem quebrar", () => {
    localStorage.setItem("zaeon.chat.plugins", "{lixo");
    expect(pluginsPlugados()).toEqual([]);
  });
});
