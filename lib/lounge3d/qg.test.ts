import { describe, expect, it } from "vitest";
import { ehDonoDoQG } from "./qg";

describe("dono do QG (Andrei Bacelar)", () => {
  it("sem a env: Andrei/Andrey + Bacelar no nome, sem acento/maiúscula/espaços extras", () => {
    expect(ehDonoDoQG({ name: "Andrei Bacelar" }, "")).toBe(true);
    expect(ehDonoDoQG({ name: "  ANDRÉI   bacelar " }, "")).toBe(true);
    expect(ehDonoDoQG({ name: "Andrey Souza Bacelar" }, "")).toBe(true);
    expect(ehDonoDoQG({ name: "Andrei Bacelar Filho" }, "")).toBe(true);
    expect(ehDonoDoQG({ name: "Andrei" }, "")).toBe(false);
    expect(ehDonoDoQG({ name: "Maria Bacelar" }, "")).toBe(false);
    expect(ehDonoDoQG({ name: "Andreia Bacelar" }, "")).toBe(false);
    expect(ehDonoDoQG({ name: null }, undefined)).toBe(false);
  });
  it("com CYBER_QG_EMAILS: só o e-mail vale (o nome não basta)", () => {
    expect(ehDonoDoQG({ email: "Andrei@X.com", name: "qualquer" }, "andrei@x.com, outro@y.com")).toBe(true);
    expect(ehDonoDoQG({ email: "z@x.com", name: "Andrei Bacelar" }, "andrei@x.com")).toBe(false);
  });
});
