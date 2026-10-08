# HANDOFF — Visualizador de personagem no Perfil + Voz da Zaeon (holograma) no tutorial

> Para o agente que vai executar. Escrito em out. 2026, depois da PR #299 (avatares anime, VRM do founder e asas
> negras). O dono (founder) aprovou o escopo abaixo. Responda e escreva a UI em **português**.

## Contexto rápido (o que já existe)
- **Corpo do jogador no cyberespaço:** `components/cyber/AvatarLuz.ts` → `criarAvatarLuz(cor, starTex, low, gltf)`.
  - É o GLB mixamo (Soldier) com animações Idle/Walk/Run e poses procedurais.
  - Carrega com `carregarModeloAvatar()`.
- **Estilo ANIME (o "stock" dos iniciantes):**
  - cel shading com luz presa à câmera + contorno de tinta;
  - código em `components/cyber/AvatarAnime.ts` e `lib/cyber/estiloAvatar.ts`;
  - liga com `?anime=1` ou `NEXT_PUBLIC_CYBER_AVATAR_ESTILO=anime`.
  - O dono quer que isso seja o visual padrão dos usuários comuns, em várias cores.
- **Founder:** corpo próprio em VRM (`public/avatars/fundador/fundador.vrm`, `CORPO_DO_FUNDADOR` em `lib/cyber/estiloAvatar.ts`).
  - Usa `components/cyber/AvatarVrm.ts`: `carregarVrm`, `tingirVrm`, `espelharNoVrm`. O VRM espelha a pose do esqueleto mixamo invisível.
  - Tem ASAS negras sempre abertas (`components/cyber/AsasAnjo.ts` + `lib/cyber/asas.ts`).
  - No avatar, liga com `av.usarVrm(vrm)` + `av.usarAsas()`. Ver `vestirFundador` em `components/cyber/engine.ts`.
- **Cor da armadura de cada pessoa:** `lib/cyber/cores.ts` (a minha é azul; a dos outros vem da ordem dos membros) e `recolorir()` no AvatarLuz.

---

## ENTREGÁVEL 1 — Visualizador de personagem na aba Perfil

### Onde
- **Arquivo:** `components/research/EditableProfile.tsx`, montado em `app/research-lab/page.tsx:3087-3091` quando `activeTab === "profile"`.
- **O HERO de hoje:** `EditableProfile.tsx:153-154` é `grid grid-cols-1 lg:grid-cols-2 gap-8 items-start`.
  - À esquerda, a cápsula DNA (150×360).
  - À direita, o card **"Habilidades"** (`:227-238`, barras em `SkillBar`).
  - O contêiner (`:145`) é `max-w-5xl` sem `mx-auto`. Por isso sobra espaço vazio à direita da tela.
- **O pedido do dono:** "ao lado direito da tela, ao lado do mural de habilidades — já tem o local perfeito que cabe um personagem em vertical".
  - Transforme o hero em 3 colunas: `lg:grid-cols-[auto_1fr_260px]` (ou um flex em volta).
  - Ponha o personagem **em pé, vertical**, à direita do card Habilidades.
  - No celular (1 coluna), o personagem vai abaixo das Habilidades, menor.

### O quê
- **O canvas:**
  - um `<canvas>` three.js **client-only**, com `next/dynamic` e `ssr:false`, como o `CosmicLounge`;
  - componente sugerido: `components/cyber/VitrinePersonagem.tsx`.
- **O que mostrar:**
  - **usuário comum:** o corpo padrão no estilo ANIME, sempre, independentemente da flag do cyberespaço, na **cor dele** (a mesma regra de `lib/cyber/cores.ts`);
  - **founder:** o VRM com as asas. As asas abertas têm ~3 m de envergadura, então enquadre com câmera mais aberta ou reduza a escala das asas na vitrine.
- **Animação:**
  - idle (`av.animar({ andando: false, dt, t })`) com um giro lento de vitrine (turntable);
  - opcional: arrastar pra girar.
