import { describe, expect, it } from "vitest";
import { avaliarEstudo } from "@/lib/cyber/relicario";
import { itemDoBlueprint, pontosDoBlueprint } from "./itens";
import { docVazio, type DocBlueprint } from "./tipos";

const aval = (fase: 1 | 2 | 3 | 4, n: number) => ({ fase, em: 1, nota: { rigor: n, originalidade: n, usabilidade: n, viabilidade: n, impacto: n }, parecer: "ok", aprovada: true });
const doc = (o: Partial<DocBlueprint> = {}): DocBlueprint => ({ ...docVazio("Privacy on Solana", 0), ...o });

describe("o blueprint como ITEM RARO do jogo", () => {
  it("recém-nascido é comum e não é vendável", () => {
    const it0 = itemDoBlueprint("a".repeat(24), doc());
    expect(it0).toMatchObject({ id: `${"a".repeat(24)}:blueprint`, cardId: "blueprint", raridade: "comum", vendavel: false });
  });
  it("cada fase aprovada pesa; fase 2 aprovada = vendável e pelo menos épico", () => {
    const d = doc({ fase: 3, avaliacoes: [aval(1, 70), aval(2, 80)], passos: [{ id: "p1", titulo: "a", fase: 1, fontes: [{ titulo: "Zether" }, { titulo: "Bulletproofs" }] }], pecas: [{ id: "zk", nome: "zk", fase: 2 }] });
    expect(pontosDoBlueprint(d)).toBe(44 + 16 + 4);
    const it2 = itemDoBlueprint("a".repeat(24), d);
    expect(it2).toMatchObject({ vendavel: true, raridade: "epica", nivel: 64, fontes: 2, componentes: 1 });
  });
  it("aguardando mentor com nota alta = lendário; o Relicário aceita", () => {
    const d = doc({ fase: 4, aguardandoMentor: true, avaliacoes: [aval(1, 80), aval(2, 80), aval(3, 90), aval(4, 90)] });
    const it4 = itemDoBlueprint("b".repeat(24), d);
    expect(it4.raridade).toBe("lendaria"); expect(avaliarEstudo(it4).aceito).toBe(true);
  });
});
