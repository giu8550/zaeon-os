// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { cliqueForaDoCerebro } from "./cliqueFora";

describe("mapa do cérebro — o que é clicar fora", () => {
  const montar = () => {
    document.body.innerHTML = `<div id="chat"><div data-cerebro-painel><canvas id="cv"></canvas><div id="rotulos"><span id="no" class="cerebro-node">Luz</span></div></div><button data-bolinha-cerebro id="bol"></button><textarea id="caixa"></textarea></div>`;
  };
  const clicar = (id: string) => {
    let fora: boolean | null = null;
    const el = document.getElementById(id)!;
    const ouvir = (e: Event) => { fora = cliqueForaDoCerebro(e); };
    document.addEventListener("mousedown", ouvir);
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    document.removeEventListener("mousedown", ouvir);
    return fora;
  };
  it("clicar/arrastar no canvas ou num nó do mapa NÃO fecha; a bolinha também não", () => {
    montar();
    expect(clicar("cv")).toBe(false);
    expect(clicar("no")).toBe(false);
    expect(clicar("bol")).toBe(false);
  });
  it("mesmo com o painel segurando o mousedown no React (o listener do document vê o evento), decide pelo caminho", () => {
    montar();
    document.querySelector("[data-cerebro-painel]")!.addEventListener("mousedown", (e) => e.stopPropagation());
    // o listener do document não recebe — mas no app router o React escuta no document; aqui basta o caminho
    expect(cliqueForaDoCerebro({ composedPath: () => [document.getElementById("cv")!, document.querySelector("[data-cerebro-painel]")!, document.body] } as any)).toBe(false);
  });
  it("clicar na conversa (fora do mapa) fecha", () => {
    montar();
    expect(clicar("caixa")).toBe(true);
  });
});
