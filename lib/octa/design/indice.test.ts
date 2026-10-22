import { describe, it, expect } from "vitest";
import { FONTES_ABERTAS } from "./tokens";
import { carregarIndice, lerDesignMd, candidatosPorDescricao, marcaDoEstilo, palavrasDaMarca, estiloDoProjeto, MARCAS_EXPLICITAS } from "./indice";
import { mencionaMarca, marcaMencionada } from "../secoes/render";

describe("carregarIndice / lerDesignMd", () => {
  it("lê o índice vendorizado com os 84 estilos e campos completos", () => {
    const ind = carregarIndice();
    expect(ind.length).toBe(84);
    for (const e of ind) {
      expect(e.id).toBeTruthy();
      expect(e.nome).toBeTruthy();
      expect(e.marca).toBeTruthy();
      expect(e.tokens.cores.primaria).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // marca = nome da pasta sem TLD, capitalizado
    expect(ind.find((e) => e.id === "linear.app")?.marca).toBe("Linear");
  });

  it("lerDesignMd devolve o markdown e recusa id fora do índice (path traversal)", () => {
    expect(lerDesignMd("linear.app")).toContain("#5e6ad2");
    expect(() => lerDesignMd("../../package.json")).toThrow();
    expect(() => lerDesignMd("nao-existe")).toThrow();
  });
});

describe("candidatosPorDescricao", () => {
  const ind = carregarIndice();

  it("'escura e minimalista' só traz estilos escuros entre os 3 primeiros", () => {
    const top = candidatosPorDescricao("escura e minimalista", ind);
    expect(top.length).toBe(5);
    for (const e of top.slice(0, 3)) expect(e.tokens.escuro).toBe(true);
  });

  it("'clara' não traz estilo escuro no topo", () => {
    const top = candidatosPorDescricao("uma página clara e corporativa", ind);
    for (const e of top.slice(0, 3)) expect(e.tokens.escuro).toBe(false);
  });

  it("respeita n e é determinístico", () => {
    const a = candidatosPorDescricao("divertida", ind, 2);
    expect(a.length).toBe(2);
    expect(candidatosPorDescricao("divertida", ind, 2).map((e) => e.id)).toEqual(a.map((e) => e.id));
  });

  it("nome da marca na descrição puxa o estilo", () => {
    expect(candidatosPorDescricao("quero algo estilo stripe", ind, 1)[0].id).toBe("stripe");
  });
});

describe("anti-marca no índice real", () => {
  const ind = carregarIndice();

  it("nenhuma palavra (3+ letras) da marca nem dos aliases aparece nos tokens de nenhum estilo", () => {
    for (const e of ind) {
      const json = JSON.stringify(e.tokens).toLowerCase();
      for (const w of palavrasDaMarca(e).join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((p) => p.length >= 3)) {
        expect(json, `${e.id} vaza "${w}"`).not.toContain(w);
      }
    }
  });

  it("toda família de fonte nos tokens está na lista aberta (ou é do sistema)", () => {
    for (const e of ind) {
      for (const pilha of Object.values(e.tokens.fontes)) {
        const primeira = pilha.split(",")[0].trim().replace(/^"|"$/g, "").toLowerCase();
        const ok = primeira === "system-ui" || FONTES_ABERTAS.has(primeira);
        expect(ok, `${e.id}: ${primeira}`).toBe(true);
      }
    }
  });
});

describe("marca real de cada estilo (MARCAS_EXPLICITAS)", () => {
  const ind = carregarIndice();
  const de = (id: string) => ind.find((e) => e.id === id)!;

  it("o índice gravado bate com marcaDoEstilo (o sync é reproduzível)", () => {
    for (const e of ind) {
      const m = marcaDoEstilo(e.id);
      expect(e.marca, e.id).toBe(m.marca);
      expect(e.aliases ?? [], e.id).toEqual(m.aliases);
    }
    for (const id of Object.keys(MARCAS_EXPLICITAS)) expect(de(id), `override sem estilo: ${id}`).toBeTruthy();
  });

  it("id com ano/sufixo/palavras grudadas vira o nome da marca de verdade", () => {
    expect(de("bmw-m").marca).toBe("BMW");
    expect(de("bmw-m").nome).toBe("BMW M");
    expect(de("dell-1996").marca).toBe("Dell");
    expect(de("nintendo-2001").marca).toBe("Nintendo");
    expect(palavrasDaMarca(de("runwayml"))).toEqual(["Runway", "RunwayML"]);
    expect(palavrasDaMarca(de("theverge"))).toEqual(["The Verge", "TheVerge"]);
    expect(palavrasDaMarca(de("aljazeera"))).toEqual(["Al Jazeera", "Aljazeera"]);
    expect(palavrasDaMarca(de("x.ai"))).toEqual(["xAI", "X", "Grok"]);
  });

  it("a varredura acha as marcas reais e os aliases", () => {
    const pg = (t: string) => `<html><body><p>${t}</p></body></html>`;
    expect(marcaMencionada(pg("um site tipo Nintendo"), palavrasDaMarca(de("nintendo-2001")))).toBe("Nintendo");
    expect(marcaMencionada(pg("carros BMW"), palavrasDaMarca(de("bmw-m")))).toBe("BMW");
    expect(marcaMencionada(pg("como o runway"), palavrasDaMarca(de("runwayml")))).toBe("Runway");
    expect(marcaMencionada(pg("leia The Verge"), palavrasDaMarca(de("theverge")))).toBe("The Verge");
    expect(marcaMencionada(pg("notícias da Al Jazeera"), palavrasDaMarca(de("aljazeera")))).toBe("Al Jazeera");
    expect(marcaMencionada(pg("feito com Grok"), palavrasDaMarca(de("x.ai")))).toBe("Grok");
    expect(marcaMencionada(pg("Dell"), palavrasDaMarca(de("dell-1996")))).toBe("Dell");
  });

  it("alias de 1 letra não é varrido: link pro x.com e um 'x' solto não disparam (o rótulo continua na galeria)", () => {
    const html = '<html><body><a href="https://x.com/padaria">siga no X</a><p>3 x 4</p></body></html>';
    expect(mencionaMarca(html, palavrasDaMarca(de("x.ai")))).toBe(false);
    expect(de("x.ai").marca).toBe("xAI");
  });

  it("estiloDoProjeto lê o marcador do DESIGN.md da raiz; sem marcador ou id desconhecido → sem estilo", () => {
    expect(estiloDoProjeto({ "DESIGN.md": "<!-- zaeon-estilo: theverge -->\n# x" })?.estilo?.id).toBe("theverge");
    expect(estiloDoProjeto({ "DESIGN.md": "# x" })?.estilo).toBeUndefined();
    expect(estiloDoProjeto({ "DESIGN.md": "<!-- zaeon-estilo: nao-existe -->\n" })?.estilo).toBeUndefined();
    expect(estiloDoProjeto({ "index.html": "x" })).toBeNull();
  });
});
