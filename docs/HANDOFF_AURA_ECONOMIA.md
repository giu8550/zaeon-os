# AURA — economia de reputação (ledger + perfil + credencial acadêmica) — handoff

> AURA = função determinística de conquistas VERIFICADAS. Livro-razão append-only (`AuraEvent`,
> idempotente por `(userId, source, refId)`), saldo em cache `User.aura` (recomputável). Nada vem
> do cliente nem de "atividade". **Tudo atrás de `AURA_ECONOMY` / `NEXT_PUBLIC_AURA_ECONOMY` (off).**

## Flags
| Flag | Liga |
|---|---|
| `AURA_ECONOMY=1` (server) | rotas `/api/profile/aura`, `/api/credentials/academic`, `/api/academic/*` (404 desligada); `skilltree/progress.ts` paga AURA no ledger em vez de somar `xp` |
| `NEXT_PUBLIC_AURA_ECONOMY=1` (build) | cartão AURA no perfil (`components/profile/AuraCard.tsx`, dentro de `EditableProfile`) |

## Dados (`prisma generate` + `db push` feitos)
- `AuraEvent` (`aura_events`): `source` ∈ node_learned · node_applied · node_validated · brain_completed · credential_verified · edu_link · legacy_xp · reversal; `@@unique([userId, source, refId])`.
- `AcademicCredential` (`academic_credentials`): nível, área, instituição, `docRef` (data URL PRIVADA), `docHash` (sha256 — detecta reuso), `metodo`, `status`, `verifiedById`, `credentialId` (Solana), `auraEventId`.
- `User.aura` (cache), `User.level` (derivado), `User.verificadorHabilitado`, `User.xp` **deprecado**.
- `CredentialType` ganhou `"academic"` (`lib/solana/config.ts`).

## Regras (`lib/aura/rules.ts` — único lugar com números)
`node_learned 5 · node_applied 15 · node_validated 50 · brain_completed 200`; soft-cap diário `node_learned` = 20.
Níveis: 0 Iniciante · 150 Aprendiz · 400 Praticante · 900 Especialista · 1800 Mestre · 3600 Referência (`levelFromAura`).
Acadêmico: `tecnico 60 · graduacao 120 · especializacao 200 · mestrado 350 · doutorado 600 · posdoc 800`; método é PORTÃO
(`declarado` 0 · `edu_email` 20 fixo · `doc_review`/`registry`/`onchain` base cheia; `registry`/`onchain` = selo ouro, só instituição).

## Ledger (`lib/aura/ledger.ts`)
`grantAura` (idempotente, trata corrida P2002, cap diário, recalcula saldo e nível) · `reverseAura` (evento negativo, 1× por original) ·
`recomputeAura` (auto-cura) · ganchos prontos: `grantNodeLearned/Applied/Validated/BrainCompleted`.

## Onde dispara hoje
- `lib/skilltree/progress.ts` → nó dominado → `grantNodeLearned(userId, "<topic>:<node>")` (flag on). Flag off = `xp` como antes.
- `POST /api/academic/:id/verificar` → `credential_verified` (1× por credencial) + `issueCredential(type:"academic")` (fire-and-forget) + `User.academicLevel` = maior nível verificado. Rejeitar depois de verificado → `reverseAura`.

## Seams pro PR2 (mapa probabilístico — ainda NÃO está no main)
Quando o PR2 entrar: nas transições `aprendido/aplicado` do mapa chamar `grantNodeLearned/Applied`; na rota de
validação (`aplicado→validado`), logo após `issueCredential`, `grantNodeValidated(mapaId, noId)`; quando
`completudeValidacao === 1`, `grantBrainCompleted(mapaId)`. As funções já existem e são testadas.

## Quem verifica (`lib/aura/academico.ts` → `elegibilidade`)
Professor (`teacher`/`professor`) **habilitado** (`verificadorHabilitado` OU com credencial própria verificada) e **vinculado** (`TeacherStudent`);
instituição (`role instituicao`) vinculada pelo nome (`User.institution` == `AcademicCredential.instituicao`). Ninguém verifica a própria (403).
Admin (super admin) só modera: pode **rejeitar**, nunca verificar.

## Rotas
`GET /api/profile/aura` (dono) · `GET/POST /api/credentials/academic` (dono; POST com `doc` = doc_review pendente, sem = declarado) ·
`GET /api/academic/fila?status=` (verificador; sem documento; `docDuplicado`) · `GET /api/academic/:id/doc` (dono ou verificador elegível; `no-store`) ·
`POST /api/academic/:id/verificar { status, metodo? }`.

## Migração única (`scripts/aura-migrate-xp.mjs`)
`node --env-file=.env scripts/aura-migrate-xp.mjs --dry-run` → depois sem `--dry-run`. Idempotente (unique `legacy_xp`). **Não rodada** nesta PR
(rodar ao ligar a flag em prod).

## Testes
`lib/aura/{rules,ledger,academico,skilltree-hook}.test.ts`, rotas `verificar` (IDOR: self/aluno/sem vínculo/não habilitado → 403; admin só rejeita),
`fila`, `credentials/academic`, `profile/aura`.

## Não verificado
- Navegador (cartão AURA, fila do verificador) — só testes de rota e `tsc`.
- `issueCredential("academic")` contra Crossmint real (mockado).
- Instituição como papel real: não existe fluxo de criação de conta `role: "instituicao"` ainda — o gate está pronto, falta o onboarding.
