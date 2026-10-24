import { describe, it, expect } from "vitest";
import { chipPublico, diaSp, enviadosNoDia, estadoDoAdapter, fotoJpegValida, ordemDoRodizio, proximoInstanceId, PRIMEIRO_INSTANCE_ID } from "./chips";

const chip = (o: Partial<any> = {}) => ({ id: "c", papel: "zaeon", agentKey: null, ativo: true, estado: "conectado", limiteDia: 10, enviadosHoje: 0, diaContagem: "2026-10-24", ultimoEnvioEm: null, ...o });

describe("chips — puro", () => {
  it("dia do contador = Brasília (meia-noite de lá, não UTC)", () => {
    expect(diaSp(new Date("2026-10-25T02:30:00Z"))).toBe("2026-10-24");   // 23:30 em SP
    expect(diaSp(new Date("2026-10-25T03:30:00Z"))).toBe("2026-10-25");
  });
  it("ids numéricos do adapter começam em 900001 e não colidem", () => {
    expect(proximoInstanceId([])).toBe(PRIMEIRO_INSTANCE_ID);
    expect(proximoInstanceId([900001, 900007])).toBe(900008);
  });
  it("contador de outro dia não conta", () => {
    expect(enviadosNoDia({ enviadosHoje: 9, diaContagem: "2026-10-23" }, "2026-10-24")).toBe(0);
    expect(enviadosNoDia({ enviadosHoje: 9, diaContagem: "2026-10-24" }, "2026-10-24")).toBe(9);
  });
  it("RODÍZIO: só ativo+conectado+abaixo do teto, o que mandou há mais tempo primeiro", () => {
    const t = (h: number) => new Date(`2026-10-24T${String(h).padStart(2, "0")}:00:00Z`);
    const chips = [
      chip({ id: "recente", ultimoEnvioEm: t(12) }), chip({ id: "antigo", ultimoEnvioEm: t(8) }), chip({ id: "nunca" }),
      chip({ id: "lotado", enviadosHoje: 10 }), chip({ id: "off", ativo: false }), chip({ id: "caido", estado: "desconectado" }),
      chip({ id: "lotadoOntem", enviadosHoje: 10, diaContagem: "2026-10-23", ultimoEnvioEm: t(9) }),
    ];
    expect(ordemDoRodizio(chips as any, { papel: "zaeon", dia: "2026-10-24" }).map((c) => c.id)).toEqual(["nunca", "antigo", "lotadoOntem", "recente"]);
  });
  it("agente usa o chip DELE; sem chip próprio apto, cai nos da Zaeon", () => {
    const chips = [chip({ id: "z1" }), chip({ id: "nina", papel: "agente", agentKey: "nina" }), chip({ id: "teo", papel: "agente", agentKey: "teo", estado: "qr" })];
    expect(ordemDoRodizio(chips as any, { papel: "agente", agentKey: "nina", dia: "2026-10-24" }).map((c) => c.id)).toEqual(["nina"]);
    expect(ordemDoRodizio(chips as any, { papel: "agente", agentKey: "teo", dia: "2026-10-24" }).map((c) => c.id)).toEqual(["z1"]);
    expect(ordemDoRodizio(chips as any, { papel: "zaeon", dia: "2026-10-24" }).map((c) => c.id)).toEqual(["z1"]);
  });
  it("foto: só JPEG (data-URI ou base64), até 1,5 MB", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]).toString("base64");
    const ok = fotoJpegValida(`data:image/jpeg;base64,${jpeg}`);
    expect(ok.ok && ok.base64).toBe(jpeg);
    expect(fotoJpegValida(jpeg).ok).toBe(true);
    expect(fotoJpegValida(Buffer.from("\x89PNG").toString("base64")).ok).toBe(false);
    expect(fotoJpegValida(Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(1_600_000)]).toString("base64")).ok).toBe(false);
  });
  it("estado do adapter → estado do chip; o token da sessão nunca vai pro painel", () => {
    expect(estadoDoAdapter("open")).toBe("conectado");
    expect(estadoDoAdapter("connecting")).toBe("qr");
    expect(estadoDoAdapter("logged_out")).toBe("desconectado");
    expect("token" in chipPublico({ ...chip(), token: "segredo", instanceId: 1 } as any)).toBe(false);
  });
});
