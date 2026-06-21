# Zaeon OS — Loop de Finalização (prompt + plano para agente autônomo)

> Cole o bloco **PROMPT DO AGENTE** numa sessão de agente (Claude Code / Cowork) com o repo
> `~/Documents/Projects.nosync/zaeon-os` aberto. O agente trabalha em loop, **sem subir o dev
> server** (RAM curta) — valida por transpile por arquivo + `vitest run`. Mantém o verde como
> portão. Commits pequenos; o deploy é automático (push na `main` → GitHub Actions → VPS).

---

## Contexto travado (não re-descobrir)

- **App**: Zaeon OS — Next.js 14 (App Router) + custom `server.js` (Socket.IO) + MongoDB
  (Prisma p/ auth+study, Mongoose p/ scholar/network) + Vertex/Gemini (única IA) + voz neural
  Kokoro (`voice-engine/`, `/api/ai/voice`). Produção real = VPS (`beta.zaeon.space`).
- **Modo de runtime**: `NEXT_PUBLIC_RUNTIME_MODE` default `container` (VPS). `capabilities()` em
  `lib/runtime/mode.ts` é granular (voz server, RAG pesado on; whatsapp só com env).
- **Regra de ouro (uniformidade)**: **onde houver input, haverá modo voz que EXECUTA esse input
  pelo usuário.** Voz/ligação = "modo sem as mãos": a Zaeon clica, digita, navega e salva por ele.
- **Estética**: liquid-glass (vidro translúcido, blur, ring gradiente azul→ciano→violeta,
  brilho especular). Modo claro com **tom suave** que se diferencia do fundo. Desktop primeiro.
- **Verificação (obrigatória a cada passo)**:
  - Transpile por arquivo: `node -e` com `typescript.transpileModule` (category===1) OU `tsc --noEmit` se couber.
  - Testes: `node_modules/.bin/vitest run` (deve ficar 100% verde — esse é o portão).
  - NÃO rodar `next build`/`next dev` localmente (estoura o RAM). O build real roda no CI/VPS.
- **Commits**: pequenos e descritivos. Quem dá push é o humano (via Zed) — ao fim de cada fase,
  liste os arquivos e a mensagem de commit sugerida.
- **Segurança**: segredos só em `.env`/`.env.local` e no VPS. Nunca em git, memória ou chat.
  Super admins (bypass de cotas): zaeondao@gmail.com, donmartinez@aluno.unilab.edu.br, martinez@zaeon.space.

## Já entregue nesta sessão (NÃO refazer)
- Fix do Prisma engine em prod (binaryTargets + openssl runtime no Dockerfile).
- Modo container + thinking do Gemini religado + maxDuration solto.
- Voz unificada no `/api/ai/voice`; fallback do navegador agora respeita gênero.
- `VoicePicker` em Options + rota `GET /api/ai/voices`.
- Menu inicial reformado (módulos expansíveis Pesquisas/Estudos/Projetos + últimas 3 + deep-link).
- **Fix do menu**: `activeTab` do `app/research-lab/page.tsx` agora inicializa do `?tab=` (lazy
  initializer) → "Estudos" abre Sala de Estudos, "Pesquisas" abre Pesquisa.
- CI: `MONGODB_URI` placeholder no build (corrige vermelho).
- Preview aprovado do cabeçalho liquid-glass: `outputs/zaeon-study-header-preview.html` (referência visual).

---

## PROMPT DO AGENTE — copie a partir daqui

Você é o agente de finalização do Zaeon OS. Trabalhe em loop: **planejar → editar → verificar
(transpile + `vitest run`) → manter verde → commit pequeno → repetir**. Nunca suba `next dev`/
`next build` (RAM). Respeite a regra de ouro: todo input tem modo voz que o executa. Estética
liquid-glass, modo claro com tom suave, desktop. Entregue em duas FASES; ao terminar a Fase 1 e
estar verde, comece imediatamente a Fase 2.

### FASE 1 — Experiência (UI + Voz "sem as mãos")

