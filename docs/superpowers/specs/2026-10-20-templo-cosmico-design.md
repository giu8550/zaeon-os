# Templo Cósmico: design

**Data:** 20/out/2026 · **Dono:** Don Martinez · **Status:** aguardando aprovação

## Intenção

Hoje o nível "lounge" do cyberespaço é só o lounge cósmico: pátio, deck com DJ e pista, garagem das motos à esquerda e, à direita, a escadaria-veia (muralha vermelha) subindo até o templo com a capela e a Examiner. Os níveis agora carregam um por vez (PR #455), então cada nível pode crescer sem pesar no resto.

O dono quer que esse nível vire o **Templo Cósmico**: um lugar de "hang out" e amizades com áreas de personalidades diferentes e três caminhos a partir de um salão central. A chegada tem que impressionar e mostrar as escolhas de cara: esquerda, direita ou o caminho do meio.

## O layout (aprovado no esboço)

Referencial: quem chega pelo buraco negro aparece **na frente do salão central, olhando pra dentro**. "Esquerda" e "direita" são as de quem chega.

1. **Salão / praça central (a chegada).** Parecido com o pátio de entrada do lounge atual. No lugar do palco, no meio do salão, fica um **monumento alienígena em forma de pirâmide**. Das laterais do salão saem conexões subindo para plataformas **mais altas e mais pra fora**.
2. **Braço esquerdo: o Lounge Cósmico.** Vai pra cá **tudo o que existe hoje no lounge cósmico** (palavras do dono): o deck com a pista de dança e o DJ, o palco, o buraco negro acima do DJ, o olho holográfico, o ritual, a mandala e o show, a tempestade, os tronos, a escadaria curva com a muralha vermelha e a capela/templo no topo, onde fica a Examiner. O conjunto é **espelhado**: o que hoje está à direita passa pra esquerda, mantendo a simetria. **A garagem das motos sai.**
   - O salão central fica só com a chegada, a pirâmide e as saídas pros três caminhos. O que ancorava no "centro do lounge" (pista, palco, mesa do DJ, show, ritual, spawns) passa a ancorar no centro do braço esquerdo.
3. **Braço direito: o Lounge Rasta.** Mesma estrutura de escadaria tortuosa, mas no lugar da muralha vermelha uma estrutura de **raízes de árvore, verdes**. Cores do reggae (verde, amarelo, vermelho). No topo, uma **capela maior** com áreas superiores: **torre, salão de festas e lounge privativo para casais**, tudo **moderno e futurista**.
   - **Decisão minha:** nesta entrega o lado rasta é só **arquitetura** (dá pra andar, subir e sentar). Regras como convite ou acesso só pro casal no lounge privativo ficam pra depois.
4. **O caminho do meio.** Na mesma linha de visão do monumento piramidal: um **caminho reto** e depois uma **escadaria subindo** até um **monumento ainda mais sinistro**, a **Cyber Room** (espaço dedicado a agentes de IA, código e tecnologia).
   - **Escopo desta entrega:** o caminho, a escadaria e o monumento da Cyber Room **como estrutura (casca)**. O interior e o resto do caminho do meio a gente cria junto depois. É aqui que a entrega para.

## A Examiner, guardiã do braço esquerdo

- A Examiner deixa de ser uma personagem que larga a mesa e desce quando alguém chega (`lib/cyber/examiner.ts`). Ela passa a **guardar o topo do braço esquerdo**: aquele nível e o que vem acima dele.
- **Ao chegar lá** (topo da escadaria-veia, antes de entrar na cabana/templo), uma **cutscene** foca nela e os olhos dela começam a **brilhar em vermelho, de um jeito estranho**. Ela pergunta: *"Você acha que consegue quebrar a barreira de saber apenas 1 idioma?"*
- Começa um **duelo de linguagem**: um **quiz de inglês com 7 perguntas**.
- **O erro é medido e mostrado igual à sala do Relicário:** o veredito sai com o mesmo tipo de sinal. Se não passar, **a tela fica vermelha** e a pessoa não entra.
- A Examiner fica **conectada a um agente de língua inglesa**. **Depois** (fora desta entrega) ela pode virar professora de inglês com quem passou.

### Decisões minhas (o dono pode trocar)

- **Quiz de múltipla escolha**, corrigido no servidor.
- **O bloqueio é a própria cúpula (decisão do dono):** a capela no topo do braço esquerdo fica dentro de uma cúpula **fechada e sólida**, sem nenhuma outra entrada nem portal pra outro nível. Não tem mecanismo de empurrar. A única passagem é a porta que a Examiner abre pra quem venceu o duelo. Quem já passou encontra a porta aberta (o servidor diz quem passou).
- **Motos:** saem só do lounge. Continuam no nível próprio da garagem, e a recompensa do Relicário segue igual.

- **Nota pra passar:** acertar **6 de 7**.
- **Quem passa fica liberado pra sempre** naquele braço e no que vem acima: grava em `User.cyberPerfil` (mesmo padrão do `entregaAceitaEm` do Relicário) e ela não para a pessoa de novo.
- **Quem não passa** é levado de volta ao pé da escadaria e pode tentar de novo depois de **2 minutos**.
- **Perguntas geradas na hora pelo agente de inglês** (via o gateway de IA que o cyber já usa), em nível crescente, com **validação no servidor**: as respostas certas nunca vão pro cliente antes da correção. Se a IA falhar, usa um banco fixo de perguntas.
- **O dono também passa pelo duelo** (pra testar). Um `?semGuardia` local só pra teste.
- A correção é **no servidor** (rota própria, como `/api/cyber/entrega`), e quem está no nível vê a cena (olhos vermelhos, veredito), como no Relicário.

## Fora desta entrega

- O interior da Cyber Room e o resto do caminho do meio.
- O modo professora de inglês da Examiner.
- As áreas "clássica" (biblioteca) e "noir" citadas antes: o dono não as pediu neste desenho.

## Restrições

- Tudo dentro do nível "lounge" (um nível carregado por vez, `montarSala`/`desmontarSala`). O hub e os outros níveis não podem ficar mais pesados.
- Testar só nas páginas `/zz-cyber/*` sem login (o `.env` local aponta pro Atlas de produção).
- Um PR por fatia, merge com CI verde, conferir o deploy pelo `/api/health`.
- Os jogadores já sincronizados (presença, Colyseus) continuam funcionando nas novas alturas e posições.

## Fica com quem constrói

- As medidas exatas (raios, alturas, comprimento dos braços e do caminho do meio), desde que o salão seja a chegada, os braços subam pra fora e o caminho do meio fique alinhado com a pirâmide.
- O visual detalhado da pirâmide alienígena, das raízes, da capela rasta e do monumento sinistro, seguindo o gosto do dono já registrado: formas lisas na cor da plataforma, muito brilho cósmico, nada de cara de jogo antigo.
- A divisão em fatias e PRs.
