import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AbntPreview from "./AbntPreview";

const DOC = `# INTRODUÇÃO

A agricultura de precisão usa sensores
para decidir onde aplicar insumos.
Segundo parágrafo.

## Contexto

"${"Citação direta longa que precisa passar de três linhas pra virar bloco recuado. ".repeat(4)}"

![Mapa da área|própria](data:image/png;base64,iVBORw0KGgo=)

%%tabela Produtividade
%%fonte IBGE (2020)
| Safra | t/ha |
| --- | --- |
| 2020 | 3,1 |

# CONCLUSÃO

Fim.

# REFERÊNCIAS

SILVA, A. Solos. Fortaleza: UFC, 2020.`;

describe("AbntPreview", () => {
  const html = renderToStaticMarkup(<AbntPreview content={DOC} titulo="IA no Campo" />).split("<!-- -->").join("");
  it("numera seções e subseções como o motor (referências sem número)", () => {
    expect(html).toContain("1 INTRODUÇÃO");
    expect(html).toContain("1.1 Contexto");
    expect(html).toContain("2 CONCLUSÃO");
    expect(html).toMatch(/>REFERÊNCIAS</);
  });
  it("junta a quebra mole num parágrafo só e separa no fim de frase", () => {
    expect(html).toContain("A agricultura de precisão usa sensores para decidir onde aplicar insumos.</p>");
    expect(html).toContain(">Segundo parágrafo.</p>");
  });
  it("figura e tabela com legenda e fonte; citação longa sem aspas", () => {
    expect(html).toContain("Figura 1 – Mapa da área");
    expect(html).toContain("Fonte: elaborado pelo próprio autor");
    expect(html).toContain("Tabela 1 – Produtividade");
    expect(html).toContain("Fonte: IBGE (2020)");
    expect(html).not.toContain("&quot;Citação direta longa");
  });
  it("texto sem marcadores ainda aparece", () => {
    expect(renderToStaticMarkup(<AbntPreview content={"Só texto\nsolto."} />)).toContain("Só texto solto.");
  });
});
