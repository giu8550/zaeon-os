# LOD no cyberespaço — como fazemos e como escalar

> LOD (nível de detalhe) é a "alternativa de ouro" pra toda a Zaeon: **de perto, completo; de longe, barato**.
> Este documento registra o padrão já em uso (frota de IAs + personagens VRM) para aplicar no resto do mapa.

## Por que LOD

O gargalo do cyberespaço **não é triângulo, é draw call**. Cada malha visível com material próprio custa uma
chamada à GPU (e o custo de CPU do three.js para preparar essa chamada).

Medição na Zaeon (out/2026, Mac Metal, sem vsync), antes do LOD dos personagens:

| O que | Draw calls / peças |
|---|---|
| Cena inteira | ~985 calls, 1,31 M triângulos |
| Grupo da cidade | 1377 malhas, 754 k triângulos |
| 1 personagem VRM (Nina, Aura, Téo, Examiner) | ~120–138 malhas **cada** |
| 1500 IAs da frota (silhuetas instanciadas) | **2** calls (corpo + moto) |

A frota inteira, com 1500 pessoas, custava menos que **um** personagem VRM. Essa é a lição: o que está longe tem que
virar **uma peça** (ou uma instância de um `InstancedMesh`).

**Régua de desempenho:** nenhum teste passa abaixo de **73 fps** (medido sem trava de vsync — é a capacidade; o jogo
roda travado a 60). Base 60 + folga.

## O padrão (3 degraus)

```
distância à câmera:  0 ──── perto ──── médio ──── longe ──── some
                     │ COMPLETO     │ COMPLETO,      │ SILHUETA     │ invisível
                     │ anima todo   │ anima 1 em     │ 1 peça,      │
                     │ quadro       │ cada N quadros │ sem esqueleto│
```

1. **Completo** — o modelo real (VRM, moto, props), animado todo quadro.
2. **Completo com animação econômica** — o mesmo modelo, mas o esqueleto/anim só roda a cada N quadros,
   acumulando o `dt` (pra a animação não ficar lenta, só menos suave). Longe ninguém vê a diferença.
3. **Silhueta** — uma geometria de baixo polígono (cápsula + esfera fundidas com `mergeGeometries`), material
   barato (`MeshLambertMaterial`, opaco), **na cor do personagem**, na mesma posição/rumo/pose (sentado = achatada,
   de moto = levantada). Se há muitas iguais: **`InstancedMesh`** (1 call para todas).
4. **Some** — além do alcance, `visible = false` (nem silhueta).

### Regras que fazem funcionar

- **Sem "pop":** troca com crossfade em dither (truque 5), nunca liga/desliga seco à vista.
- **Esconda o grupo, não destrua.** Trocar de nível é só `visible` — nada de carregar/descarregar (isso dá engasgo).
- **A silhueta mora no mesmo pai** do modelo completo e recebe a mesma posição — troca sem "salto".
- **Geometria da silhueta compartilhada** (um `BufferGeometry` para todos); só o material (cor) é por personagem.
  Com muitos iguais, use `InstancedMesh` + `setColorAt`.
- **Material opaco e simples** na silhueta (Lambert, sem transparência — transparência obriga ordenação e quebra o batch).
- **Acessórios saem junto** (moto, tag, balão): cada um com sua distância (`DIST_MOTO`).
- **Atualização escalonada**: o que está longe pode ser recalculado 1 quadro a cada 4 (`iv % 4 === quadro`), perto, todo
  quadro.
- **Varredura com orçamento de tempo** (`ORCAMENTO_MS`): listas grandes (1500 IAs) são percorridas em fatias — cada
  quadro avança até gastar 1,5 ms e continua no próximo.
- **Trabalho pesado fora da linha principal** (Web Worker) com fallback se o worker falhar.

## Onde já está aplicado

### Frota de IAs — `components/cyber/FrotaIA.ts`

| Nível | Quem | Como |
|---|---|---|
| Completo | as 18 IAs mais próximas (`MAX = 18`; `low` = 8) | avatar anime completo |
| Anim. econômica | corpo completo a mais de 25 m da câmera | anima em quadros alternados (`quadroPar`, `animDt` acumulado) |
| **Multidão GPU — perto** | sem corpo completo, até 35 m (até 220) | `MultidaoGPU.ts`: a MESMA malha do corpo completo, esqueleto animado no vertex shader a partir de uma textura com as poses assadas; armadura toon na cor do card + contorno + visor + mochila; 2 draw calls |
| **Multidão GPU — longe** | 35 a 90 m (até 220) | a mesma coisa com o corpo simplificado (`SimplifyModifier`, 40% dos vértices); 2 draw calls |
| Silhueta | todo o resto que está visível (até `MAX_SILHUETAS = 900`; `low` = 300) | `InstancedMesh` cápsula+esfera, Lambert opaco, cor por instância; motos idem |
| Atualização | silhuetas que se movem | todo quadro até 120 m; além, 1 em cada 4 (`quadroSil`) |

