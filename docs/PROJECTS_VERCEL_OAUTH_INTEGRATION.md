# Projetos — Integração OAuth da Vercel (deploy na conta do usuário)

> Implementação FUTURA. Hoje o deploy "na conta do usuário" funciona via **import por
> link** (GitHub é a ponte). Este doc descreve o "acabamento premium": conectar a
> Vercel do usuário uma vez (OAuth) e a Zaeon publicar direto, sem passo manual.
> Handoff pronto pra outro agente.

## Objetivo
O usuário coda na Zaeon → o app roda **na conta Vercel dele**, sem ele sair da IDE
e sem token da plataforma. Mesmo padrão por-usuário do GitHub App.

## Hoje vs. proposta
| | Hoje (import por link) | Proposta (OAuth) |
|---|---|---|
| Onde roda | Conta do usuário | Conta do usuário |
| Passo manual | 1 clique de import na Vercel **por projeto** | 1 conexão única |
| Token guardado | Nenhum | Token do usuário (cifrado) |
| Deploy da IDE | Abre aba `vercel.com/new/clone` | Direto via API, sem sair da Zaeon |
| Esforço | Pronto | Médio |

## Arquitetura
```
Usuário ── "Conectar Vercel" ──► Vercel (autoriza) ──► /api/projects/vercel/callback
                                                          └─ troca code→token (do usuário)
                                                          └─ grava User.vercelToken (cifrado)
Zaeon "Publicar" ──► /api/projects/deploy (usa User.vercelToken) ──► Vercel DO USUÁRIO
```

## Peças a construir
1. **Vercel Integration** (criar 1x no painel da Vercel → Integrations):
   - tipo: OAuth/Integration; define `redirect_uri` = `${NEXTAUTH_URL}/api/projects/vercel/callback`.
   - gera `VERCEL_CLIENT_ID` + `VERCEL_CLIENT_SECRET` (env da plataforma).
2. **Início do OAuth** — `GET /api/projects/vercel/connect`:
   - redireciona para a URL de autorização da Vercel com `client_id`, `redirect_uri`, `state` (anti-CSRF, ligado à sessão).
3. **Callback** — `GET /api/projects/vercel/callback`:
   - valida `state`; troca `code` por access token (endpoint de token da Vercel; pode vir `team_id`).
   - **cifra** o token (ex.: AES com `crypto`/`crypto-js` já no projeto) e grava em `User.vercelToken`
     (+ `User.vercelTeamId?`). NUNCA salvar em claro nem no client.
4. **Prisma**: `vercelToken String?` (cifrado), `vercelTeamId String?` no `User` (Mongo → só regenerar).
5. **Deploy por usuário** — ajustar `app/api/projects/deploy/route.ts`:
   - usar `decrypt(dbUser.vercelToken)` em vez de `process.env.VERCEL_TOKEN`.
   - se ausente → 401/“conecte a Vercel” (UI mostra botão "Conectar Vercel").
6. **UI** (ProjectsContent): botão **"Conectar Vercel"** (estado conectado/desconectado, igual ao
   GitHub pill). Quando conectado, "Publicar na minha Vercel" deixa de abrir aba e faz deploy direto.
7. **Revogação**: botão "Desconectar Vercel" → apaga `User.vercelToken`. Tratar token expirado/revogado
   (deploy 401 → limpar e pedir reconexão).

## Segurança
- Cifrar o token em repouso; descriptografar só no servidor (runtime nodejs).
- `state` no OAuth (anti-CSRF) — não repetir o erro do `checks:['none']` do Google (ver
  `docs/SECURITY_OAUTH_GOOGLE_CHECKS.md`).
- Escopos mínimos da Integration; permitir revogar.

## Env novas
```
VERCEL_CLIENT_ID=
VERCEL_CLIENT_SECRET=
# (a plataforma) — o token de DEPLOY passa a ser o do usuário, vindo do OAuth.
```

## Aceitação
- [ ] Usuário clica "Conectar Vercel" → autoriza → volta conectado.
- [ ] `User.vercelToken` gravado cifrado; nunca exposto no client.
- [ ] "Publicar" faz deploy na conta do usuário sem abrir aba da Vercel.
- [ ] Desconectar limpa o token; token revogado → pede reconexão.
- [ ] Deploy continua respeitando o gate de curso.

## Ref
- Vercel REST API — Create deployment: https://vercel.com/docs/rest-api/deployments/create-a-new-deployment
- Vercel Integrations / OAuth: https://vercel.com/docs/integrations
