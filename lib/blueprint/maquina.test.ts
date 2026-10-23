import { describe, expect, it } from "vitest";
import { LISTA_ARRANJOS, LISTA_FORMAS, formaDe, montarMaquina, posicoes } from "./maquina";
import { docVazio, type DocBlueprint, type Peca } from "./tipos";

const peca = (id: string, o: Partial<Peca> = {}): Peca => ({ id, nome: id, fase: 1, ...o });
const doc = (o: Partial<DocBlueprint> = {}): DocBlueprint => ({ ...docVazio("T", 0), fase: 2, ...o });

describe("a máquina do tema (padrão anatomy)", () => {
  it("cada arranjo põe as estações em lugares diferentes, sem encostar umas nas outras", () => {
    for (const arranjo of LISTA_ARRANJOS) {
      const ps = posicoes(6, arranjo);
      expect(ps).toHaveLength(6);
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]!, b = ps[j]!;
        expect(Math.hypot(a.cx - b.cx, a.cy - b.cy) + Math.abs(a.z - b.z), `${arranjo} ${i}×${j}`).toBeGreaterThanOrEqual(60);
      }
    }
    expect(posicoes(5, "torre").map((p) => p.z)).toEqual([0, 62, 124, 186, 248]);
    expect(posicoes(5, "cubo", 2)[2]).toEqual({ cx: 0, cy: 0, z: 0 });
  });
  it("a forma vem da Zaeon; sem ela, variada (nunca tudo igual); forma desconhecida não entra", () => {
    expect(formaDe({ forma: "tanque" }, 0)).toBe("tanque");
    expect(new Set([0, 1, 2, 3, 4].map((i) => formaDe({}, i))).size).toBe(5);
    expect(LISTA_FORMAS).toContain(formaDe({ forma: "foguete" }, 0));
  });
  it("monta o SVG com a placa-base, cada forma, os cabos e a legenda (sem texto solto: só os números gravados)", () => {
    const pecas = LISTA_FORMAS.slice(0, 7).map((f, i) => peca(`p${i}`, { forma: f, nome: `Peça <${i}>`, sub: "faz algo" }));
    const m = montarMaquina(doc({ pecas, ligacoes: pecas.slice(1).map((p, i) => [pecas[i]!.id, p.id] as [string, string]), arranjo: "anel" }))!;
    expect(m.legenda.map((l) => l.forma)).toEqual(LISTA_FORMAS.slice(0, 7));
    expect(m.svg).toContain("iso-solid"); expect(m.svg).toContain("iso-wire"); expect(m.svg).toContain("iso-halo");
    expect(m.svg).not.toContain("Peça <");   // nomes não vão pro desenho (e nada sem escape)
    expect((m.svg.match(/iso-face-text/g) ?? []).length).toBe(7);
  });
  it("sem peças, nada; a peça travada fica acesa", () => {
    expect(montarMaquina(doc())).toBeNull();
    const m = montarMaquina(doc({ pecas: [peca("a"), peca("b", { fase: 2 })], criticos: [{ id: "r", fase: 2, titulo: "t", prova: "p", tipoProva: "repo", pecaId: "b", abertoEm: 0, status: "aberto" }] }))!;
    expect(m.legenda.map((l) => l.estado)).toEqual(["ok", "trava"]);
    expect(m.svg).toContain('data-estado="trava"');
  });
});
