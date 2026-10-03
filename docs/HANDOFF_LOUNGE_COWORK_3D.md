# Handoff — Lounge vira sala de co-working 3D (MVP em prod, assets 3D melhoram depois)

> Objetivo: transformar a cartolina do Lounge num **espaço de co-working 3D** onde até **5 alunos** se
> encontram com **avatares que andam**, **conversam** (chat), colam **notas editáveis** (inclusive puxadas do
> chat da Sala de Pesquisa) e **geram artefatos** juntos. **Decisão do dono:** subir uma **versão básica em
> produção agora** e **aprimorar os assets 3D depois**. A memória NÃO vive mais aqui — ela é o cérebro
> (`HANDOFF_CEREBRO_AURA.md` / `HANDOFF_FIX_CEREBRO_BUSCA_MEMORIA.md` §4). A cartolina agora é canvas colaborativo.

## Protótipo de referência (testado)
- **`docs/prototypes/cartolina-3d.html`** — cena **three.js real** (r149 embutido), avatares **cientista** low-poly
  (jaleco branco por padrão), câmera angulada tipo Sims/Gather, andar WASD + clique-no-chão, colegas que vagam,
  **chat da sala** (input → balão de fala sobre o avatar + log), **anel azul marcando "Você"**, notas DOM
  projetadas (editáveis/removíveis, incl. "do chat"), **artefato** = molécula 3D ao lado do avatar, proximidade.
  Gerado por `docs/prototypes/build_cartolina3d.py` (embute `three.min.js`). Serve de espec viva — portar a lógica
  pro app (que **já tem three.js instalado**), não o three embutido.
- Protótipo 2.5D anterior (`cartolina-cowork.html` + `gen_sprites.py`) fica como alternativa de asset (sprites).

## Avatar (MVP agora × melhorar depois)
- **MVP:** avatar **cientista procedural** (cápsulas/esferas sombreadas: jaleco branco default, gola/crachá na cor
  de accent do perfil, calça/sapatos escuros, cabelo, olhos) — ver `makeScientist()` no protótipo. Leve, sem
  asset externo, roda em qualquer lugar. **Criação condicionada ao perfil** (nome = usuário; cor accent = perfil;
  regra fina a definir).
- **Depois (aprimorar assets):** trocar o mesh procedural por **Ready Player Me** (GLB realista, SDK grátis,
  **uso comercial OK**) + animações **Mixamo** (idle/walk), OU **baked 3D→sprite** (renderizar o personagem em
  quadros p/ custo = imagem). Observação: `readyplayer.me` é **bloqueado no sandbox de preview/navegador** desta
  ferramenta, mas **funciona no app em produção** pela mesma pipeline three.js. A interface do avatar deve ser
  um componente isolado (`<Avatar3D kind variant/>`) pra trocar o asset sem mexer no resto.

## Arquitetura de produção
**Onde vive:** `components/lounge/` — novo `Cartolina3D.tsx` monta a cena three.js (um único `WebGLRenderer`,
câmera angulada que segue o jogador, `GridHelper` + plano no tom `#0b1226`). Substitui/complementa o board
atual de `LoungeCartolina.tsx`; `useCartolinaCowork.ts` passa a sincronizar por `roomId`.

**Camadas:**
1. **Mundo 3D (three.js):** chão + grid (infinito por ora = plano grande/segue câmera), avatares (grupo por
   usuário com pivôs de perna/braço p/ ciclo de caminhada), artefatos 3D (molécula/prancha/etc. como objetos).
2. **Overlay DOM projetado:** nametags, **notas** (cards editáveis), **balões de fala** — cada um ancorado a uma
   posição 3D e projetado por frame (`vector.project(camera)`), pra manter texto nítido e editável (contenteditable).
3. **HUD:** título, stack de presença (≤5), toolbar (＋Nota, Puxar ponto do chat, Gerar artefato, Centralizar),
   caixa de **chat** (log + input).

**Multiplayer / concorrência (alvo ≤5):** presença por sala —
`{userId, name, colorAccent, x, z, facing, animPhase, lastMsg}` difundida a ~10–15 Hz (throttle), com
**interpolação** dos avatares remotos (lerp de posição/rotação) p/ ficar suave. Chat = eventos de mensagem
(aparecem como balão + no log). Notas e artefatos sincronizados. Opções de transporte (ver
`HANDOFF_FIX_CEREBRO_BUSCA_MEMORIA.md` §5.2), escolher 1:
- **Yjs + y-partykit** (MIT, CRDT p/ notas + awareness p/ presença) — recomendado, permissivo, ≤5 é trivial.
- **Liveblocks** (managed; presence/others/broadcast prontos) — mais rápido de plugar, serviço pago ao escalar.
- **Pusher** (já usado no Lounge) — dá p/ MVP reusando o que existe (canal `room-<id>`, eventos pos/chat/nota),
  porém sem CRDT (notas = last-write). **Para o MVP rápido em prod, Pusher reusado é aceitável.**
Impor **teto de 5** por sala (recusar 6º com aviso).

**Ponte chat→nota:** quando a Sala de Pesquisa marca um "ponto importante" (reusar o sinal do `fixarTurno`/evento
por `scopeId`), vira **nota sugerida** no canvas (aceitar/editar/remover). Aqui é projeção opcional, não memória.

**Artefatos:** o pipeline que hoje gera molécula/prancha/tabela "apertado" no chat ganha alvo "gerar no canvas"
→ instancia o objeto 3D (ou card) na posição do avatar. Começar com 1–2 tipos (molécula, card de imagem).

## Modelo de dados (Mongo/Prisma)
- Reusar/!estender `CollabDoc` (já existe: ownerId, members[], token, kind, content, sourceType/sourceId) como a
  **sala** (kind="lounge_canvas"); `content` guarda `{notes:[{id,x,z,kind,src,text}], artifacts:[{id,type,x,z,data}]}`.
