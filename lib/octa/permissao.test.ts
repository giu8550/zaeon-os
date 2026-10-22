import { describe, it, expect } from "vitest";
import { precisaAprovacao } from "./permissao";
import type { PermissaoOcta } from "./projetos";

const TOOLS = ["octa_apagar", "octa_escrever", "octa_pagina_montar", "octa_design_escolher", "octa_publicar"] as const;
const ESPERADO: Record<PermissaoOcta, Record<(typeof TOOLS)[number], boolean>> = {
  auto: { octa_apagar: true, octa_escrever: false, octa_pagina_montar: false, octa_design_escolher: false, octa_publicar: false },
  antes_de_publicar: { octa_apagar: true, octa_escrever: false, octa_pagina_montar: false, octa_design_escolher: false, octa_publicar: true },
  antes_de_escrever: { octa_apagar: true, octa_escrever: true, octa_pagina_montar: true, octa_design_escolher: true, octa_publicar: true },
};

describe("octa · precisaAprovacao (3 níveis × 5 tools)", () => {
  for (const [nivel, linha] of Object.entries(ESPERADO) as [PermissaoOcta, Record<string, boolean>][]) {
    for (const tool of TOOLS) {
      it(`${nivel} · ${tool} → ${linha[tool]}`, () => expect(precisaAprovacao(nivel, tool)).toBe(linha[tool]));
    }
  }

  it("leitura nunca pede aprovação", () => {
    for (const nivel of Object.keys(ESPERADO) as PermissaoOcta[]) {
      expect(precisaAprovacao(nivel, "octa_ler")).toBe(false);
      expect(precisaAprovacao(nivel, "octa_listar")).toBe(false);
    }
  });
});
