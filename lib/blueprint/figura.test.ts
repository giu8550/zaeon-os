import { describe, expect, it } from "vitest";
import { estadoPeca } from "./figura";
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
});