- **Luz:**
  - o material anime ignora a luz da cena (a luz é presa à câmera);
  - o VRM (MToon) precisa de luz: use `HemisphereLight` + `DirectionalLight` leves.
- **Leveza:**
  - só renderiza visível (IntersectionObserver) e pausa com a aba oculta;
  - DPR no máximo 1,5;
  - `dispose()` ao desmontar;
  - **só baixa o VRM (16 MB) se for o founder**.
- **Quem é founder:**
  - **NÃO invente regra nova.** Reuse a mesma que o servidor já usa pro `fundador` dos membros da sala (procure `fundador` em `app/api/lounge3d/**` e `lib/lounge3d/**`).
  - Exponha só um booleano pro perfil, via a rota/props que o perfil já usa.

### O botão "Mudar skin" (usuário comum)
- **Botão:** abaixo do personagem, no estilo dos botões do perfil, com o texto **"Mudar skin"**.
- **Ao clicar, abre um pop-up (modal):**
  - um **"X" vermelho** pra fechar;
  - o texto exato: **"Para conquistar novas skins, você precisa progredir seus estudos no laboratório ou no cyberespaço."**
- **Acessibilidade:** `role="dialog"`, `aria-modal`, foco dentro do modal, Esc fecha, clicar fora fecha.
- **Founder:** não mostra o botão (o corpo dele é único).
- **Futuro (NÃO fazer agora):** o plano do dono é a troca de cor/skin de verdade no Perfil, persistida no servidor e propagada pro cyberespaço. Deixe o botão e o modal prontos pra virar o seletor depois.

---

## ENTREGÁVEL 2 — Voz da Zaeon no tutorial (holograma), sincronizada e com reverb

**Viabilidade: SIM.** Tudo o que precisa já existe; falta ligar.

### A voz (a mesma do laboratório: **Leda**, feminina, pt-BR)
- **Servidor:** `lib/voice/gemini-tts.ts` → `synthGeminiTTS(text, voice?, timeoutMs)`.
  - Voz padrão `leda`; modelo `GEMINI_TTS_MODEL` (padrão `gemini-2.5-flash-tts`).
  - Retorna `{ audio_base64, mime: "audio/wav" }`: PCM 24 kHz em WAV.
  - **Não faz streaming** e **não traz timestamps** de palavra.
- **Rota existente:** `POST /api/ai/voice` (`app/api/ai/voice/route.ts`).
  - Exige sessão e usa o guard `"ai-heavy"`.
  - Gemini com prazo de 12 s, depois cai pro Piper (`VOICE_ENGINE_URL`).
- **Harness separado:** o dono pediu harness do cyberespaço SEPARADO do laboratório ("pode copiar, não misturar").
  - Crie uma rota do cyber, ex.: `POST /api/lounge3d/[id]/zaeon/voz`, que chama `synthGeminiTTS` direto (é utilitário, não harness).
  - Use um guard próprio, pra o tutorial (~10–15 falas) não estourar o "ai-heavy" do laboratório.
  - Registre o custo como `cyber:zaeon-voz`, igual ao `lib/cyber/ia/motor.ts` (ledger, `agentKey "cyber:<agente>"`).

### Onde ela fala hoje (sem voz)
- **Falas da Zaeon:** `components/cyber/engine.ts`.
  - `zaeonFala(texto, ultima)` (~`:798`) mostra o balão e chama `holoZaeon.falar(0.6 + len*0.055)`; a boca é aleatória.
  - A máquina da conversa é `atualizarConversa` (~`:868`): ABERTURA, perguntas, reação e fechamento, com tempos FIXOS (3,4 s / 2,6 s).
  - Os turnos gerativos são `responderZaeon` / `aplicarTurno` (~`:818-850`).
- **Textos:** `lib/cyber/conversaZaeon.ts` (`ABERTURA`, `PERGUNTAS`, `reacaoFixa`, `fechamento`, `fallbackZaeon`).
- **Holograma:** `components/cyber/HoloZaeon.ts`. Sprites `idle/talk/talk_half/blink/smile/think/angry`; `falar(seg)` sorteia a boca a cada 0,08–0,16 s.

