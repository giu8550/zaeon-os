# HANDOFF — Áudio do ciberespaço + fix da música + ícone (cérebro azul)

**Para:** agente executor
**Branch:** encaixar na do cyber (`fix/lounge-realtime`) — é lá que vivem `components/cyber/*`, `engine.ts`, `CenaCosmica.ts`.
Três entregas num PR só: (A) ícone cérebro azul, (B) fix da música que corta, (C) sistema de áudio do ciberespaço.

---

## A. Ícone (cérebro azul) — JÁ TROCADO no working tree, só garantir que entra no PR

O favicon da aba e os ícones PWA estavam no mascote antigo. Foram **regenerados do `public/assets/zaeon-brain.png`** (cérebro azul) e já estão no disco. Incluir no commit:
- `app/favicon.ico` (multi-tamanho 16→256)
- `public/icons/icon-192.png`, `public/icons/icon-512.png`
- `public/icons/apple-touch-icon.png`
- `public/icons/maskable-192.png`, `public/icons/maskable-512.png`

Metadata/manifest já apontam pra esses caminhos (`app/layout.tsx` `icons`, `app/manifest.ts`) — não precisa mexer no código, só versionar os binários. **Aviso:** favicon é cacheado forte; validar em aba anônima / hard refresh. (Opcional: bump de versão `?v=2` nos `icons` do metadata pra forçar atualização nos clientes.)

---

## B. Fix: a música da Zaeon começa e **para abruptamente**

### Causa (confirmada no código)
Um ÚNICO elemento `globalAudio` (`window.zaeonAudio`, criado em `components/main/navbar.tsx:92`) tem **dois donos** que brigam, coordenados por um flag global `introMusicActive` + eventos custom:
- `src/components/main/intro-overlay.tsx`: dá `play()` (async), toca ~60s em loop e só então faz fade-out de 10s e `pause()`. Dispara `zaeon-music-sync` (ligar) e `zaeon-music-end` (fim).
- `components/main/navbar.tsx:105` efeito `[pathname, isHome]`: se `isHome && !introMusicActive` → **`pause()` + `currentTime=0` + reset de `src` (corte seco)**.

A corrida: o `play()` do intro é assíncrono e o `zaeon-music-sync` (que liga `introMusicActive=true`) só dispara **depois** que a promise resolve. Entre o efeito do navbar rodar (home montou) e o flag virar true, existe uma janela em que `isHome && !introMusicActive` → o navbar **mata a faixa no meio**. Qualquer re-render que rode o efeito `[pathname, isHome]` nessa janela corta. Resultado: música começa e para seco em vez de fadear.

### Fix (dono único + gesto do "Iniciar")
O botão **"Iniciar"** da intro (`src/components/main/intro-overlay.tsx`, `PT_TEXT="Iniciar"`) já é o gesto do usuário que libera áudio no navegador — usar ele como o **unlock único**.
1. **Um dono só.** Centralizar o ciclo de vida da música num controlador único (ex. `lib/audio/music.ts` ou um `AudioProvider`) com API explícita: `unlock()` (no clique do Iniciar), `playTheme()`, `fadeTo(vol,ms)`, `stop()`. Intro e navbar **chamam** esse controlador em vez de cada um dar `play`/`pause` no mesmo elemento.
2. **Matar o corte do navbar.** O efeito `[pathname, isHome]` não pode dar `pause()+currentTime=0` enquanto a música de entrada está tocando OU fadeando. Trocar o flag frágil `introMusicActive` por um estado de verdade no controlador (`estado: "tocando"|"fade"|"parado"`); navbar só pausa se `estado==="parado"`.
3. **Sem corte seco em lugar nenhum.** Toda parada passa por `fadeTo(0, ~800ms)` e então `pause()`. Nunca `pause()` direto no meio.
4. **Handoff suave pro ambiente.** Quando a música de entrada termina, em vez de silêncio seco, **cross-fade** pro leito ambiente do ciberespaço (parte C) se o usuário já entrou na cena; senão fade pra silêncio limpo.
5. Faixas disponíveis hoje: `boot-track.mp3` (intro), `zaeon-theme.mp3`, `zaeon-theme-chill.mp3`, `zaeon-theme-uplift.mp3` — `chill` é bom candidato a leito ambiente.

Critério: dar play no Iniciar → música toca inteira e **fadeia** no fim (sem corte); navegar/voltar pra home não corta no meio; nenhuma faixa reinicia sozinha.

---

## C. Sistema de áudio do ciberespaço

### Arquitetura (3 camadas, um unlock só)
O ciberespaço é three.js (`engine.ts` + `CenaCosmica.ts`), então usar o áudio nativo do three pra espacialização:
1. **Espacial 3D (`THREE.AudioListener` na câmera + `THREE.PositionalAudio` nos objetos):** o som atenua com a distância e paneia sozinho. Fontes posicionais em loop:
   - buraco negro → `blackhole-hum` (grave, bem baixo);
   - base/cristais → `crystals` (shimmer vítreo);
   - landmark Zaeon → `fire` (crepitar) ; neurônios subindo → `neuron-chime` disparado esporádico.
