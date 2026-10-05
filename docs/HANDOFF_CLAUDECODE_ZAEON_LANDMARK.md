# HANDOFF (Claude Code) — gerar o marco da Zaeon ATIVO na cena pra ver em dev

**Objetivo:** criar o ponto de interesse "Zaeon" (estrutura megalítica flutuante) e deixá-lo **visível agora** no cyberespaço em dev, pra o dono avaliar com tudo ativo.

**Fonte visual canônica (JÁ EXISTE no repo):** `public/zaeon-landmark.html` — protótipo three.js standalone com a estrutura pronta e os parâmetros exatos (geometrias, cores, flutuação, fogo sem estrobo, querubins, base no topo). **Abra esse arquivo e porte o visual 1:1.** Não reinvente o look; replique de lá.

**Branch:** trabalhar sobre `fix/lounge-realtime` (onde vivem `components/cyber/*`, `lib/cyber/*`). Spec de arquitetura completa em `docs/HANDOFF_CYBERESPACO_LANDMARKS.md` — este aqui é o recorte "gerar e ver já".

---

## O que fazer

### 1. `lib/cyber/landmarks.ts` (PURO, sem three) — registro dirigido por dados
```ts
export type AcessoPOI = "publico" | "dono";
export type PresetPOI = "zaeon" | "generico";
export type POI = { id:string; nome:string; org:string; preset:PresetPOI;
  x:number; z:number; footprintR:number; interactR:number; altura:number;
  topo?:{y:number}; acesso:AcessoPOI; link?:string };
export const POIS: POI[] = [{
  id:"zaeon", nome:"Zaeon", org:"A universidade regida por IA.",
  preset:"zaeon", x:0, z:-34, footprintR:7, interactR:11,
  altura:7, topo:{y:6.6}, acesso:"dono", link:"/",
}];
export const colisoresDosPOIs = (p=POIS)=>p.map(o=>({x:o.x,z:o.z,r:o.footprintR}));
```
Teste puro espelhando `lib/cyber/cyber.test.ts` (registro + colisores).

### 2. `components/cyber/Landmark.ts` (three) — builder, portando `public/zaeon-landmark.html`
`criarLandmark(poi, {low, starTex}): { group:THREE.Group; rotulo:HTMLElement; atualizar(dt,t):void; dispose():void }`.
Para `preset:"zaeon"`, replicar do protótipo (seção "ZAEON — a estrutura flutuante"):
- **Ilha** `ConeGeometry(9,7,8)` invertida, `MeshPhysicalMaterial` cristal escuro + emissive `0x10325e`, `transmission .25`; **brilho frio por baixo** (`Sprite` com `glowTex`).
- **Piso interno** frio `CylinderGeometry(6.4,6.4,.3,8)` emissive `COLD 0xbfe8ff`.
- **Muralhas de granizo:** 16 `BoxGeometry` num anel r=6.3, `MeshPhysicalMaterial` `transmission .9`, opacity .6 (ICE `0x9fd0ff`).
- **Casa de cristal:** 6 pilares `CylinderGeometry(.22,.26,4.2,6)` + cúpula `SphereGeometry(3.9,24,16,0,2π,0,π/2)` emissive azul.
- **Querubins:** ~80 `Points` (starTex) orbitando devagar.
- **Línguas de fogo:** 18 `Sprite` quentes (paleta `0xffe3b0/0xffb45a/0xff7a2c`) + anel de brasa `Torus`. **Cintilar LENTO `sin(t*1.8)`, SEM estrobo.**
- **Topo:** `topo.position.y=6.6`; plataforma `CylinderGeometry(2.4,2.6,.25,32)` + anel ciano; avatar do dono (núcleo `CapsuleGeometry` emissive `0x45d6ff` + aura Sprite + coroa Torus dourada).
- `atualizar(dt,t)`: flutuação `pos.y = altura + sin(t*.5)*.4`, `rotation.y += dt*.03`, fogo/brasa/querubins; `rotulo` posicionado via projeção (como as tags de base).
- `dispose()` completo (geometrias + materiais + texturas + remover `rotulo` do overlay).

### 3. Montar na cena — `components/cyber/CenaCyber.tsx` / `engine.ts`
- No setup, iterar `POIS`, `criarLandmark(...)`, `scene.add(group)`, guardar `rotulo` no overlay.
- **Colisão:** concatenar `colisoresDosPOIs()` na MESMA lista de colisores que o engine já aplica por passo (hoje das bases) → `empurrarParaFora` já faz o deslizar.
- **Update:** chamar `landmark.atualizar(dt,t)` no loop; esconder `rotulo` fora de `interactR`.
- **Clique:** estender `lib/cyber/clique.ts` com alvo `"landmark"` (proximidade `< interactR`) → por ora abre um painel placeholder com `poi.nome` + `poi.org` + botão que navega pra `poi.link` (stub ok).

### 4. Base do dono no TOPO (só a Zaeon, `acesso:"dono"`)
- Override em `lib/cyber/bases.ts`: se o usuário é o dono da Zaeon, a `LayoutBase` dele é a plataforma do topo (parentar ao `group` do landmark, `topo.y`), em vez de `posicaoDaBase(indice)`.
- Subir/descer: clicar na Zaeon sendo o dono → transição de câmera pro topo; outros veem mas não sobem (privacidade de base já existe).
- **Papel do dono vem do SERVIDOR** (`sessaoUsuario()` → `role`/lista de ids), mandado no `GET /api/lounge3d/[id]` junto do `eu`. Regalia cosmética pode pintar no cliente; **qualquer ação privilegiada valida no backend** (nunca confiar em flag de cliente).

### 5. Ver em dev AGORA
- Flag `NEXT_PUBLIC_CYBER_LANDMARKS` (default **ligada em dev**) pra render o marco.
- Entrar no cyberespaço (modo "tela") deve mostrar a Zaeon flutuando atrás da praça. Se der, mostrar também na prévia "janela" da landing (só visual, sem rede).

---

## Restrições (não negociável)
- **Sem estrobo/flash**; honrar `prefers-reduced-motion` (fogo quase estático). Mesma regra do fix `fix/epilepsia-fundo-estrobo`.
- Respeitar o flag `low` (menos partículas/segmentos no mobile); instanciar blocos repetidos.
- `dispose()` sem vazamento; rótulos no overlay 2D, não text-geometry.
- Marca/jurídico (para POIs de empresas reais depois): estrutura estilizada original + nome como rótulo; **não** clonar logo/arquitetura real 1:1 sem permissão.

## Critérios de aceite
- [ ] A Zaeon aparece flutuando no cyberespaço em dev, igual ao `public/zaeon-landmark.html`.
- [ ] Colisão: não atravessa a estrutura (desliza na borda).
- [ ] Proximidade acende o rótulo "Zaeon"; clique perto abre o painel (nome+org+link).
- [ ] Base do dono no topo, parentada (flutua junto); regalia visível; ação privilegiada gated no servidor.
- [ ] `lib/cyber/landmarks.ts` testado; sem estrobo; `low`/`prefers-reduced-motion` respeitados; `dispose()` ok.
- [ ] `npm run lint` + `npm run build` + testes passam.

## Resumo
Portar `public/zaeon-landmark.html` → `components/cyber/Landmark.ts`, dirigido por `lib/cyber/landmarks.ts`, montar em `CenaCyber`/`engine` com colisão reaproveitada + rótulo/clique de proximidade, base do dono no topo, atrás de flag ligada em dev — pra ver com tudo ativo.
