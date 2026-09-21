import { describe, it, expect } from "vitest";
import { semAcento, limparTermo, candidatosLocais, resolverMolecula } from "./molecule";

/** fetch falso que responde por rota, imitando o PUG REST. */
function pubchemFalso(mapa: Record<string, any>, sdf3d = true) {
  const chamadas: string[] = [];
  const f = (async (url: any) => {
    const u = String(url);
    chamadas.push(u);
    const mNome = u.match(/\/name\/([^/]+)\/property/);
    if (mNome) {
      const nome = decodeURIComponent(mNome[1]);
      const p = mapa[nome];
      if (!p) return { ok: false, status: 404, json: async () => ({}) } as any;
      return { ok: true, status: 200, json: async () => ({ PropertyTable: { Properties: [p] } }) } as any;
    }
    if (u.includes("/SDF?record_type=3d")) {
      return sdf3d
        ? ({ ok: true, status: 200, text: async () => "bloco\nM  END\n" } as any)
        : ({ ok: false, status: 404, text: async () => "" } as any);
    }
    if (u.includes("/SDF?record_type=2d")) {
      return { ok: true, status: 200, text: async () => "chapado\nM  END\n" } as any;
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => "" } as any;
  }) as unknown as typeof fetch;
  return { f, chamadas };
}

const CAFEINA = { CID: 2519, MolecularFormula: "C8H10N4O2", MolecularWeight: "194.19", IUPACName: "1,3,7-trimethylpurine-2,6-dione" };

describe("termo que o aluno escreve", () => {
  it("tira acento (o PubChem 404a em 'cafeína')", () => {
    expect(semAcento("cafeína")).toBe("cafeina");
    expect(semAcento("água")).toBe("agua");
  });

  it("descasca o que a conversa gruda no nome", () => {
    expect(limparTermo("estrutura molecular da cafeína")).toBe("cafeína");
    expect(limparTermo("a fórmula da água")).toBe("água");
    expect(limparTermo("  Glicose. ")).toBe("glicose");
  });

  it("candidatos vão do mais fiel ao mais tolerante, sem repetir", () => {
    expect(candidatosLocais("cafeína")).toEqual(["cafeína", "cafeina"]);
    expect(candidatosLocais("etanol")).toEqual(["etanol"]);
  });
});

describe("resolução no PubChem", () => {
  it("acha pelo termo sem acento e devolve estrutura 3D", async () => {
    const { f } = pubchemFalso({ cafeina: CAFEINA });
    const r = await resolverMolecula("estrutura molecular da cafeína", { fetchImpl: f });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cid).toBe(2519);
    expect(r.data.formula).toBe("C8H10N4O2");
    expect(r.data.tridimensional).toBe(true);
    expect(r.data.sdf).toContain("M  END");
  });

  it("sem conformação 3D, cai pro 2D e AVISA (render chapado não pode passar por 3D)", async () => {
    const { f } = pubchemFalso({ cafeina: CAFEINA }, false);
    const r = await resolverMolecula("cafeina", { fetchImpl: f });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.tridimensional).toBe(false);
  });

  it("nome só em português vira inglês como ÚLTIMO recurso", async () => {
    const { f } = pubchemFalso({ glucose: { ...CAFEINA, CID: 5793, MolecularFormula: "C6H12O6" } });
    const r = await resolverMolecula("glicose", { fetchImpl: f, traduzir: async () => "glucose" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.cid).toBe(5793);
    expect(r.data.nomeResolvido).toBe("glucose");
  });

  it("não inventa molécula quando não existe", async () => {
    const { f } = pubchemFalso({});
    const r = await resolverMolecula("abluberdabe", { fetchImpl: f, traduzir: async () => "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("não achei");
  });

  it("não chama tradução quando o termo já resolveu (custo é do aluno)", async () => {
    const { f } = pubchemFalso({ cafeina: CAFEINA });
    let traduziu = false;
    await resolverMolecula("cafeina", { fetchImpl: f, traduzir: async () => { traduziu = true; return ""; } });
    expect(traduziu).toBe(false);
  });
});
