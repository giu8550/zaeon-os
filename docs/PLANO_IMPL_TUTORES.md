# PLANO DE IMPLEMENTAÇÃO — Tutores (camada agêntica plugável por conta)

> Para um agente subir a camada agêntica. **Assume a PR do harness (render + `artifacts[]` inline)
> JÁ ONLINE** — o tutor responde texto + artefato na mesma bolha reusando o `runTrajectory` + Studio.
> Auditado contra `origin/main`. Branch: **`aura/tutores-plugaveis`** (a partir de `main` já com a PR do harness).
> Entregável: os 12 tutores (§3.8 do `AGENTIC_LAYER.md`) como **agentes plugáveis por conta**, com a
> **experiência de plugar no chat**. Princípio: **parametriza o harness, não cria motor novo.**

---

## 0. Como um Tutor roda (sem motor novo)
O tutor = `agent:"aura"` (mantém o harness) + 3 parametrizações: **(a)** persona de domínio via
`systemContext`, **(b)** memória escopada (`wing = curso/userId`), **(c)** skills/artefatos preferidos
do domínio. Trocar de tutor = trocar esses 3. Nada de novo endpoint de IA.

## 1. Schema + seed (Prisma / Mongo — `prisma db push`, sem migração)
`prisma/schema.prisma`:
```prisma
model TutorTemplate {                 // catálogo global (os 12)
  id String @id @default(auto()) @map("_id") @db.ObjectId
  slug String @unique                 // "medicina" | "computacao" …
  course String                       // "Medicina"
  name String                         // "Osler"
  emoji String @default("⟁")
  personaId String                    // id do perfil de domínio (persona/AGENTS.md-style)
  personaText String                  // o system prompt do domínio (PT-BR) — injetado no systemContext
  enabledSkills String[]              // skills/artefatos do domínio (ex.: ["studio","molecule","literature"])
  signatureArtifacts String[]         // p/ o card e o hint de artefato
  sources String[]                    // fontes-base (rótulo)
  academicLevel String @default("graduacao")
  order Int @default(0)
  @@map("tutor_templates")
}
model PluggedTutor {                  // instância POR CONTA
  id String @id @default(auto()) @map("_id") @db.ObjectId
  userId String @db.ObjectId
  templateId String @db.ObjectId
  enabled Boolean @default(true)
  pluggedAt DateTime @default(now())
  @@unique([userId, templateId])
  @@index([userId])
  @@map("plugged_tutors")
}
// model User: somar
activeTutorId String? @db.ObjectId    // qual tutor está ativo no chat (null = Aura base)
```
**Seed** (`scripts/seed-tutors.ts` ou rota admin): os 12 do §3.8 (`personaText` = perfil curto de especialista sênior em PT-BR, adaptado ao `academicLevel`; deriva das personas K-Dense `scientific-agents`, não copia cru). Osler com guardrail "educacional, não diagnóstico".

## 2. APIs (`app/api/tutors/*`)
- `GET /api/tutors` → catálogo (os 12 `TutorTemplate`, ordenado por `order`).
- `GET /api/tutors/plugged` → os `PluggedTutor.enabled` do usuário (join com template) + `activeTutorId`.
- `POST /api/tutors/plug` `{templateId}` → cria `PluggedTutor` (upsert por `@@unique`), retorna o card. (guard `studioUid()`/sessão.)
- `POST /api/tutors/unplug` `{templateId}` → `enabled:false` (memória fica, inerte).
- `POST /api/tutors/activate` `{templateId|null}` → seta `User.activeTutorId`.
Todos filtram por `userId` (multi-tenant). Erros via `messageForError`.

## 3. Wiring no `/api/ai/chat/route.ts` (o coração — mínimo)
A rota já recebe `{ agent, systemContext, agentContext, surface }` (`:127`) e injeta `systemContext` em `:205`.
Somar suporte a tutor:
1. Aceitar `tutorId` no body (`:127`).
2. Após resolver `agentKey` (`:128`), se `tutorId` **e** `agentKey==="aura"`:
   ```ts
   const tutor = tutorId ? await prisma.tutorTemplate.findUnique({ where: { id: tutorId } }) : null;
   const tutorPersona = tutor ? `=== TUTOR: ${tutor.course} (${tutor.name}) ===\n${tutor.personaText}\n(Responda no domínio ${tutor.course}; fora dele, redirecione. Prefira artefatos: ${tutor.signatureArtifacts.join(", ")}.)` : "";
   ```
3. Concatenar `tutorPersona` ANTES do `systemContext` existente (a persona do tutor tem precedência).
4. No `hctx` do harness (o objeto que vai pro `runTrajectory`, ~`:250` da PR do harness), setar:
   `wing: tutor ? \`${tutor.slug}/${userId}\` : hctx.wing` (memória escopada por curso+usuário) e
   `enabledSkills: tutor?.enabledSkills` (escopo de skills — ver §5 fase 2).
