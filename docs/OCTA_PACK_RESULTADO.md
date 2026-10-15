# Octa Code: Pack Sinistro, o que foi feito

Resultado de `docs/HANDOFF_OCTA_CODE_PACK.md`. São 7 fases, uma por commit, todas atrás de `NEXT_PUBLIC_OCTA_CODE`, que vem **desligada**. O código fica em `lib/octa/`.

| Fase | O que existe | Arquivos | Testes |
|---|---|---|---|
| P1 Guardrails + vetting | `permit()` nega escrita em `review`/`answer`. Guard com file-lock por glob, bloqueio de traversal, escrita sem path e teto de subagentes, sempre devolvendo motivo estável. Heurística SHIT pro juiz. CI com vet-deps, `npm ci --ignore-scripts` e SCA com catraca | `lib/agent/runtime.ts`, `lib/octa/guard.ts`, `lib/octa/shit.ts`, `scripts/vet-*.mjs`, `config/vetting/` | `guard.test.ts` |
| P2 Segredos | Cofre AES-256-GCM, oculto por padrão, escopo por ação. `{{secret:nome}}` só vira valor no executor, a saída volta redigida, a auditoria não guarda o valor. Rotação/TTL. Virtual keys do LiteLLM com budget, e budget estourado vira recusa | `lib/octa/secrets.ts`, `lib/octa/litellm.ts` | `secrets.test.ts` |
| P3 Anti-alucinação | Suite canônica com groundedness, tool-truth, repetibilidade e drift. Juiz recebe snapshot congelado. Auto-cura re-ancora e **re-roda** (nunca edita a saída). Painel 🩺 em `/octa/saude` | `lib/octa/evals/*`, `app/api/octa/*`, `components/octa/PainelSaude.tsx` | `evals/core.test.ts` |
| P4 Fortificação | Loop validar → benchmark → juiz read-only, com checagem de integridade dos inputs do avaliador. Só vira "oficial" com PASS. Executor de contêiner sem rede e inputs `:ro` | `lib/octa/fortify.ts` | `fortify.test.ts` |
| P5 Arte + mobile design | Genart determinístico (seed → SVG idêntico) com determinism-check. Skills `genart` e `appllama-app-design-skill` vendorizadas por SHA, **sem** o MCP pago. Fix no parser de SKILL.md (escalar `>` e mapa aninhado) | `lib/octa/genart.ts`, `lib/octa/skills.ts`, `vendor/skills/`, `lib/agent/skills.ts` | `genart.test.ts` |
| P6 Canal mobile | E2E com handshake no padrão Noise_IK e anti-replay. Pareamento por código de uso único, revogação. Protocolo fechado, sem shell. Aprovação pelo celular entra como `ApproveFn` | `lib/octa/mobile/canal.ts` | `mobile/canal.test.ts` |
| P7 Lacunas 3, 1, 5 | Conteúdo externo vira DADO cercado (fronteira aleatória) com sinal de injeção, e depois de um sinal toda escrita exige humano. Trace com custo e replay. Checkpoint/rollback por run fora do histórico git. `runOctaTool` costura tudo | `lib/octa/untrusted.ts`, `trace.ts`, `checkpoint.ts`, `runner.ts` | `p7.test.ts` |

## O que **não** está feito (portões do dono / infra)
1. **Chaves reais** no LiteLLM (`LITELLM_URL`, `LITELLM_MASTER_KEY`) e `OCTA_VAULT_KEY` (`openssl rand -base64 32`). Sem elas, o cofre não sobe e a rotina de evals responde 503.
2. **`prisma db push`**, para criar `OctaSecret`, `OctaSecretAudit` e `OctaEvalRun`.
3. **Cron** da rotina diária, em janela segura, na VPS:
   `0 4 * * * curl -fsS -X POST -H "Authorization: Bearer $OCTA_CRON_SECRET" https://<host>/api/octa/evals/run`
4. **Infra dos contêineres** (`ExecutorContainer` monta o `docker run`, mas precisa de uma imagem e de um host com Docker), além do **relay/coturn** do canal mobile. A negociação LAN→P2P→TURN→relay ainda é só interface.
5. **Android**: está em handoff separado, ainda não aberto.
6. **MCP Appllama** (pago): continua desligado. A skill funciona sem ele.
7. **Dívida de SCA**: são 71 advisories high/critical herdadas, 7 delas critical (`sharp`, `tar`, `ws`, `uuid`…), listadas em `config/vetting/audit-baseline.json`. O CI só barra advisory nova.
8. **Ligar a flag** `NEXT_PUBLIC_OCTA_CODE=1` (é valor de build).

## Ressalvas honestas
- O handshake do canal mobile **segue o padrão** Noise_IK com primitivas do `node:crypto`. Não é uma implementação certificada do Noise Protocol.
- `detectarInjecao` é heurística: ela sinaliza, não garante. A defesa principal é a cerca de DADO somada à exigência de humano depois de um sinal.
- Ainda não existe a UI de chat/IDE do Octa (fases F0–F6 do `HANDOFF_OCTA_CODE.md`). O pack é a camada de segurança e confiabilidade que essa UI vai usar através de `runOctaTool`.
- O agente padrão sob avaliação (`octa-chat` via LiteLLM) não foi rodado de verdade, porque o gateway ainda não existe.