### Como fazer
1. **Pré-gerar:**
   - As falas FIXAS são conhecidas antes. Comece a sintetizar quando o Droid levar a pessoa à capela (passo "capela" do roteiro).
   - As gerativas: sintetize assim que a resposta da IA chegar.
   - Cache em memória por texto.
   - Opcional depois: gerar as fixas como arquivos estáticos (`public/assets/sounds/zaeon/*.wav`) com um script. Fica sem custo e sem latência.
2. **Sincronizar fala, balão e boca:**
   - O balão aparece **quando o áudio começa**: espere o áudio até ~1,5 s; se não chegar, mostre o balão sem voz.
   - O tempo da fala vira `max(tempo fixo, duração do áudio + 0,4 s)`, no lugar dos 3,4 s fixos de `atualizarConversa`.
   - **Boca pela voz:** um `AnalyserNode` no áudio da Zaeon mede o volume (como `lib/voice/nivelVoz.ts` faz no lab: 3 níveis 0 / 0,3 / 0,8).
     - Novo método no `HoloZaeon`, ex.: `boca(nivel)`: `talk` quando alto, `talk_half` quando médio, `idle` quando baixo.
     - Mantém o sorteio só como reserva sem áudio.
     - Funciona no Safari, porque é WebAudio num buffer e não `captureStream`.
3. **Som de HOLOGRAMA (reverb), no grafo de áudio do cyberespaço:**
   - Hoje `components/cyber/AudioCyber.ts` só toca buffers NOMEADOS (`tocar(nome)`) e não tem reverb nem convolver em `lib/cyber/audio.ts`.
   - Crie `AudioCyber.falaHolograma(buf: AudioBuffer, obj: Object3D, { dist })`:
     - um `PositionalAudio` preso ao holograma (`holoZaeon` — veja `ancora()`), com `setBuffer`;
     - uma cadeia em `setFilter(...)`: passa-alta ~180 Hz → **Convolver** (reverb ~1,2 s) em mix wet/dry (~35% wet) → um chorus/flanger bem leve (delay ~8 ms modulado) pro "brilho" de holograma;
     - gerar a resposta ao impulso do reverb como função PURA em `lib/cyber/audio.ts` (ruído com decaimento exponencial, com semente; testável), como os sons sintetizados que já existem;
     - **inteligível primeiro**: o efeito é tempero, não pode embolar as palavras.
   - Decodificar: base64 → `ArrayBuffer` → `listener.context.decodeAudioData` (o mesmo contexto do three).
   - Respeitar as preferências `zaeon_sfx` e `zaeon_volume` (`lerPrefs`) e o gesto (o áudio só existe depois de `ativar()`).
4. **Expulsão (opcional):** a fala do Droid ("Você não tem poder nenhum aqui, humano…") poderia ter voz própria, grave e robótica. NÃO é obrigatório.

### Testar
- **Prévia de dev:** `/zz-cyber/tela?nascer=1` é sem sessão, então a conversa usa a reserva local.
  - Pra testar a voz lá, a rota de voz precisa de um bypass só em dev, ou teste logado em `/lounge-cosmico`.
  - **Nunca commite `app/zz-cyber/`.**
- **Testes de unidade (vitest):**
  - geração da resposta ao impulso (duração, decaimento, determinismo);
  - o tempo das falas com duração de áudio;
  - o mapa de nível → boca.

---

## Regras do repositório (o dono pede sempre)
- **Branch:** crie a sua a partir da `main` (depois da #299 mergeada) ou da `feat/zaeon-mega-2`.
- **Commits:** terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **PRs:** terminam com `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Nunca faça merge.** O dono mergeia. Depois de abrir a PR, só consulte o status (sem polling de CI).
- **Leveza:** o cyberespaço tem que continuar leve (há qualidade adaptativa).
- **Antes de entregar:** `npx tsc --noEmit` limpo e `npx vitest run` verde. Mostre prints da vitrine (comum e founder) e descreva como testou a voz.
