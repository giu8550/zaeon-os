# HANDOFF — Cyberespaço: levar pra produção + plano da NAVE (descer e subir)

**Para:** o agente executor.
**De:** a sessão que construiu o cyberespaço (PRs #186–#204).
**Objetivo:**
1. Colocar em produção o que está no PR **#204** (Zaeon andável, câmera livre, Cidade Zaeon no céu, portal no buraco negro, sala de computadores e nave).
2. Implementar o plano da **Parte B**, que deixa **descer e subir com a nave (a "moto espacial")** de verdade. Hoje isso não funciona na prática.

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
| 9 | Nave: Embarcar → voar → pousar → sair | Veja a **Parte B**. Hoje só funciona com rota manual e paciência. |
| 10 | B no chão enquanto A voa | B vê a nave de A voando. |
| 11 | Celular (aparelho real) | Joystick, CORRER e PULAR, SUBIR e DESCER em voo. O FPS precisa ser aceitável; meça. |

### A.6 Rollback

- **Rápido:** `NEXT_PUBLIC_CYBER_LANDMARKS` = `0` e redeploy. A Zaeon, a cidade e a nave somem. O resto do cyberespaço (multiplayer, bases) continua.
- **Total:** `git revert -m 1 <merge do #204>` e push.

### A.7 Dívida técnica conhecida (não bloqueia)

- A nave **pousada no chão não é sincronizada** para os outros; eles só a veem em voo. Veja B.6.
- `window.__cyber`: o engine se expõe só quando `NODE_ENV !== "production"`, para depuração e testes em dev. Pode ficar.
- Ficou código de menu de monitor sem uso no `engine.ts` (`els.menu`, `els.hold`, `holdT`) desde que a landing virou "só a vista". Dá para limpar.
- Componentes antigos do lounge sem uso: `LoungeCartolina`, `LoungeSala3D`, `Cartolina3D`, `CollabModule`.
- `public/` não tem mais o protótipo antigo (`cosmic-map.html` foi removido).
- O **desempenho em celular real** não foi medido. Os testes foram em painel de navegador, que limita os frames em segundo plano. Meça a Cidade (vidro com transmission, cerca de 56 draw calls e 73 mil triângulos no total da cena).

---

## PARTE B — Plano: descer e subir com a nave ("moto espacial")

### B.1 Diagnóstico (reproduzido por simulação do `passoVoo`)

| Caso | Hoje | Por quê |
|---|---|---|
| No hangar, segurar DESCER | **Pousa de novo na cidade** (y = 190) e não desce | `chaoDaNave` considera o piso da cidade como "chão" sempre que a nave está dentro do raio andável, e o hangar fica dentro dele. É preciso sair voando de lado mais de 17 m antes, e não há nenhuma pista visual disso. |
| No chão, embaixo da cidade (onde fica o portal), segurar SUBIR | **Trava a 156 m**, no fundo da ilha | `foraDaIlha` trata a ilha como sólida. Para subir é preciso sair do raio de 40 m, subir além de 190 m e voltar, e ninguém descobre isso sozinho. |
| Descer ou subir os 190 m fora da ilha | Cerca de 11 s cada trecho a 60 FPS | `VOO.sobe = 18` com inércia. |
| FPS baixo | Fica muito mais lento: a 5 FPS, em 10 s reais sobe só 40 m | O engine limita `dt` a 0,05 s, e com frames escassos o tempo de jogo anda mais devagar que o real. |
| Orientação | Não há altímetro, marcador de pouso nem aviso de "saia da borda" | — |

### B.2 Solução em 6 frentes

**B.2.1 Poço de voo (elevador) sob o hangar.** É a correção principal.
- Abra um **poço vertical** atravessando a ilha embaixo do hangar, com raio de cerca de 4,5 m centrado no hangar (local `x 22, z 8`).
- Dentro do poço, a ilha **não é sólida** para a nave. Assim, segurar DESCER no hangar leva direto ao chão, e segurar SUBIR embaixo do poço leva direto ao hangar.
- A ilha tem pouco mais de 14 m de espessura ali: o fundo do cone, a 23,4 m do centro, fica em cerca de 176 m.
- Lógica pura em `lib/cyber/ceu.ts`:
  - acrescente `CIDADE.poco = { x: 22, z: 8, r: 4.5 }`;
  - crie `noPoco(p)`;
  - em `foraDaIlha`, retorne `p` sem mudança quando `noPoco(p)`;
  - em `chaoDaNave`, quando estiver no poço e **descendo** abaixo do piso, o chão é o do mapa (0). Para isso, passe `vy`, ou um booleano `atravessando`, como argumento.
- Visual em `Cidade.ts`: um tubo de cristal translúcido do piso até o fundo da ilha, com anéis de luz descendo devagar (sem estrobo), mais uma marcação circular no chão do mapa embaixo do poço para quem vem de baixo.
- **Testes** em `lib/cyber/ceu.test.ts`: do hangar com DESCER chega a y = 0, pousado; do chão embaixo do poço com SUBIR passa do piso; fora do poço, embaixo da ilha, continua bloqueado.

**B.2.2 Voo independente de FPS.**
- No engine, passe o `dt` **real** para o voo (limitado a 0,25 s) e divida em **subpassos** de no máximo 1/60 s dentro de `passoVoo`, ou de um wrapper `passoVooSub`.
- Não use o `dt` limitado a 0,05 que o resto do loop usa.
- **Teste:** 10 s simulados a 5 FPS e a 60 FPS precisam dar a mesma altura, com tolerância pequena.

**B.2.3 Velocidade e sensação de voo.**
- Em `VOO`, suba a velocidade vertical para cerca de 34 m/s com aceleração (curva suave) e a horizontal para cerca de 30 m/s.
- Meta: **até 7 s** do hangar até o chão, ou o caminho inverso, já contando o poço.
- Mantenha o teto `yMax` acima de `pisoY + 40` (já existe um teste para isso).

**B.2.4 Piloto automático: "⬇ Descer ao chão" e "⬆ Subir à Cidade".**
- Em `lib/cyber/voo.ts`, de forma pura:
  - `rotaPara(destino: "chao" | "cidade", s: EstadoVoo): Waypoint[]`;
  - `seguirRota(s, rota, dt): { s, rota, chegou }`, um controlador proporcional com os limites de `VOO`.
- **Descer ao chão:** ir até a boca do poço (se estiver na cidade), descer pelo poço e pousar no **heliporto** (B.2.5) ou logo abaixo do poço.
- **Subir à Cidade:** ir até a coluna do poço e subir até o hangar, e pousar.
- Qualquer entrada manual (WASD, SUBIR ou DESCER) **cancela** o piloto.
- **UI** (`CenaCyber.tsx`): no HUD de voo, ao lado de "Sair da nave", mostre "⬇ Descer ao chão" quando estiver na cidade ou acima de 60 m, e "⬆ Subir à Cidade" quando estiver no chão ou abaixo da cidade. Os dois botões só aparecem pilotando.
- **Testes:** as duas rotas chegam ao destino, pousadas e sem atravessar sólidos, a 60 e a 10 FPS.

**B.2.5 Heliporto no chão (perto da praça).**
- Um ponto de pouso fixo no chão, por exemplo por volta de (24, 24), a uns 34 m da origem. Escolha um ponto livre do anel de bases, da Zaeon e da escada.
- **Registre como POI** em `lib/cyber/landmarks.ts` (preset novo `heliporto`, `acesso: "publico"`, sem nav), para que `basesDosMembros` pule automaticamente os slots que caírem nele. Hoje `baseLivreDosPOIs` já faz isso para POIs com `footprintR`.
- Visual: disco com anel de luz e um "H" estilizado, sem logo.
- O piloto automático "Descer ao chão" pode ter como destino o heliporto em vez de logo abaixo do poço. Escolha e documente; o heliporto é mais social, porque fica perto das pessoas.

**B.2.6 HUD de voo.**
- **Altímetro** (`y` em metros) e uma indicação "sobre a Cidade" ou "sobre o chão".
- **Marcador de pouso:** um anel ou sombra no chão sob a nave, na altura de `chaoDaNave`, para mostrar onde ela vai encostar.
- **Dica contextual:** sobre a cidade e fora do poço, segurando DESCER, mostre "Desça pelo poço do hangar ↓". Embaixo da ilha, segurando SUBIR, mostre "Suba pelo poço do hangar ↑".
- **Teclado:** mantenha Espaço para subir e Shift para descer, e adicione **E** para subir e **Q** para descer, porque Shift também é "correr" a pé e confunde. No celular já existem SUBIR e DESCER.

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

- [ ] Do **hangar**, segurar DESCER leva a nave **até o chão do mapa** pelo poço, em até 7 s a 60 FPS, e pousa.
- [ ] Do **chão embaixo do poço**, segurar SUBIR leva **até o hangar** sem travar no fundo da ilha.
- [ ] "⬇ Descer ao chão" e "⬆ Subir à Cidade" funcionam de qualquer posição e são canceláveis com entrada manual.
- [ ] O voo é **independente de FPS**: mesma trajetória a 5 e a 60 FPS, com teste.
- [ ] Há altímetro, marcador de pouso e dicas contextuais.
- [ ] Ao pousar no heliporto ou no chão e escolher "Sair da nave", dá para andar e falar com os outros. Reembarcar funciona (o servidor valida).
- [ ] Para os outros, a nave em voo e a nave parada (B.3) aparecem, só para o fundador.
- [ ] Sem estrobo; `reduced-motion` e `low` respeitados; `dispose()` sem vazamento.
- [ ] Testes novos em `lib/cyber/ceu.test.ts` e `lib/cyber/voo` (ou `ceu.test.ts`), além de `lib/lounge3d/*`. A suíte inteira continua verde.
- [ ] Verificado no navegador, com a aba visível, e num celular real.

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
