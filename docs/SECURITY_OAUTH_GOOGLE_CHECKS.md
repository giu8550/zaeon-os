# Segurança — `GoogleProvider({ checks: ['none'] })` no NextAuth

> Handoff para outro agente. **Não é o foco atual** (que é o primeiro commit pela IA
> na sala Projetos). Documento de investigação + plano de correção, pronto para execução.

## TL;DR
Em `src/lib/auth.ts` o provider do Google está com `checks: ['none']`, o que **desliga
as proteções nativas do fluxo OAuth/OIDC** (`state`, `pkce`, `nonce`). Isso reabre a
porta para **CSRF de login** (login fixation) e **injeção de authorization code**.
Recomendação: **remover `checks: ['none']`** e deixar o padrão do NextAuth
(`['pkce','state']` para OAuth2, + `nonce` no OIDC), corrigindo a causa-raiz que
provavelmente motivou o workaround (mismatch de `NEXTAUTH_URL`/cookies por ambiente).

## Onde
`src/lib/auth.ts`:
```ts
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  checks: ['none'],   // ← ponto de risco
}),
```

## O que cada check faz (e o que perdemos com `'none'`)
- **`state`** — token anti-CSRF ligado ao cookie do iniciador. Sem ele, um atacante
  pode iniciar o fluxo e fazer a vítima completar com o código dele → **login CSRF /
  session fixation** (a vítima acaba logada na conta do atacante, ou vice-versa).
- **`pkce`** — `code_verifier`/`code_challenge`. Sem ele, um `authorization code`
  interceptado pode ser trocado por token por outra parte → **code injection**.
- **`nonce`** (OIDC) — liga o `id_token` à sessão de autenticação; sem ele há risco de
  **replay de id_token**.

Com `checks: ['none']` os três são pulados. Para um app que escreve em GitHub e guarda
perfil acadêmico, é um risco que não compensa.

## Por que provavelmente foi colocado (hipótese a confirmar)
Quase sempre `checks:['none']` é um "band-aid" para erros de `state`/PKCE que na
verdade vêm de **configuração de ambiente**, não do check em si:
- **`NEXTAUTH_URL` errado por ambiente** — já encontramos isto: o `.env.local` estava
  com `https://zaeon.space` rodando local (corrigido p/ `http://localhost:3000` em
  2026-06-13). URL errada → cookie `state`/PKCE gravado num domínio e validado em
  outro → "state mismatch" → alguém "resolveu" desligando os checks.
- **Cookies atrás de proxy/HTTPS** (Nginx/Vercel): faltava `trustHost`/headers
  `x-forwarded-*`, ou `cookies.*.secure` divergente → o cookie do `state` não voltava.
- **Sessões `strategy: "jwt"`** estão ok com os checks; não é a causa.

Confirmar via git blame na linha do `checks` e procurar issues/PRs que mencionem
"state mismatch", "OAuthCallback", "redirect_uri".

## Correção recomendada (passo a passo)
1. **Remover** `checks: ['none']` do `GoogleProvider` (deixar o default).
2. Garantir `NEXTAUTH_URL` correto por ambiente:
   - local: `http://localhost:3000`
   - prod: `https://zaeon.space`
   (Lembrete: `.env.local` tem precedência sobre `.env` no Next — não deixe valor de
   prod no `.env.local`.)
3. Em produção atrás de proxy, no `authOptions`:
   - `trustHost: true` (ou `AUTH_TRUST_HOST=true`);
   - garantir que o proxy repassa `X-Forwarded-Proto: https` e `X-Forwarded-Host`.
4. Conferir relógio do servidor (NTP) — clock skew quebra validação de `nonce`/`iat`.
5. No Google Cloud Console, manter os **Authorized redirect URIs** exatos por ambiente:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://zaeon.space/api/auth/callback/google`

## Plano de teste (aceitação)
- [ ] Login Google **local** funciona sem `checks:['none']` (cookies `next-auth.*`
      sendo gravados; sem erro `OAuthCallback`/`state`).
- [ ] Login Google **prod** continua funcionando.
- [ ] DevTools → Application → Cookies: existe o cookie de `state`/`pkce` durante o
      fluxo (`__Host-`/`__Secure-` em prod; `next-auth.pkce.code_verifier`).
- [ ] Forçar erro: adulterar o `state` na volta → o login deve **falhar** (prova de que
      a proteção voltou).
- [ ] Sem regressão em contas existentes (mesmo `email` → mesmo usuário no Mongo).

## Severidade
Médio-alto. Não é RCE, mas é **autenticação enfraquecida** num app que comita em
repositórios e guarda dados de perfil. Priorizar depois do milestone atual (1º commit
agêntico). Não exige migração de dados; é mudança de config + 1 linha de código.

## Referências
- NextAuth v4 — Providers `checks` e proteção `state`/`pkce`/`nonce`.
- OAuth 2.0 Security BCP (RFC 9700) — recomenda PKCE + state.