2. **Leito ambiente (não-posicional):** `space-bed` em loop, bem quieto, preenchendo o silêncio (ou cross-fade do `zaeon-theme-chill`).
3. **Eventos + UI (one-shots):** passos, pulo, sentar, whoosh de entrada, pop de chat, chegada/saída de avatar, botão Estudar, ping de proximidade. Blips de UI **reusam** o `GlobalClickSound` que já existe (`mouse-click`/`menu-hover`/`menu-back`).
4. **⭐ Nave (vetor sonoro protagonista):** `ship-takeoff` dispara ao **iniciar voo** (entrar no ciberespaço / sair do solo), encadeando no leito espacial; `ship-landing` ao **pousar** (chegar/assentar na base ou voltar ao solo); enquanto a nave está em movimento rápido, `ship-flight` toca em loop (fade-in na decolagem, fade-out no pouso); `ship-idle` em loop baixinho com a nave parada. A nave é posicional (`PositionalAudio` no objeto da nave).

### Espacialização — COMO garantir que é mesmo 3D (não só estéreo)
> O dono pediu explicitamente áudio espacial. Checklist que torna isso real:
- **Um `THREE.AudioListener` na câmera** (`camera.add(listener)`), criado só após o gesto do Iniciar.
- **Fontes no mundo = `THREE.PositionalAudio(listener)`**, adicionadas ao `THREE.Object3D` da fonte (`navio.add(posAudio)`, `base.add(...)`, `blackhole.add(...)`), **não** `THREE.Audio` (esse é 2D/global, serve só pro leito ambiente e UI).
- **Buffers MONO** — `PositionalAudio` só espacializa mono. Os 4 sons da nave já são mono ✔. Qualquer som posicional futuro idem.
- **Modelo de distância:** `setRefDistance(~6)`, `setMaxDistance(~60)`, `setRolloffFactor(~1.2)`, `setDistanceModel('linear'|'inverse')` — assim o som cai com a distância e some longe.
- **Pan por orientação:** como o listener segue a câmera e a fonte vive no objeto, o pan L/R e a atenuação saem de graça quando o dono orbita/anda.
- **Nave do próprio jogador vs. dos outros:** a nave do JOGADOR LOCAL pode usar `rolloff` baixo (ou um `THREE.Audio` 2D) pra não panecar forte quando ele gira a câmera; as naves dos OUTROS jogadores são `PositionalAudio` cheias — é o que faz você ouvir de que lado o colega chegou/decolou.
- **Teste de aceite espacial:** com um colega na cena, a decolagem/pouso/voo dele deve soar **do lado correto** e **sumir com a distância**; girar a câmera muda o lado.

### Regras obrigatórias
- **Unlock por gesto:** `AudioContext`/`listener` só iniciam depois do clique no **Iniciar** (mesmo gesto do fix B). Nada de autoplay.
- **Toggle + volume:** respeitar o `localStorage "zaeon_sfx"` que já existe (on/off) e adicionar um volume master (ex. `zaeon_volume`). Música e SFX com faders separados seria ideal.
- **Mobile:** destravar o áudio no primeiro `touchstart` também.
- **Performance:** `PositionalAudio` com `setRefDistance`/`setMaxDistance` (cull por distância), pool/clone pra one-shots sobrepostos, teto de vozes simultâneas (~12), e `dispose()` de todos os buffers/fontes no teardown do engine (igual os outros recursos three).
- **Loops sem emenda:** arquivos de loop precisam casar início/fim (sem silêncio nas pontas).

### Formato dos arquivos
Web: `.ogg` (menor, loop limpo) de preferência; `.mp3` serve de fallback/aceitável. Loops curtos (4–20s) que repetem bem; one-shots < 2s. Mono pra fontes posicionais (espacializa melhor), estéreo pro leito ambiente.

---

## 📦 INVENTÁRIO FINAL — todos os 22 sons PRONTOS em `public/assets/sounds/cyber/`

Nada a baixar: tudo já está no repo, nos nomes-alvo. Coluna **espacial** diz como tocar (ver §Espacialização).
Licenças em `public/assets/sounds/cyber/CREDITS.md` (reais = conferir termos; synth = CC0).

**Leito + fontes posicionais (loops):**
| arquivo | gatilho / fonte no mundo | espacial |
|---|---|---|
| `space-bed.ogg` | leito ambiente do mundo (432 Hz, relaxante), sempre tocando baixinho | `THREE.Audio` **2D** (estéreo) |
| `blackhole-hum.ogg` | preso ao buraco negro | `PositionalAudio` (mono) |
| `crystals.ogg` | preso à base (cristais) | `PositionalAudio` (mono) |
| `fire.ogg` | preso ao landmark Zaeon (fogo) | `PositionalAudio` (mono) |
| `ship-flight.ogg` | loop enquanto a nave voa (fade-in na decolagem, fade-out no pouso) | `PositionalAudio` (mono) |
| `ship-idle.ogg` | loop baixinho com a nave pousada | `PositionalAudio` (mono) |

