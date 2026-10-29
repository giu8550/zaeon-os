# Fluxo agêntico no Hermes

O Hermes é o centro: toda tarefa agêntica vira um **cartão** no quadro `zaeon`, cada cartão tem **uma worktree e uma branch**, e o dispatcher entrega o cartão pra uma das três faixas. Os IDEs (Qoder, Zed) ficam pra ler, revisar e mexer na mão.

```
você ──► hermes (perfil default = orquestrador)
           │  quadro "zaeon" (projeto zaeon-os)
           ├─► claude-code ── claude -p ──► .worktrees/<id>  (branch zaeon-os/<id>-…)
           ├─► codex-cli  ── codex exec ─► .worktrees/<id>
           └─► manus      ── API Manus ──► relatório anexado ao cartão (nuvem, sem worktree)
                                             │
                    revisão ◄── Qoder / Zed (scripts/hermes/abrir.sh <id>)
```

## As faixas

| Perfil Hermes | Agente | Use pra |
|---|---|---|
| `claude-code` | Claude Code CLI | UI/React/Next, refatoração grande, cyberespaço/3D, revisão e arquitetura |
| `codex-cli` | Codex CLI | backend/APIs, scripts, testes, migrações, segurança, tarefas bem especificadas |
| `manus` | Manus (API v2) | pesquisa web, navegação, relatórios, slides, sites — tudo fora do repo |
| — | Qoder (IDE) | faixa secundária: revisão humana da worktree, ajustes finos à mão |

Cada perfil é um Hermes com um `SOUL.md` que diz como pilotar o seu CLI (`~/.hermes/profiles/<perfil>/SOUL.md`). O worker escreve o brief, roda o CLI dentro da worktree do cartão, confere `git diff` e testes, faz commit na branch e termina em **review** — push e PR só se o cartão pedir.

## Uso do dia a dia

```bash
# tarefa nova (worktree + branch criadas sozinhas no 1º claim)
hermes kanban create "Botão de exportar no editor" --assignee claude-code --project zaeon-os --workspace worktree --body "…critério de pronto…"

# deixar o Hermes decompor um objetivo em cartões e escolher as faixas
hermes   # no chat: "decomponha <objetivo> no quadro zaeon"

# rodar o dispatcher (pega os cartões prontos e chama as faixas)
hermes kanban daemon -v          # ou: hermes kanban dispatch (uma passada)

# acompanhar
hermes kanban ls
hermes kanban tail <id>
hermes dashboard                 # quadro visual

# revisar no IDE
scripts/hermes/abrir.sh <id>       # Qoder
scripts/hermes/abrir.sh <id> zed
```

## Trazer worktrees antigas pro quadro

Worktrees criadas fora do Hermes (`.claude/worktrees/…`, Codex, Qoder) **não precisam ser movidas**. O cartão aponta pra pasta e branch atuais:

```bash
scripts/hermes/adotar-worktree.sh .claude/worktrees/<nome>            # faixa pelo prefixo da branch
scripts/hermes/adotar-worktree.sh <pasta> codex-cli "título do cartão"
```

O cartão nasce **bloqueado** com os commits que faltam no main. Escreva o que falta no corpo e libere com `hermes kanban unblock <id>`. Rodar de novo na mesma pasta não duplica o cartão.

## Configuração (já feita nesta máquina)

- Projeto Hermes `zaeon-os` → `~/Documents/Projects.nosync/zaeon-os`, quadro `zaeon` ligado a ele.
- Perfis `claude-code`, `codex-cli`, `manus` clonados do default (mesmo modelo/provedor).
- `manus-task` em `~/.hermes/profiles/manus/bin/` (link em `~/.local/bin`): ponte pra API do Manus (`run`, `wait`, `reply`, `me`).
- `.worktrees/` já está no `.gitignore`.

Pendências do dono: `claude auth login` (o CLI do terminal não está logado), e a chave do Manus em `~/.hermes/profiles/manus/.env` como `MANUS_API_KEY=…` (gerar em manus.im → Settings → Developers); teste com `manus-task me`.
