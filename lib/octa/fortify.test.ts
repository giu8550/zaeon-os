import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fortificar, ExecutorContainer, type ContratoAlvo, type JuizFortificacao } from "./fortify";

async function ws() {
  const d = await mkdtemp(join(tmpdir(), "octa-fort-"));
  await mkdir(join(d, "avaliador"));
  await writeFile(join(d, "avaliador", "esperado.txt"), "42");
  return d;
}
const node = (code: string) => [process.execPath, "-e", code];
const contrato = (over: Partial<ContratoAlvo> = {}): ContratoAlvo => ({
  alvo: "demo",
  correcao: [{ nome: "testes", argv: node("process.exit(0)") }],
  benchmark: { nome: "bench", argv: node("let s=0;for(let i=0;i<1e5;i++)s+=i"), limiteMs: 10_000 },
  inputsSomenteLeitura: ["avaliador"],
  ...over,
});

describe("octa · fortificação (§6)", () => {
  it("candidato bom → juiz PASS → resultado oficial gravado, com benchmark", async () => {
    const d = await ws();
    const r = await fortificar(d, contrato(), { runId: "r1" });
    expect(r.veredito.pass).toBe(true);
    expect(r.registro.benchmark?.codigo).toBe(0);
    expect(r.oficial).toBe(join(d, ".octa", "oficial", "r1.json"));
    expect(JSON.parse(await readFile(r.oficial!, "utf8")).veredito.pass).toBe(true);
  });

  it("teste quebrado NUNCA vira oficial e nem roda benchmark", async () => {
    const d = await ws();
    const r = await fortificar(d, contrato({ correcao: [{ nome: "testes", argv: node("process.exit(3)") }] }), { runId: "r2" });
    expect(r.veredito).toMatchObject({ pass: false });
    expect(r.registro.benchmark).toBeUndefined();
    expect(r.oficial).toBeNull();
    expect(existsSync(join(d, ".octa", "oficial", "r2.json"))).toBe(false);
  });

  it("candidato que adultera o input do avaliador é reprovado por integridade", async () => {
    const d = await ws();
    const trapaca = node(`require("fs").writeFileSync("avaliador/esperado.txt","0")`);
    const r = await fortificar(d, contrato({ correcao: [{ nome: "testes", argv: trapaca }] }));
    expect(r.registro.integridade.ok).toBe(false);
    expect(r.veredito.motivo).toMatch(/integridade/);
    expect(r.oficial).toBeNull();
  });

  it("benchmark acima do limite reprova", async () => {
    const d = await ws();
    const r = await fortificar(d, contrato({ benchmark: { nome: "b", argv: node("const t=Date.now();while(Date.now()-t<60);"), limiteMs: 1 } }));
    expect(r.veredito.motivo).toMatch(/benchmark/);
  });

  it("juiz read-only: tentar editar o registro falha e reprova", async () => {
    const d = await ws();
    const malandro: JuizFortificacao = (reg) => { (reg as any).integridade.ok = true; return { pass: true, motivo: "" }; };
    const r = await fortificar(d, contrato(), { juiz: malandro });
    expect(r.veredito.pass).toBe(false);
    expect(r.oficial).toBeNull();
  });

  it("executor de contêiner: sem rede, workspace rw, inputs :ro", () => {
    const argv = new ExecutorContainer("node:24-slim", ["avaliador"]).argvDocker({ nome: "t", argv: ["npm", "test"] }, "/ws");
    expect(argv).toEqual(expect.arrayContaining(["--network", "none", "/ws:/work:rw", "/ws/avaliador:/work/avaliador:ro"]));
    expect(argv.slice(-2)).toEqual(["npm", "test"]);
  });
});
