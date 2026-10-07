# Avatares vivos dos agentes (estilo anime)

Cards e chats com o agente "com vida": respira, pisca, sorri no hover, pensa, fala junto ao stream
e sorri ao concluir. MVP em **sprites** (MIT puro), com o motor **Live2D** pronto (liga sozinho quando o agente tiver modelo próprio).

## Como funciona

```
persona (lib/avatars/looks.ts)        ESTÚDIO (tela dividida, o dono vê tudo ao vivo)
        │                             ┌──────────────────────────┬─────────────────────────────┐
        ▼                             │ persona + prompt-base    │ AgentAvatar já animando     │
promptBase ──► Gemini image ──► BASE  │ estados: aprovar/↻/✎     │ prévias 64/44/28 px         │
                    │ (texto→img)     │ salvar (só aprovados)    │ quadros aparecendo 1 a 1    │
                    ▼                 └──────────────────────────┴─────────────────────────────┘
promptEdicao(estado) ──► Gemini image (img→img, a partir da MESMA base)
                    ▼
máscara de diferença (lib/avatars/mascara.ts): só a região mudada é colada na base
→ trocar de quadro não treme  →  WebP 512 + miniatura 160 recortada no rosto
```

- **Quadros**: `idle` (base), `blink`, `talk`, `talk_half`, `smile` (hover), `happy` (concluiu),
  `think` (pensando), `confused` (erro). Obrigatórios: `idle` + `blink`; o resto cai no idle.
- **Sinais do app → quadro** (`lib/avatars/estados.ts`): `pensando` → think · `falando` → boca
  irregular (idle/talk_half/talk) · `pensando|falando → idle` = sorriso de 1,6 s automático ·
  `erro` → confused + tremidinha · hover → smile + paralaxe "olha pro cursor".
- **Modelo de imagem**: `gemini-2.5-flash-image` no Vertex (os ids do Imagen respondem 404 neste
  projeto — inclusive o default do Studio em `lib/studio/imagen.ts`). A cota compartilhada estoura
  em rajada: o cliente gira entre regiões no 429 (`AVATAR_IMAGE_LOCATIONS`).

## Onde aparece

| Lugar | Comportamento |
|---|---|
| Admin → Agents (cards) | avatar vivo no card, reage ao hover do card; botão **✨ avatar vivo** abre o estúdio |
| Sala de Pesquisa / Estudos (`ResearchChat`, `StudyCoworkChat`) | pílula da Aura na resposta mais recente: pensa → fala → sorri |
| research-lab (chat do PDF) | indicador "pensando" com a Aura viva; bolhas com o idle |
| Escritório (canal) | "está escrevendo…" fala; chips reagem; lista de @ fica estática |
| Mentores (grid/carrossel) | ganham vida quando o admin criar o avatar do mentor |
| Qualquer `<img>` legada | `avatarPadraoDe()` (roster) devolve o idle quando existe |

`<AgentAvatar agentId estado hover destaque vivo manifest />` — sem `agentId`/manifesto é a foto
de sempre (compatível com todos os usos antigos).

**Performance**: lazy (fora da tela só o idle), orçamento de vida de **2 vivos por vez** (1 no
celular/toque/economia de dados; lá o card parado fica estático e só reage a sinal ativo),
`prefers-reduced-motion` = quadro do estado sem nenhum movimento.

## O avatar É o chat

- **Presença** (`lib/avatars/presenca.ts`): o chat publica o que está fazendo; todos os rostos da
  Aura seguem juntos (aba, boas-vindas, rosto ao lado da resposta). Sinais: `ouvindo` (o usuário
  digita: inclina e acena), `pensando`, `falando`, sorriso automático ao concluir.
- **Boas-vindas sem texto**: o chat vazio mostra só a Aura grande. Ela **se apresenta falando** com
  a voz real (Aoede) — `voz.saudacoes` no manifesto, clipes em `public/avatars/aura/voz/` gerados por
  `node --env-file=.env scripts/avatars/gerar-saudacao.mjs aura`. Toca sozinha 1× por sessão quando
  o navegador permite áudio (usuário já interagiu); tocar no rosto repete. A boca segue o volume do
  áudio (`components/agents/avatar/falar.ts`, Web Audio).
- **Rosto ao lado de cada resposta** (sem nome); só o mais recente vive. Na 1ª mensagem o rosto
  grande viaja (layoutId) até a resposta.
