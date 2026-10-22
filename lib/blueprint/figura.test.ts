import { describe, expect, it } from "vitest";
import { estadoPeca, montarFigura } from "./figura";
import { docVazio, type Critico, type DocBlueprint, type Peca } from "./tipos";

const peca = (id: string, fase: 1 | 2 | 3 | 4 = 2): Peca => ({ id, nome: id, fase });
const c = (o: Partial<Critico>): Critico => ({ id: "r1", fase: 2, titulo: "t", prova: "p", tipoProva: "repo", abertoEm: 0, status: "aberto", ...o });
const doc = (o: Partial<DocBlueprint> = {}): DocBlueprint => ({ ...docVazio("T", 0), fase: 2, ...o });

describe("a figura do tema — a peça acende quando a prova chega", () => {
  it("peça de fase já aprovada = ok; com crítico aberto = trava; com crítico provado = ok; senão futuro", () => {
    expect(estadoPeca(doc(), peca("a", 1))).toBe("ok");
    expect(estadoPeca(doc({ criticos: [c({ pecaId: "zk" })] }), peca("zk"))).toBe("trava");
    expect(estadoPeca(doc({ criticos: [c({ pecaId: "zk", status: "provado", entrega: { url: "https://x.org", em: 1, detalhe: "" } })] }), peca("zk"))).toBe("ok");
    expect(estadoPeca(doc(), peca("dest", 3))).toBe("futuro");
  });
  it("7 peças em serpentina sem colisão, e cada uma mais alta quanto mais adiante a fase", () => {
    const f = montarFigura(doc({ pecas: Array.from({ length: 7 }, (_, i) => peca(`p${i}`, ((i % 4) + 1) as 1 | 2 | 3 | 4)) }));
    const chaves = f.pecas.map((p) => `${p.gx},${p.gy}`);
    expect(new Set(chaves).size).toBe(7);
    expect(f.pecas[3]!.h).toBeGreaterThan(f.pecas[0]!.h);
    expect(f.caixa.w).toBeGreaterThan(0); expect(f.caixa.h).toBeGreaterThan(0);
  });
  it("sem peças não quebra (caixa mínima)", () => {
    const f = montarFigura(doc()); expect(f.pecas).toEqual([]); expect(f.caixa.w).toBeGreaterThan(0);
  });
  it("as ligações só entre peças que existem; ordem de desenho de trás pra frente", () => {
    const f = montarFigura(doc({ pecas: [peca("a"), peca("b"), peca("c")], ligacoes: [["a", "b"], ["b", "c"]] }));
    expect(f.ligacoes).toEqual([["a", "b"], ["b", "c"]]);
    const prof = f.ordem.map((id) => { const p = f.pecas.find((k) => k.id === id)!; return p.gx + p.gy; });
    expect([...prof].sort((x, y) => x - y)).toEqual(prof);
  });
});