### Personagens VRM — testado e DESCARTADO

Trocar o VRM por uma silhueta de 1 peça além de 60 m foi testado (out/2026): a Zaeon ficou nos mesmos ~69 fps e o
dono achou **anticlimático** (o personagem "vira um boneco"). Regra: **personagem com nome nunca vira silhueta**.
O caminho para eles é o truque 2 abaixo (mesma aparência, menos draw calls).

## Truques do spiderbench (xikhar/spiderbench) — cidade + multidão no navegador

O spiderbench roda uma Nova York inteira com multidão animada no navegador. O que ele faz e serve pra nós:

1. **Multidão instanciada com esqueleto na GPU** (`src/world/npc/crowd.js`): as animações são **pré-gravadas numa
   textura** (18 ossos, 14 clipes); cada pessoa é uma instância de um `InstancedMesh`, e o vertex shader
   (`onBeforeCompile`) lê a pose da textura e aplica o skinning. Há crossfade de clipes por instância, olhar com a
   cabeça e cores de roupa por instância. São 3 LODs (24 / 70 / 300 m), cada um um pool instanciado →
   **centenas de pessoas ANIMADAS em poucas draw calls**. Para nós: as silhuetas-cápsula da frota viram gente de
   verdade, andando e sentando, sem custo extra.
2. **Fundir por material, sem mudar a aparência**: o personagem (ou o prédio) continua idêntico, só que as peças
   que dividem o material viram uma malha só. Para um VRM: juntar as primitivas que dividem material e esqueleto
   num único `SkinnedMesh` (130 peças → ~1 por material).
3. **Super-tiles** (`src/world/tilebatch.js`): a geometria estática é agrupada em blocos 2×2 (512 m) e fundida por
   material num buffer só. Cada tile desenha sua faixa de índices do MESMO buffer (sem memória extra). Se o bloco
   inteiro está no mesmo estado, ele desenha em **1 chamada**. Senão, tile a tile, como antes.
   ⚠️ Eles testaram `THREE.BatchedMesh` antes: no Chrome/ANGLE ele **travava a GPU ~100 ms por quadro (2 fps)**.
   Não usar BatchedMesh.
4. **Pools instanciados com recorte por distância** (`src/world/pool.js`): um `InstancedMesh` por tipo de prop; só
   as instâncias perto da câmera são reempacotadas, quando a câmera anda alguns metros (estáticos) ou todo quadro
   (dinâmicos). Os limites (bounds) das instâncias vivas são recalculados, assim o frustum culling funciona no pool.
5. **Transição de LOD sem "pop"**: crossfade com **dither** em tela (ruído + limiar complementar). O LOD perto some
   na mesma faixa em que o longe aparece, sem buraco e sem duplicado. A distância é calculada no vertex shader, então
   o fade é contínuo.
6. **Aquecimento de shaders** (`src/render/warmup.js`): `renderer.compile` adiantado (com
   `KHR_parallel_shader_compile`) para todo material que ainda vai aparecer, em lotes com orçamento por quadro. Assim
   nada trava na primeira vez que entra na tela. Nós já fazemos `compileAsync` na carga; falta o "gotejamento" pros
   que entram depois.
7. **Chaves A/B na URL** (`?perf2off`, `?nobatch`, `?nocrowdopt`…) e `?qset=` para desligar cada otimização e
   medir. Nós temos `?semLotes`; padronizar.
8. **Uploads mínimos**: os atributos por instância ficam num buffer intercalado (2 uploads por pool por quadro, não
   6), e só a faixa viva é enviada (`addUpdateRange`).

## O que já foi aplicado (PR #318, out/2026) e o que mediu

| Mudança | Onde | Efeito medido |
|---|---|---|
| Distrito da Terra entra no lote; células de 120 m | `lotes.ts`, `Cidade.ts` | Zaeon ~1000 → ~720 draw calls |
| Acessórios dos VRM: materiais compartilhados + 1 lote por acessório | `AcessoriosVrm.ts` | personagens ~225 → ~105 draws |
| Motos de personagens/frota pelo lote (`loteMoto`) | `Moto.ts` | ~43 peças → ~1 dúzia por moto |
| Base de estudo: linhas, medidores e cristais instanciados | `BaseEstudo.ts` | ~45 → ~14 draws **por jogador** (praça com 12: ~1300 → ~670) |
| **Congelar** o que a simulação viu parado (`matrixAutoUpdate = false`) | `lotes.ts` | ~3.600 nós a menos recalculando por quadro |
| Avatar só recalcula matrizes quando animou/andou; topo invisível não recalcula | `matrizes.ts` | Zaeon com 12 jogadores ~64 → ~75 fps |
| Transparente + dupla face numa passada só (`forceSinglePass`) | `umaPassada.ts` | trocas de programa ~8.600/s → ~800/s |
| VRM: contorno some além de 34 m (< 1 px); 25–70 m anima a cada ~2 quadros; rig normalizado e esqueleto escondido fora da passada da cena | `PersonagemVivo.ts`, `AvatarVrm.ts` | ~40% menos nós por personagem |
| A ilha só boia quando andou 2 mm | `Cidade.ts` | os ~1.300 nós da cidade não recalculam todo quadro |

