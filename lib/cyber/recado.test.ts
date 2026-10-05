import { describe, expect, it } from "vitest";
import { linhasDoRecado, tempoDoRecado } from "./recado";
import { aplicarOps, lerConteudo, sanitizarRecado } from "@/lib/lounge3d/sala";
import { MAX_TEXTO_RECADO } from "@/lib/lounge3d/tipos";

const medir = (s: string) => s.length;   // 1 "px" por letra

describe("recado pro QG", () => {
  it("quebra em linhas que cabem; palavra gigante é cortada; passou do teto → reticências", () => {
    expect(linhasDoRecado("reunião amanhã às dez horas", medir, 12, 5)).toEqual(["reunião", "amanhã às", "dez horas"]);
    expect(linhasDoRecado("a\nb", medir, 10, 5)).toEqual(["a", "b"]);
    expect(linhasDoRecado("supercalifragilistico", medir, 8, 5).every((l) => l.length <= 8)).toBe(true);
    const l = linhasDoRecado("um dois três quatro cinco seis sete oito", medir, 9, 2);
    expect(l).toHaveLength(2); expect(l[1]!.endsWith("…")).toBe(true); expect(l[1]!.length).toBeLessThanOrEqual(9);
  });
  it("há quanto tempo", () => {
    const t0 = 1_000_000_000;
    expect(tempoDoRecado(t0, t0 + 20_000)).toBe("agora");
    expect(tempoDoRecado(t0, t0 + 5 * 60_000)).toBe("há 5 min");
    expect(tempoDoRecado(t0, t0 + 3 * 3600_000)).toBe("há 3 h");
    expect(tempoDoRecado(t0, t0 + 86400_000)).toBe("há 1 dia");
    expect(tempoDoRecado(t0, t0 + 3 * 86400_000)).toBe("há 3 dias");
  });
  it("no conteúdo da sala: saneado (teto, cor, autor), lixo some, e editar notas NÃO apaga o recado", () => {
    const r = { id: "abc123", texto: "x".repeat(400), deId: "a".repeat(24), deNome: "Don", deCor: "#2f7bff", ts: 5 };
    expect(sanitizarRecado(r)!.texto).toHaveLength(MAX_TEXTO_RECADO);
    expect(sanitizarRecado({ ...r, deCor: "red" })!.deCor).toBe("#66e6ff");
    expect(sanitizarRecado({ ...r, deId: "eu" })).toBeNull();
    expect(sanitizarRecado({ ...r, texto: "  " })).toBeNull();
    const c = lerConteudo(JSON.stringify({ notes: [], artifacts: [], recadoQG: r }));
    expect(c.recadoQG?.deNome).toBe("Don");
    expect(lerConteudo(JSON.stringify({ notes: [], artifacts: [], recadoQG: "lixo" })).recadoQG).toBeUndefined();
    const depois = aplicarOps(c, { upsertNotes: [{ id: "n1", x: 0, z: 0, text: "nota" }] });
    expect(depois.notes).toHaveLength(1); expect(depois.recadoQG?.id).toBe("abc123");
  });
});
