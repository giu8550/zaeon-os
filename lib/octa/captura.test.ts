import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  capturaDisponivel, capturarComDiagnostico, capturarPagina, decidirPedido, encerrarCaptura, tipoPorExtensao,
  type Diagnostico,
} from "./captura";

const CHROMIUM = capturaDisponivel();
const MOTIVO = "sem Chromium (defina OCTA_CHROMIUM_PATH) — testes de captura real pulados";
if (!CHROMIUM) console.warn(`[captura.test] ${MOTIVO}`);

const pagina = (corpo: string, head = "") =>
  `<!doctype html><html><head><meta charset="utf-8">${head}<style>body{margin:0;background:#fff;font:24px sans-serif}</style></head><body>${corpo}</body></html>`;

const novoDiag = (): Diagnostico => ({ pedidos: [] });

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
    const diag: Diagnostico = { pedidos: [], esperaMs: 800 };
    const r = await capturarComDiagnostico({
      "index.html": pagina(`<p>FICA</p>`, `<meta http-equiv="refresh" content="0;url=https://evil.example">`),
    }, {}, diag);
    expect(r.ok).toBe(true);
    // dá tempo do refresh disparar e conferir que a página continua a do projeto
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

  it("página pesada estourando o teto de 15 s → tempo_esgotado, e a próxima captura funciona", async () => {
    const pesado = "<div style='filter:blur(30px) drop-shadow(0 0 40px red);box-shadow:0 0 80px #000'>".repeat(4000) + "x" + "</div>".repeat(4000);
    const r = await capturarPagina({ "index.html": pagina(pesado + "<p>z</p>".repeat(60000)) });
    expect(r).toEqual({ ok: false, erro: "tempo_esgotado" });
    const depois = await capturarPagina({ "index.html": pagina("<h1>de novo</h1>") });
    expect(depois.ok).toBe(true);
  }, 60_000);

  it("capturas simultâneas entram na fila e todas terminam", async () => {
    const rs = await Promise.all([1, 2, 3].map((i) => capturarPagina({ "index.html": pagina(`<h1>${i}</h1>`) })));
    expect(rs.every((r) => r.ok)).toBe(true);
  }, 60_000);
});
