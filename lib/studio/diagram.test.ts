import { describe, it, expect, vi } from "vitest";
import {
  normalizarIR, idSeguro, gerarDiagrama, rodarArchify, lerDiagnosticos, promptSistema, autoReparo, TIPOS,
  type RodarArchify,
} from "./diagram";
import { EXEMPLOS } from "./diagram-exemplos";

// Estes testes rodam o archify DE VERDADE (vendor/archify, processo node) — é o contrato que importa.
describe("exemplos didáticos", () => {
  for (const tipo of TIPOS) {
    it(`${tipo}: o exemplo passa pelo pipeline (normaliza → render/autoReparo → validate) sem chamar o modelo de novo`, async () => {
      const gerarJson = vi.fn().mockResolvedValue(EXEMPLOS[tipo]);
      const r = await gerarDiagrama({ topic: tipo }, { gerarJson: gerarJson as any, maxReparos: 0 });
      expect(r.ok ? "ok" : r.motivo).toBe("ok");
      if (r.ok) {
        expect(r.tipo).toBe(tipo);
        expect(r.html).toContain("<svg");
        expect(r.html).toContain("Legenda"); // interface em PT
      }
      expect(gerarJson).toHaveBeenCalledTimes(1);
    }, 30_000);
  }
});

describe("normalizarIR", () => {
  it("ids seguros e estáveis (sem acento, começa com letra)", () => {
    expect(idSeguro("Fixação do CO₂")).toBe("Fixacao_do_CO");
    expect(idSeguro("123")).toBe("n0");
    expect(idSeguro("", 3)).toBe("n3");
  });

  it("conserta o IR bagunçado do modelo: ids, refs, props desconhecidas, coluna fora, ligação órfã", async () => {
    const ir = await normalizarIR("workflow", {
      diagram_type: "workflow",
      meta: { title: "Teste", foo: 1, viewBox: [1, 2] },
      lanes: [{ id: "Fase 1", label: "Fase 1" }],
      nodes: [
        { id: "Água", lane: "Fase 1", col: 9, type: "molecula", label: "Água", sources: ["x"], extra: true },
        { id: "luz", lane: "inexistente", col: -2, type: "external", label: "Luz" },
      ],
      edges: [
        { from: "luz", to: "Água", label: "aquece", via: [[1, 2]], variant: "neon" },
        { from: "luz", to: "fantasma" },
      ],
      lixo: 42,
    });
    expect(ir.schema_version).toBe(2);
    expect(ir.meta).toMatchObject({ title: "Teste", output: "diagrama.html", locale: "pt-BR" });
    expect(ir.meta.foo).toBeUndefined();
    expect(ir.lixo).toBeUndefined();
    expect(ir.nodes[0]).toMatchObject({ id: "Agua", lane: "Fase_1", col: 5, type: "backend" });
    expect(ir.nodes[0].extra).toBeUndefined();
    expect(ir.nodes[1]).toMatchObject({ lane: "Fase_1", col: 0 });
    expect(ir.edges).toEqual([{ from: "luz", to: "Agua", label: "aquece" }]);
    expect((await rodarArchify("validate", "workflow", ir)).ok).toBe(true);
  }, 20_000);

  it("sequence: o y vem da ordem das mensagens (o modelo não escreve geometria)", async () => {
    const ir = await normalizarIR("sequence", {
      meta: { title: "S" },
      participants: [{ id: "a", type: "frontend", label: "A" }, { id: "b", type: "backend", label: "B" }],
      messages: [{ from: "a", to: "b", label: "oi", y: 999 }, { from: "b", to: "a", label: "olá", variant: "return" }],
      activations: [{ participant: "a", from: 1, to: 2 }],
    });
    expect(ir.messages.map((m: any) => m.y)).toEqual([170, 210]);
    expect(ir.activations).toBeUndefined();
  });

  it("lifecycle: a primeira faixa vira 'main' e as referências acompanham", async () => {
    const ir = await normalizarIR("lifecycle", {
      lanes: [{ id: "fases", label: "Fases" }, { id: "terminal", label: "Fim" }],
      states: [{ id: "a", type: "start", label: "A", lane: "fases", col: 0 }, { id: "b", type: "success", label: "B", lane: "terminal", col: 1 }],
      transitions: [{ from: "a", to: "b", label: "vai" }],
    });
    expect(ir.lanes[0].id).toBe("main");
    expect(ir.states[0].lane).toBe("main");
  });
});