- Presença e chat são **efêmeros** (não persistir no doc; só broadcast). Opcional: últimas N mensagens no doc.
- `members[]` = controle de acesso (IDOR por sessão: só membro lê/escreve a sala).

## Flags & deploy (lição do escritório — NÃO repetir o bug)
- Flag `NEXT_PUBLIC_LOUNGE_3D` **off por padrão**; **cablear como BUILD ARG** no `Dockerfile` **e** em
  `docker-compose.beta.yml` (espelhando o padrão do Pusher/escritório — senão a feature “some” em prod mesmo
  mergeada). Ver `fix/escritorio-build-args` e `AGENTE_SUBIR_ESCRITORIO.md`.
- Mobile: cena 3D é pesada — **fallback** (versão 2D/estática ou desabilitar avatares) em telas pequenas/sem WebGL.

## Segurança
- Acesso à sala só por `members[]` (IDOR por sessão). Sanitizar texto de **chat** e **notas** (XSS — não usar
  innerHTML com conteúdo do usuário; usar textContent). Nada de segredos no client. Teto de 5 aplicado no servidor.

## MVP (agora) × Depois
**MVP em prod:** cena 3D + avatar cientista procedural (default jaleco) do perfil; mover (WASD/clique) + câmera;
presença ≤5 com interpolação; chat da sala (balões + log); notas editáveis/removíveis + ponte do chat; 1 tipo de
artefato; flag + build-arg; fallback mobile.
**Depois:** assets 3D melhores (RPM/Mixamo ou baked sprites); mais tipos de artefato; voz por proximidade;
customização de avatar; grid verdadeiramente infinito; salas múltiplas; emotes.

## Definition of Done (MVP)
- [ ] `Cartolina3D` monta cena three.js no Lounge atrás de `NEXT_PUBLIC_LOUNGE_3D` (build-arg no Dockerfile+compose).
- [ ] Avatar cientista (jaleco default) por usuário, cor/nome do perfil; **anel marca "Você"**.
- [ ] Mover com WASD **e** clique-no-chão (relativo à câmera); câmera segue, gira (arraste) e zoom (roda).
- [ ] Presença ≤5 em tempo real com interpolação; 6º recusado.
- [ ] **Chat da sala**: input → balão sobre o avatar + log; mensagens dos outros aparecem.
- [ ] Notas editáveis/removíveis projetadas; **“Puxar ponto do chat”** cria nota a partir da Sala de Pesquisa.
- [ ] 1 tipo de artefato gerado no canvas.
- [ ] Acesso por `members[]` (IDOR); chat/notas sanitizados.
- [ ] Fallback mobile/sem-WebGL; `tsc --noEmit` limpo; teste dos núcleos (presença/limite 5, projeção, ponte chat→nota).
- [ ] Avatar isolado em `<Avatar3D/>` pra trocar o asset depois sem refatorar a cena.

---
## Estado (out/2026) — MVP implementado (PR feat/lounge-cowork-3d)
| Peça | Onde |
|---|---|
| Flag `NEXT_PUBLIC_LOUNGE_3D` (build-arg Dockerfile/compose/deploy.yml via Variables) + `LOUNGE_3D` server | `lib/lounge3d/tipos.ts`, `lib/lounge3d/server.ts` |
| Sala = `CollabDoc` kind `lounge_canvas` (`content` = `{notes, artifacts}`, `members[]` = IDOR) | `app/api/lounge3d/{route,[id]/route}.ts` |
| Chat efêmero (POST → evento `chat`), posição (`client-pos` 12 Hz direto entre clientes; fallback POST `/pos` 4 Hz) | `app/api/lounge3d/[id]/{chat,pos}` |
| Presença `presence-lounge3d-<id>` com **teto 5 no auth** (conta ocupantes via Pusher REST; quem está dentro reconecta) | `app/api/lounge3d/[id]/pusher-auth` |
| Núcleos puros + testes: sanitização (textContent na UI, nunca innerHTML), ops por item com tetos, admissão, WASD relativo à câmera, interpolação, ponte chat→nota | `lib/lounge3d/sala.ts`, `lib/lounge3d/pontos.ts` |
| Avatar cientista procedural isolado (`criarAvatar` → {group, animar, olharPara, marcarComoEu}) + molécula | `components/lounge/Avatar3D.ts` |
| Cena three.js (câmera Sims, WASD + clique-no-chão, arraste gira, roda = zoom), overlay DOM projetado (tags, balões, notas contenteditable), HUD (presença, toolbar, chat, convite) | `components/lounge/Cartolina3D.tsx`, `useSala3D.ts` |
| Porta do Lounge (convite `?sala=<token>` via `/api/collab/join`, minha sala ou cria) + fallback 2D (mobile / sem WebGL) | `components/lounge/LoungeSala3D.tsx` |
| Ponte Sala de Pesquisa → canvas: resposta estruturada empurra pontos (conceitos/próximos passos) numa fila local; "Puxar ponto do chat" vira nota sugerida | `ResearchChat` → `lib/lounge3d/pontos.ts` |

**Pusher:** posições usam *client events* (`client-pos`) — ligar "Enable client events" no app Pusher; sem isso o cliente cai no fallback via servidor (4 Hz). Sem Pusher configurado: sala funciona sem tempo real (notas/chat só locais ao refresh).
**Não verificado:** multiplayer real (2 navegadores logados), Pusher REST `/users` em prod, celular físico. Verificado local com API simulada: cena, avatar, andar, notas, balão, molécula.
**Depois:** RPM/Mixamo ou sprites baked (só `Avatar3D.ts` muda), mais artefatos, voz por proximidade, emotes, salas múltiplas.