**Armadilha do three:** material `transparent` + `DoubleSide` é desenhado em 2 passadas e o three troca `side` +
`needsUpdate` a CADA objeto, a cada quadro (re-checagem de programa). Use `forceSinglePass` (aditivo: idêntico).

**Lição do perfil:** com jogadores presentes o gargalo deixa de ser draw call e vira **CPU do grafo de cena**
(`updateMatrixWorld` + `multiplyMatrices` ≈ 35% do quadro, ~5 ms). Ferramentas de medida (scratchpad da sessão, recriáveis):
contar draw calls por motivo (`userData.foraDoLote`), perfil de CPU via CDP `Profiler`, tempo de `scene.updateMatrixWorld`
por quadro, e A/B na MESMA página (a máquina de dev é compartilhada; fps entre páginas diferentes varia ±15).
Chaves A/B: `?semLotes`, `?semCongelar`, `?celula=N`.

## Rodada 2 (branch feat/multidao-gpu) — o que mediu

Ferramentas novas de medida (mais estáveis que fps numa máquina compartilhada):
- **tempo de GPU por quadro** (`EXT_disjoint_timer_query_webgl2`, somando as passadas do quadro): 2–4 ms — a GPU NÃO é o gargalo;
- **CPU dentro do `render`** separada em matrizes (`scene.updateMatrixWorld`) e o resto (montar a lista + desenhar);
- **trace do Chrome** (FireAnimationFrame vs. ocioso): a thread principal ficava ~3 ms ociosa por quadro na praça — o
  resto do quadro é o PROCESSO DE GPU do Chrome traduzindo cada draw call (WebGL → ANGLE → Metal): draw call custa
  CPU, mas fora da página.

| Mudança | Onde | Efeito |
|---|---|---|
| Ossos sem nada desenhável no galho → `visible = false` (o skinning usa só a matriz) | `matrizes.ts` (`esconderOssosVazios`, `mostrarCaminho`) | Zaeon cheia: nós percorridos 9.525 → 4.295; CPU do render 16 → 9 ms |
| Luzes das bases: 4 PointLights FIXAS que vão pras bases mais perto (eram 1 por base: 17 no shader da cena inteira, e cada jogador que entrava recompilava os materiais) | `engine.ts` (`acenderBases`), `BaseEstudo.ts` (`luz`) | 17 → 4 luzes |
| Asas do founder: 1 malha com esqueleto por asa | `AsasAnjo.ts` | 48 → 4 draw calls |
| As 2 telas laterais da base com o mesmo material | `BaseEstudo.ts` | o lote junta |
| **Pool de gêmeos**: as bases (estruturas idênticas) desenhadas juntas, cada peça uma malha instanciada pra todas | `poolGemeos.ts` | praça com 12 jogadores ~720 → ~400 draw calls; ~0,2 ms/quadro |
| Multidão na GPU (abaixo) | `MultidaoGPU.ts` | as IAs até 90 m animadas de verdade, sem custo de fps mensurável |

## A multidão na GPU (como funciona) — `components/cyber/MultidaoGPU.ts`

1. **Assar** (uma vez, ~330 ms, 1,5 s depois da cena montar): um `AvatarLuz` de verdade passa por cada `PoseIA` da frota
   com os MESMOS parâmetros que a FrotaIA usa nos corpos completos (andando, parado, mochila, moto montada com IK,
   sentado, deitado, relaxa, chão, dança). A cada quadro (15 por segundo) as matrizes dos ossos vão pra uma `DataTexture`
   float (4 texels por osso; +1 "osso" pra MOCHILA, que é rígida e reposicionada pela espinha).
2. **Geometria**: o corpo do GLB + o visor (que tem esqueleto PRÓPRIO de 2 ossos: cada vértice é levado pro osso
   equivalente do corpo) + a mochila (caixa, bocais, friso). Atributos `aVisor` (acende na cor da luz) e `aFixa` (cor
   fixa da mochila + 20% da cor da armadura, como o `materialToonSimples`).
3. **Desenho**: 1 `InstancedMesh` por nível com 2 grupos da mesma faixa de índices (armadura toon e contorno de tinta).
   Por instância: matriz (posição + rumo), cor (a do card) e `aAnim` (quadro inicial, nº de quadros, fase, velocidade).
   O vertex shader interpola 2 quadros. `?semMultidao` desliga (A/B).