- **Aba do chat** ("Chat"/"Aura" na sala de estudos, "Conversa" na pesquisa): a bolinha é o rosto,
  espelha o chat de qualquer aba e mostra um anel "respondeu" se ela terminou com o chat fechado.
- **Landing**: cartão "Aura ao vivo" no hero (desktop) + rosto no botão "Iniciar chat".
- **Modo voz (próximo)**: o mesmo `falarClipe`/`boca` serve pro TTS das respostas — publicar o nível
  do áudio em `definirPresenca(agentId, { sinal: "falando", boca })`.
- Prova sem login: `/dev/avatares/chat` (dev).

## Criar avatares

**Etapa A — no Claude Code (dev):** `node server.js` → `http://localhost:3000/dev/avatares`, aberto
no painel do navegador ao lado da conversa. Escolha o agente, "gerar avatar", acompanhe cada estado
aparecer, aprove/rerole/ajuste e **salvar** → `public/avatars/<id>/` + `manifest.json` +
`public/avatars/index.json` (vão pro git). A rota `/api/dev/avatares` e a página dão 404 em produção.

**Etapa B — no admin (self-service):** Admin → Agents → **✨ avatar vivo** no card. Mesmo estúdio;
"partir da foto atual" usa a foto do agente como base. Salva no Mongo (`AgentAvatarQuadro`), servido
por `/api/agents/avatars/<id>/<estado>.webp?v=` (imutável). "apagar avatar vivo" volta pra foto.
Precisa de `NEXT_PUBLIC_AGENTS_ADMIN=1` (já usado pelo gateway de agentes) e credencial do Vertex.

**Manutenção em lote** (refazer só alguns estados de um set aprovado, mesma base):
`npx tsx scripts/avatars/gerar.ts aura --estados think,confused`.

## Live2D (upgrade, fase 4)

Basta o manifesto do agente ter `live2d: { model: "/…/x.model3.json", expressoes: { feliz: "…",
pensando: "…", hover: "…" } }` — o `AgentAvatar` passa a usar o Live2D sozinho
(`NEXT_PUBLIC_AVATAR_ENGINE=sprite` força sprites em tudo). O runtime (Cubism Core + PixiJS 7 +
pixi-live2d-display) carrega do CDN **só** quando um card desses entra na tela; boca via
`ParamMouthOpenY`, olhar no hover via `focus`, expressões por sinal. Sem modelo, no celular ou com
qualquer falha → sprite. **Nenhum modelo foi incluído** (os de amostra da Live2D não vão pra
produção) — o próximo passo é o artista entregar os rigs próprios.

### Licença do Cubism Core

- Cubism Core é proprietário (Live2D Inc.): https://www.live2d.com/en/sdk/license/ — a página
  isenta indivíduos/pequenas empresas (cita ¥20 mi/ano), exceto "Expandable Applications".
- **O dono confirmou (07/out/2026) que a Zaeon tem as permissões necessárias.** Por isso o Live2D é
  o motor padrão quando houver modelo próprio.

## Créditos (libs)

- Motor de sprites: código próprio (sem dependência).
- Live2D (opcional, via CDN): [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)
  (MIT) — fork mantido [RaSan147/pixi-live2d-display](https://github.com/RaSan147/pixi-live2d-display)
  (MIT, pacote `pixi-live2d-display-lipsyncpatch`); [PixiJS](https://github.com/pixijs/pixijs) (MIT);
  Cubism Core (proprietário, ver acima).
- Arte: gerada pelo próprio pipeline (Gemini image no Vertex) a partir dos looks em
  `lib/avatars/looks.ts`.

## Pendências

- [ ] Dono: aprovar no estúdio os sets das personas (Aura já tem idle/blink/talk½/smile/think
      aprovados; faltam talk/happy/confused) e criar Zaeon, Nina, Caio, Téo, Zenita, Davi, Scholar,
      Examiner — com o dono vendo, como pede o handoff.
- [ ] Dono: `prisma db push` (cria a coleção/índice `agent_avatar_quadros`) antes de usar a Etapa B.
- [ ] Modelos Live2D próprios por agente (artista/rig) → `live2d.model` no manifesto.
- [ ] Futuro: cabeçalho da sala com o agente ativo; VRM 3D pro avatar grande no ciberespaço.
