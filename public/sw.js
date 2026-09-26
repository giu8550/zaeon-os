/*
 * Service worker da Zaeon — escrito à mão de propósito (sem Serwist/Workbox).
 *
 * O que ele faz, e SÓ isso:
 *   - navegação ............ network-first; sem rede, devolve a /offline
 *   - /_next/static/* ...... cache-first (nome com hash = imutável)
 *   - /icons /assets /sponsors ... stale-while-revalidate
 *   - todo o resto ......... não toca (API, _next/data, RSC, POST, outra origem)
 *
 * O que ele NÃO faz, e por quê:
 *   - precache do build: a Zaeon faz deploy no push pra main; um precache
 *     prenderia quem já tem o SW num build velho.
 *   - cache de HTML de página: página pode ser autenticada (NextAuth); servir
 *     a de uma sessão pra outra pessoa no mesmo aparelho é vazamento.
 *
 * Trocar VERSAO descarta todos os caches antigos no próximo activate.
 */
const VERSAO = "zaeon-v1";
const CACHE_ESTATICO = `${VERSAO}-estatico`;
const CACHE_MIDIA = `${VERSAO}-midia`;
const CACHE_PAGINAS = `${VERSAO}-paginas`;
const OFFLINE = "/offline";

// Cada deploy gera chunks com hash novo e os velhos nunca mais são pedidos.
// Sem teto, o cache estático cresceria para sempre dentro da mesma VERSAO.
const TETO_ESTATICO = 300;
const TETO_MIDIA = 150;

// ── INTERRUPTOR DE EMERGÊNCIA ───────────────────────────────────────────
// Trocar para true, fazer deploy, e todo SW instalado se desinstala sozinho
// e apaga os próprios caches. É o "desfazer" deste service worker.
// Exercitado antes do merge (ver descrição da PR).
const DESLIGAR = false;

self.addEventListener("install", (e) => {
    // skipWaiting vale também com DESLIGAR: sem ele a versão desligada fica
    // "waiting" atrás da antiga até a pessoa fechar TODAS as abas — e um F5
    // não basta. O interruptor precisa assumir na hora.
    self.skipWaiting();
    if (DESLIGAR) return;
    e.waitUntil(guardarOffline());
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        (async () => {
            if (DESLIGAR) {
                const nomes = await caches.keys();
                await Promise.all(nomes.map((n) => caches.delete(n)));
                await self.registration.unregister();
                // Só abas CONTROLADAS (o padrão do matchAll) — ou seja, as que o
                // SW antigo servia. Enquanto DESLIGAR estiver no ar, a página
                // continua registrando o /sw.js e ele se autodestrói de novo;
                // uma aba recém-aberta não é controlada, então não é recarregada
                // e não existe loop. Não troque por includeUncontrolled: true.
                const abas = await self.clients.matchAll({ type: "window" });
                abas.forEach((aba) => aba.navigate(aba.url));
                return;
            }
            // some com cache de versão anterior
            const nomes = await caches.keys();
            await Promise.all(
                nomes.filter((n) => !n.startsWith(VERSAO)).map((n) => caches.delete(n))
            );
            await self.clients.claim();
        })()
    );
});

self.addEventListener("fetch", (e) => {
    if (DESLIGAR) return; // handler existe mas não intercepta
    const req = e.request;
    if (req.method !== "GET") return;

    if (req.mode === "navigate") {
        e.respondWith(navegar(req));
        return;
    }

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (req.headers.has("authorization")) return;

    if (url.pathname.startsWith("/_next/static/")) {
        e.respondWith(cacheFirst(req));
        return;
    }
    if (/^\/(icons|assets|sponsors)\//.test(url.pathname)) {
        e.respondWith(staleWhileRevalidate(req, e));
    }
    // qualquer outra coisa: o navegador segue sozinho, sem o SW no meio
});

// Navegação: a rede sempre vence. O cache só entra quando a rede FALHA —
// um 500 do servidor continua sendo mostrado como 500, não como "offline".
async function navegar(req) {
    try {
        return await fetch(req);
    } catch {
        const offline = await caches.match(OFFLINE, { cacheName: CACHE_PAGINAS });
        return offline || Response.error();
    }
}

async function cacheFirst(req) {
    // caches.match (e não cache.match) porque os chunks da /offline moram
    // no CACHE_PAGINAS, fora do teto do estático.
    const guardado = await caches.match(req);
    if (guardado) return guardado;
    const resp = await fetch(req);
    if (cacheavel(resp)) guardar(CACHE_ESTATICO, req, resp.clone(), TETO_ESTATICO);
    return resp;
}

async function staleWhileRevalidate(req, e) {
    const cache = await caches.open(CACHE_MIDIA);
    const guardado = await cache.match(req);
    const daRede = fetch(req).then((resp) => {
        if (cacheavel(resp)) return guardar(CACHE_MIDIA, req, resp.clone(), TETO_MIDIA).then(() => resp);
        return resp;
    });
    if (guardado) {
        e.waitUntil(daRede.catch(() => {}));
        return guardado;
    }
    return daRede;
}

function cacheavel(resp) {
    if (!resp || resp.status !== 200 || resp.type === "opaque") return false;
    const cc = resp.headers.get("cache-control") || "";
    return !/no-store|private/i.test(cc);
}

async function guardar(nome, req, resp, teto) {
    const cache = await caches.open(nome);
    await cache.put(req, resp);
    // keys() volta em ordem de inserção: corta os mais antigos
    const chaves = await cache.keys();
    for (let i = 0; i < chaves.length - teto; i++) await cache.delete(chaves[i]);
}

// A /offline é renderizada dentro do layout raiz, então depende do CSS e dos
// chunks do build em que foi gerada. Guarda a página E esses arquivos juntos
// no mesmo cache: a cópia offline fica coerente consigo mesma mesmo depois de
// deploys novos (os arquivos têm hash, não existe "versão velha" deles).
// Isto NÃO é precache do build: é só a árvore de dependências de uma página.
async function guardarOffline() {
    const cache = await caches.open(CACHE_PAGINAS);
    const resp = await fetch(OFFLINE, { cache: "reload" });
    if (!resp.ok) throw new Error(`offline: ${resp.status}`);
    const html = await resp.clone().text();
    await cache.put(OFFLINE, resp);
    const arquivos = new Set(html.match(/\/_next\/static\/[^"'\s)\\<>]+/g) || []);
    // allSettled: um chunk que falhar não pode impedir a instalação
    await Promise.allSettled([...arquivos].map((a) => cache.add(a)));
}