**Compatibilidade:** sem `tutorId` → comportamento atual (Aura base) idêntico. `AURA_HARNESS=0` → legado.

## 4. UI — categoria "Tutores" na Plugin Store (`app/plugin-store/page.tsx`)
- Adicionar uma **categoria "Tutores"** (aditiva, não mexe nas existentes) que faz `GET /api/tutors`.
- **Grade de cards** liquid-glass (tokens do `2026-06-07-liquid-glass-style-reference`: fundo `rgba(22,22,34,0.55)`, blur 40, raio 22, gradiente `#8b5cf6→#22d3ee`): ⟁ + nome, chip do curso, "forjado em…", chips dos `signatureArtifacts`.
- Botão **"Plugar no chat"** → `POST /api/tutors/plug` → estado do botão: `Plugar → Plugando… → Plugado ✓` (o ritual de conexão). Se já plugado, mostra "No seu chat ✓" + "Desplugar".

## 5. UI — seletor ⟁ no chat (`components/study/CoworkComposer.tsx` + `StudyCoworkChat.tsx`)
- A pill **"⟁ Aura"** vira **"⟁ Aura ▾"** — um dropdown que lista **Aura (base) + os `PluggedTutor` do usuário** (`GET /api/tutors/plugged`).
- Selecionar → `POST /api/tutors/activate` + estado local `activeTutor`. A partir daí, cada envio do chat manda **`tutorId`** no body do `/api/ai/chat` (junto de `agent:"aura"`, `surface`).
- Header do chat mostra o tutor ativo (⟁ + nome + curso). Trocar pra "Aura" = `tutorId:null`.
- **Fase 1 de skills:** o escopo do tutor é persona + memória wing + preferência de artefato (já muda o comportamento). **Fase 2:** gating duro de tools no `IntentRegistry`/runtime por `enabledSkills` (só as skills do domínio ficam disponíveis) — refinamento, não bloqueia o lançamento.

## 6. Multi-tenant / memória
- `PluggedTutor` e `activeTutorId` são por `userId`. A memória L3 grava/recupera no `wing = slug/userId` → o tutor lembra **daquele** aluno, nunca vaza entre contas. (Depende do índice Atlas da memória — se ainda não criado, degrada muda, sem quebrar.)

## 7. Verificação (gates)
- **Transpile:** os arquivos tocados (route.ts, page.tsx, CoworkComposer, StudyCoworkChat, as rotas /api/tutors).
- **Vitest:** resolução do tutor (dado `tutorId`, monta `tutorPersona` + `wing` corretos; sem `tutorId` → sem mudança).
- **Smoke (staging):**
  1. Plugin Store → Tutores → **Plugar** "Farmácia (Kekulé)" → botão vira "Plugado ✓".
  2. Chat → seletor ⟁ lista "Aura" + "Kekulé"; selecionar Kekulé.
  3. "me explica a cafeína" → resposta com **voz de farmácia** + (com PR1.5) **molécula/imagem inline**.
  4. Trocar pra "Aura" → volta ao generalista. Outra conta **não** vê o tutor plugado nem a memória.
  5. Desplugar → some do seletor.

## 8. DoD
- [ ] `prisma db push` (tutor_templates + plugged_tutors + User.activeTutorId) + seed dos 12.
- [ ] Plugin Store mostra a categoria Tutores (12 cards liquid-glass) e o "Plugar no chat" funciona.
- [ ] Seletor ⟁ no chat lista os plugados; ativar troca o `AgentContext` (persona+wing) via `tutorId`.
- [ ] Tutor responde no domínio, com memória por conta, e texto+artefato juntos (reusa PR1.5).
- [ ] Sem `tutorId` = Aura base idêntica; `AURA_HARNESS=0` = legado. `build web` ok.
- [ ] CHANGELOG citando §9 (StudentAgent) do `AURA_AGENTIC_LAYER_PLAN` + §3.8/3.9 do `AGENTIC_LAYER`.

## 9. Riscos & mitigação
- **Persona longa infla token** → `personaText` curto (perfil, não enciclopédia); é 1 bloco no systemContext.
- **Tutor "vaza" fora do domínio** → instrução de redirecionamento na persona ("fora de X, indique o tutor certo"); fase 2 reforça com gating de tools.
- **Skills fase 1 não gateadas** → aceitável: persona+wing já diferenciam; gating duro é fase 2 (não regride nada).
- **Memória sem índice Atlas** → degrada muda (tutor funciona, só não lembra) — não quebra.

## 10. Fora de escopo (próximas PRs)
Gating duro de tools por `enabledSkills` (fase 2) · kind `molecule` (RICH_ARTIFACTS) · a **camada mestra**
(professores/§3.7) · o professor **criar/editar** o próprio tutor (deriva do template). Este entregável =
os 12 plugáveis por conta, com a experiência de plugar. 

## 11. Fronteira
Fable escreve/verifica; o agente executor aplica na branch (sobre a PR do harness), roda os gates, abre o PR.
