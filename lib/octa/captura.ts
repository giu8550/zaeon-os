/**
 * lib/octa/captura.ts — captura de tela da página do projeto do aluno, no servidor (Chromium headless).
 *
 * O HTML é do aluno ou do modelo: NÃO confiável, e roda no nosso servidor de produção. Por isso:
 * - JavaScript desligado na página (`setJavaScriptEnabled(false)`): `<script>` não roda;
 * - rede em allowlist por interceptação: os arquivos do projeto são servidos de memória num host fictício
 *   (`http://projeto.octa.invalid/<caminho>`); fora isso, só GET https em fonts.googleapis.com,
 *   fonts.gstatic.com e images.unsplash.com (e nunca como documento). Todo o resto é abortado: outros hosts,
 *   IPs (metadata da nuvem, serviços do compose), `file:`, websockets, POST;
 * - segunda camada no DNS (`--host-resolver-rules`): qualquer host fora da allowlist não resolve, mesmo que
 *   algo escape da interceptação (prefetch, service worker…);
 * - sem navegação: o documento inicial é a única navegação de quadro principal permitida (meta refresh,
 *   `<a target>`, form → abortados); `data:`/`file:` no topo o próprio Chromium já recusa;
 * - contexto anônimo novo (createBrowserContext) por captura, fechado no fim; nenhum cookie/cache passa
 *   de um aluno pro outro;
 * - teto de tempo por captura (15 s padrão): estourou → o navegador inteiro é morto (renderer preso em
 *   layout gigante não segura o processo) e o próximo pedido abre outro;
 * - uma captura por vez por processo (fila); o navegador é reaproveitado e fechado após 60 s ocioso,
 *   pra não deixar ~150 MB parados na memória do `web`;
 * - DevTools por pipe (`pipe: true`), nunca porta TCP: outro processo da máquina não consegue se conectar.
 *
 * SANDBOX: no container (usuário não-root, sem user namespaces — o seccomp padrão do Docker bloqueia, e o
 * chromium do Debian não traz o chrome-sandbox setuid) o sandbox do Chromium não sobe. Decisão: lá roda com
 * `--no-sandbox`, ligado por env (OCTA_CHROMIUM_SEM_SANDBOX=1 no Dockerfile/CI), e SÓ porque as camadas
 * acima valem juntas (JS off + allowlist + sem navegação + sem file: + contexto novo + teto de tempo +
 * fechar tudo). Fora do container (dev no Mac) o sandbox fica ligado. Alternativas descartadas por ora:
 * `--cap-add SYS_ADMIN`/seccomp próprio no compose (abre o container inteiro, pior troca) e serviço de
 * captura em container separado (mais um serviço pra operar; fica pra quando a captura sair do `web`).
 *
 * `puppeteer-core` (Apache-2.0) é carregado por import dinâmico ESCONDIDO do webpack (mesmo truque de
 * secoes/render.ts e lib/queue): nunca entra no grafo do Next. Nenhum token/segredo passa por aqui.
 *
 * AUDIT (config/vetting/audit-baseline.json): puppeteer-core → @puppeteer/browsers traz basic-ftp e
 * extract-zip com advisories high. Caminhos que NÃO executamos: sempre passamos `executablePath`
 * (Chromium do sistema), nunca baixamos navegador (extract-zip), nunca usamos FTP nem proxy PAC (basic-ftp).
 * Se algum dia este arquivo passar a baixar navegador ou usar proxy, essa justificativa cai.
 */
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type ErroCaptura = "sem_index" | "chromium_ausente" | "tempo_esgotado" | "falha_render" | "projeto_grande" | "fila_cheia";
export type ResultadoCaptura =
  | {
    ok: true; jpegBase64: string; largura: number; altura: number;
    /** Só com `miniatura: true`: JPEG de 480 px de largura, ≤ MINIATURA_MAX_BYTES (ausente se não coube). */
    miniaturaBase64?: string;
  }
  | { ok: false; erro: ErroCaptura };
export type OpcoesCaptura = { largura?: number; altura?: number; timeoutMs?: number; miniatura?: boolean };

export const HOST_PROJETO = "projeto.octa.invalid";
const ORIGEM_PROJETO = `http://${HOST_PROJETO}`;
const URL_INICIAL = `${ORIGEM_PROJETO}/index.html`;
/** Hosts externos liberados (só https, só GET, nunca documento). */
export const HOSTS_LIBERADOS = ["fonts.googleapis.com", "fonts.gstatic.com", "images.unsplash.com"] as const;