1. **Aplicar o cabeçalho liquid-glass aprovado** em `components/study/MeusEstudosFeed.tsx`
   (referência: `outputs/zaeon-study-header-preview.html`):
   - Pílula de vidro contendo o **⟁ da Zaeon** (abre/fecha a barra de novo estudo) + o **título
     grande** do estudo. Modo claro: branco com leve tinta fria (destaca do fundo) + ring
     gradiente + sombra macia; manter a variante dark já existente.
   - **Título sempre completo**: vira um campo multi-linha que cresce em altura (sem reticências,
     sem corte). Continua editável inline e persiste (`persistTitle`).
   - **Play funcional ao lado** (mais visível). Reescreva `components/voice/VoicePlayButton.tsx`
     para, no estado "tocando", usar as **ondas do chat widget** (estilo
     `components/voice/VoiceWaveIndicator.tsx`: barras violeta→ciano + núcleo), **não** o equalizer
     branco. Mantenha aura + anel. Continua controlado por `playing/loading` do `useTTS`.
2. **Parar de duplicar o título como bloco de texto**: em `zaeonStudy` (MeusEstudosFeed), o
   agente já escreve começando por um título — esse título é o do **cabeçalho**. No loop de
   blocos, **pule o bloco `heading` cujo texto == título do estudo** (normalizado). O título vive
   só no cabeçalho.
3. **Título da pesquisa no mesmo padrão visual**: aplique a mesma pílula/título liquid-glass ao
   título da aba **Pesquisa** (em `app/research-lab/page.tsx` / componente da pesquisa), pra ficar
   consistente com a Sala de Estudos.
4. **Deep-links do menu** (já parcialmente feitos — verificar e completar): Pesquisas →
   `?tab=pesquisa` (abrir a sessão `?session=` quando vier); Estudos → `?tab=sala-de-estudos&space=`
   (abrir o espaço escolhido); Projetos → `?tab=projetos&project=`. Garanta que `MeusEstudosFeed`
   honra `?space=` e `ProjectsContent` honra `?project=` (já implementado — confirmar).
5. **Voz hands-free em TODO input** (o coração desta fase): faça um inventário de **todos** os
   campos de entrada do app (chat da Zaeon, barra ⟁ de novo estudo, busca de pesquisa, busca de
   vídeos, título, notas, projetos, etc.). Para cada um, garanta um caminho de voz que **executa**
   a ação (não só ditado). Use o action bus existente (`lib/agent/actions.ts`, `lib/agent/context.ts`)
   + eventos de janela (`zaeon:set-tab`, handoff de estudo) e amplie o vocabulário de ações:
   `open_room`, `open_study(space)`, `new_study(tema)`, `type_into(campo, texto)`, `submit(campo)`,
   `save`, `play_read`, `search(tema)`. **A Zaeon deve conseguir clicar no próprio menu inicial e
   navegar até um estudo** — dê ao usuário a impressão de que ela clica/escreve por ele, com o
   "cockpit" visível (o usuário VÊ a ação acontecendo). Mantenha 100% de paridade texto↔voz.
6. **Modo voz de ligação acessa tudo em tempo real**: verifique que o loop de ligação/voz
   alcança todas as ações acima estando em qualquer tela (não só no mount). Corrija lacunas.
7. **Persistência de memória**: verifique que o `AgentContext` (world-state durável) e o histórico
   do chat realmente persistem entre turnos/sessões (`/api/agent/context`, injeção em `/api/ai/chat`).
   Corrija se estiver perdendo estado.
- **Portão da Fase 1**: `vitest run` verde + transpile verde + paridade texto↔voz preservada.
  Liste arquivos alterados + mensagem de commit.

### FASE 2 — Safeguards + Financeiro (começar assim que a Fase 1 estiver verde)

