import { describe, it, expect } from "vitest";
import { ehAdminDoMapa } from "./adminMapa";

describe("admin do mapa", () => {
  it("só o dono (sem diferença de caixa/espaços); os outros super admins não", () => {
    expect(ehAdminDoMapa(" DonMartinezCaiuDoCeu@gmail.com ")).toBe(true);
    expect(ehAdminDoMapa("zaeondao@gmail.com")).toBe(false);
    expect(ehAdminDoMapa("martinez@zaeon.space")).toBe(false);
    expect(ehAdminDoMapa(null)).toBe(false);
  });
});