const TIMEOUT_PADRAO_MS = 15_000;
const OCIOSO_MS = 60_000;
const QUALIDADE_JPEG = 70;
const LARGURA_MAX = 1600;
const VIEWPORT_PADRAO = { largura: 1280, altura: 800 };
/** Teto do texto somado dos arquivos do projeto: acima disso nem abre o navegador. */
export const MAX_BYTES_PROJETO = 2 * 1024 * 1024;
/** Mais que isto esperando na fila → `fila_cheia` na hora (em vez de esperar N × 15 s). */
export const MAX_NA_FILA = 3;
/** Miniatura pra IDE (evento `captura`): 480 px de largura, JPEG ≤ 60 KB. */
export const MINIATURA_LARGURA = 480;
export const MINIATURA_MAX_BYTES = 60 * 1024;

/** Onde procurar o binário quando OCTA_CHROMIUM_PATH não está definido (Debian/Ubuntu, runner do CI, Mac). */
const CAMINHOS_CONHECIDOS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

/** Caminho do Chromium: OCTA_CHROMIUM_PATH manda (se apontar pra nada, não há captura); senão o 1º conhecido. */
export function caminhoChromium(): string | null {
  const env = process.env.OCTA_CHROMIUM_PATH?.trim();
  if (env) return existsSync(env) ? env : null;
  return CAMINHOS_CONHECIDOS.find((c) => existsSync(c)) ?? null;
}

/** O caminho do Chromium existe (a captura pode rodar). */
export function capturaDisponivel(): boolean {
  return caminhoChromium() !== null;
}

// ─────────────────────────── arquivos e tipos ───────────────────────────

const TIPOS: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8", webmanifest: "application/manifest+json; charset=utf-8",
  svg: "image/svg+xml; charset=utf-8", xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif",
  ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
};

/** Content-Type pela extensão (desconhecida → octet-stream: o Chromium não renderiza como página). */
export function tipoPorExtensao(caminho: string): string {
  const ext = caminho.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  return TIPOS[ext] ?? "application/octet-stream";
}

/** Normaliza a chave do mapa de arquivos ("./a/b.css", "/a/b.css" → "a/b.css"). */
const normalizar = (c: string) => c.replace(/\\/g, "/").replace(/^(\.\/|\/)+/, "");

/** Caminho do arquivo do projeto pedido numa URL do host fictício ("/" e "pasta/" → index.html). */
function caminhoDaUrl(u: URL): string {
  let p: string;
  try { p = decodeURIComponent(u.pathname); } catch { p = u.pathname; }
  p = normalizar(p);
  if (p === "" || p.endsWith("/")) p += "index.html";
  return p;
}

// ─────────────────────────── decisão de rede ───────────────────────────

export type Decisao = "servir" | "liberar" | "bloquear";
export type PedidoRede = { url: string; metodo: string; tipo: string; navegacaoPrincipal: boolean; inicial: boolean };

/**
 * Regra pura da allowlist (testável sem Chromium):
 * - navegação de quadro principal: só a inicial, e só pro host do projeto;
 * - host do projeto (http): servido da memória, só GET;
 * - hosts liberados: só https + GET + não-documento;
 * - todo o resto: bloqueado.
 */
export function decidirPedido(p: PedidoRede): Decisao {
  let u: URL;
  try { u = new URL(p.url); } catch { return "bloquear"; }
  if (p.metodo !== "GET") return "bloquear";
  if (p.navegacaoPrincipal && !p.inicial) return "bloquear";
  if (u.protocol === "http:" && u.hostname === HOST_PROJETO && !u.port && !u.username && !u.password) return "servir";
  if (p.navegacaoPrincipal) return "bloquear";
  if (u.protocol === "https:" && !u.port && !u.username && (HOSTS_LIBERADOS as readonly string[]).includes(u.hostname) && p.tipo !== "document") {
    return "liberar";
  }
  return "bloquear";
}

// ─────────────────────────── navegador (um, preguiçoso) ───────────────────────────

type Pptr = { launch: (o: Record<string, unknown>) => Promise<any> };
let pptrCache: Promise<Pptr> | null = null;
function carregarPuppeteer(): Promise<Pptr> {
  return (pptrCache ??= (async () => {
    const spec = "puppeteer" + "-core";
    const mod = await import(/* webpackIgnore: true */ spec);
    return (mod.default?.launch ? mod.default : mod) as Pptr;
  })().catch((e) => { pptrCache = null; throw e; }));
}

