# PR — Service Worker da Zaeon

**Para um agente executar.** Autocontido: tudo que precisa saber sobre o estado
atual está aqui. Leia a seção "Não faça" antes de escrever a primeira linha.

---

## 0. Por que isto existe, e o que já está pronto

A landing já é um PWA **instalável**. O que foi ao ar na PR #146:

- `app/manifest.ts` → servido em `/manifest.webmanifest`
- `public/icons/` → `icon-192`, `icon-512`, `maskable-192`, `maskable-512`,
  `apple-touch-icon` (180, opaco)
- `viewport-fit=cover` + `env(safe-area-inset-*)` na navbar, no body e nas calhas
- `apple-mobile-web-app-capable`, title e `black-translucent`
- `<html lang="pt-BR">`

**O que falta e o que isso realmente compra.** Uma correção importante, porque
muda a urgência: o Chrome **removeu** a exigência de service worker para o item
"Instalar app" do menu — versão 108 no mobile, 112 no desktop. Hoje, com o que já
está no ar, um usuário Android **já consegue instalar a Zaeon** pelo menu do
Chrome. O que ainda exige um service worker com handler de `fetch` é o **prompt
automático** de instalação (o que aparece sozinho). No iOS, "Adicionar à Tela de
Início" nunca precisou de service worker.

Ou seja: este PR compra (a) o prompt proativo no Android e (b) offline de
verdade. Não compra "poder instalar" — isso já existe.

---

## 1. Não faça (leia antes de tudo)

Estas não são preferências de estilo. Cada uma corresponde a uma forma concreta
de quebrar a Zaeon em produção, e é difícil de desfazer depois que o service
worker está no navegador das pessoas.

1. **Não faça precache do build.** Nada de `workbox-precaching`, nada de
   `self.__SW_MANIFEST`. A Zaeon faz deploy no push pra `main` (`deploy.yml` →
   VPS); um precache do manifest de build serve a versão antiga para quem já
   tem o SW instalado, e a pessoa fica presa num build velho sem entender por quê.

2. **Não cacheie HTML/navegação com cache-first.** Navegação é sempre
   network-first. O cache de HTML existe SÓ como resposta a uma falha de rede.

3. **Não cacheie nada autenticado.** A Zaeon tem NextAuth e cadastro por
   convite. `/api/*`, `/_next/data/*`, qualquer coisa com `Authorization` ou
   cookie de sessão fica FORA do cache. Servir a resposta cacheada de uma sessão
   para outra pessoa no mesmo aparelho é vazamento de dados, não bug de
   performance.

4. **Não cacheie métodos != GET**, nem respostas com `status != 200`, nem
   `response.type === "opaque"`.

5. **Não registre o SW em desenvolvimento.** Só em produção. Um SW no `next dev`
   serve chunk velho e faz você caçar um bug que não existe.

6. **Não mexa em `PARTICLE_COUNT`, `star-background.tsx` nem
   `ParticleSystem.tsx`.** Existe um trabalho separado de performance mobile em
   cima desses arquivos; os dois PRs vão colidir.

---

## 2. O que construir

### 2.1 Decisão: SW escrito à mão, não Serwist

