# HANDOFF — Cyberespaço: Pontos de Interesse (estruturas megalíticas interagíveis)

**Para:** agente executor
**Branch base:** `fix/lounge-realtime` (onde vivem `components/cyber/*`, `lib/cyber/*`, `useSala3D.ts`).
**Contexto:** o cyberespaço já tem cenário (`CenaCosmica.ts`), avatares de luz, bases privadas por pessoa (`lib/cyber/bases.ts`), colisão circular (`lib/cyber/colisao.ts`) e regras de clique (`lib/cyber/clique.ts`). Este handoff adiciona uma **nova camada**: pontos de interesse (POIs) — estruturas monumentais que representam, em versão cósmica, empresas e instituições reais. A primeira é a **Zaeon**.

---

## 1. Conceito

Grandes estruturas flutuantes, no mesmo idioma visual da cena (nebulosa roxo/ciano + o quente do disco de acreção do buraco negro), espalhadas pelo mapa como **marcos**. Cada uma:
- tem **colisão** (não se atravessa) — reaproveita o colisor circular existente;
- é **interagível** — chegar perto + clicar abre um painel (o que é a organização, links, e, quando fizer sentido, "entrar");
- é **dirigida por dados** — adicionar uma nova instituição = uma entrada num registro + um preset visual, sem reescrever a cena.

A Zaeon é o marco-mãe: a maior, central, e a **base do dono fica no topo dela**.

---

## 2. Arquitetura (seguir o padrão já existente: módulo PURO em `lib/cyber` + builder three em `components/cyber`)

### 2.1 Registro de POIs — `lib/cyber/landmarks.ts` (PURO, sem three)
Fonte única de verdade do level-design dos marcos. Exemplo de forma:
```ts
export type AcessoPOI = "publico" | "dono";
export type PresetPOI = "zaeon" | "generico"; // cada instituição ganha um preset visual
export type POI = {
  id: string;            // slug estável, ex. "zaeon"
  nome: string;          // rótulo flutuante, ex. "Zaeon"
  org: string;           // descrição curta mostrada no painel
  preset: PresetPOI;
  x: number; z: number;  // posição no plano (fora do anel de bases — ver §2.4)
  footprintR: number;    // raio sólido (colisão no chão)
  interactR: number;     // raio que acende o rótulo + habilita clique
  altura: number;        // quão alto flutua (base da estrutura acima do chão)
  topo?: { y: number };  // plataforma do topo (onde a base do dono pousa), se houver
  acesso: AcessoPOI;     // quem pode "entrar"/subir
  link?: string;         // destino do painel (rota interna ou site)
};
export const POIS: POI[] = [{
  id: "zaeon", nome: "Zaeon", org: "A universidade regida por IA.",
  preset: "zaeon", x: 0, z: -34, footprintR: 7, interactR: 11,
  altura: 6, topo: { y: 16 }, acesso: "dono", link: "/",
}];
export const colisoresDosPOIs = (pois = POIS) => pois.map(p => ({ x: p.x, z: p.z, r: p.footprintR }));
```

### 2.2 Builder visual — `components/cyber/Landmark.ts` (three)
`criarLandmark(poi, { low, starTex }): { group: THREE.Group; rotulo: HTMLElement; atualizar(dt,t); dispose() }`. Um `switch(poi.preset)` escolhe a geometria. Espelhar a disciplina de `BaseEstudo.ts`/`CenaCosmica.ts`: materiais reaproveitados, `dispose()` completo, respeitar `low` (menos partículas/segmentos).

### 2.3 Montagem na cena — `components/cyber/CenaCyber.tsx` / `engine.ts`
- No setup da cena, iterar `POIS`, criar cada landmark e `scene.add(group)`; guardar os `rotulo` no overlay (igual às tags de base).
- **Colisão:** concatenar `colisoresDosPOIs()` na MESMA lista de colisores que o engine já aplica por passo (hoje vinda das bases). `empurrarParaFora` já faz o deslizar na borda — nada novo.
- **Update:** chamar `landmark.atualizar(dt,t)` no loop (animar fogo/flutuação), e posicionar o rótulo via `proj()` como as tags de base, escondendo fora de alcance.

