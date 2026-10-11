# Tutorial RPG + level design do novato (out/2026)

Pedido do dono (11/out/2026). O tutorial do cyberespaço é refeito como um jogo de verdade: diálogos "rpg-like" em
cutscene, movimento básico ensinado pelo Droid, a 1ª missão (criar um estudo) dentro do tablet, a pesquisa virando item
no inventário e a despedida do Droid rumo à Sala do Saber.

## Decisões

- **Vira o padrão de todo usuário novo** (quem não tem `User.cyberNasceuEm`). Quem já nasceu não é afetado.
- **Trava só dentro do jogo**: até o fim do tutorial, os atalhos do cyberespaço pras salas ("Estudar", F, "Ir para a
  Sala de Estudos") ficam escondidos. O laboratório na web (`/research-lab`, "Iniciar chat") continua aberto.
- **Sem motos, sem portal, sem dash** no tutorial. Foco 100% em movimento: andar → correr → voo curto → voo longo.
- **Voo longo** = o VOO TURBO que já existe (segurar Shift no ar, 2× os jatos). Não nasce um modo novo.
- **Diálogo**: antes da 1ª conversa com a Zaeon, as falas saem numa CAIXA DE DIÁLOGO RPG no pé da tela (retrato, nome,
  letra grande, efeito de máquina de escrever). Depois dela, as falas viram balões em cima dos personagens (maiores e
  mais destacados que os de hoje). A instrução de um passo só sai da tela quando a ação é feita.
- **Cutscene**: um plano de câmera (foco, ângulo, distância) misturado à câmera normal com faixas de cinema. A câmera
  volta devagar pro personagem. Usado na apresentação do Droid, na conversa com a Zaeon, nos telões e no final.
- **Zaeon pensando**: um "…" animado em cima da cabeça dela enquanto a resposta é gerada.

## Roteiro

1. **Nascer** no tubo (como hoje).
2. **Andar** (WASD, 6 m) — cutscene de apresentação do Droid.
3. **Correr** (segurar Shift andando, 20 m correndo).
4. **Voo curto** (Espaço decola; 4 m acima do chão).
5. **Voo longo** (no ar, segurar Shift = turbo; 50 m em turbo) — o Droid vai na frente, rumo à capela.
6. **Capela** (pousar no centro).
7. **Zaeon** — a conversa de hoje (uma pergunta), em cutscene, com o "…" quando ela pensa. Depois: balões liberados.
8. **Os telões** — o Droid leva até a estação PROBLEMA → SOLUÇÃO do mirante 1; cutscene nos dois telões.
9. **A missão** — "Agora sua primeira missão é criar um estudo sobre qualquer tema que te interessa." O tablet abre.
10. **No tablet** (tour clássico com destaque nos cards; o Droid fala no balão do lab):
    1. Conversa nova com 3 sugestões azuladas: "Quero estudar sobre:", "Me ensina a…", "Faz isso aqui pra mim:" (vale
       pra todo mundo). Dica do Droid: "eu estudaria sobre chocolate, morango, o vento, cachoeiras…".
    2. O tema escolhido vai pro Marketplace › Estudos, direto na tela roxa (Omega), já gerando.
    3. Destaque em onde salvar as referências e nos estudos relacionados, e na bandeja onde eles aparecem.
    4. Obrigatório: gerar a pesquisa sugerida → abrir em Pesquisas → salvar/exportar até o arquivo estar salvo.
11. **O Droid interrompe**: fecha o tablet; aviso em destaque: "essa pesquisa ainda não tem base de estudos pra ter
    algum valor ainda. não dá pra vender nem publicar, mas você pode guardar ela no seu inventário e me entregar algo
    melhor depois."
12. **Inventário** abre, redesenhado (referência de RPGs, identidade Zaeon). A pesquisa é um livro-holograma com as
    páginas que a pessoa criou (1 página = a capa + 1 página em 3D), no visual do Marketplace.
13. **Despedida**: o Droid fecha o inventário — "pressione I pra abrir seu inventário, e só venha falar comigo quando
    tiver algo de valor, estarei te esperando na sala do saber". Cutscene: a Sala do Saber (capela isolada na borda da
    Zaeon) e o Droid voando até lá; a câmera volta devagar pro personagem. Tutorial completo; os botões das salas
    aparecem.

## Entregas (uma PR cada)

1. Diálogo RPG + cutscenes + movimento + "…" da Zaeon + telões → tablet abre (passos 1–9).
2. Sugestões da conversa nova + tour do tablet + protocolo cyber↔lab (passo 10).
3. Inventário RPG + pesquisa como livro-holograma (passos 11–12).
4. Sala do Saber + cutscene final + trava das salas + tutorial padrão pro novato (passo 13).

## Fora de escopo

Motos, portais, dash, arena e a economia real (vender/publicar) — o aviso do Droid só explica que ainda não dá.