**Eventos one-shot:**
| arquivo | gatilho | espacial |
|---|---|---|
| `ship-takeoff.ogg` | **iniciar voo** (entrar no ciberespaço / sair do solo) | `PositionalAudio` na nave* |
| `ship-landing.ogg` | **pousar** (chegar/assentar na base) | `PositionalAudio` na nave* |
| `step-1/2/3.ogg` | passos ao andar (alternar as 3, sutis) | `PositionalAudio` no avatar |
| `jump.ogg` | pular | `PositionalAudio` no avatar |
| `land.ogg` | aterrissar do pulo | `PositionalAudio` no avatar |
| `sit.ogg` | sentar na cadeira da base | `PositionalAudio` no avatar |
| `near-ping.ogg` | ficar perto de um colega (pode conversar) / perto da base | `PositionalAudio` |
| `neuron-chime.ogg` | brilho ocasional dos neurônios subindo da base | `PositionalAudio` na base |
| `rise.ogg` | dono subindo pro topo da Zaeon | `PositionalAudio` |
| `whoosh-hyperspace.ogg` | transição de entrada no ciberespaço (play) | `THREE.Audio` **2D** |
| `study-confirm.ogg` | botão Estudar / entrar na sala de estudos | `THREE.Audio` **2D** (UI) |
| `chat-pop.ogg` | mensagem nova no chat | `THREE.Audio` **2D** (UI) |
| `join.ogg` / `leave.ogg` | avatar de um colega chega / sai | `PositionalAudio` na posição dele |

\* nave do **jogador local**: usar rolloff baixo ou `THREE.Audio` 2D pra não panecar ao girar a câmera; nave dos **outros** = `PositionalAudio` cheio.

**Já existem no projeto (reusar, não recriar):**
- **UI:** `/assets/sounds/mouse-click.mp3` · `menu-hover.mp3` · `menu-back.mp3` (via `GlobalClickSound`).
- **Música:** `/assets/sounds/zaeon-theme-chill.mp3` (leito musical alternativo), `boot-track.mp3` (intro).

**Arquivos-fonte de edição** (`/assets/sounds/leberch-432hz-*.mp3`, `freesound_community-*.mp3`, `spaceship-*-epic-stock-media-*.mp3`): são as matérias-primas dos reais; podem sair do bundle público (mover pra `/_sources/`). Ver CREDITS.md.

---

## 🎧 Recap — tudo que sobe NESTE PR
1. **Ícone cérebro azul** (6 binários regenerados) — §A, já no working tree.
2. **Fix da música** (dono único + fade, sem corte seco) — §B, só código.
3. **Sistema de áudio do ciberespaço** — §C: **os 22 sons já estão prontos** em `public/assets/sounds/cyber/` (inventário acima, com gatilho e espacial/2D de cada). O trabalho do agente é **plugar no engine**, não produzir áudio.
4. **UI/música reusadas** (já no projeto): `mouse-click`/`menu-hover`/`menu-back` + `zaeon-theme-chill`.
5. **`CREDITS.md`** pronto: separa os **reais editados** (432 Hz, tigela de cristal, passos — Freesound; nave — Epic Stock Media → **conferir termos antes do deploy público**) dos **synth CC0**.

Tudo neste PR; não há sons pendentes.

---

## Critérios de aceite
- [ ] Ícone cérebro azul na aba e no PWA (validado em aba anônima); binários no PR.
- [ ] Música toca no Iniciar e **fadeia** no fim; não corta no meio; não reinicia sozinha; dono único.
- [ ] **Nave espacial de verdade:** `ship-*` tocam via `PositionalAudio` (mono) presos ao objeto da nave; som de outro jogador vem do lado certo e some com a distância; girar a câmera muda o lado. Leito ambiente/UI em `THREE.Audio` 2D.
- [ ] `AudioContext` só após o gesto do Iniciar; toggle `zaeon_sfx` + volume respeitados; unlock no touch (mobile).
- [ ] Sem corte seco em nenhuma transição; loops sem emenda; `dispose()` sem vazamento; teto de vozes.
- [ ] Os 22 sons de `cyber/` disparando nos gatilhos do inventário; cada um no modo (PositionalAudio vs 2D) indicado.
- [ ] `CREDITS.md` conferido e preenchido (termos de Freesound/Epic Stock Media validados antes de deploy público); arquivos-fonte fora do bundle se preciso.

## Resumo
Incluir os ícones já trocados; unificar o dono da música e matar o corte seco do navbar usando o "Iniciar" como unlock; e plugar no engine o áudio em 3 camadas (espacial via `THREE.PositionalAudio` nos objetos, leito ambiente/UI em `THREE.Audio` 2D, one-shots), respeitando `zaeon_sfx` + volume. **Os 22 arquivos já estão em `public/assets/sounds/cyber/`** — é integração, não produção de áudio.
