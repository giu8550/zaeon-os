import { describe, expect, it } from "vitest";
import { ARQ_RE, MAX_FAIXAS, adicionarFaixa, controlar, nomeDoArquivo, posicaoAgora, removerFaixa, sanitizarSom, somVazio, tempo, type Faixa, type SomLounge } from "./musica";
import { aplicarOps, lerConteudo } from "./sala";

const f = (k: number, dur: number): Faixa => ({ id: `faixa${k}aa`, nome: `Música ${k}`, arq: `lm_${String(k).padStart(20, "0")}.mp3`, dur, deId: "dono" });
const T0 = 1_000_000;
const lista = (...durs: number[]): SomLounge => durs.reduce((s, d, k) => adicionarFaixa(s, f(k, d), T0), somVazio());

describe("toca-discos do lounge: a música sincronizada", () => {
  it("a 1ª música enviada já começa a tocar; as próximas entram no fim", () => {
    const s = lista(100, 200);
    expect(s.estado).toEqual({ i: 0, tocando: true, desde: T0, pos: 0 });
    expect(s.faixas.map((x) => x.nome)).toEqual(["Música 0", "Música 1"]);
  });
  it("todo mundo calcula o MESMO ponto: troca de faixa quando uma acaba e a playlist dá a volta", () => {
    const s = lista(100, 200);
    expect(posicaoAgora(s, T0 + 30_000)).toEqual({ i: 0, t: 30 });
    expect(posicaoAgora(s, T0 + 130_000)).toEqual({ i: 1, t: 30 });
    expect(posicaoAgora(s, T0 + 310_000)).toEqual({ i: 0, t: 10 });   // 300 s de ciclo → volta pro começo
    expect(posicaoAgora(somVazio(), T0)).toBeNull();
  });
  it("pausar guarda o ponto; tocar continua dali; parar volta pro começo da faixa", () => {
    let s = lista(100, 200);
    s = controlar(s, "pausar", T0 + 130_000);
    expect(s.estado).toMatchObject({ i: 1, tocando: false, pos: 30 });
    expect(posicaoAgora(s, T0 + 999_000)).toEqual({ i: 1, t: 30 });   // pausado não anda
    s = controlar(s, "tocar", T0 + 500_000);
    expect(posicaoAgora(s, T0 + 505_000)).toEqual({ i: 1, t: 35 });
    s = controlar(s, "parar", T0 + 510_000);
    expect(s.estado).toMatchObject({ i: 1, tocando: false, pos: 0 });
  });
  it("próxima / anterior (anterior no meio da faixa volta pro começo dela) / ir pra uma faixa", () => {
    let s = lista(100, 200, 50);
    s = controlar(s, "proxima", T0 + 10_000); expect(posicaoAgora(s, T0 + 10_000)).toEqual({ i: 1, t: 0 });
    s = controlar(s, "anterior", T0 + 20_000); expect(posicaoAgora(s, T0 + 20_000)).toEqual({ i: 1, t: 0 });   // já tocou 10 s → começo da mesma
    s = controlar(s, "anterior", T0 + 21_000); expect(posicaoAgora(s, T0 + 21_000)).toEqual({ i: 0, t: 0 });   // logo no início → a anterior
    s = controlar(s, "anterior", T0 + 21_500); expect(posicaoAgora(s, T0 + 21_500)!.i).toBe(2);              // dá a volta
    s = controlar(s, "ir", T0 + 30_000, 1); expect(s.estado).toMatchObject({ i: 1, tocando: true });
    expect(controlar(s, "ir", T0, 9)).toBe(s);   // faixa que não existe: nada muda
    const pausado = controlar(s, "pausar", T0 + 31_000); expect(controlar(pausado, "proxima", T0 + 40_000).estado.tocando).toBe(false);   // pular pausado segue pausado
  });
  it("tirar uma faixa: a atual segue (índice acerta); tirar a que toca passa pra próxima; tirar todas zera", () => {
    let s = controlar(lista(100, 200, 50), "ir", T0, 2);
    s = removerFaixa(s, f(0, 100).id, T0 + 10_000);
    expect(s.faixas).toHaveLength(2); expect(posicaoAgora(s, T0 + 10_000)).toEqual({ i: 1, t: 10 });
    s = removerFaixa(s, f(2, 50).id, T0 + 12_000);
    expect(posicaoAgora(s, T0 + 12_000)).toEqual({ i: 0, t: 0 });
    expect(removerFaixa(s, f(1, 200).id, T0)).toEqual(somVazio());
  });
  it("teto da playlist", () => {
    let s = somVazio(); for (let k = 0; k < MAX_FAIXAS + 5; k++) s = adicionarFaixa(s, f(k, 60), T0);
    expect(s.faixas).toHaveLength(MAX_FAIXAS);
  });
  it("sanitiza: arquivo só no formato do servidor (nada de caminho), nome limpo, índice no intervalo", () => {
    expect(ARQ_RE.test("lm_0123456789abcdef0123.mp3")).toBe(true);
    for (const ruim of ["../../etc/passwd", "lm_xyz.mp3", "lm_0123456789abcdef0123.exe", "aulavoice_ab.webm"]) expect(ARQ_RE.test(ruim)).toBe(false);
    const s = sanitizarSom({ faixas: [{ ...f(1, 10), nome: "a\u0000b" }, { id: "x", arq: "../x" }], estado: { i: 99, tocando: true, desde: T0, pos: -5 } })!;
    expect(s.faixas).toHaveLength(1); expect(s.faixas[0]!.nome).toBe("a b");
    expect(s.estado.i).toBe(0); expect(s.estado.pos).toBe(0);
    expect(sanitizarSom("lixo")).toBeNull();
  });
  it("utilidades: tempo e nome a partir do arquivo", () => {
    expect(tempo(187.9)).toBe("3:07"); expect(tempo(5)).toBe("0:05");
    expect(nomeDoArquivo("01_Minha_Música.mp3")).toBe("01 Minha Música");
  });
});

describe("a playlist no conteúdo da sala", () => {
  it("lerConteudo guarda a playlist; editar notas NÃO apaga ela (nem o recado)", () => {
    const som = lista(100);
    const c = lerConteudo(JSON.stringify({ notes: [], artifacts: [], somLounge: som, recadoQG: { id: "r1", texto: "oi", deId: "d", deNome: "Dono", deCor: "#ffffff", ts: 1 } }));
    expect(c.somLounge?.faixas).toHaveLength(1);
    const depois = aplicarOps(c, { upsertNotes: [] });
    expect(depois.somLounge).toEqual(c.somLounge); expect(depois.recadoQG).toEqual(c.recadoQG);
    expect(lerConteudo(JSON.stringify({ notes: [], artifacts: [], somLounge: somVazio() })).somLounge).toBeUndefined();   // lista vazia = sem playlist
  });
});