let navegador: any | null = null;
let abrindo: Promise<any> | null = null;
let timerOcioso: ReturnType<typeof setTimeout> | null = null;
/** Há captura rodando (o fechamento por ócio só é agendado fora dela). */
let capturando = false;

function argsChromium(): string[] {
  const args = [
    "--disable-gpu",
    "--disable-dev-shm-usage", // /dev/shm do container é 64 MB
    "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-component-extensions-with-background-pages",
    "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-default-apps",
    "--disable-domain-reliability", "--disable-client-side-phishing-detection", "--metrics-recording-only",
    "--disable-features=Translate,MediaRouter,OptimizationHints,AutofillServerCommunication,InterestFeedContentSuggestions",
    "--mute-audio", "--hide-scrollbars", "--font-render-hinting=none",
    "--renderer-process-limit=1", // um renderer só: cabe no limite de memória do web/worker (compose)
    // 2ª camada: fora da allowlist nenhum host resolve (o host do projeto nem chega no DNS: é interceptado).
    `--host-resolver-rules=MAP * ~NOTFOUND, ${HOSTS_LIBERADOS.map((h) => `EXCLUDE ${h}`).join(", ")}`,
  ];
  // Ver o cabeçalho (SANDBOX): só no container, só junto com as demais camadas.
  if (process.env.OCTA_CHROMIUM_SEM_SANDBOX === "1") args.push("--no-sandbox");
  return args;
}

let homeChromium: string | null = null;
/**
 * Ambiente do processo do Chromium: SÓ isto. Sem `env`, o Puppeteer repassa o process.env inteiro do `web`
 * (DATABASE_URL, NEXTAUTH_SECRET, chaves de API…) e, sem sandbox, um bug no renderer poderia lê-lo.
 * HOME numa pasta temporária própria (nada do usuário do servidor).
 */
export const CHAVES_ENV_CHROMIUM = ["PATH", "HOME", "LANG", "TZ"] as const;
export function envChromium(): Record<(typeof CHAVES_ENV_CHROMIUM)[number], string> {
  homeChromium ??= mkdtempSync(join(tmpdir(), "octa-chromium-"));
  return { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: homeChromium, LANG: "C.UTF-8", TZ: "UTC" };
}

/** Opções de launch do Puppeteer (puras, testadas: ambiente mínimo, pipe, args). */
export function opcoesDeLancamento(caminho: string): Record<string, unknown> {
  return {
    executablePath: caminho,
    headless: true,
    pipe: true,
    args: argsChromium(),
    env: envChromium(),
    defaultViewport: null,
    handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
  };
}

async function obterNavegador(caminho: string): Promise<any> {
  if (navegador?.connected) return navegador;
  if (abrindo) return abrindo;
  abrindo = (async () => {
    const pptr = await carregarPuppeteer();
    const b = await pptr.launch(opcoesDeLancamento(caminho));
    b.on?.("disconnected", () => { if (navegador === b) navegador = null; });
    navegador = b;
    // Abriu depois de uma captura estourar o tempo (ninguém mais vai agendar): garante o fechamento por ócio.
    if (!capturando) agendarFechamento();
    return b;
  })().finally(() => { abrindo = null; });
  return abrindo;
}

type Matar = (pid: number, sinal: NodeJS.Signals) => unknown;
/**
 * Mata o Chromium e TODOS os filhos (renderer, GPU, utilitários). O Puppeteer o lança `detached`, então ele
 * lidera o próprio grupo de processos: `kill(-pid)` pega o grupo inteiro. Matar só o líder deixaria os filhos
 * órfãos pendurados no PID 1 do container (por isso o compose também liga `init: true`). Fallback: só o líder.
 */
export function matarProcesso(proc: { pid?: number; kill: (s: NodeJS.Signals) => unknown } | null | undefined, matar: Matar = process.kill) {
  if (!proc?.pid) return;
  try { matar(-proc.pid, "SIGKILL"); return; } catch { /* grupo já não existe (ESRCH) ou Windows */ }
  try { proc.kill("SIGKILL"); } catch { /* já morreu */ }
}