### 2.4 Posicionamento — não colidir com as bases
As bases vivem num anel de raio `PRACA_R=9` em torno da origem (`lib/cyber/bases.ts`). Os POIs ficam **fora** desse anel (ex.: Zaeon em `z=-34`, bem atrás da praça, entre o chão e o buraco negro) pra não brigar com as bases nem com o spawn. Regra pro agente: ao posicionar um POI, garantir `dist(POI, qualquer base) > footprintR + BASE_COLLIDER_R + folga`.

---

## 3. Preset `zaeon` — a estrutura (visão de Enoque, 1 Enoque / Livro dos Vigilantes)

Referência de design dada pelo dono (traduzir em geometria, não copiar nada real):

- **Ilha flutuante:** a estrutura inteira **levita** (`altura` acima do chão), com um leve sobe-desce (bob lento) e um **brilho por baixo** (sprite/halo frio) pra "assentar" a flutuação. Reaproveitar `glowTex()` de `CenaCosmica.ts`.
- **Muralhas de granizo:** anel externo de muros **cristalinos de gelo** — faces translúcidas branco-azuladas, arestas vivas (use `MeshPhysicalMaterial` com `transmission`/`roughness` baixo, ou faces facetadas low-poly com emissive frio). Dão a sensação de granizo compactado.
- **Línguas de fogo:** chamas lambendo as muralhas por fora — sprites/plano com shader aditivo quente **reusando a paleta do disco de acreção** (`0xffe3b0 / 0xffb45a / 0xff7a2c`) pra casar com o buraco negro. **CRÍTICO a11y: fogo com cintilar LENTO e contínuo (ex. `sin(t*1.8)`), NUNCA estrobo/flash** — mesma regra que já removemos do fundo da home (`fix/epilepsia-fundo-estrobo`). Respeitar `prefers-reduced-motion` (fogo quase estático).
- **Casa de cristal (interior):** dentro das muralhas, um pavilhão de **gelo + cristal**; **teto imitando o caminho das estrelas/relâmpagos** (reaproveitar `starTex` + linhas finas emissivas) e **querubins** como pontos/sprites de luz orbitando devagar (reusar o sistema de "neurônios" `Points` dos avatares/base).
- **Contraste térmico:** chão/piso interno com emissivo **frio** (ciano/branco-gelo) contra o **anel de fogo quente** nas bordas — o choque frio×quente é a assinatura. Luz de preenchimento fria no interior, luz quente rasante nas muralhas.
- **Escala:** monumental — deve ler como "megalítico" de longe, maior que qualquer base. Low-poly instanciado onde der (pilares, blocos de muralha) pra segurar performance.

Coesão: é cósmico-Zaeon, não um castelo medieval. Cristal + gelo + fogo contido + flutuação + a nebulosa atrás.

---

## 4. Base do dono no TOPO da Zaeon

Hoje a base de cada pessoa é posicionada pela ordem na sala (anel, `posicaoDaBase`). Para o **dono/fundador da Zaeon**, sobrepor essa regra:
- A base dele **não entra no anel**: ela pousa na **plataforma do topo** da estrutura Zaeon (`POI.topo.y`), e é **parentada ao group do landmark**, então flutua e balança junto.
- Como o movimento é no plano XZ do chão, subir precisa de um gesto: clicar na Zaeon **sendo o dono** → `acesso:"dono"` → sobe (lift/teleporte com transição de câmera) pra plataforma do topo; um gesto equivalente desce. Os outros veem a base lá em cima mas **não sobem** (a privacidade de base já existe: ninguém entra na base alheia — `clique.ts`).
- Implementação sugerida: um override em `bases.ts` tipo `layoutDaBase(userId, { ehDonoZaeon })` que, quando dono, retorna a pose do topo (coordenadas locais do landmark convertidas por `localParaMundo`-like, mas no group do POI) em vez de `posicaoDaBase(indice)`.

---

## 5. Regalias do avatar do dono ("regalias que outros não têm")

Papel vem da sessão (ex. `role: "founder"` / id do dono no `.env` ou no `User`). Dividir em duas naturezas, com uma regra de segurança dura:

**Cosméticas (podem ser client-side, a partir de um flag de papel):**
- Armadura/aura/cor exclusivas (a tua já é azul; o dono pode ter um tom/treco único — coroa, trilha de luz, neurônios mais densos).
- Acesso visual ao topo da Zaeon e a animações próprias.

**De ação / acesso (NUNCA confiar no cliente — autorizar no SERVIDOR):**
- Subir ao topo, editar/mover o landmark, "entrar" em áreas restritas, qualquer moderação.
- **Regra:** o cliente pode PINTAR a regalia a partir de um flag, mas toda AÇÃO privilegiada tem que ser verificada no backend (sessão → papel), igual o `pusher-auth` já valida membro/teto. Um flag de papel no cliente é dica visual, não permissão. Caso contrário qualquer um forja `role:"founder"` no devtools.

Onde cravar o papel: derivar de `sessaoUsuario()` no servidor (um campo `role`/lista de ids de fundador) e mandar junto do `GET /api/lounge3d/[id]` (como já manda `eu.color`). O `AvatarLuz.ts` ganha um parâmetro de "regalia" pra trocar material/adereços.

---

## 6. Instituições reais (próximos POIs) — nota de marca/jurídica

O registro `POIS` é feito pra escalar: cada nova instituição = uma entrada + um preset visual. **Porém**, ao representar empresas/instituições reais:
- Usar **estruturas estilizadas e originais** no idioma Zaeon; o **nome** da organização como rótulo descritivo é ok.
- **Não** reproduzir logos, marcas registradas ou o design arquitetônico real 1:1 sem permissão. Homenagem estilizada, não cópia.
- Idealmente, só publicar o marco de uma instituição real com acordo/permissão dela. Deixar isso como checklist antes de ir pra `main`.

---

## 7. Performance & acessibilidade (não negociável)
- Instanciar blocos repetidos (muralha, pilares); low-poly; respeitar o flag `low` (menos segmentos/partículas no mobile).
- Fogo e brilhos: cintilar lento, **sem estrobo**; honrar `prefers-reduced-motion`.
- `dispose()` completo em cada landmark (geometria + materiais + texturas + rótulo do overlay), chamado no teardown do engine.
- Rótulos no overlay 2D (como as tags de base), não text-geometry 3D.

---

## 8. Critérios de aceite
- [ ] `lib/cyber/landmarks.ts` (registro puro) + `components/cyber/Landmark.ts` (builder) + montagem em `CenaCyber`/`engine`, com teste puro do registro/colisores (espelhar `lib/cyber/cyber.test.ts`).
- [ ] A Zaeon aparece como estrutura **flutuante** monumental (gelo+cristal+fogo contido+teto estelar), coesa com a nebulosa/buraco negro, visível de longe.
- [ ] **Colisão:** o avatar não atravessa a base da estrutura; desliza na borda (reusa `empurrarParaFora`).
- [ ] **Interação:** chegar perto acende o rótulo "Zaeon"; clicar abre o painel (descrição + link). Clique de longe não ativa.
- [ ] **Base do dono no topo**, parentada à estrutura (flutua junto); dono sobe/desce por gesto gated; outros não sobem.
- [ ] **Regalias** do dono visíveis (cosmético) e **toda ação privilegiada validada no servidor** (papel via `sessaoUsuario()`), não por flag de cliente.
- [ ] Sem estrobo; `prefers-reduced-motion` respeitado; `low` respeitado; `dispose()` sem vazamento.
- [ ] Adicionar um 2º POI de teste = só uma entrada em `POIS` + preset `generico` (prova que escala por dados).

## Resumo de uma linha
Nova camada de **pontos de interesse** dirigida por dados (`lib/cyber/landmarks.ts` + `components/cyber/Landmark.ts`), com colisão circular reaproveitada e clique de proximidade; primeiro marco = **Zaeon** flutuante (visão de Enoque: muralhas de granizo, casa de cristal, línguas de fogo contidas, contraste térmico), com a **base do dono no topo** e **regalias** do avatar — cosméticas no cliente, ações privilegiadas sempre autorizadas no servidor.
