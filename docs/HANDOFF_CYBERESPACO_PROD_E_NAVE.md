# HANDOFF — Cyberespaço: levar pra produção + plano da NAVE (descer e subir)

**Para:** o agente executor.
**De:** a sessão que construiu o cyberespaço (PRs #186–#204).
**Objetivo:**
1. Colocar em produção o que está no PR **#204** (Zaeon andável, câmera livre, Cidade Zaeon no céu, portal no buraco negro, sala de computadores e nave).
2. Implementar o plano da **Parte B**, que deixa **descer e subir com a nave (a "moto espacial")** de verdade, com **botões de movimento** (subir, descer, direção) que levam a nave a qualquer lugar do mapa. Hoje isso não funciona na prática.

Leia também `docs/HANDOFF_CYBERESPACO.md`, que descreve a arquitetura, o tempo real e os marcos e é a referência viva. Este documento é o recorte de execução.

---

## 0. Regras de trabalho

- **Siga os padrões já usados, sem inventar um estilo novo.** Toda regra de jogo é **pura e testada** em `lib/cyber/*.ts`, no padrão de `nav.ts`, `ceu.ts`, `voo.ts` e `camera.ts`. O three.js fica só em `components/cyber/*.ts` (builders), e o engine (`components/cyber/engine.ts`) só **consome** as regras puras. React (`CenaCyber.tsx`) é HUD e botões.
- **Toda ação privilegiada é validada no servidor.** Subir ao topo, entrar pelo portal e pilotar a nave passam por `POST /api/lounge3d/[id]/acesso { alvo }`, que decide pela **sessão** (`isSuperAdmin`). Flag ou estado do cliente é só dica visual e nunca permissão. Os outros só desenham alguém no topo, no céu ou voando se o **servidor** marcou essa pessoa como `fundador`.
- **Acessibilidade:** nada de estrobo ou flash. Cintilar sempre lento (`sin(t*1.8)`), `prefers-reduced-motion` deixa a cena quase parada, e o modo `low` (celular) reduz partículas e segmentos e troca vidro com transmission por transparente simples.
- **`dispose()` completo** em todo builder novo. Use o `liberar()` de `Landmark.ts`: ele não descarta texturas compartilhadas como `starTex`.
- **Commits e PRs em PT-BR**, com co-autoria no rodapé, no formato do histórico (`git log`).
- **Prove antes de afirmar.** Testes de unidade com simulação quadro a quadro (veja `lib/cyber/landmarks.test.ts` e `lib/cyber/ceu.test.ts`) e verificação no navegador. Ao relatar, diga o que foi e o que **não** foi testado.

---

## PARTE A — Levar o PR #204 para produção

### A.1 O que está no PR #204 (branch `fix/lounge-realtime`)

São 3 commits à frente da `main`, com 37 arquivos e cerca de 2.100 linhas:

| Commit | O quê |
|---|---|
| `6578a2c` | **Zaeon**: QG megalítico flutuante andável (escada de cristal, plataforma, muralhas com portão, pilares). A base do dono fica no topo, liberada pelo servidor. |
| `abbe69a` | **Câmera livre**: arrastar para baixo encosta a câmera no chão e o olhar sobe para o céu. |
| `fe26c88` | **Cidade Zaeon no céu** (QG do dono, piso a 190 m), **portal no buraco negro**, **sala de computadores**, **nave pilotável**, `POST /acesso`, presença com `ceu` e `voo`. Também corrige a escada da Zaeon, que terminava no ar, e um salto na muralha. |

Mapa dos arquivos:

| Camada | Arquivos |
|---|---|
| Regras puras (testadas) | `lib/cyber/landmarks.ts` (registro de POIs e flag), `lib/cyber/nav.ts` (chão → escada → plataforma), `lib/cyber/ceu.ts` (cidade, portais, estações), `lib/cyber/voo.ts` (física da nave), `lib/cyber/camera.ts` (câmera livre), `lib/cyber/clique.ts` (alvo `landmark`), `lib/cyber/bases.ts` (pula slots que caem na ilha ou na escada) |
| three.js | `components/cyber/Landmark.ts` (Zaeon, porte 1:1 de `docs/prototypes/zaeon-landmark.html`), `Cidade.ts`, `Nave.ts`, `CenaCosmica.ts` (expõe `buracoNegro` para o clique) |
| Engine e HUD | `components/cyber/engine.ts`, `CenaCyber.tsx`, `CosmicLounge.tsx` |
| Rede | `components/lounge/useSala3D.ts`, `lib/lounge3d/{tipos,sala,pose}.ts` (campos `topo`, `ceu` e `voo` sanitizados) |
| Servidor | `app/api/lounge3d/[id]/acesso/route.ts` (novo), `.../topo/route.ts` (atalho), `.../pos/route.ts` (zera as regalias de quem não é fundador), `.../route.ts` e `lib/lounge3d/server.ts` (`fundador` no GET) |
| Deploy | `Dockerfile`, `docker-compose.beta.yml`, `.github/workflows/deploy.yml` e `.env.example` já repassam `NEXT_PUBLIC_CYBER_LANDMARKS` e `NEXT_PUBLIC_CYBER_AVATAR_GLB` |
| Docs | `docs/HANDOFF_CYBERESPACO.md`, `docs/HANDOFF_CYBERESPACO_LANDMARKS.md`, `docs/HANDOFF_CLAUDECODE_ZAEON_LANDMARK.md`, `docs/prototypes/zaeon-landmark.html` |

### A.2 Antes do merge

1. **CI do #204 verde** (`build-test`). Se falhar, conserte na própria branch.
2. Rode localmente:
   ```bash
   npx vitest run
   ```
   O esperado são 188 arquivos e mais de 1565 testes passando. Um teste de `lib/canal/queue.test.ts` às vezes falha em execução paralela; isolado ele passa e não tem relação com o cyberespaço.
3. `npx tsc --noEmit`: os únicos erros aceitáveis são os de Prisma em `lib/map/*`, que vêm de um client desatualizado. Rode `npx prisma generate` se quiser limpar.
4. `npm run lint`: só acusa `app/research-lab/CitationsPanel.tsx` e `components/study/MeusEstudosFeed.tsx` (aspas sem escape), que **já vêm da `main`** e que não tocamos. O build ignora o lint (`eslint.ignoreDuringBuilds`). Conserte os dois se quiser o lint 100% verde, mas num commit separado.
5. **Não** suba as páginas de prévia `app/zz-cyber/*`. Elas existem só localmente e não estão versionadas; veja o apêndice.

### A.3 Ligar em produção

O render dos marcos (Zaeon, Cidade, nave) fica atrás da flag de **build** `NEXT_PUBLIC_CYBER_LANDMARKS`:
- vazia: ligada em dev, **desligada em produção**;
- `"1"`: ligada em produção.

Passos:
1. Em GitHub, Settings → Secrets and variables → Actions → **Variables**, crie `NEXT_PUBLIC_CYBER_LANDMARKS` = `1`. Hoje ela **não existe**. Peça ao dono ou use `gh variable set`, se tiver permissão.
2. **Opcional (recomendado):** hospede um GLB humano próprio, rigado com Idle/Walk/Run (Ready Player Me ou Mixamo com licença), em `public/assets/avatar.glb` e crie `NEXT_PUBLIC_CYBER_AVATAR_GLB` = `/assets/avatar.glb`. Sem ela, o avatar carrega o `Soldier.glb` de referência do threejs.org em runtime, que é de terceiros.
3. **No painel do Pusher**, em App Settings, ligue **"Enable client events"**. Sem isso o multiplayer funciona pelo fallback do servidor (`POST /pos` a 4 Hz, com rate limit próprio `lounge-pos`), mas o movimento fica em degraus. O teste contra o app de produção mostrou que essa opção está **desligada**. O Pusher responde com `code: null` e só a mensagem, e o cliente já detecta pela mensagem.
4. Confira no `.env` e no `.env.secrets` da VPS se `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `PUSHER_APP_ID` e `PUSHER_SECRET` existem. O bundle de produção já tem key e cluster (`sa1`). Se o auth der 503, o log do servidor lista os **nomes** das variáveis que faltam.

### A.4 Merge e deploy

1. Mergeie o #204 na `main`, com merge commit, como no histórico.
2. O workflow **Deploy (VPS)** dispara sozinho no push para a `main`. Acompanhe com:
   ```bash
   gh run watch <id> --repo web3-engineer/zaeon-os --exit-status
   ```
   Costuma levar de 7 a 10 minutos.
3. Variáveis `NEXT_PUBLIC_*` são inlinadas no **build**. Se você criar ou alterar a flag **depois** do merge, dispare o deploy de novo (re-run do workflow ou um push vazio).

### A.5 Verificação em produção

Sem login (via `curl`):
- `/`, `/lounge-cosmico` e `/api/health` respondem 200.
- `POST /api/lounge3d/<qualquer-id>/acesso` sem sessão responde 401.
- No bundle do chunk dinâmico do cyberespaço, use o `webpack-*.js` da página para mapear os chunks. Devem aparecer `client-hello`, `presence-lounge3d` e `Cidade Zaeon · QG` (este só com a flag ligada no build).

Logado, com **duas contas**: A é o fundador (`donmartinezcaiudoceu@gmail.com`, que está na allowlist de `lib/auth/roles.ts`) e B é uma conta comum. B entra pelo link do botão Convidar de A.

| # | Cenário | Esperado |
|---|---|---|
| 1 | A e B entram (Conectar) | Cada um vê o outro na hora, sentado na própria base, mesmo parado. O aviso de tempo real só aparece se falhar de fato. |
| 2 | Andar até a Zaeon (esquerda-atrás da praça) | O rótulo "Zaeon" acende por proximidade. Não dá para andar por baixo da ilha, e a colisão desliza na borda. |
| 3 | Subir e descer a escada com WASD, e clicar nos degraus | Sobe pelo pé, passa pelo portão e entra no salão. Muralhas e pilares são sólidos e não dá para cair da borda. Desce normalmente. |
| 4 | Painel da Zaeon → "Subir ao topo" | A sobe (o servidor responde 200). B não vê o botão, e se forçar a API recebe 403. B vê A lá em cima. |
| 5 | Câmera: arrastar para baixo | A câmera encosta no chão e o olhar sobe. Dá para ver o fundo da Cidade Zaeon bem alto, acima do buraco negro. |
| 6 | Clicar no buraco negro, ou pisar no anel dourado no chão embaixo dele | A entra na cidade (fade). B recebe "o portal não abre pra você". |
| 7 | Na cidade, clicar numa estação de computador estando perto | Abre `/research-lab?tab=pesquisa` e o WebGL é desmontado. |
| 8 | Portal de volta, ou "↩ Voltar à praça" | A volta para a praça. |
| 9 | Nave: Embarcar → voar → pousar → sair | Veja a **Parte B**. Hoje só funciona com rota manual e paciência; os botões de movimento (⬆ Subir, ⬇ Descer, direcional) resolvem. |
| 10 | B no chão enquanto A voa | B vê a nave de A voando. |
| 11 | Celular (aparelho real) | Joystick, CORRER e PULAR, SUBIR e DESCER em voo. O FPS precisa ser aceitável; meça. |

### A.6 Rollback

- **Rápido:** `NEXT_PUBLIC_CYBER_LANDMARKS` = `0` e redeploy. A Zaeon, a cidade e a nave somem. O resto do cyberespaço (multiplayer, bases) continua.
- **Total:** `git revert -m 1 <merge do #204>` e push.

### A.7 Dívida técnica conhecida (não bloqueia)

- A nave **pousada no chão não é sincronizada** para os outros; eles só a veem em voo. Veja B.3.
- `window.__cyber`: o engine se expõe só quando `NODE_ENV !== "production"`, para depuração e testes em dev. Pode ficar.
- Ficou código de menu de monitor sem uso no `engine.ts` (`els.menu`, `els.hold`, `holdT`) desde que a landing virou "só a vista". Dá para limpar.
- Componentes antigos do lounge sem uso: `LoungeCartolina`, `LoungeSala3D`, `Cartolina3D`, `CollabModule`.
- `public/` não tem mais o protótipo antigo (`cosmic-map.html` foi removido).
- O **desempenho em celular real** não foi medido. Os testes foram em painel de navegador, que limita os frames em segundo plano. Meça a Cidade (vidro com transmission, cerca de 56 draw calls e 73 mil triângulos no total da cena).

---

## PARTE B — Plano: descer e subir com a nave ("moto espacial")

> **Status (out. 2026):**
>
> **Feito:**
> - Parte A em produção (#204, com `NEXT_PUBLIC_CYBER_LANDMARKS=1`).
> - **B.2.1, B.2.3 e B.2.4** no #205: botões de movimento, voo independente de FPS, velocidade, pouso na Zaeon.
> - **B.2.5 e B.2.6** no #206: heliporto e HUD de voo.
> - **B.2.2 e B.3** no #207: atalhos de rota e nave parada visível para todos.
> - Correção do rate limit do `/pos`, que estava dentro de um comentário.
>
> **Não feito, opcional:**
> - **B.2.7**, o poço: só se o dono quiser.
> - **B.4**, o visual de moto: precisa de confirmação do dono.
>
> **Pendente com o dono:**
> - Ligar "Enable client events" no painel do Pusher (A.3.3).
> - Testar num celular real.

### B.1 Diagnóstico (reproduzido por simulação do `passoVoo`)

| Caso | Hoje | Por quê |
|---|---|---|
| No hangar, segurar DESCER | **Pousa de novo na cidade** (y = 190) e não desce | `chaoDaNave` considera o piso da cidade como "chão" sempre que a nave está dentro do raio andável, e o hangar fica dentro dele. É preciso sair voando de lado mais de 17 m antes, e não há nenhuma pista visual disso. |
| No chão, embaixo da cidade (onde fica o portal), segurar SUBIR | **Trava a 156 m**, no fundo da ilha | `foraDaIlha` trata a ilha como sólida. Para subir é preciso sair do raio de 40 m, subir além de 190 m e voltar, e ninguém descobre isso sozinho. |
| Descer ou subir os 190 m fora da ilha | Cerca de 11 s cada trecho a 60 FPS | `VOO.sobe = 18` com inércia. |
| FPS baixo | Fica muito mais lento: a 5 FPS, em 10 s reais sobe só 40 m | O engine limita `dt` a 0,05 s, e com frames escassos o tempo de jogo anda mais devagar que o real. |
| Orientação | Não há altímetro, marcador de pouso nem aviso de "saia da borda" | — |

### B.2 Solução (pedido do dono: **botões de movimento da nave**)

**Princípio:** os botões **movem a nave**. São controles de voo, não teleporte, e é com eles que a nave chega a **qualquer lugar do mapa**: chão, praça, bases, Zaeon, Cidade, e de volta. A pessoa pilota em 3D, subindo, descendo e andando para os lados. Pode pousar onde houver chão livre e sair da nave ali.

O resto do plano existe para isso funcionar sem frustração:
- voo independente de FPS e mais rápido;
- regras de pouso que não "grudam" na cidade;
- HUD que mostra onde a nave vai encostar;
- atalhos opcionais.

**B.2.1 Botões de movimento na tela (desktop e celular).** É a correção principal.
- **Onde ficam** (`CenaCyber.tsx`, HUD de voo): visíveis **sempre que estiver pilotando**, no desktop também (hoje SUBIR e DESCER só aparecem no toque).
  - **⬆ Subir** e **⬇ Descer**: segurar para mover na vertical, usando `comandoVoo({ subir })` e `comandoVoo({ descer })`, que já existem. Ficam à direita, grandes, com `pointerdown`/`pointerup`/`pointerleave` e captura de ponteiro, para não "grudar" quando o dedo escorrega.
  - **Direção** (frente, trás e laterais) à esquerda:
    - no celular, o joystick que já existe;
    - no desktop, um **direcional de 4 botões** (setas) que alimenta o mesmo `wx`/`wz` de WASD, relativo à câmera, como hoje.
  - **Pousar / Sair da nave:** "Pousar" desce sozinho até o chão logo abaixo (o que `chaoDaNave` disser). Depois de pousada, "Sair da nave".
- **Teclado continua:** WASD e setas para direção; Espaço ou **E** para subir; Shift ou **Q** para descer. E e Q são novos, porque Shift também é "correr" a pé.
- **Alcance:** a nave voa por **todo o mapa**. Confirme que `VOO.raioMapa` (320) cobre tudo onde há coisa para visitar, incluindo bases distantes e a Zaeon (−30, −48). Se o mapa andável a pé for maior, aumente. O teto é `VOO.yMax` (260), acima da Cidade (190).
- **Pouso em qualquer lugar:** encostar no chão (y = 0) pousa ali, empurrado para fora de colisores sólidos (bases, Zaeon, ilha). Deixe também pousar:
  - **na plataforma do topo da Zaeon**, só para o fundador, que já tem acesso ao topo: o chão vira `nav.pisoY` dentro de `bordaR`, igual à cidade;
  - **na Cidade** (já existe).
  - Ao sair da nave, o avatar fica exatamente onde a nave pousou, com a altura certa: chão, topo da Zaeon ou Cidade.
- **Descer da Cidade com os botões:** hoje, segurar ⬇ Descer em cima da cidade pousa na cidade. Isso continua correto, porque é chão, mas a pessoa precisa saber que, para ir lá embaixo, **sai voando pela borda** (cerca de 17 m a partir do hangar) e desce. Isso é coberto por:
  - **dica contextual** no HUD (B.2.6);
  - **anel de borda** desenhado no ar ao redor da ilha enquanto pilota;
  - ou o **poço** opcional (B.2.7), que permite descer direto pelo hangar.
- **Subir para a Cidade com os botões:** embaixo da ilha, ⬆ Subir trava no fundo dela, que é sólida. O mesmo HUD avisa: "a ilha está em cima, saia pela lateral". Com o poço, sobe direto.
- **Testes** (`lib/cyber/voo.test.ts` novo, puro, simulando entradas como se fossem os botões):
  - hangar → andar para fora da borda → segurar Descer → **pousa em y = 0**;
  - chão → sair de baixo da ilha → segurar Subir até acima de `pisoY` → ir até o hangar → Descer → **pousa na Cidade**;
  - voar até a **praça**, até uma **base distante** e até a **Zaeon**, pousando em cada uma (fora dos colisores);
  - fundador **pousa no topo da Zaeon**;
  - tudo a **60 e a 10 FPS** (B.2.3).

**B.2.2 Atalhos de rota (opcionais, por cima dos botões de movimento).**
- Botões de um toque que **pilotam pela pessoa usando o mesmo movimento**: o piloto automático gera entradas de `wx`/`wz`/`subir`/`descer`, não teleporta. A nave voa visivelmente pelo caminho, e os outros a veem passar.
  - Os destinos mínimos são **"⬇ Chão (praça)"** e **"⬆ Cidade (hangar)"**. Dá para acrescentar "Zaeon" e "Minha base".
  - Função pura `rotaPara(destino, s): Waypoint[]` em `lib/cyber/voo.ts`. Se a nave estiver em cima ou embaixo da ilha, a rota primeiro sai pela borda (`bordaR + 8`), depois sobe ou desce e por fim vai até o destino e pousa.
  - `seguirRota(s, rota, dt)` devolve as entradas do frame.
  - **Qualquer toque nos botões de movimento cancela** o atalho, porque a pessoa sempre tem o controle. Durante o trajeto aparece "■ Parar".
- **Testes:** cada atalho chega e pousa, nunca atravessa a ilha nem a Zaeon, e é cancelado por entrada manual.

**B.2.3 Voo independente de FPS.**
- No engine, passe o `dt` **real** para o voo (limitado a 0,25 s) e divida em **subpassos** de no máximo 1/60 s dentro de `passoVoo`, ou de um wrapper `passoVooSub`.
- Não use o `dt` limitado a 0,05 que o resto do loop usa; hoje, a 5 FPS, em 10 s reais a nave sobe só 40 m.
- **Teste:** 10 s simulados a 5 FPS e a 60 FPS dão a mesma altura, com tolerância pequena.

**B.2.4 Velocidade.**
- Em `VOO`, suba a velocidade vertical para cerca de 34 m/s com aceleração (curva suave) e a horizontal para cerca de 30 m/s.
- Meta: **até 8 s** do hangar até o chão segurando os botões (incluindo sair pela borda), e o mesmo na volta. Atravessar o mapa inteiro (cerca de 600 m) deve levar no máximo 25 s; se for preciso, adicione um "turbo" ao segurar a direção por mais de 1 s.
- Mantenha `yMax` acima de `pisoY + 40` (já existe um teste para isso).

**B.2.5 Heliporto no chão (perto da praça) — ponto de pouso de referência e destino do atalho "⬇ Chão".**
- Um ponto de pouso fixo no chão, por exemplo por volta de (24, 24), a uns 34 m da origem. Escolha um ponto livre do anel de bases, da Zaeon e da escada.
- **Registre como POI** em `lib/cyber/landmarks.ts` (preset novo `heliporto`, `acesso: "publico"`, sem nav), para que `basesDosMembros` pule automaticamente os slots que caírem nele (`baseLivreDosPOIs` já faz isso para POIs com `footprintR`).
- Visual: disco com anel de luz e um "H" estilizado, sem logo.
- Pousar perto da praça é o que permite "descer para interagir com os outros". Se o heliporto estiver ocupado por alguém em pé, pouse ao lado: empurre o ponto de pouso para fora dos colisores.

**B.2.6 HUD de voo.**
- **Altímetro** (`y` em metros) e uma indicação "sobre a Cidade" ou "sobre o chão".
- **Marcador de pouso:** um anel ou sombra no chão sob a nave, na altura de `chaoDaNave`, para mostrar onde ela vai encostar.
- **Dica contextual:** sobre a cidade, segurando ⬇ Descer, mostre "Saia pela borda da ilha pra descer até o chão". Embaixo da ilha, segurando ⬆ Subir, mostre "A ilha está em cima — saia pela lateral pra subir".
- **Anel de borda:** enquanto pilota perto da Cidade, desenhe um anel tênue (sem piscar) em `bordaR` na altura do piso, para mostrar por onde dá para descer e subir.
- **Bússola ou indicadores** dos destinos principais (Praça, Zaeon, Cidade, Minha base) na borda da tela, para achar o caminho para qualquer lugar.

**B.2.7 Opcional: poço de voo sob o hangar.** É complemento aos botões de movimento.
- Um **poço vertical** atravessando a ilha embaixo do hangar (raio de cerca de 4,5 m, centro local `x 22, z 8`, onde a ilha tem cerca de 14 m de espessura). Dentro dele, a ilha não é sólida, então DESCER no hangar desce direto e SUBIR por baixo sobe direto.
- Lógica em `lib/cyber/ceu.ts`:
  - `CIDADE.poco = { x: 22, z: 8, r: 4.5 }` e `noPoco(p)`;
  - `foraDaIlha` ignora pontos dentro do poço;
  - em `chaoDaNave`, quem está no poço descendo abaixo do piso tem como chão o do mapa.
- Visual: tubo de cristal com anéis de luz lentos e uma marcação no chão embaixo.
- Se for feito, os atalhos (B.2.2) podem usar o poço, que é mais curto, em vez de contornar a borda.
- **Só faça depois do B.2.1** e se o dono quiser.

### B.3 Nave pousada visível para todos (dívida da Parte A)

- Quando o fundador **não** está pilotando, inclua na presença `naveParada: { x, y, z, yaw }` apenas se ela não estiver no hangar.
- Faça a sanitização como em `vooDe()` (`lib/lounge3d/sala.ts`) e zere no `/pos` para quem não é fundador.
- O receptor mostra a nave estacionada (reuse a `NaveHandle` remota) se `fundador`.
- **Teste:** sanitização e `poseMudou` com `naveParada`.

### B.4 Opcional: visual de "moto espacial"

- O dono chama o veículo de moto espacial. O contrato de `components/cyber/Nave.ts` (`group`, `alvos`, `atualizar({voando, vel, curva})`, `dispose`) permite trocar o modelo por uma **hoverbike** sem mexer no engine: corpo alongado, guidão, dois propulsores laterais e o piloto montado e visível.
- No modo moto, mostre o avatar montado em vez de escondê-lo. Hoje `embarcar()` esconde o avatar.
- **Confirme com o dono antes de trocar o visual.**

### B.5 Critérios de aceite da Parte B

- [ ] **Botões de movimento na tela** (⬆ Subir, ⬇ Descer, direcional no desktop, joystick no celular) aparecem sempre que se pilota, no **desktop e no celular**. Segurar move a nave; soltar faz ela parar e pairar. Teclado: WASD/setas, Espaço/E, Shift/Q.
- [ ] Com os botões dá para ir a **qualquer lugar do mapa**:
  - Cidade → chão (saindo pela borda) e chão → Cidade (saindo de baixo da ilha);
  - praça, bases distantes e Zaeon.
  - Pousa em cada lugar fora dos colisores. "Sair da nave" deixa o avatar ali, na altura certa.
- [ ] O fundador pousa no **topo da Zaeon**.
- [ ] Cidade → chão leva **no máximo 8 s** de voo a 60 FPS.
- [ ] O voo é **independente de FPS**: mesma trajetória a 5 e a 60 FPS, com teste.
- [ ] Há altímetro, marcador de pouso, anel de borda, dicas contextuais e indicadores dos destinos.
- [ ] (Opcional, B.2.2) Os atalhos "⬇ Chão" e "⬆ Cidade" voam visivelmente até o destino, pousam e são cancelados por qualquer botão de movimento.
- [ ] Reembarcar funciona de onde a nave pousou (o servidor valida).
- [ ] Para os outros, a nave em voo e a nave parada (B.3) aparecem, só para o fundador.
- [ ] Sem estrobo; `reduced-motion` e `low` respeitados; `dispose()` sem vazamento.
- [ ] Testes novos (`lib/cyber/voo.test.ts`), além de `lib/cyber/*` e `lib/lounge3d/*`. A suíte inteira continua verde.
- [ ] Verificado no navegador, com a aba visível, e num celular real.
- [ ] (Opcional, B.2.7) Poço no hangar: Descer e Subir atravessam a ilha pelo poço, e fora dele a ilha continua sólida.

---

## Apêndice — Prévia local sem login (para testar sem Mongo ou sessão)

As rotas de prévia **não** são versionadas. Crie localmente, use e apague antes de commitar:

```tsx
// app/zz-cyber/tela/page.tsx — NÃO COMMITAR
"use client";
import dynamic from "next/dynamic";
import { useMemo, useRef } from "react";
import type { Presenca } from "@/lib/lounge3d/tipos";
const CenaCyber = dynamic(() => import("@/components/cyber/CenaCyber"), { ssr: false });
const EU = "a".repeat(24), B = "b".repeat(24);
export default function Tela() {
  const eu = useMemo(() => ({ id: EU, name: "Você", color: "#2f7bff", fundador: true }), []);
  const membros = useMemo(() => [eu, { id: B, name: "Marina", color: "#c69bff" }], [eu]);
  const remotos = useRef(new Map<string, Presenca>());
  return <div style={{ position: "fixed", inset: 0, zIndex: 300 }}>
    <CenaCyber modo="tela" eu={eu} membros={membros} remotos={remotos} enviarPos={() => {}} online={2}
      souFundador pedirAcesso={async () => ({ ok: true })} />
  </div>;
}
```

Para rodar:

```bash
npx next dev -p 3100
```

Depois abra `http://localhost:3100/zz-cyber/tela`.

Em dev, o engine fica em `window.__cyber`. Úteis para testar sem depender de teclado:
- `__cyber.debug` (posição, altura, nível, piloto, nave);
- `__cyber.entrarNoCeu()`, `__cyber.voltarDaCidade()`;
- `__cyber.embarcar()`, `__cyber.comandoVoo({ subir: true })`, `__cyber.desembarcar()`;
- `__cyber.camAz` e `__cyber.camPitch` para mirar a câmera.

**Armadilhas conhecidas:**
- O **painel do navegador em segundo plano** limita a 1–4 FPS e pausa o `requestAnimationFrame`. Não meça desempenho nem sinta o voo assim; garanta a aba visível. Para lógica, prefira a simulação quadro a quadro nos testes.
- A ferramenta do navegador às vezes dá um **clique de foco no centro** ao abrir a aba. Se o centro for a escada ou o chão, o avatar sai andando sozinho. Ao testar, zere `__cyber.alvo` e `__cyber.alvoDepois`.
- No `next dev` dentro de worktree, a rota `zz-cyber` às vezes some com 404 depois de editar arquivos. Um `touch app/zz-cyber/tela/page.tsx` resolve.
- **NEXT_PUBLIC_*** é inlinado no build. Depois de mexer no `.env`, reinicie o `next dev` (ou `node server.js`).