/** Fecha (e, se travar, mata) o navegador atual. */
async function derrubarNavegador(): Promise<void> {
  const b = navegador;
  navegador = null;
  if (!b) return;
  const proc = b.process?.();
  try {
    await Promise.race([b.close(), new Promise((r) => setTimeout(r, 3_000))]);
  } catch { /* segue pro kill */ }
  // mesmo com o líder já encerrado, filhos podem ter ficado no grupo
  matarProcesso(proc);
}

function agendarFechamento() {
  if (timerOcioso) clearTimeout(timerOcioso);
  timerOcioso = setTimeout(() => { timerOcioso = null; void derrubarNavegador(); }, OCIOSO_MS);
  timerOcioso.unref?.();
}

/** Fecha o navegador agora (testes e desligamento). */
export async function encerrarCaptura(): Promise<void> {
  if (timerOcioso) { clearTimeout(timerOcioso); timerOcioso = null; }
  await derrubarNavegador();
}

// ─────────────────────────── fila (uma captura por vez) ───────────────────────────

let fila: Promise<unknown> = Promise.resolve();
/** Pedidos que entraram na fila e ainda não começaram. */
let esperando = 0;
/** `null` = fila cheia (quem chamou devolve `fila_cheia` sem esperar). */
function naFila<T>(fn: () => Promise<T>): Promise<T> | null {
  if (esperando >= MAX_NA_FILA) return null;
  esperando++;
  const comecar = () => { esperando--; return fn(); };
  const r = fila.then(comecar, comecar);
  fila = r.catch(() => undefined);
  return r;
}

// ─────────────────────────── captura ───────────────────────────

/** O que a captura viu (só para testes: decisões de rede, URLs do topo e dos quadros, DOM; esperas antes da foto). */
export type Diagnostico = { pedidos: { url: string; decisao: Decisao }[]; urlFinal?: string; quadros?: string[]; html?: string;
  /** Espera fixa antes da foto. */
  esperaMs?: number;
  /** Espera (até 5 s) até isto ser verdade antes da foto. */
  esperarAte?: (d: Diagnostico) => boolean;
};

const limitar = (n: number | undefined, min: number, max: number, padrao: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n as number))) : padrao;

/**
 * Tira um JPEG (qualidade 70, até 1600 px de largura) da página `index.html` do projeto.
 * Erros viram códigos curtos; nunca lança.
 */
export function capturarPagina(arquivos: Record<string, string>, opts: OpcoesCaptura = {}): Promise<ResultadoCaptura> {
  return capturarComDiagnostico(arquivos, opts);
}

