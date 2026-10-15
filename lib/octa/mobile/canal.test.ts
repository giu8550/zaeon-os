import { describe, it, expect, vi } from "vitest";
import { runTool, type ToolDef } from "@/lib/agent/runtime";
import { gerarPar, iniciarHandshake, RegistroDispositivos, HostMobile, validarMsgCelular, type FonteDeTasks, type MsgHost } from "./canal";

function montar() {
  const hostChave = gerarPar();
  const reg = new RegistroDispositivos();
  const tasks: FonteDeTasks = {
    listar: async () => [{ id: "t1", titulo: "PR do P1", estado: "rodando", modo: "change" }],
    instruir: vi.fn(async () => {}),
    linkWorkspace: async (id) => (id === "t1" ? "/octa/ws/t1" : null),
  };
  const saida: Array<[string, Buffer]> = [];
  const host = new HostMobile(hostChave, reg, tasks, (c, p) => saida.push([c, p]));
  const celular = gerarPar();
  const dev = reg.parear(reg.novoCodigo(), celular.publica.toString("base64"), "Pixel do Martinez");
  const { hello, sessao } = iniciarHandshake(celular, hostChave.publica);
  const ok = host.aceitarHandshake("con1", hello);
  const ultima = () => sessao.abrir(saida[saida.length - 1][1]) as MsgHost;
  return { host, reg, tasks, saida, sessao, dev, ok, ultima, hostChave };
}

describe("octa · canal mobile (§4)", () => {
  it("pareia por código de uso único e conversa cifrado ponta a ponta", async () => {
    const m = montar();
    expect(m.ok).toBe(true);
    const pacote = m.sessao.selar({ t: "listar_tasks" });
    expect(pacote.toString("utf8")).not.toContain("listar_tasks"); // o relay só vê bytes cifrados
    await m.host.receber("con1", pacote);
    expect(m.ultima()).toEqual({ t: "tasks", tasks: [expect.objectContaining({ id: "t1" })] });
  });

  it("código de pareamento é de uso único", () => {
    const reg = new RegistroDispositivos();
    const c = reg.novoCodigo();
    reg.parear(c, gerarPar().publica.toString("base64"), "a");
    expect(() => reg.parear(c, gerarPar().publica.toString("base64"), "b")).toThrow(/inválido/);
  });

  it("dispositivo não pareado não fecha handshake", () => {
    const m = montar();
    const intruso = iniciarHandshake(gerarPar(), m.hostChave.publica);
    expect(m.host.aceitarHandshake("con2", intruso.hello)).toBe(false);
  });

  it("pacote adulterado e replay são descartados", async () => {
    const m = montar();
    const p = m.sessao.selar({ t: "listar_tasks" });
    const adulterado = Buffer.from(p); adulterado[adulterado.length - 1] ^= 1;
    await m.host.receber("con1", adulterado);
    expect(m.saida).toHaveLength(0);
    await m.host.receber("con1", p);
    await m.host.receber("con1", p); // replay
    expect(m.saida).toHaveLength(1);
  });

  it("não existe shell: tipo fora do protocolo é rejeitado", async () => {
    expect(validarMsgCelular({ t: "shell", cmd: "rm -rf /" })).toBeNull();
    const m = montar();
    await m.host.receber("con1", m.sessao.selar({ t: "shell", cmd: "ls" }));
    expect(m.ultima()).toEqual({ t: "erro", code: "mensagem_fora_do_protocolo" });
  });

  it("instrução com imagem chega na task", async () => {
    const m = montar();
    await m.host.receber("con1", m.sessao.selar({ t: "instrucao", taskId: "t1", texto: "use essa tela", imagem: { mime: "image/png", base64: "iVBORw0KGgo=" } }));
    expect(m.tasks.instruir).toHaveBeenCalledWith("t1", "use essa tela", { mime: "image/png", base64: "iVBORw0KGgo=" });
  });

  it("aprovar do celular libera a ação no host (via permit/runTool)", async () => {
    const m = montar();
    const destrutiva: ToolDef = { name: "git_push_force", runtime: "ts", risk: "destructive", minPlan: "free", schema: {} as any, run: async () => ({ ok: true, provenance: {} }) };
    const rodando = runTool(destrutiva, { branch: "x" }, { plan: "free" }, { approve: m.host.aprovador(5_000) });
    await new Promise((r) => setTimeout(r, 0));
    const pedido = m.ultima() as Extract<MsgHost, { t: "pedido_permissao" }>;
    expect(pedido).toMatchObject({ t: "pedido_permissao", tool: "git_push_force", risco: "destructive" });
    await m.host.receber("con1", m.sessao.selar({ t: "resposta_permissao", pedidoId: pedido.pedidoId, aprovado: true }));
    expect((await rodando).ok).toBe(true);
  });

  it("remover o dispositivo revoga a sessão: não aprova mais, e sem resposta = negado", async () => {
    vi.useFakeTimers();
    const m = montar();
    const def: ToolDef = { name: "rm", runtime: "ts", risk: "destructive", minPlan: "free", schema: {} as any, run: async () => ({ ok: true, provenance: {} }) };
    const p1 = runTool(def, {}, { plan: "free" }, { approve: m.host.aprovador(1_000) });
    await vi.advanceTimersByTimeAsync(1_001);
    expect((await p1).code).toBe("needs_approval"); // silêncio = NÃO
    m.reg.revogar(m.dev.id);
    const p2 = runTool(def, {}, { plan: "free" }, { approve: m.host.aprovador(1_000) });
    expect((await p2).code).toBe("needs_approval"); // sem dispositivo ativo: nega na hora
    await m.host.receber("con1", m.sessao.selar({ t: "listar_tasks" }));
    expect(m.saida).toHaveLength(1); // só o pedido do p1; o revogado não recebe mais nada
    vi.useRealTimers();
  });
});