8. **Cotas (enforcement no SERVIDOR, não só no cliente)** — reutilize o padrão de
   `src/lib/ratelimit.ts` (`guard`) e adicione um **contador diário por usuário** (chave
   `userId + bucket + yyyy-mm-dd`, em Redis/Upstash ou Mongo). Regras do plano **Plus**:
   - **10 pesquisas/dia na Sala de Estudos** (bucket `study-research`).
   - **10/dia de todo o resto** (demais ações caras de IA — bucket `ai-other`).
   - **Sempre liberado, sem cota**: o usuário digitar nos inputs, salvar/editar trabalhos.
   - **Salvar**: Plus pode salvar **apenas UM de cada**: TCC, artigo, relatório. Além disso →
     CTA de upgrade pro **Pro**. (Conte os salvos por tipo; bloqueie o 2º de cada tipo no Plus.)
   - **Pro**: sem esses limites (ou limites muito maiores).
   - **Super admin**: bypass total.
   - Ao estourar: resposta amigável (não erro cru) + CTA de upgrade. Adicione **testes unitários**
     da lógica de cota (vitest).
8b. **Retomar de onde parou — um rascunho por tipo de trabalho** (TCC, artigo, relatório):
    hoje o editor de pesquisa guarda **um** rascunho só (`localStorage "zaeon_research_draft"` =
    `{docContent, docTitle, workType}` em `app/research-lab/page.tsx`). Mude para **três rascunhos
    independentes**, um por `workType` (tcc | artigo | relatorio), cada um guardando conteúdo +
    título + **posição do cursor/scroll**. O **seletor de trabalho** troca entre eles e **retoma
    exatamente no ponto onde a pessoa parou** (ex.: escreve um parágrafo do relatório, troca pro
    TCC, volta — e o relatório está intacto, no mesmo lugar). Persistência por conta quando logado
    (sincroniza com o servidor), `localStorage` como cache/offline. Casa com a regra de "salvar 1
    de cada": cada slot salvo = um desses rascunhos finalizado.

9. **Tela Financeiro** (`/financeiro` ou aba dedicada): cards dos planos (Free/Plus/Pro), **links
   de pagamento** (Stripe/PayPal — configuráveis por env, ex.: `PAYMENT_LINK_PLUS`,
   `PAYMENT_LINK_PRO`), **medidores de uso do dia** (ex.: "3/10 pesquisas hoje") e o **estado dos
   slots de salvamento** (TCC/artigo/relatório usados). Estética liquid-glass, modo claro suave.
10. **Safeguards finais**: as ações sempre-livres nunca podem ser bloqueadas; voz/ligação respeitam
    as mesmas cotas (já que executam os mesmos inputs); admin bypassa.
- **Portão da Fase 2**: `vitest run` verde (incl. testes de cota) + transpile verde + tela
  financeiro renderiza. Liste arquivos + mensagem de commit.

### FASE 1.5 — Fluxo didático (tour + "Estudar esse tema" + painéis sincronizados)

Feito (verde): `components/study/StudyThisButton.tsx` (botão GRANDE estilo about-us → gera
estudo a partir de um tema via handoff + eventos) e listener `zaeon:study:run` no
`MeusEstudosFeed` (gera o estudo mesmo já estando no research-lab).

Pendente:
A. **Plugar o `<StudyThisButton topic={tema} />`** na Pesquisa: aparece depois que o aluno
   pesquisa e **salva uma ref** (o tema = título da pesquisa / ref salva). Botão grande,
   destaque. Ao clicar → novo estudo em Meus Estudos (já demonstra que dá pra gerar mais pelo
   ⟁, de forma resumida). CONFIRMAR o anchor exato no research-lab antes de editar.
B. **Tour didático no estilo do chat widget**: ao entrar (?tour=true) o **chat expande** e mostra
   textos GRANDES e simples, guiando passo a passo o FLUXO INICIAL:
   1) "Pesquise um tema aqui na Sala de Estudos."
   2) "Arraste e solte a pesquisa para abrir o leitor."
   3) "Arraste uma pesquisa sobre a outra para comparar publicações."
   4) "Salve uma referência na sua biblioteca."
   5) "Agora toque em **Estudar esse tema** — a Zaeon monta seu estudo."
   6) "Quer outro? Clique no ⟁ da Zaeon (resumido)."
   Cada passo: texto curto + (opcional) voz. Base: `components/onboard/ResearchRoomTour.tsx` +
   `LoungeChatWidget` (o chat que expande). Didático, sem jargão.