Gotchas: `SimplifyModifier` com atributo `color` quebra (usa `THREE.Color` sem importar) — os atributos do esqueleto
voltam pelo vértice original na mesma posição; atributo intercalado não tem `getComponent` (use `getX..getW`); bloco GLSL
prefixado precisa terminar em `\n` (senão gruda no `#define` seguinte).

## Pisos que escondem — as células/portais do céu aberto (`oclusaoPisos.ts`)

Ideia tirada do motor do Black Ops 1 (`r_dpvs.cpp`, analisado em out/2026 — código descompilado da Activision, SEM
licença: só as ideias, nenhuma linha copiada). Lá o mapa é dividido em CÉLULAS ligadas por PORTAIS e só se desenha a
célula que se enxerga por algum portal. A cidadela é a céu aberto (paredes de vidro: portal não esconde nada), mas é
feita de PLATAFORMAS — e o piso de uma plataforma esconde o que está do outro lado dele.

- Cada plataforma registra `{ acima, r, topo }`: o grupo do conteúdo em cima do piso, o raio do disco e a altura do piso.
- Com a câmera ABAIXO do piso, cada peça (num invólucro próprio, criado depois do lote) some se as linhas de visão até
  os 8 cantos da caixa dela cruzam o plano do piso dentro do disco. Exato e conservador: o miolo some, a borda que
  aparece por cima fica. 8 cantos por peça por quadro (~0,05 ms pras 4 salas).
- Da chegada na Zaeon: 81 das 213 peças das salas somem (~60 draw calls).

### O padrão pros LABORATÓRIOS embaixo da Zaeon (nascer assim)
1. **Cada sala do laboratório = uma plataforma** registrada na oclusão: quem está na capela (em cima do piso da ilha)
   não desenha os laboratórios embaixo, e vice-versa — o "subir" entre eles é o portal.
2. **Teto de atores animados por área** (o Zombies mantém no máximo 24 zumbis vivos; o resto espera): cada sala tem um
   máximo de corpos completos; o excedente vai pra multidão na GPU (`MultidaoGPU`), e além dela, silhueta.
3. **Raios mortais, peças girando, ritmos de energia: animação no shader** (uniform de tempo), nunca material por peça
   — senão o lote não junta (ver "sozinha:material-muda").
4. **Peças repetidas instanciadas** (cristais dos santuários, painéis): `InstancedMesh` com cor por instância.
5. **Orçamento como teste** (o `mapkit/selftest_budget` do motor): cada sala nova passa pelo perfil de draw calls
   (`userData.foraDoLote`) e pela régua de 73 fps com 12 jogadores antes de entrar.

## Como escalar para a Zaeon inteira (próximos passos)

Em ordem de retorno (draw calls economizadas por esforço):

1. **Cidade / prédios (1377 malhas)** — o maior alvo.
   - **Fundir estáticos por material** (`mergeGeometries` por material dentro de cada região): centenas de calls → dezenas.
     Já há "lotes estáticos" (PR #270, `?semLotes` para A/B) — estender a tudo que não se mexe.
   - **Peças repetidas → `InstancedMesh`** (postes, bancos, pufes, vasos, cristais, motos estacionadas).
   - **LOD por região**: cada região (`lib/cyber` regiões, PR #267) ganha 2 versões — detalhada e "casca" (caixas
     fundidas, 1–3 calls). Troca pela distância do centro da região, com **histerese** (entra a 150 m, sai a 180 m)
     para não piscar na fronteira.
2. **Personagens com nome (VRM)** — fundir as primitivas por material (truque 2); nunca silhueta.
   **Frota** — multidão com esqueleto na GPU (truque 1) no lugar das cápsulas.
3. **Lugares flutuantes (UNILAB, Solana House, campi, nave)** — de longe, um impostor: caixa fundida ou um plano com
   textura renderizada (billboard) do lugar.
4. **Laboratórios sob a Zaeon** (próxima fase) — já nascer com LOD por sala: quem não está na sala vê a casca;
   raios/peças girando só animam com a câmera a menos de X m.
5. **Sombras** — objetos longe não projetam sombra (`castShadow = false` no degrau 3).

### Como medir (obrigatório em cada PR de LOD)

- `renderer.info.render.calls` e `.triangles` antes/depois no mesmo ponto (`__cyber.irParaNo("zaeon")`).
- fps sem vsync: Chrome headless com `--use-angle=metal --disable-gpu-vsync --disable-frame-rate-limit`, 8 s de
  `requestAnimationFrame` em `zaeon`, `univ`, `praca`. Reprovar abaixo de **73 fps**.
- Para achar o culpado: esconder um grupo por vez (`visible = false`) e ver quanto o fps sobe.
