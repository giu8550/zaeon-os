import { describe, it, expect } from "vitest";
import { ALCANCE_RELICARIO, DURACAO_RELICARIO, RITMO_RELICARIO, avaliarEstudo, encaixaNoRelicario, eventoVivo, faseDoRelicario, idDeEncaixeValido, relicarioLocal, relicarioMundo, sanitizarEventoRelicario } from "./relicario";
import { CIDADE, MOVEIS, RELICARIO_SALA, daSala, mundo, naSala, rotDaSala } from "./ceu";

const OID = "64f0c0ffee0000000000abcd";

describe("o Relicário do Saber (a entrega na Sala do Saber)", () => {
  it("fica DENTRO da biblioteca, no corredor do meio, de frente pra porta — e o móvel sólido marca a mesma pegada", () => {
    const s = CIDADE.salas.biblioteca, p = relicarioLocal();
    expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeLessThan(s.r);
    expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeCloseTo(Math.hypot(RELICARIO_SALA.x, RELICARIO_SALA.z), 6);
    const d = daSala(s, RELICARIO_SALA.x, RELICARIO_SALA.z); expect(p.x).toBeCloseTo(d.x, 9); expect(p.z).toBeCloseTo(d.z, 9);
    const volta = naSala(s, p.x, p.z); expect(volta.x).toBeCloseTo(RELICARIO_SALA.x, 6); expect(volta.z).toBeCloseTo(RELICARIO_SALA.z, 6);
    expect(p.rumo).toBeCloseTo(rotDaSala(s), 9);   // a frente aponta pra porta (o +z da sala)
    expect(relicarioMundo()).toEqual(mundo({ x: p.x, z: p.z }));
    expect(ALCANCE_RELICARIO).toBeGreaterThan(RELICARIO_SALA.r);   // o F vale de fora da cabine
    const moveis = MOVEIS.biblioteca.filter((m) => m.tipo === "relicario"); expect(moveis).toHaveLength(1);
    const m = moveis[0]!; expect(m.x).toBe(RELICARIO_SALA.x); expect(m.z).toBe(RELICARIO_SALA.z); expect(m.solido).not.toBe(false);
    expect(m.larg).toBeCloseTo(RELICARIO_SALA.r * 2, 6); expect(m.prof).toBeGreaterThan(RELICARIO_SALA.r);
  });
  it("a cena: o item VOA, a Zaeon LÊ, sai o VEREDITO e acaba — nos tempos do ritmo; quem entra depois não vê uma entrega que já acabou", () => {
    const R = RITMO_RELICARIO;
    expect(DURACAO_RELICARIO).toBeCloseTo(R.voo + R.leitura + R.veredito, 9);
    expect(faseDoRelicario(0)).toBe("voando"); expect(faseDoRelicario(R.voo - 0.01)).toBe("voando");
    expect(faseDoRelicario(R.voo)).toBe("lendo"); expect(faseDoRelicario(R.voo + R.leitura - 0.01)).toBe("lendo");
    expect(faseDoRelicario(R.voo + R.leitura)).toBe("veredito"); expect(faseDoRelicario(DURACAO_RELICARIO - 0.01)).toBe("veredito");
    expect(faseDoRelicario(DURACAO_RELICARIO)).toBe("fim"); expect(faseDoRelicario(999)).toBe("fim");
    const t0 = 1_700_000_000_000;
    expect(eventoVivo({ agora: t0 }, t0)).toBe(true);
    expect(eventoVivo({ agora: t0 }, t0 + DURACAO_RELICARIO * 1000 - 1)).toBe(true);
    expect(eventoVivo({ agora: t0 }, t0 + DURACAO_RELICARIO * 1000)).toBe(false);
  });
  it("o evento da sala (Pusher) é saneado: lixo fora; nome/cor/título com padrão; tamanhos cortados; aceito só se === true", () => {
    const lixo: unknown[] = [null, undefined, "x", 42, [], {}, { id: "e", userId: "u", tipo: "arma", agora: 1 }, { id: "e", userId: "u", tipo: "pesquisa" }, { id: "e", userId: "u", tipo: "pesquisa", agora: "nada" }, { id: "e", userId: "u", tipo: "pesquisa", agora: Infinity }, { id: "e", tipo: "pesquisa", agora: 1 }, { userId: "u", tipo: "pesquisa", agora: 1 }, { id: "", userId: "u", tipo: "livro", agora: 1 }, { id: 7, userId: "u", tipo: "livro", agora: 1 }];
    for (const l of lixo) expect(sanitizarEventoRelicario(l)).toBeNull();
    expect(sanitizarEventoRelicario({ id: "e1", userId: "u1", tipo: "pesquisa", agora: 123 })).toEqual({ id: "e1", userId: "u1", nome: "Alguém", cor: "#7fe8ff", titulo: "Sem título", tipo: "pesquisa", aceito: false, agora: 123 });
    expect(sanitizarEventoRelicario({ id: "e1", userId: "u1", tipo: "livro", agora: "456", nome: "Ana", cor: "#AbCdEf", titulo: "TCC", aceito: true })).toEqual({ id: "e1", userId: "u1", nome: "Ana", cor: "#AbCdEf", titulo: "TCC", tipo: "livro", aceito: true, agora: 456 });
    for (const aceito of ["true", 1, "sim", {}]) expect(sanitizarEventoRelicario({ id: "e", userId: "u", tipo: "livro", agora: 1, aceito })!.aceito).toBe(false);
    for (const cor of ["red", "#abc", "#12345g", 0xff0000, null]) expect(sanitizarEventoRelicario({ id: "e", userId: "u", tipo: "livro", agora: 1, cor })!.cor).toBe("#7fe8ff");
    const longo = sanitizarEventoRelicario({ id: "i".repeat(100), userId: "u".repeat(100), nome: "n".repeat(100), titulo: "t".repeat(200), tipo: "pesquisa", agora: 1 })!;
    expect(longo.id).toHaveLength(64); expect(longo.userId).toHaveLength(64); expect(longo.nome).toHaveLength(60); expect(longo.titulo).toHaveLength(120);
    expect(sanitizarEventoRelicario({ id: "e", userId: "u", tipo: "livro", agora: 1, nome: 7, titulo: null })).toMatchObject({ nome: "Alguém", titulo: "Sem título" });
  });
  it("cabe: estudos (livros) e pesquisas; armas e o resto não", () => {
    expect(encaixaNoRelicario("pesquisa")).toBe(true); expect(encaixaNoRelicario("livro")).toBe(true);
    for (const t of ["arma", "", "PESQUISA", "espada", "moto", "artigo"]) expect(encaixaNoRelicario(t)).toBe(false);
  });
  it("os ids que vão pro servidor: pesquisa = ObjectId; estudo = boardId:cardId; o rascunho local do tutorial (local:…) não entrega", () => {
    expect(idDeEncaixeValido({ tipo: "pesquisa", id: OID })).toBe(true); expect(idDeEncaixeValido({ tipo: "pesquisa", id: OID.toUpperCase() })).toBe(true);
    for (const id of ["local:abc", `local:${OID}`, OID.slice(0, 23), `${OID}0`, `${OID}:card`, "", "não", "x".repeat(24)]) expect(idDeEncaixeValido({ tipo: "pesquisa", id })).toBe(false);
    expect(idDeEncaixeValido({ tipo: "livro", id: `${OID}:card-1` })).toBe(true); expect(idDeEncaixeValido({ tipo: "livro", id: `${OID}:${"c".repeat(64)}` })).toBe(true);
    for (const id of [OID, `${OID}:`, `${OID}:${"c".repeat(65)}`, `${OID}:a.b`, `local:${OID}:card`, "abc:card", `${OID}:card:extra`, `${OID.slice(0, 23)}:card`]) expect(idDeEncaixeValido({ tipo: "livro", id })).toBe(false);
    expect(idDeEncaixeValido({ tipo: "arma", id: OID })).toBe(false); expect(idDeEncaixeValido({ tipo: "arma", id: `${OID}:card` })).toBe(false);
  });
  it("o veredito de um ESTUDO: vendável no blueprint = aceito; senão o Droid diz o que falta (a lista nunca vem vazia)", () => {
    expect(avaliarEstudo({ vendavel: true, nivel: 0, fontes: 0, componentes: 0 })).toEqual({ aceito: true, faltando: [] });
    const r = avaliarEstudo({ vendavel: false, nivel: 12, fontes: 0, componentes: 0 });
    expect(r.aceito).toBe(false); expect(r.faltando).toHaveLength(3);
    expect(r.faltando.join(" | ")).toMatch(/nível 12 de 50.*fontes confirmadas.*produto final no blueprint/);
    expect(avaliarEstudo({ vendavel: false, nivel: 50, fontes: 3, componentes: 0 }).faltando).toEqual(["o produto final no blueprint"]);
    expect(avaliarEstudo({ vendavel: false, nivel: 50, fontes: 0, componentes: 2 }).faltando).toEqual(["fontes confirmadas na literatura"]);
    const selos = avaliarEstudo({ vendavel: false, nivel: 80, fontes: 3, componentes: 2 });
    expect(selos.aceito).toBe(false); expect(selos.faltando).toHaveLength(1); expect(selos.faltando[0]).toMatch(/selos do blueprint/);
  });
});
