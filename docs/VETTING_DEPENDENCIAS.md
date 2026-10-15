# Política de vetting de dependências (Pack Octa §1)

Nada de terceiro entra no Zaeon, nem pacote npm, nem skill, nem repo indicado pelo dono, sem passar por isto.

## Checklist (antes do PR)
1. **Ler** README, LICENSE e o código dos pontos sensíveis (rede, FS, segredos, exec, install scripts).
2. **Pinar**: npm = versão exata no lockfile; repo/skill = commit SHA (nunca `latest`/branch).
3. **Risco**: anotar o que acessa (rede? disco? segredos? executa?) e o que foi deixado de fora.
4. **Isolar**: rodar primeiro fora da produção (scratch/contêiner), nunca perto das chaves reais.
5. **Registrar** em `config/vetting/repos.json` (repos/skills) ou `config/vetting/install-scripts.json` (pacotes com install script).

## O que o CI garante (`.github/workflows/ci.yml`)
| Passo | Script | Quebra quando |
|---|---|---|
| Vetting | `scripts/vet-deps.mjs` | lockfile ausente/v1; pacote com `preinstall/install/postinstall` fora da lista revisada ou com versão nova; repo **rejeitado** aparece no `package.json` |
| Install | `npm ci --ignore-scripts` + `npm rebuild` | nenhum script roda antes do vetting |
| SCA | `scripts/vet-audit.mjs` | advisory **high/critical nova** nas deps de produção (as herdadas estão na baseline) |

## Dívida herdada
`config/vetting/audit-baseline.json` lista as advisories high/critical que já existiam quando o SCA entrou (71 em 15/out/2026, incluindo 7 critical em `sharp`/`tar`/`ws`/`uuid`/…). É dívida a pagar, não aprovação. Ao corrigir, tire da lista; nunca acrescente sem revisão.

`config/vetting/install-scripts.json` foi gerado como **baseline** (8 pacotes conhecidos: prisma, sharp, canvas, esbuild…). Entrada nova exige ler o script.

## Repos indicados (out/2026)
Ver `config/vetting/repos.json`. **`davidcarliez/trustmebro` está REJEITADO**: é ferramenta de jailbreak que fabrica saída de tool. O substituto é `lib/octa/evals`, que detecta em vez de enganar.

Regra de ouro: confiança ≠ ausência de revisão.