C. **Painéis de Pesquisa e Estudos CONECTADOS** (sincronia perfeita): biblioteca + documentos
   compartilhados entre as duas abas — alternar biblioteca/documentos em ambas, mesma fonte de
   dados. Hoje a Sala de Estudos usa StudyItem (placement library/feed) e a Pesquisa tem a sua
   própria biblioteca de PDFs/refs. Unificar numa store/origem comum (ou espelhar via eventos
   `zaeon:study:add` + uma store cliente) pra ficarem em sincronia. Tarefa arquitetural — fazer
   com teste (precisa do dev server pra validar o drag-drop e a sincronia).

### FASE 3 — Limpeza, Áudio streaming, Admin & Convites (lote "finalização")

Feito nesta leva (verde): voz premium default (`engine.py` ZAEON_TTS_DEFAULT=nova-f +
`/api/ai/voices` fallback); música de boot 33s + fade suave (`lib/audio/bootMusic.ts` +
`MacSplash`); loader das salas só ícone (IosLoader texto opcional + `<IosLoader/>`); Perfil →
"em construção" (barra de progresso) em `app/research-lab/page.tsx`; frame da Pesquisa com a
mesma altura da Sala de Estudos (mesmo padding superior).

Pendente:
11. **Limpeza da codebase**: rodar `npx depcheck` (deps não usadas no package.json) e
    `npx knip`/`ts-prune` (exports/arquivos mortos). Remover SÓ o que for claramente seguro;
    regenerar lock com `npm install` depois; manter `vitest`+transpile verdes. Cuidado: há
    libs web3/aptos/wagmi com peers — não remover sem confirmar uso.
12. **Novo motor/vozes de voz (textura melhor)** — PESQUISAR (web) engines CPU-friendly p/ pt-BR
    com timbre superior ao Kokoro atual (candidatos: Chatterbox — já citado em docs/, XTTS/Coqui,
    StyleTTS2, Piper hi-fi). Avaliar custo de RAM/CPU no VPS 8GB. Se viável, adicionar como engine
    opcional no `voice-engine/` atrás de flag + testes + explicação; expor novas vozes no catálogo
    (`VOICES`) e no VoicePicker.
13. **Gadget de música (Spotify/Apple Music/YouTube Music)** — PESQUISAR viabilidade. Spotify Web
    Playback SDK (requer conta Premium + OAuth, toca no navegador) é o mais viável; Apple MusicKit
    JS (developer token); YouTube Music não tem playback oficial. Conectar conta do usuário e usar
    a **navbar como controle principal** (play/pause/skip + faixa atual). Entregar como gadget
    plugável; começar pelo Spotify se aprovado.
14. **Admin com controle TOTAL real**: auditar `app/workstation/admin/*` + rotas `/api/admin`.
    Garantir que o dashboard controla de verdade: planos/cotas por usuário, voz avançada, deep-think,
    conceder/revogar Plus, ver uso, e **grupos de convite** (item 15). Fechar lacunas.
15. **Convites (gateway de novos usuários)**: garantir que **estudante convida no máx. 3 pessoas**;
    permitir **compartilhar o Plus** depois (estratégia: Plus em grupo mais barato). **Agrupar
    usuários por convite no dashboard** (quem convidou quem → grupos), pra controlar a promoção de
    grupo. Auditar `lib/invite-codes.ts` + models (InviteCode) + a tela admin; adicionar a visão de
    grupos e o teto de 3.

### Definition of Done (geral)
- `vitest run` 100% verde e transpile sem erros em todos os arquivos tocados.
- Paridade texto↔voz mantida (regra de ouro).
- Memória do projeto atualizada (arquivos de memória) com o que mudou.
- Lista final de commits sugeridos para o humano dar push (deploy é automático).

## PROMPT DO AGENTE — fim