O [Serwist](https://github.com/serwist/serwist) é o sucessor mantido do
`next-pwa` e é o que a [documentação do Next](https://nextjs.org/docs/app/guides/progressive-web-apps)
aponta para offline completo. **Mesmo assim, aqui escreva à mão.** Motivos
concretos, não preferência:

- O ganho do Serwist é o precache do build — que é exatamente o item 1 do "Não
  faça" neste projeto.
- O escopo aqui cabe em ~80 linhas. Uma dependência de build a mais num projeto
  que já tem Prisma, NextAuth, i18n e servidor custom tem custo real.
- O `next.config.mjs` é limpo hoje (sem `headers()`, sem plugins). Manter assim
  facilita o próximo que abrir o arquivo.

Se um dia o objetivo virar "app offline de verdade, com rotas navegáveis sem
rede", aí sim troque por Serwist — e nesse dia reavalie o item 1.

### 2.2 Arquivos

```
public/sw.js                       (novo)  — o service worker
components/pwa/RegistrarSW.tsx     (novo)  — registra, só em produção
app/offline/page.tsx               (novo)  — página de fallback offline
next.config.mjs                    (editar) — headers de /sw.js
app/layout.tsx                     (editar) — monta o <RegistrarSW />
```

### 2.3 `public/sw.js`

Estratégia por tipo de request, e nada além disso:

| O quê | Estratégia | Por quê |
|---|---|---|
| Navegação (`request.mode === "navigate"`) | network-first, fallback `/offline` | build novo sempre vence; offline não dá tela de dinossauro |
| `/_next/static/*` | cache-first, imutável | o nome do arquivo já tem hash — mudou o conteúdo, mudou a URL |
| `/icons/*`, `/assets/*`, `/sponsors/*`, fontes | stale-while-revalidate | imagem velha por alguns segundos é aceitável; bloquear a pintura não é |
| **todo o resto** (`/api/*`, `_next/data`, POST, cross-origin) | passa direto, sem tocar | ver item 3 do "Não faça" |

Esqueleto obrigatório:

```js
// public/sw.js
const VERSAO = "zaeon-v1";
const CACHE_ESTATICO = `${VERSAO}-estatico`;
const CACHE_MIDIA = `${VERSAO}-midia`;
const CACHE_PAGINAS = `${VERSAO}-paginas`;
const OFFLINE = "/offline";

// ── INTERRUPTOR DE EMERGÊNCIA ───────────────────────────────────────────
// Trocar para true, fazer deploy, e todo SW instalado se desinstala sozinho
// e apaga os próprios caches no primeiro fetch. É o "desfazer" deste PR, e
// é a razão de ele poder ir pra produção com segurança. TESTE ISSO ANTES
// DE MERGEAR — um kill switch que nunca foi exercido não é um kill switch.
const DESLIGAR = false;

self.addEventListener("install", (e) => {
    if (DESLIGAR) return;
    e.waitUntil(caches.open(CACHE_PAGINAS).then((c) => c.add(OFFLINE)));
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        (async () => {
            if (DESLIGAR) {
                const nomes = await caches.keys();
                await Promise.all(nomes.map((n) => caches.delete(n)));
                await self.registration.unregister();
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
    if (DESLIGAR) return;               // handler existe mas não intercepta
    // ... roteamento da tabela acima
});
```

`skipWaiting` + `clients.claim` juntos são deliberados: fazem a versão nova
assumir na hora, o que é o que torna o interruptor rápido. O risco clássico
disso (trocar assets no meio da sessão) não se aplica porque os assets são
hasheados e a navegação é network-first.

### 2.4 `next.config.mjs` — headers do `/sw.js`

Direto da [documentação do Next](https://nextjs.org/docs/app/guides/progressive-web-apps),
seção 8:

```js
async headers() {
    return [
        {
            source: "/sw.js",
            headers: [
                { key: "Content-Type", value: "application/javascript; charset=utf-8" },
                { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
            ],
        },
    ];
}
```

O `Cache-Control` é o que mais importa: **se o próprio `/sw.js` for cacheado, o
interruptor de emergência não chega no aparelho.**

Confirme que `headers()` está valendo — a Zaeon roda com servidor custom
(`server.js`, `npm start` = `NODE_ENV=production node server.js`). Os headers do
`next.config` são aplicados pelo request handler do Next, então funcionam desde
que o `server.js` delegue pro `app.getRequestHandler()`; **leia o `server.js` e
confirme isso** antes de assumir. Se não estiver, ponha os headers no Caddy
(`Caddyfile`) em vez do `next.config`.

### 2.5 `components/pwa/RegistrarSW.tsx`

```tsx
"use client";
useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const registrar = () =>
        navigator.serviceWorker
            .register("/sw.js", { scope: "/", updateViaCache: "none" })
            .catch(() => { /* silêncio: SW é melhoria, nunca requisito */ });
    window.addEventListener("load", registrar, { once: true });
    return () => window.removeEventListener("load", registrar);
}, []);
```

`updateViaCache: "none"` é o par do `Cache-Control` acima — os dois precisam
existir. Registrar no `load` e não no mount: o SW não deve competir por banda
com a primeira pintura.

### 2.6 `app/offline/page.tsx`

Estática, sem fetch, sem dependência de sessão. Use `Rotulo` e `TituloSecao` de
`@/components/layout/secao` e a classe `.zaeon-borda`, que é a calha da página
— assim ela não parece de outro site. Texto curto em PT-BR, um botão "tentar de
novo" que faz `location.reload()`.

---

## 3. Como verificar (obrigatório, nesta ordem)

1. `npm run build && npm start` — **não** `next dev`, o SW não registra em dev.
2. DevTools → Application → Service Workers: registrado, `activated`, escopo `/`.
3. Application → Manifest: sem erros, ícones carregando, "Installability: yes".
4. Network → offline → recarregar: cai na `/offline`, não na tela do navegador.
5. Volta online → recarregar: **volta o conteúdo de verdade**, não a `/offline`.
6. **Prova do build novo:** com o SW ativo, faça um build novo com uma mudança
   visível, suba, e recarregue. Tem que aparecer a mudança. Se aparecer o build
   velho, o roteamento de navegação está errado — volte pro item 2 do "Não faça".
7. **Prova do interruptor:** troque `DESLIGAR = true`, build, recarregue duas
   vezes. `navigator.serviceWorker.getRegistrations()` tem que voltar `[]` e
   `caches.keys()` tem que voltar `[]`. Depois volte pra `false`. **Este teste
   não é opcional** — ele é a única garantia de que dá pra desfazer em campo.
8. Lighthouse (mobile) na home: a categoria PWA sem erro de installability.
9. `npx tsc --noEmit`: os erros pré-existentes do projeto continuam (hoje 33 no
   checkout de trabalho), e **nenhum** nos arquivos deste PR.

---

## 4. Fora do escopo

- **Web Push / VAPID.** A documentação do Next cobre no mesmo guia e é tentador
  emendar. Não emende: push exige chaves VAPID, persistência de subscription no
  banco e uma decisão de produto sobre o que notificar. PR separado.
- **Offline navegável** (cachear rotas inteiras pra usar sem rede). Isso é o caso
  em que o Serwist passa a valer a pena; hoje o alvo é só não dar tela de erro.
- **Background sync / periodic sync.**

---

## Referências

- [Guides: PWAs — Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps) — `app/manifest.ts`, headers do `/sw.js`, registro com `updateViaCache: 'none'`, e a afirmação de que dá pra ter prompt de instalação sem offline
- [Revisiting Chrome's installability criteria — Chrome for Developers](https://developer.chrome.com/blog/update-install-criteria) — SW deixou de ser exigido pro "Instalar" do menu (108 mobile / 112 desktop); o prompt automático ainda exige handler de `fetch`
- [Making PWAs installable — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [Using Service Workers — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) — ciclo de vida, `skipWaiting`, `clients.claim`
- [Web app manifest does not meet the installability requirements — Lighthouse](https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest)
- [Serwist](https://github.com/serwist/serwist) — sucessor do `next-pwa`, a alternativa se um dia o alvo virar offline completo
- [Implementing service workers in your Next.js app — LogRocket](https://blog.logrocket.com/implementing-service-workers-next-js/) — útil pelo padrão de versionamento de cache; **não siga o `fetch` handler dele**, que não trata o risco de HTML velho