/** Igual a capturarPagina, preenchendo `diag` (usado nos testes de segurança). */
export async function capturarComDiagnostico(
  arquivos: Record<string, string>, opts: OpcoesCaptura = {}, diag?: Diagnostico,
): Promise<ResultadoCaptura> {
  const mapa = new Map<string, string>();
  for (const [k, v] of Object.entries(arquivos ?? {})) if (typeof v === "string") mapa.set(normalizar(k), v);
  if (!mapa.has("index.html")) return { ok: false, erro: "sem_index" };
  let bytes = 0;
  for (const v of mapa.values()) bytes += Buffer.byteLength(v, "utf8");
  if (bytes > MAX_BYTES_PROJETO) return { ok: false, erro: "projeto_grande" };
  const caminho = caminhoChromium();
  if (!caminho) return { ok: false, erro: "chromium_ausente" };

  const largura = limitar(opts.largura, 320, LARGURA_MAX, VIEWPORT_PADRAO.largura);
  const altura = limitar(opts.altura, 320, 4000, VIEWPORT_PADRAO.altura);
  const timeoutMs = limitar(opts.timeoutMs, 1, 60_000, TIMEOUT_PADRAO_MS);

  const naVez = naFila(async () => {
    if (timerOcioso) { clearTimeout(timerOcioso); timerOcioso = null; }
    capturando = true;
    let contexto: any = null;
    let estourou = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const teto = new Promise<"tempo">((r) => { timer = setTimeout(() => r("tempo"), timeoutMs); });

    const trabalho = (async (): Promise<ResultadoCaptura> => {
      const b = await obterNavegador(caminho);
      contexto = await b.createBrowserContext({ downloadBehavior: { policy: "deny" } });
      if (estourou) { await contexto.close().catch(() => undefined); return { ok: false, erro: "tempo_esgotado" }; }
      const page = await contexto.newPage();
      await page.setJavaScriptEnabled(false);
      await page.setViewport({ width: largura, height: altura, deviceScaleFactor: 1 });
      await page.setRequestInterception(true);
      let inicialFeita = false;
      page.on("request", (req: any) => {
        const url: string = req.url();
        const navegacaoPrincipal = req.isNavigationRequest() && req.frame() === page.mainFrame();
        const inicial = navegacaoPrincipal && !inicialFeita && url === URL_INICIAL;
        if (inicial) inicialFeita = true;
        const decisao = decidirPedido({ url, metodo: req.method(), tipo: req.resourceType(), navegacaoPrincipal, inicial });
        diag?.pedidos.push({ url, decisao });
        const responder = async () => {
          if (decisao === "liberar") return req.continue();
          // Navegação do topo barrada responde 204: o Chromium fica na página atual (abortar trocaria por
          // uma página de erro). Os demais pedidos barrados são abortados.
          if (decisao === "bloquear") return navegacaoPrincipal ? req.respond({ status: 204, body: "" }) : req.abort("blockedbyclient");
          const arq = caminhoDaUrl(new URL(url));
          const corpo = mapa.get(arq);
          if (corpo === undefined) return req.respond({ status: 404, contentType: "text/plain; charset=utf-8", body: "" });
          return req.respond({ status: 200, contentType: tipoPorExtensao(arq), body: corpo });
        };
        // pedido já tratado (página fechando) não pode derrubar o processo
        responder().catch(() => undefined);
      });

      try {
        await page.goto(URL_INICIAL, { waitUntil: "load", timeout: Math.max(500, timeoutMs - 1_500) });
      } catch (e: any) {
        // Fonte/imagem liberada lenta: tira a foto do que já carregou (o teto de tempo ainda vale).
        if (e?.name !== "TimeoutError") throw e;
      }
      if (diag?.esperaMs) await new Promise((r) => setTimeout(r, diag.esperaMs));
      if (diag?.esperarAte) {
        const limite = Date.now() + 5_000;
        while (!diag.esperarAte(diag) && Date.now() < limite && !estourou) await new Promise((r) => setTimeout(r, 50));
      }
      if (estourou) return { ok: false, erro: "tempo_esgotado" };
      const buf: Uint8Array = await page.screenshot({ type: "jpeg", quality: QUALIDADE_JPEG, fullPage: false });
      const miniaturaBase64 = opts.miniatura ? await tirarMiniatura(page, largura, altura) : undefined;
      if (diag) {
        diag.urlFinal = page.url();
        diag.quadros = page.frames().map((f: any) => f.url() as string);
        diag.html = await page.content().catch(() => undefined);
      }
      return { ok: true, jpegBase64: Buffer.from(buf).toString("base64"), largura, altura, ...(miniaturaBase64 ? { miniaturaBase64 } : {}) };
    })();

    try {
      const r = await Promise.race([trabalho, teto]);
      if (r === "tempo") {
        estourou = true;
        trabalho.catch(() => undefined);
        await derrubarNavegador(); // renderer preso não fecha por bem
        return { ok: false, erro: "tempo_esgotado" } as const;
      }
      return r;
    } catch {
      trabalho.catch(() => undefined);
      if (!navegador?.connected) await derrubarNavegador();
      return { ok: false, erro: "falha_render" } as const;
    } finally {
      capturando = false;
      if (timer) clearTimeout(timer);
      if (contexto && navegador?.connected) await contexto.close().catch(() => undefined);
      if (navegador) agendarFechamento();
    }
  });
  return naVez ?? { ok: false, erro: "fila_cheia" };
}

/**
 * Miniatura da mesma tela, sem 2º render: screenshot com `clip.scale` (o Chromium reduz) e qualidade caindo
 * até caber em MINIATURA_MAX_BYTES. Não coube nem na pior qualidade → sem miniatura (a captura vale igual).
 */
async function tirarMiniatura(page: any, largura: number, altura: number): Promise<string | undefined> {
  const scale = Math.min(1, MINIATURA_LARGURA / largura);
  for (const quality of [60, 40, 25]) {
    const buf: Uint8Array = await page.screenshot({ type: "jpeg", quality, clip: { x: 0, y: 0, width: largura, height: altura, scale } });
    if (buf.length <= MINIATURA_MAX_BYTES) return Buffer.from(buf).toString("base64");
  }
  return undefined;
}
