import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  CHAVES_ENV_CHROMIUM, MAX_BYTES_PROJETO, MINIATURA_MAX_BYTES, capturaDisponivel, capturarComDiagnostico, capturarPagina, decidirPedido, encerrarCaptura,
  matarProcesso, opcoesDeLancamento, tipoPorExtensao, type Diagnostico,
} from "./captura";

const CHROMIUM = capturaDisponivel();
const MOTIVO = "sem Chromium (defina OCTA_CHROMIUM_PATH) — testes de captura real pulados";
if (!CHROMIUM) console.warn(`[captura.test] ${MOTIVO}`);

const pagina = (corpo: string, head = "") =>
  `<!doctype html><html><head><meta charset="utf-8">${head}<style>body{margin:0;background:#fff;font:24px sans-serif}</style></head><body>${corpo}</body></html>`;

const novoDiag = (): Diagnostico => ({ pedidos: [] });

/** Largura × altura de um JPEG (marcador SOF0/SOF2). */
function dimensoesJpeg(b64: string): [number, number] {
  const b = Buffer.from(b64, "base64");
  for (let i = 2; i < b.length - 9;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xc0 || m === 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  return [0, 0];
}

describe("captura — sempre (sem navegador)", () => {
  const envOriginal = process.env.OCTA_CHROMIUM_PATH;
  afterEach(() => {
    if (envOriginal === undefined) delete process.env.OCTA_CHROMIUM_PATH;
    else process.env.OCTA_CHROMIUM_PATH = envOriginal;
  });

  it("sem index.html → sem_index", async () => {
    expect(await capturarPagina({ "styles.css": "body{}" })).toEqual({ ok: false, erro: "sem_index" });
    expect(await capturarPagina({})).toEqual({ ok: false, erro: "sem_index" });
  });

  it("sem binário → chromium_ausente", async () => {
    process.env.OCTA_CHROMIUM_PATH = "/caminho/que/nao/existe/chromium";
    expect(capturaDisponivel()).toBe(false);
    expect(await capturarPagina({ "index.html": pagina("oi") })).toEqual({ ok: false, erro: "chromium_ausente" });
  });

  it("Chromium recebe só o ambiente mínimo (nenhum segredo do process.env)", () => {
    process.env.SEGREDO_DE_TESTE = "nao-pode-vazar";
    try {
      const env = opcoesDeLancamento("/x/chromium").env as Record<string, string>;
      expect(Object.keys(env).sort()).toEqual([...CHAVES_ENV_CHROMIUM].sort());
      expect(Object.values(env)).not.toContain("nao-pode-vazar");
      expect(env.HOME).not.toBe(process.env.HOME);
      expect(opcoesDeLancamento("/x/chromium").pipe).toBe(true);
    } finally { delete process.env.SEGREDO_DE_TESTE; }
  });

  it("um processo de renderer só (cabe no limite de memória do container)", () => {
    expect(opcoesDeLancamento("/x/chromium").args).toContain("--renderer-process-limit=1");
  });

  it("matar o navegador mata o grupo de processos inteiro (pid negativo), com fallback no líder", () => {
    const matar = vi.fn();
    const proc = { pid: 4242, kill: vi.fn() };
    matarProcesso(proc, matar);
    expect(matar).toHaveBeenCalledWith(-4242, "SIGKILL");
    expect(proc.kill).not.toHaveBeenCalled();

    const falha = vi.fn(() => { throw Object.assign(new Error("ESRCH"), { code: "ESRCH" }); });
    matarProcesso(proc, falha);
    expect(proc.kill).toHaveBeenCalledWith("SIGKILL");

    expect(() => matarProcesso(null, matar)).not.toThrow();
  });

  it("projeto acima de 2 MB de texto → projeto_grande (nem abre o navegador)", async () => {
    const r = await capturarPagina({ "index.html": pagina("oi"), "grande.css": "a".repeat(MAX_BYTES_PROJETO) });
    expect(r).toEqual({ ok: false, erro: "projeto_grande" });
  });

  it("content-type pela extensão", () => {
    expect(tipoPorExtensao("index.html")).toMatch(/^text\/html/);
    expect(tipoPorExtensao("a/b/styles.CSS")).toMatch(/^text\/css/);
    expect(tipoPorExtensao("logo.svg")).toMatch(/^image\/svg\+xml/);
    expect(tipoPorExtensao("x.woff2")).toBe("font/woff2");
    expect(tipoPorExtensao("sem-extensao")).toBe("application/octet-stream");
  });

  it("allowlist de rede (regra pura)", () => {
    const p = (url: string, extra: Partial<Parameters<typeof decidirPedido>[0]> = {}) =>
      decidirPedido({ url, metodo: "GET", tipo: "image", navegacaoPrincipal: false, inicial: false, ...extra });
    expect(p("http://projeto.octa.invalid/index.html", { tipo: "document", navegacaoPrincipal: true, inicial: true })).toBe("servir");
    expect(p("http://projeto.octa.invalid/styles.css", { tipo: "stylesheet" })).toBe("servir");
    expect(p("https://fonts.googleapis.com/css2?family=Inter", { tipo: "stylesheet" })).toBe("liberar");
    expect(p("https://fonts.gstatic.com/s/inter/v1/a.woff2", { tipo: "font" })).toBe("liberar");
    expect(p("https://images.unsplash.com/photo-1")).toBe("liberar");
    // bloqueados
    expect(p("http://images.unsplash.com/photo-1")).toBe("bloquear"); // só https
    expect(p("https://images.unsplash.com.evil.example/x")).toBe("bloquear");
    expect(p("https://evil.example/x.png")).toBe("bloquear");
    expect(p("http://169.254.169.254/latest/meta-data/")).toBe("bloquear");
    expect(p("http://localhost:3000/api/x")).toBe("bloquear");
    expect(p("file:///etc/passwd")).toBe("bloquear");
    expect(p("ws://evil.example/s", { tipo: "websocket" })).toBe("bloquear");
    expect(p("https://images.unsplash.com/x", { metodo: "POST" })).toBe("bloquear");
    expect(p("https://images.unsplash.com/x", { tipo: "document" })).toBe("bloquear"); // iframe pra fora
    expect(p("http://projeto.octa.invalid:8080/x")).toBe("bloquear");
    // navegação de quadro principal além da inicial (meta refresh, link, form)
    expect(p("http://projeto.octa.invalid/outra.html", { tipo: "document", navegacaoPrincipal: true })).toBe("bloquear");
    expect(p("https://evil.example/", { tipo: "document", navegacaoPrincipal: true })).toBe("bloquear");
    expect(p("https://fonts.googleapis.com/", { tipo: "document", navegacaoPrincipal: true, inicial: true })).toBe("bloquear");
  });
});

describe.skipIf(!CHROMIUM)("captura — com Chromium", () => {
  afterAll(async () => { await encerrarCaptura(); });

  it("página simples → JPEG válido (> 1 KB) no tamanho pedido", async () => {
    const r = await capturarPagina({
      "index.html": pagina(`<h1>Olá, Octa</h1><link rel="stylesheet" href="css/estilo.css"><div class="caixa"></div>`),
      "css/estilo.css": ".caixa{width:400px;height:200px;background:linear-gradient(90deg,#f00,#00f)}",
    }, { largura: 390, altura: 844 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.jpegBase64.startsWith("/9j/")).toBe(true);
    expect(Buffer.from(r.jpegBase64, "base64").length).toBeGreaterThan(1024);
    expect([r.largura, r.altura]).toEqual([390, 844]);
  }, 30_000);

  it("CSS do projeto é servido pela interceptação com o content-type certo", async () => {
    const diag = novoDiag();
    const r = await capturarComDiagnostico({
      "index.html": pagina(`<p>x</p>`, `<link rel="stylesheet" href="/estilo.css">`),
      "estilo.css": "p{color:red}",
    }, {}, diag);
    expect(r.ok).toBe(true);
    expect(diag.pedidos).toContainEqual({ url: "http://projeto.octa.invalid/estilo.css", decisao: "servir" });
  }, 30_000);

  it("<script> não executa (o DOM fica o original)", async () => {
    const diag = novoDiag();
    const r = await capturarComDiagnostico({
      "index.html": pagina(`<p id="orig">ORIGINAL</p><script>document.body.innerHTML='X'</script>`),
    }, {}, diag);
    expect(r.ok).toBe(true);
    expect(diag.html).toContain("ORIGINAL");
  }, 30_000);

  it("<img> pra host de fora é abortada", async () => {
    const diag = novoDiag();
    const r = await capturarComDiagnostico({
      "index.html": pagina(`<img src="https://evil.example/x.png"><iframe src="https://evil.example/frame"></iframe>`),
    }, {}, diag);
    expect(r.ok).toBe(true);
    expect(diag.pedidos).toContainEqual({ url: "https://evil.example/x.png", decisao: "bloquear" });
    expect(diag.pedidos.filter((p) => p.url.includes("evil.example")).every((p) => p.decisao === "bloquear")).toBe(true);
  }, 30_000);

  it("<meta http-equiv=refresh> não navega", async () => {
    // espera o refresh disparar (o pedido pra evil aparecer), até 5 s — sem sono fixo
    const diag: Diagnostico = { pedidos: [], esperarAte: (d) => d.pedidos.some((p) => p.url.startsWith("https://evil.example")) };
    const r = await capturarComDiagnostico({
      "index.html": pagina(`<p>FICA</p>`, `<meta http-equiv="refresh" content="0;url=https://evil.example">`),
    }, {}, diag);
    expect(r.ok).toBe(true);
    expect(diag.urlFinal).toBe("http://projeto.octa.invalid/index.html");
    expect(diag.html).toContain("FICA");
    expect(diag.pedidos).toContainEqual({ url: "https://evil.example/", decisao: "bloquear" });
  }, 30_000);

  it("file:///etc/passwd não é lido", async () => {
    const diag: Diagnostico = { pedidos: [], esperaMs: 800 };
    const r = await capturarComDiagnostico({
      "index.html": pagina(
        `<img src="file:///etc/passwd"><iframe src="file:///etc/passwd"></iframe><link rel="stylesheet" href="file:///etc/passwd">`,
        `<meta http-equiv="refresh" content="0;url=file:///etc/passwd">`,
      ),
    }, {}, diag);
    expect(r.ok).toBe(true);
    expect(diag.urlFinal).toBe("http://projeto.octa.invalid/index.html");
    expect(diag.html ?? "").not.toContain("root:");
    // o Chromium já recusa file: vindo de página http (nem chega na interceptação); se chegar, é bloqueado
    expect(diag.pedidos.filter((p) => p.url.startsWith("file:")).every((p) => p.decisao === "bloquear")).toBe(true);
    expect(diag.quadros?.length).toBeGreaterThan(1); // o iframe existe…
    expect(diag.quadros?.some((u) => u.startsWith("file:"))).toBe(false); // …mas não abriu o arquivo
  }, 30_000);

  it("página pesada estourando o teto de 15 s → tempo_esgotado (ou falha_render), e a próxima captura funciona", async () => {
    const pesado = "<div style='filter:blur(30px) drop-shadow(0 0 40px red);box-shadow:0 0 80px #000'>".repeat(4000) + "x" + "</div>".repeat(4000);
    const r = await capturarPagina({ "index.html": pagina(pesado + "<p>z</p>".repeat(60000)) });
    expect(r.ok).toBe(false);
    // sob pressão de memória o renderer pode morrer antes do teto → falha_render; os dois são aceitáveis
    if (!r.ok) expect(["tempo_esgotado", "falha_render"]).toContain(r.erro);
    const depois = await capturarPagina({ "index.html": pagina("<h1>de novo</h1>") });
    expect(depois.ok).toBe(true);
  }, 60_000);

  it("miniatura: JPEG de 480 px de largura, ≤ 60 KB, junto da captura", async () => {
    const r = await capturarPagina({ "index.html": pagina(`<h1>Miniatura</h1><div style="height:600px;background:linear-gradient(#f80,#08f)"></div>`) }, { miniatura: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.miniaturaBase64?.startsWith("/9j/")).toBe(true);
    expect(Buffer.from(r.miniaturaBase64!, "base64").length).toBeLessThanOrEqual(MINIATURA_MAX_BYTES);
    expect(dimensoesJpeg(r.miniaturaBase64!)[0]).toBe(480);
    expect(dimensoesJpeg(r.jpegBase64)[0]).toBe(1280);
  }, 30_000);

  it("fila longa → fila_cheia na hora, sem esperar a vez", async () => {
    const rs = await Promise.all([1, 2, 3, 4, 5].map((i) => capturarPagina({ "index.html": pagina(`<h1>${i}</h1>`) })));
    expect(rs.filter((r) => !r.ok).map((r) => !r.ok && r.erro)).toEqual(["fila_cheia", "fila_cheia"]);
    expect(rs.filter((r) => r.ok)).toHaveLength(3);
  }, 60_000);

  it("capturas simultâneas entram na fila e todas terminam", async () => {
    const rs = await Promise.all([1, 2, 3].map((i) => capturarPagina({ "index.html": pagina(`<h1>${i}</h1>`) })));
    expect(rs.every((r) => r.ok)).toBe(true);
  }, 60_000);
});
