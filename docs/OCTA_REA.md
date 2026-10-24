# REA (Reverse Engineer Anything) no Octa

Engenharia reversa dentro do Octa, a partir do `morluto/rea` (MIT) — "uma MCP pra engenharia reversa de binários, aplicações e comportamento em runtime".

Segue o MESMO modelo do Appllama no Octa: a **skill** (metodologia) é vendorizada; o **MCP** (o motor pesado) é portão do dono.

## O que entrou (fatia 1 — PR #…)
- `vendor/skills/reverse-engineer-anything/` — a skill do REA, SÓ markdown (SKILL.md + references/ + DISCLAIMER + LICENSE), pinada por SHA (`rea-agents-6.5.0`, `3b79af2…`) em `config/vetting/repos.json`. Scripts, código nativo e `install.sh` do REA **não** foram vendorizados.
- Atrás de **`OCTA_REA=1`** (portão do dono): sem a flag, a skill nem entra em `octaSkills()`. Engenharia reversa é dual-use.
- Progressive disclosure, como as outras skills do Octa: só nome+descrição no prompt; a metodologia sai via `activate_skill`. Instalar a skill **não** registra o MCP nem instala motor de análise.

## Uso lícito (DISCLAIMER do REA, preservado 1:1)
Pesquisa de segurança, análise de malware, pesquisa de vulnerabilidade e divulgação coordenada, CTF e educação, interoperabilidade, preservação de software, e auditar/depurar software que você **possui ou está autorizado** a examinar.

O REA (e, portanto, o Octa com a skill) **não** ajuda a: burlar DRM/verificação de licença/anti-cheat/medidas de proteção; criar cheats; burlar autenticação/controle de acesso em sistemas sem autorização; copiar software proprietário. Esses pedidos são recusados — o guard do Octa (deny-by-default) fica por cima.

## O que falta (fatias 2–3)
- **Fatia 2 — ponte MCP (portão do dono):** ligar o laço do agente Octa ao MCP `rea-agents`, como o seam do MCP do Appllama. Dá ao Octa as ferramentas REAIS do REA (todas as features, 1:1, porque É o REA).
- **Fatia 3 — infra:** subir o MCP `rea-agents` num host com os motores (Ghidra/Hopper/IDA p/ binário nativo; binwalk/unblob p/ firmware; PTY p/ comportamento). Os analisadores estáticos (JS/.NET/SQLite/HAR/EVM) não precisam de motor nativo. **Decisão do dono: onde esse host roda** (a VPS 24 GB não tem Ghidra; a Contabo; ou um host dedicado).