describe("lerDiagnosticos", () => {
  it("lê o --json do validate e o texto do render", () => {
    const j = JSON.stringify({ ok: false, stage: "render", diagnostics: [{ code: "schema/x", severity: "error", message: "ruim", supportedFixes: ["tire"] }, { severity: "warning", message: "aviso" }] });
    expect(lerDiagnosticos(j)).toEqual({ diagnosticos: [{ code: "schema/x", message: "ruim", fixes: ["tire"] }], estagio: "render" });
    expect(lerDiagnosticos("não é json", "erro de schema").diagnosticos[0].message).toBe("erro de schema");
  });
});

describe("gerarDiagrama", () => {
  it("modelo → IR → valida → renderiza (archify real)", async () => {
    const gerarJson = vi.fn().mockResolvedValue(EXEMPLOS.workflow);
    const r = await gerarDiagrama({ topic: "fotossíntese", contexto: "A luz vira ATP…" }, { gerarJson: gerarJson as any });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tipo).toBe("workflow");
      expect(r.titulo).toBe("Como a fotossíntese acontece");
      expect(r.html).toContain("<svg");
    }
    expect(gerarJson.mock.calls[0][1]).toContain("A luz vira ATP");
  }, 20_000);

  it("reprovado → manda os diagnósticos pro modelo consertar → passa", async () => {
    const gerarJson = vi.fn().mockResolvedValueOnce({ diagram_type: "workflow", nodes: [] }).mockResolvedValueOnce(EXEMPLOS.workflow);
    let validacoes = 0;
    const archify: RodarArchify = async (cmd) => {
      if (cmd === "validate") return ++validacoes === 1 ? { ok: false, diagnosticos: [{ message: "faltou nó" }] } : { ok: true };
      return { ok: true, html: "<svg/>" };
    };
    // 1ª resposta sem nós é recusada antes do archify; então o reparo cobre um IR reprovado:
    const r1 = await gerarDiagrama({ topic: "x" }, { gerarJson: gerarJson as any, archify });
    expect(r1.ok).toBe(false);
    const g2 = vi.fn().mockResolvedValueOnce(EXEMPLOS.workflow).mockResolvedValueOnce(EXEMPLOS.workflow);
    validacoes = 0;
    const r2 = await gerarDiagrama({ topic: "x" }, { gerarJson: g2 as any, archify });
    expect(r2.ok).toBe(true);
    expect(g2).toHaveBeenCalledTimes(2);
    expect(g2.mock.calls[1][1]).toContain("faltou nó");
  });

  it("renderizou mas a composição reprovou mesmo após os reparos → entrega o desenho; sem render, nada", async () => {
    const gerarJson = vi.fn().mockResolvedValue(EXEMPLOS.workflow);
    const composicao: RodarArchify = async (cmd) => cmd === "validate"
      ? { ok: false, diagnosticos: [{ code: "check/relationship_crossings", message: "cruza" }] }
      : { ok: true, html: "<svg/>" };
    const r = await gerarDiagrama({ topic: "x" }, { gerarJson: gerarJson as any, archify: composicao, maxReparos: 1 });
    expect(r.ok).toBe(true);
    expect(gerarJson).toHaveBeenCalledTimes(2); // tentou consertar com o modelo antes de aceitar
    const semRender: RodarArchify = async () => ({ ok: false, diagnosticos: [{ code: "schema/required", message: "falta" }] });
    expect((await gerarDiagrama({ topic: "x" }, { gerarJson: gerarJson as any, archify: semRender, maxReparos: 1 })).ok).toBe(false);
  });

  it("autoReparo aplica as sugestões exatas do archify (largura, labelDy, rótulos colados)", () => {
    const ir = { nodes: [{ id: "agua", label: "Fotólise da água", width: 92 }], edges: [{ from: "a", to: "b", label: "gera" }, { from: "b", to: "c", label: "vai" }] };
    const saida = [
      'Label "Fotólise da água" (~109px) is wider than node "agua" (92px) — shorten the label or increase node.width.',
      '[layout/constraint] Label "gera" overlaps node "x" — adjust labelDx/labelDy/labelSegment or set labelAt.',
      '  Suggested fix: set labelAt [530, 201] or set labelDy 25 (below); or set labelAt [530, 119] or set labelDy -57 (above)',
      'Labels "gera" and "vai" overlap — adjust labelDx/labelDy.',
    ].join("\n");
    const novo = autoReparo("workflow", ir, saida);
    expect(novo.nodes[0].width).toBe(137);
    expect(novo.edges[0].labelDy).toBe(25);
    expect(novo.edges[1].labelDy).toBe(20);
    expect(autoReparo("workflow", ir, "nada a ver")).toBeNull();
  });

  it("mapa mental puxa o mapa de conceitos no prompt", () => {
    expect(promptSistema(EXEMPLOS, "mapa")).toContain("MAPA MENTAL");
    expect(promptSistema(EXEMPLOS, "auto")).not.toContain("MAPA MENTAL");
  });
});
