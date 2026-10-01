# Auditoria "pente-fino" da Zaeon — 2026-09-25

> Varredura por 4 auditores em paralelo (segurança/auth, corretude de rotas, React/cliente,
> dados/Prisma+config+regressões) + verificação manual dos CRÍTICOS. Cada item:
> `severidade — arquivo:linha — problema — correção`. ✅ = confirmei lendo o código.

## 🔴 CRÍTICO — corrigir ANTES de qualquer exposição pública
Hoje só você e eu acessamos, mas no minuto em que a URL (beta/sslip) vazar, isto é grave.

1. ✅ **Login sem senha por email** — `src/lib/auth.ts:25-51`. O `CredentialsProvider("Guest").authorize` retorna a sessão de **qualquer conta só com o email** (sem senha/OTP). Basta postar `email: martinez@zaeon.space` → sessão de admin (o `session.user.isAdmin` vem do email). **Takeover total.** → Remover o provider passwordless, ou exigir magic-link/OTP verificado antes de `authorize` retornar user.
2. ✅ **`/api/workspace` sem auth + IDOR total** — `app/api/workspace/route.ts:7 (POST), :77 (GET)`. `userId` vem do body/query; lê e sobrescreve o workspace inteiro de qualquer usuário (agenda, chats, biblioteca, módulos). → Derivar o usuário de `getServerSession()` e ignorar `userId` do cliente.
3. ✅ **`/api/auth/guest-register` confia no `role` do cliente** — `route.ts:28-46`. Cria usuário com `role: data.role` → dá pra self-provisionar `super_admin`. Encadeado com o #1 = qualquer um vira super admin. → Nunca aceitar `role` do body (forçar default) + exigir o gate de convite.
4. ✅ **`/api/admin/proxies` sem auth** — `route.ts:7,18,63`. GET retorna proxies com `username`/`password`; POST/DELETE livres. → Gatear tudo com `isSuperAdmin(getServerSession())`.

## 🟠 ALTO
5. **`/api/admin` GET só checa `if(!session)`, não admin** — `route.ts:21`. Qualquer logado baixa PII de todos (email, phone, idade, gênero, kycStatus, `verificationDoc`/imagem KYC). → Usar o mesmo `checkIsAdmin` do PATCH/DELETE.
6. **`/api/plugins` POST/DELETE sem auth** — qualquer um cria/edita/apaga itens da Plugin Store, incl. `actionUrl` renderado a todos (injeção de link / stored-XSS). → Exigir super-admin nos métodos mutantes.
7. **`signIn` fail-open** — `src/lib/auth.ts:76-78`. Em exceção de infra, `return true` → fura o gate de convite pra novos. → Fail-closed no caminho de usuário novo.
8. **18 rotas com `new PrismaClient()` em escopo de módulo** — (`cyber`, `posts*`, `guest-register`, `auth/onboarding`, `plugins`, `trial/edu/verify`, +) esgota conexões do Atlas sob carga/hot-reload. Singleton já existe em `src/lib/prisma.ts`. → Trocar por `import { prisma } from "@/src/lib/prisma"`.
9. **Feeds sem paginação** — `app/api/posts/route.ts:31`, `app/api/cyber/route.ts:9`. `findMany` sem `take`, com `include` de autor/comentários → carrega o feed inteiro toda request. → `take: 30` + cursor.
10. **`_PROD_B64_DELETE_AFTER.txt` na raiz** — base64 da chave privada do service-account GCP em texto no disco (gitignored, não commitado, mas é credencial de prod viva). → Apagar e **rotacionar a chave**.
11. **`createObjectURL` no render** — `app/research-lab/page.tsx:2733`. Novo blob URL a cada render, nunca revogado → vazamento de memória com o modal aberto. → Criar 1× em `useEffect`/`useMemo` e revogar no cleanup.
12. **Hydration mismatch** — `app/workstation/student/[module]/page.tsx:79-91` (e teacher `:40-48`). `useState(() => sessionStorage.getItem(...))` diverge server/cliente. → Inicializar no default e ler storage em `useEffect`.

## 🟡 MÉDIO
13. **Rotas de IA caras sem rate-limit** — `guard()` existe mas não é aplicado em `agentic/biosim`, `documents/abnt-export`, `agentic/quantum`, `agentic/codelab`, `onboarding-extract`, `ai/agent-search`, `studio/diag`. → `await guard(req, "<nome>", "ai-heavy")`.
14. **Rotas de IA sem sessão** — `gemini`, `ai/chat` (tem rate-limit, sem sessão), `ai/agent-search`, `ai/transcript`, `scholar/search`, `onboarding-extract` expõem custo LLM a anônimos. → Exigir `getServerSession`.
15. **`ai/scholar/pdf/route.ts:46`** — fetch do PDF upstream fora de try/catch → host lento/morto 500a em vez do 502 gracioso. → Envolver em try/catch.
16. **`agentic/biosim/pdb/route.ts:96,140`** — fetches RCSB sem timeout/AbortController e sem `maxDuration` → pode pendurar. → `AbortSignal.timeout(...)` + `maxDuration`. (E validar `pdbId` `/^[A-Z0-9]{4}$/` antes de interpolar na URL.)
17. **`agentic/biosim/route.ts:114` (proteína)** — ainda usa hop HTTP interno pro `/pdb` sem timeout. → Chamar a lib direto (como já fiz no PubChem) ou timeout no hop.
18. **`abnt-export/route.ts:324`** — fetch com timeout 90s mas `maxDuration=60` → plataforma mata antes do fallback. → Timeout < maxDuration (45s) ou subir maxDuration.
19. **`LoungeChatWidget.tsx:340-360`** — `incomingRequest` nas deps do polling reseta o `setInterval` a cada mudança. → Tirar das deps, usar updater/ref.
20. **`ClassesView.tsx:497-521`** — efeito depende do objeto `session` (ref nova sempre) e sem debounce → `POST /api/workspace` + 6 writes a cada tecla. → Depender de `session?.user?.email` + debounce.
21. **`BioSim3DModule.tsx:343-356`** — `handleImageSelect` não revoga o `imagePreview` anterior nem no unmount → leak de object-URL. → Revogar antes de setar o novo + cleanup.
22. **`ResearchChat.tsx:154-161`** — `setInterval` do typewriter sem ref/cleanup → setState em componente desmontado se sair no meio do stream. → Guardar id em ref e limpar no unmount/abort.
23. **`next.config.mjs:101-106`** — `eslint.ignoreDuringBuilds` + `typescript.ignoreBuildErrors` ligados → build engole erros de tipo (foi o que deixou os 18 PrismaClient passarem). → Reativar ao menos TS no CI.
24. **`lib/auth/roles.ts:17`** — allowlist de admin via `NEXT_PUBLIC_SUPER_ADMIN_EMAILS` → emails de admin vão pro bundle do cliente e o gate client-side é burlável. → Gatear no server com `SUPER_ADMIN_EMAILS` (sem `NEXT_PUBLIC_`).

