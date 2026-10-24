import { describe, it, expect } from "vitest";
import { extrairCampoParcial, previaDoRascunho } from "./previa";
import { previaDoTurno, separarProgresso, serializarPrevia, serializarProgresso, faseCorrente } from "./progresso";

describe("prévia do rascunho (JSON incompleto → texto)", () => {
  it("extrai o nucleo enquanto ele é escrito, desescapando", () => {
    expect(extrairCampoParcial('{"nucleo": "A mitose divide', "nucleo")).toBe("A mitose divide");
    expect(extrairCampoParcial('{"nucleo":"linha 1\\nlinha \\"2\\"', "nucleo")).toBe('linha 1\nlinha "2"');
    expect(extrairCampoParcial('{"nucleo":"caf\\u00e9', "nucleo")).toBe("café");
  });
  it("escape ou \\u partido no fim do pedaço espera o próximo (sem lixo)", () => {
    expect(extrairCampoParcial('{"nucleo":"abc\\', "nucleo")).toBe("abc");
    expect(extrairCampoParcial('{"nucleo":"abc\\u00', "nucleo")).toBe("abc");
  });
  it("antes da chave aparecer: vazio; depois que fecha: o valor inteiro", () => {
    expect(extrairCampoParcial('{"conceitos":["x"],', "nucleo")).toBe("");
    expect(extrairCampoParcial('{"nucleo":"pronto","x":1}', "nucleo")).toBe("pronto");
  });
  it("com o nucleo fechado, a prévia segue no desenvolvimento", () => {
    expect(previaDoRascunho('{"nucleo":"Curto.","desenvolvimento":"Mais det')).toBe("Curto.\n\nMais det");
    expect(previaDoRascunho('{"nucleo":"Ainda escrev')).toBe("Ainda escrev");
  });
});

describe("eventos de prévia no canal de progresso", () => {
  it("os pedaços se concatenam com os espaços intactos e não viram fase", () => {
    const fio = serializarProgresso({ fase: "draft", rotulo: "Redigindo" }) + serializarPrevia("A mitose ") + serializarPrevia("divide") + serializarPrevia(" a célula\n");
    const { limpo, eventos } = separarProgresso(fio);
    expect(limpo).toBe("");
    expect(previaDoTurno(eventos)).toBe("A mitose divide a célula\n");
    expect(faseCorrente(eventos)?.rotulo).toBe("Redigindo");
  });
});

import { criarEmissorPrevia } from "./previa";
describe("emissor da prévia", () => {
  it("manda só o trecho novo, respeita o intervalo e ignora reescrita", () => {
    let t = 0; const saiu: string[] = [];
    const emitir = criarEmissorPrevia((p) => saiu.push(p), 120, () => t);
    emitir("A mi"); t = 50; emitir("A mito"); t = 130; emitir("A mitose divide");
    t = 300; emitir("Outro texto");          // revisão que não continua: fica de fora
    t = 450; emitir("A mitose divide a célula");
    expect(saiu).toEqual(["A mi", "tose divide", " a célula"]);
  });
});
