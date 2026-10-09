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

**Lição do perfil:** com jogadores presentes o gargalo deixa de ser draw call e vira **CPU do grafo de cena**
(`updateMatrixWorld` + `multiplyMatrices` ≈ 35% do quadro, ~5 ms). Ferramentas de medida (scratchpad da sessão, recriáveis):
contar draw calls por motivo (`userData.foraDoLote`), perfil de CPU via CDP `Profiler`, tempo de `scene.updateMatrixWorld`
por quadro, e A/B na MESMA página (a máquina de dev é compartilhada; fps entre páginas diferentes varia ±15).
Chaves A/B: `?semLotes`, `?semCongelar`, `?celula=N`.

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
