# PLAYBOOK — resolver os conflitos das PRs (mentores + harness) e subir pro GitHub

> Pra o agente com acesso ao repo. **Princípio-mestre:** estas features são TODAS aditivas —
> resolva conflito por **UNIÃO** (mantém os dois lados), **nunca** por "aceitar um lado" que apague
> um model, uma tool ou o wiring do harness. Ordem de merge: **schema (#118) → harness/render (#117)
> → UI mentores (#119)**. NÃO mergear a branch `aura/base-coworking-harness` (o `route.ts` dela é
> PRÉ-harness e regride tudo). Escrito 2026 (Fable).

## Regra por arquivo (os conflituosos prováveis)

### `prisma/schema.prisma`
- **UNIR todos os models aditivos**: `MemoryDrawer`, `Connector`, `MentorTemplate`, `PluggedMentor` — nenhum some.
- **`model User`**: se aparecer em dois lados, **funda os campos num único bloco** (`activeMentorId`, `course`, `skills`, back-relations…). Nunca duas definições de `User`.
- Mantém os `@@map`/`@@index`/`@@unique` de ambos. Nada de escolher "ours/theirs" inteiro.

### `app/api/ai/chat/route.ts`
- Manter **as 3 coisas juntas**: (a) o branch do harness (`AURA_HARNESS`, `runTrajectory`, `resolveHarnessOutput`, `STRUCTURED_SENTINEL`); (b) a resolução de **mentor** (`mentor`/slug → `personaText` prepend + `wing`); (c) o que já existia (personas base, sentinelas studio/research).
- Precedência no `systemContext`: **persona do mentor ANTES** do systemContext existente.
- Se o conflito for na lista de `tools`/branches: **une** — não descarta o studio/research nem o structured.

### `lib/agent/aura-harness.ts`
- Manter o `mode:"structured"` + `artifacts[]` inline (PR harness) **e** qualquer campo de mentor (`wing`). União.

### Cliente — `components/study/StudyCoworkChat.tsx` e `components/research/ResearchChat.tsx`
- Manter **o render estruturado** (`@@STRUCTURED@@` → `StructuredAnswerView` + StudioBlock inline) **e** o **seletor ⟁** de mentor. Os dois coexistem.

### `components/studio/StudioArtifactViews.tsx` / `StudioBlock.tsx`
- Se houver kind/viewer novo (molécula), manter aditivo — não remover kinds existentes.

### navbar / `app/plugin-store/page.tsx`
- Manter a **categoria "Mentores"** aditiva; não apagar categorias existentes.

## Comando (o agente roda, com acesso ao repo)
```bash
git fetch origin
# resolver em ordem de dependência, cada uma via PR na UI OU local:
git checkout main && git pull
git merge origin/<branch-#118-schema>      # resolve schema por UNIÃO (regra acima)
#   → editar arquivos com <<<<<<< , unir, git add, git commit
git merge origin/<branch-#117-harness>     # resolve route.ts/aura-harness por UNIÃO
git merge origin/<branch-#119-ui>          # resolve cliente/plugin-store por UNIÃO
# VERIFICAR antes de push:
#   - git grep -nE '^<<<<<<< |^>>>>>>> '  → tem que estar VAZIO (nenhum marcador restante)
#   - transpileModule nos .ts/.tsx tocados (0 erro categoria 1)
#   - npx vitest run  (router/resolveHarnessOutput/permit)
#   - docker compose -f docker-compose.beta.yml build web   → builda
git push origin main
```
> Se preferir resolver pela UI do GitHub (botão "Resolve conflicts"), a MESMA regra de união vale.

## Checklist de "não perdi nada do que o Martinez pediu"
- [ ] `git grep '^<<<<<<<'` vazio (zero marcador).
- [ ] `schema.prisma` tem `MentorTemplate` + `PluggedMentor` + `MemoryDrawer` + `Connector` + `User.activeMentorId`.
- [ ] `route.ts` tem `AURA_HARNESS` + `runTrajectory` + `STRUCTURED_SENTINEL` + resolução de `mentor`(slug).
- [ ] cliente tem `StructuredAnswerView` (render) **e** seletor ⟁ de mentor.
- [ ] guardrails de saúde intactos no seed dos mentores.
- [ ] transpila + vitest verde + `build web` ok.
- [ ] push feito em `main`.

## ⚠️ Deploy: a Hostinger caiu
Push em `main` dispara `deploy.yml` → SSH na Hostinger, que está **fora do ar** → o deploy vai **falhar**
(o merge/push em si fica salvo, sem problema). Pra a Zaeon voltar ao ar, siga `MIGRACAO_NOVO_SERVER.md`
(apontar o deploy pra `75.119.140.97` + repontar DNS). Ou seja: **resolve+push agora; o deploy vivo é na box nova.**

## Fronteira
Fable não tem fetch/push nesta sessão → não executa o merge. O agente Claude Code (com repo) resolve
seguindo este playbook; Fable revisa o diff resultante se você colar aqui.
