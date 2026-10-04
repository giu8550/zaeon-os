# Cyberespaço (ex-Lounge Cósmico) — estado e arquitetura

Entrada da Zaeon em produção, **sem flag**. Espec visual original: handoff "Lounge Cósmico + Base de Estudo" (protótipo em `docs/prototypes/cosmic-map.html`, que segue como referência; (a cópia em `public/` foi removida: o cyberespaço é o componente `CosmicLounge`)).

## Rotas e telas
- `/lounge-cosmico` — tela cheia imersiva (Navbar some: `lib/ui/loungeHub.ehRotaImersiva`). Só logado; pede o **nome de usuário** 1x (`POST /api/user/nome` → `User.name` + `onboardingComplete`, sem mudança de schema). Depois monta `<CosmicLounge modo="tela"/>`.
- Landing do logado (`hero-content.tsx`) — `<LoungeJanela/>`: `<CosmicLounge modo="janela"/>` (começa no menu do monitor, sem rede). **Maximizar** só habilita depois de iniciar a sessão (opção do monitor ou segurar ESPAÇO). Na janela o canvas não rouba a roda do mouse nem o ESPAÇO da página.
- Login Google → `/lounge-cosmico`. Tour/onboarding antigo desligado: `TOUR_ATIVO=false` em `lib/onboarding/tour.ts` (sidebar/`MenuNavigation` seguem disponíveis).

## Código
| Peça | Onde |
|---|---|
| Regras puras (testadas) | `lib/cyber/{bases,colisao,clique}.ts` |
| Cenário (nebulosa do dono, buraco negro, estrelas, chão) | `components/cyber/CenaCosmica.ts` |
| Base de estudo (plataforma, monitor, cadeira, cristais, neurônios) | `components/cyber/BaseEstudo.ts` |
| "Ser de luz" (contrato isolado p/ trocar por GLB/RPM) | `components/cyber/AvatarLuz.ts` |
| Engine imperativa (loop, entrada, câmera, colisão, rede→atores) | `components/cyber/engine.ts` |
| React: HUD, chat, convite, touch | `components/cyber/{CenaCyber,CosmicLounge,Joystick}.tsx` |
| Qual sala abrir (convite `?sala=`) | `components/lounge/useResolverSala.ts` |

## Regras (handoff §2 e §5.4)
- **Base por pessoa, privada, fixa**: posição = f(índice em `members[]`) num anel de raio 9 em volta da praça (`posicaoDaBase`). A ordem só cresce, então é igual pra todos; **sair da sala remove o personagem, não a base**. Só o dono clica no próprio monitor; o de outra pessoa mostra "Base de X · privada".
- **Colisão**: colisor circular por base (`BASE_COLLIDER_R`); projeta na borda (desliza). Vale pra jogador, colegas e destino do clique.
- **Monitor**: hover → brilho/pulso + cursor pointer + rótulo; clique perto → Sala de Estudos (`/research-lab`); longe → anda até a base. Prioridade: monitor → colega → chão.
- **Multiplayer**: reaproveita a sala `lounge_canvas` (CollabDoc) — `useSala3D` (Pusher presença `presence-lounge3d-<id>`, teto 5 no auth, posição por `client-pos` 12 Hz, chat). Convite = botão **Convidar** (só o dono tem o token) → `/lounge-cosmico?sala=<token>` → `POST /api/collab/join`. As rotas `/api/lounge3d/*` agora respondem sem flag (acesso: sessão + `members[]`, IDOR → 404). `lounge3dOn()` só controla a aba Lounge 3D da Sala de Pesquisa.
- **Sala cheia / erro / sem Pusher**: dá pra "Entrar sozinho"; sem tempo real aparece aviso.
- **Mobile**: joystick, CORRER, PULAR, pinça; LOD (DPR ≤ 1.5, sem antialias, menos partículas).

## Não verificado / pendências
- Multiplayer **entre duas contas reais** com Pusher de verdade (testado com presenças simuladas).
- Requer `NEXT_PUBLIC_PUSHER_KEY/CLUSTER` + `client events` ligado no app Pusher; sem isso cai no POST `/pos` a 4 Hz ou "sem tempo real".
- **Avatar = GLB humano rigado** (Idle/Walk/Run, `SkeletonUtils.clone`, escala 1.15, material holográfico emissivo por usuário + ~240 neurônios). Por padrão carrega o modelo de REFERÊNCIA de teste (`threejs.org/.../Soldier.glb`, runtime, terceiros). **Em produção hospede um GLB próprio** (ex.: `public/assets/avatar.glb`) e defina o build-arg `NEXT_PUBLIC_CYBER_AVATAR_GLB` (Dockerfile/compose/deploy.yml já têm a plumbagem; variável do GitHub com o mesmo nome). Se o GLB não carregar, o avatar fica só com luz/neurônios.
- Contrato de navegação: Estudar/clique no monitor → `postMessage({type:"zaeon:enter-study"})` (mesma origem) → `router.push("/research-lab")`.
- Dispositivo móvel real (gestos, FPS), navegador logado de ponta a ponta.

## Tempo real (Pusher) — diagnóstico e checklist
O aviso "Tempo real indisponível" **só aparece quando de fato falhou**, e diz o motivo (`lib/lounge3d/realtimeEstado.ts`). Enquanto conecta, não mostra nada. O console loga 1x: `[lounge] pusher: key presente|AUSENTE · cluster … · canal presence-lounge3d-<id>`.

| Sintoma / motivo | Causa | Onde ligar |
|---|---|---|
| "chave do Pusher ausente neste build" | `NEXT_PUBLIC_PUSHER_KEY/CLUSTER` não entraram no build (são inlinadas no BUILD; em dev, reinicie `node server.js` após mexer no `.env`) | `.env` da VPS → build-args do compose |
| "servidor sem as credenciais do Pusher" (auth 503) | `PUSHER_APP_ID`/`PUSHER_SECRET` ausentes no **runtime** do servidor (o log do servidor lista os NOMES que faltam) | `.env.secrets` da VPS |
| "entre na sua conta novamente" (auth 401) | sessão expirada | — |
| Conecta mas ninguém se mexe | **"Enable client events"** desligado em Pusher → App Settings (erro 4301). O cliente detecta e cai no fallback do servidor (`POST /pos`, 4 Hz) com um `console.warn` | painel do Pusher |
| "Sem conexão com o tempo real" | WebSocket bloqueado (`failed`/`unavailable`) | rede/proxy |

Ciclo de vida:
- `subscription_succeeded` / `member_added` → **seed**: todo membro online aparece na hora, sentado na própria base (`poseNoAssento`), antes de qualquer posição; e eu mando `client-hello` → quem já está reenvia a pose na hora (sem assimetria "um vê, o outro não").
- Posição por `client-pos` a **9 Hz** (teto do Pusher = 10 client events/s por conexão), **só quando a pose muda**; fallback `pos` via servidor a 4 Hz.
- **Heartbeat** de 2 s por `setInterval` (+ ao voltar pra aba) reenvia a última pose: o `requestAnimationFrame` pausa em segundo plano, então sem isso o avatar "congelava" pros outros.
- `member_removed` remove o personagem (a base fica); teto de 5 no auth.
- A **janela da landing** não tem rede (é só a vista): pra se ver, os dois precisam clicar em **Conectar** (tela cheia `/lounge-cosmico`) no **mesmo convite**.