## 🟢 BAIXO
25. `app/api/user/profile/[id]/route.ts:4-20` — perfil público inclui `kycStatus`; remover do select.
26. `next.config.mjs:24-27` — `remotePatterns` com wildcard `hostname:'**'` → otimizador de imagem aberto. Remover o wildcard.
27. `app/study-rooms/*/projects/page.tsx:195,202` (6 salas) — `JSON.parse(localStorage)` sem try/catch. → Envolver.
28. `app/news/page.tsx:111` — `.sort/.filter` sem `Array.isArray(data)`. → Guardar.
29. `app/study-rooms/lounge/page.tsx:137`, `app/workstation/page.tsx:118-136` — timeout/polling sem clear no estado terminal. → Limpar.
30. index-as-key em listas reordenáveis — `research-lab/page.tsx:2544,2798,2818,2856`, `ResearchReadingView.tsx:56`. → Key por id estável.
31. `ai/suggestion-forge` e `ai/voice` retornam texto plano em erro (vs `{error}` JSON) → clientes com `res.json()` quebram. → Padronizar envelope JSON.
32. `app/api/gemini/route.ts` vazio (0 bytes) → 405. → Apagar ou implementar.

## Regressões das mudanças de hoje — sem quebra
Refactor do PubChem e edições da v2 **checados: sem import quebrado, sem símbolo removido-e-usado, JSX balanceado.** Só cosmético: `t`/`useTranslation` não usados em `hero-content.tsx`/`navbar.tsx` (silenciados pelo build); voxels de IA usam `type` em vez de `label` (não aparecem na legenda — pré-existente, render ok); fast-path pode fazer 1 lookup extra em prompts tipo "blood cell" (degrada seguro).

## Verificado LIMPO (sem problema)
IDOR: biosim sessions/annotations, studio/[id]+file, teacher grade/students/submissions, collab/[id], study/items, scholar/sessions, research/chat, account, trial/grant — todos escopam por usuário. Segredos: nada de `private_key`/`GOOGLE_CREDENTIALS`/connection string logado ou devolvido ao cliente. `src/lib/db.ts` singleton ok. Engines de canvas/particle limpam listeners e cancelam rAF. Downloads revogam object URLs.

## ✅ Corrigidos nesta sessão (patch de segurança — aguardando push)
- **#1** login sem senha: `src/lib/auth.ts` agora **bloqueia contas privilegiadas** (admin/super_admin/ADMIN_EMAILS) no path de credenciais → takeover de admin fechado. (Resíduo: contas student/teacher ainda logáveis por email no onboarding — fix definitivo = magic-link/OTP, documentado.)
- **#2** `/api/workspace` POST+GET: dono vem de `getServerSession()`, `userId` do cliente ignorado → IDOR fechado.
- **#3** `/api/auth/guest-register`: `role` travado em `{student,teacher}` (default student) → sem self-provision de admin. + singleton Prisma.
- **#4** `/api/admin/proxies`: GET/POST/DELETE gateados por super-admin. + singleton.
- **#5** `/api/admin` GET: agora exige admin (era só `!session`) → PII/KYC protegido.
- **#6** `/api/plugins` POST/DELETE: gateados por super-admin (GET público de leitura mantido). + singleton.
- **#10** `_PROD_B64_DELETE_AFTER.txt` removido do disco. **PENDENTE 🔒 Martinez: rotacionar a chave no GCP.**
- **#7 (signIn fail-open)** deixado como está de propósito: flipar pra fail-closed arrisca travar TODO login em soluço do Atlas; é gate de convite (não dado sensível). Reavaliar com magic-link.

## Ordem sugerida de correção
1. **Segurança CRÍTICA (1-4)** — antes de expor a URL a qualquer um. É um PR pequeno e urgente.
2. **ALTO auth/PII (5,6,7,24)** + **PrismaClient singleton (8)** + **chave GCP (10, rotacionar)**.
3. Paginação (9), rate-limit/sessão nas rotas de IA (13,14), leaks de React (11,21,22).
4. O resto (MÉDIO/BAIXO) em lote quando der.
