import { describe, expect, it } from "vitest";
import { LISTA_ARRANJOS, LISTA_FORMAS, anguloRaio, formaDe, montarMaquina, posicoes } from "./maquina";
import { docVazio, type DocBlueprint, type Peca } from "./tipos";

const peca = (id: string, o: Partial<Peca> = {}): Peca => ({ id, nome: id, fase: 1, ...o });
const doc = (o: Partial<DocBlueprint> = {}): DocBlueprint => ({ ...docVazio("T", 0), fase: 2, ...o });

describe("a máquina do tema (padrão anatomy)", () => {
  it("cada arranjo põe as estações em lugares diferentes, sem encostar umas nas outras", () => {
    for (const arranjo of LISTA_ARRANJOS) for (const n of [3, 5, 7]) {
      const ps = posicoes(n, arranjo);
      expect(ps).toHaveLength(n);
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]!, b = ps[j]!;
        expect(Math.hypot(a.cx - b.cx, a.cy - b.cy) + Math.abs(a.z - b.z), `${arranjo} n=${n} ${i}×${j}`).toBeGreaterThanOrEqual(90);
      }
    }
    expect(posicoes(5, "cubo")[0]).toEqual({ cx: 0, cy: 0, z: 0 });   // o núcleo no meio
    expect(new Set(posicoes(4, "torre").map((p) => p.z)).size).toBe(2);   // duas por prateleira
  });
  it("o raio do centro pro anel nunca cai em cima de uma estação", () => {
    for (const arranjo of ["anel", "cubo"] as const) for (let n = 3; n <= 7; n++) {
      const a = anguloRaio(arranjo, n), est = posicoes(n, arranjo).filter((p) => p.cx || p.cy);
      for (const p of est) {
        const d = Math.abs(((Math.atan2(p.cy, p.cx) - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        expect(d, `${arranjo} n=${n}`).toBeGreaterThan(0.3);
      }
    }
  });
  it("a forma vem da Zaeon; sem ela, variada (nunca tudo igual); forma desconhecida não entra", () => {
    expect(formaDe({ forma: "tanque" }, 0)).toBe("tanque");
    expect(new Set([0, 1, 2, 3, 4].map((i) => formaDe({}, i))).size).toBe(5);
    expect(LISTA_FORMAS).toContain(formaDe({ forma: "foguete" }, 0));
  });
  it("todas as formas em todos os arranjos montam: peças torneadas, canos, itens com profundidade e vetor de saída", () => {
    for (const arranjo of LISTA_ARRANJOS) {
      const pecas = LISTA_FORMAS.slice(0, 6).map((f, i) => peca(`p${i}`, { forma: f, nome: `Peça <${i}>`, sub: "faz algo" }));
      const m = montarMaquina(doc({ pecas, arranjo }))!;
      expect(m.legenda.map((l) => l.forma)).toEqual(LISTA_FORMAS.slice(0, 6));
      expect(m.svg).toContain("iso-solid"); expect(m.svg).toContain('class="tb"'); expect(m.svg).toContain("iso-halo");
      expect(m.svg).not.toContain("Peça <");   // nomes não vão pro desenho
      expect(m.svg).not.toMatch(/NaN|undefined/);
      const chaves = [...m.svg.matchAll(/class="it" data-piece="([^"]+)" data-k="([-\d.]+)"/g)].map((x) => Number(x[2]));
      expect(chaves.length).toBeGreaterThan(30);
      expect([...chaves].sort((a, b) => a - b)).toEqual(chaves);   // já em ordem de pintor
      for (let i = 0; i < 6; i++) expect(m.svg).toContain(`data-piece="${i}" `);
      expect(m.movimentos).toHaveLength(6);
    }
    const resto = LISTA_FORMAS.slice(6).map((f, i) => peca(`q${i}`, { forma: f }));
    expect(montarMaquina(doc({ pecas: resto, arranjo: "linha" }))!.svg).not.toMatch(/NaN|undefined/);
  });
  it("sem peças, nada; a peça travada fica acesa em vermelho no pedestal", () => {
    expect(montarMaquina(doc())).toBeNull();
    const m = montarMaquina(doc({ pecas: [peca("a"), peca("b", { fase: 2 })], criticos: [{ id: "r", fase: 2, titulo: "t", prova: "p", tipoProva: "repo", pecaId: "b", abertoEm: 0, status: "aberto" }] }))!;
    expect(m.legenda.map((l) => l.estado)).toEqual(["ok", "trava"]);
    expect(m.svg).toContain('data-estado="trava"');
    expect(m.svg).toContain("mq-lampada-trava");
  });
});
