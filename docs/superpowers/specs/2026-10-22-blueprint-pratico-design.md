# Sala de Estudos como BLUEPRINT PRÁTICO — design

Data: 2026-10-22 · Status: aprovado pelo dono em 2026-10-22 ("prossiga e entregue")
Protótipo visual aprovado em conversa: `.superpowers/brainstorm/63505-1792671606/content/estudo-simulado-v3.html` (não commitado — abrir local).

## 1. Intenção e porquê

No chat da Aura as conversas são construtivas, mas é na **Sala de Estudos** que o estudo deve **tomar forma prática**: o que a conversa vira (demo, produto, projeto, publicação). Exemplo do dono: um estudo de "privacidade na Solana" fica atrelado não só a fontes acadêmicas, mas a repositórios do tema, a uma demo, a conversas com devs/mentores, a um produto essencial e aos próximos passos.

Palavras do dono que guiam tudo:
- "Qualquer tópico que envolva tecnologia digital deve envolver entrega de projeto ou produto, não só embasamento científico. Pra passar de uma fase pra outra tem que ter **entrega real**."
- "Cards **vermelhos críticos** com coisas que devo fazer para desbloquear próximas fases."
- "Queremos **VISUALIZAR** as coisas — por isso o anatomy. Desenho e visualização valem mais do que cards com palavras."
- "Queremos **simetria e não caos**." O estilo explicativo de prancha que já existe (cantos de registro, carimbos `PERCURSO · P-04`, curvas saindo de um ponto do card) é o certo.
- "O seletor de blueprints pode ser na parte **superior** — queremos espaço e fluidez na tela."
- "Encaixar a condição de se é um **estudo válido** ou não com a **criação** do estudo na sala, e a implementação e **melhoria contínua** dele conforme avançamos nas conversas."
- A Zaeon "pode **reescrever e reorganizar**, tudo precisa ser **modular**". "Podemos **arrastar à mão**; o foco é tudo direcionado da **esquerda para a direita**."

## 2. O que o aluno vê (fiel ao protótipo v3)

**Topo — seletor de blueprints.** Faixa horizontal com um item por estudo nascido no chat: título, área, fase atual, nº de críticos abertos, barrinha das 4 fases (verde = aprovada, vermelho = travada, amarelo = aguardando mentor). Clicar troca a prancha.

**Prancha — mesma estética do `BoardEstudos`** (papel azul com grade, cards com cantos de registro, carimbo + régua + ✕, título mono, fontes ✓, barra de PROFUNDIDADE, chips de ação). Leitura **da esquerda para a direita**:

| Esquerda — o conhecimento | Centro — o estudo | Direita — a prática |
|---|---|---|
| Passos do **percurso** (P-01…), em ordem, cada um com a fase a que pertence e suas fontes conferidas | **Figura** (F-01, isométrica) em cima · card do **ESTUDO** com o trilho de 4 fases e a profundidade · **críticos** vermelhos embaixo, lado a lado (ou a **avaliação da Zaeon** quando a fase fecha) | **Repositórios** (GitHub) · **Conversas** (mentor, agentes, devs) · **Demo/protótipo** · **Produto essencial** · **Próximos passos** |

As curvas saem da borda esquerda do estudo para cada passo e da borda direita para cada módulo de prática; os críticos ligam-se ao estudo, à **peça da figura** que travam e ao **passo do percurso** que travam (tracejado). A prancha inteira se ajusta à tela (zoom/pan continuam). Sem sobreposição nunca.

**Figura (o "objeto é a explicação", padrão anatomy).** Uma máquina isométrica do tema: cada peça é um componente C-NN do estudo (ex.: carteira → cifrador → prova ZK → Token-2022 → destinatário). Estados: **verde = provada**, **vermelha pulsando = travada por um crítico**, **tracejada = ainda não construída**. A ligação entre duas peças provadas "flui" (animação). Quando um crítico é provado, a peça acende.

## 3. Ciclo de vida do estudo

1. **Validade.** O gatekeeper existente (`lib/map/gatekeeper.ts`, `ESTUDO_GATEKEEPER=1`) continua sendo quem decide se a conversa é estudo. Nada novo aqui além de reagir ao "sim".
2. **Criação.** Na primeira vez que a conversa é marcada estudável, nasce **um** blueprint ligado àquela conversa (o thread id do chat, o mesmo `cartolinaScopeId` que Conversation/Mapa/TCC já usam). Título = `tituloSugerido`. Idempotente: nunca dois blueprints por conversa.
3. **Melhoria contínua.** Nos turnos seguintes **da mesma conversa**, a Zaeon **recompõe** o mesmo blueprint: pode reescrever textos, trocar/reordenar passos, criar/ajustar críticos, adicionar peças na figura, trocar repositórios. Recompor é em segundo plano (nunca atrasa a resposta do chat).
4. **Fases** (4, iguais pra todo estudo; o conteúdo muda pela área):
   1. **Fundamento** — fontes e entendimento (ex.: "explique com suas palavras…").
   2. **Prova de conceito** — entrega real mínima. Em tecnologia: código/demo (repo público). Em áreas não digitais: experimento ou caso aplicado (ex.: "5 noites de registro de sono").
   3. **Produto** — algo que alguém usa / validação com pessoas reais (interface no ar, opinião de devs, protótipo testado).
   4. **Final** — levar ao mundo real: produto lançado ou, no mínimo, publicação. **Só aqui entra o humano** (mentor ou professor) junto com a Zaeon.
5. **Críticos.** Cada fase tem 1–3 críticos vermelhos. Um crítico = o que fazer + **a prova exigida** + a peça da figura e o passo que ele trava. Só fecha com prova anexada que o **servidor confere**. A fase passa quando todos os críticos dela fecham **e** a Zaeon aprova pela rubrica (fatia 4).
6. **Quem aprova.** Fases 1–3: checagem automática do servidor + Zaeon. Fase 4: Zaeon + humano. Neste projeto a fase 4 só mostra "aguardando mentor" — chamar e registrar o mentor é pedido futuro.

### Regras de recomposição (o que a Zaeon pode e não pode mexer)
- **Pode**: reescrever/reorganizar qualquer módulo; criar, mudar ou remover críticos **ainda abertos**; trocar passos e peças.
- **Não pode desfazer entrega real** (decisão minha): crítico provado, prova conferida, selo e fase aprovada são **imutáveis** — a recomposição os recebe como fatos fixos e constrói em volta. A fase nunca regride.
- **Posição**: o layout é calculado (esquerda→direita, simétrico). O aluno **pode arrastar**; um módulo arrastado fica **fixo** onde foi solto mesmo quando a Zaeon recompõe. Botão **"reorganizar"** solta todos e volta ao alinhamento automático (decisão minha).
- **Módulos criados pelo aluno** (nota, pergunta, especulação): não são apagados pela Zaeon; podem ser reposicionados pelo layout (decisão minha).

## 4. Camada de harness prático (o que vem de cada repositório)

| Repo | Licença | O que usamos |
|---|---|---|
| `wheresryan22/anatomy` | MIT | Disciplina "o objeto é a explicação": **lista de peças antes do desenho**, um só modelo de verdade alimentando tudo que é exibido, passe de "criticar como um crítico". Portar o núcleo isométrico do `kit/iso-kit` (com aviso de copyright MIT) **ou** escrever o nosso — ao construtor. |
| `morluto/rea` | MIT | **Modelo de dados**: cada pendência é uma "incógnita" com gravidade, sonda (ler/perguntar/construir/testar) e status; só fecha citando evidência observada → nosso **crítico**. Cada afirmação tem confiança (observado/derivado/inferido) e autoridade (paper, mentor, dev, protótipo, inferência da IA). Fechamento por checklist respondido/parcial/aberto. |
| `google-research/harness2` | Apache-2.0 | **Prompts** portados (com NOTICE e marcação de modificação): dois passes (como o agente trabalha × o que um praticante da área sabe) + compositor que cita evidência; **crítico cego** na ordem entrega → conformidade → fidelidade às fontes → consistência → aptidão operacional → acabamento — base da **avaliação da Zaeon**. Regra "nunca inventar autoridade, identificador, padrão ou citação". |

Pesquisa completa: notas da sessão (`blueprint-repos-research.md`).

**O compositor** (novo, servidor): entrada = conversa recente + blueprint atual + fatos imutáveis; saída = plano do blueprint **validado por schema** (zod): estudo, passos, peças da figura (≤ ~7) e ligações, críticos por fase (com prova exigida, peça e passo alvo), produto, próximos passos, termos de busca de repositório. Modelo: **Google (gemini-3.5-flash via Vertex)** — os modelos locais da Contabo não servem para isso (lentos/fracos para artefatos).

**Nada inventado.** Repositórios vêm da **API do GitHub** (busca por termos do compositor; o modelo não escreve nomes de repo). Fontes vêm do pipeline existente com citação conferida (`lib/scholar`, "Resposta certeira"). Mentores/agentes nas Conversas vêm do que de fato participou (roster/mentors), não de nomes inventados.

**Provas conferidas pelo servidor** (genéricas, não específicas de Solana): URL viva (já existe em `selos`, com guarda SSRF); repositório GitHub público existe e tem commits recentes; arquivo/PDF anexado; link de demo viva (Octa preview ou URL pública). Verificações de domínio (ex.: transação na devnet) ficam como extensão futura — o crítico pode pedir, mas a checagem automática v1 é a genérica + avaliação da Zaeon.

**Toda fase exige artefato** (decisão minha, a partir de "pra passar tem que ter entrega real"): inclusive a fase 1 — ex.: um README/nota explicativa num repo, um diagrama, um documento publicado — nunca só texto digitado no chat. **Provas v1 são links** (sem upload de arquivo; um PDF entra como link público). **Anti-trapaça sem identidade GitHub** (decisão minha): repositório como prova precisa ter commits **depois** que o crítico foi aberto, e a Zaeon lê o conteúdo na avaliação; vincular conta GitHub do aluno fica para depois.

**Avaliação da Zaeon** (rubrica do dono): rigor, originalidade, usabilidade real, viabilidade, impacto (0–100 cada) + parecer curto citando as provas; aprova a fase acima de um limiar (construtor propõe; dono ajusta).

## 5. Restrições e encaixe no que existe

- Reaproveitar: `Cartolina` (cards Json + `rev` otimista + convites/membros/presença Pusher), visual e helpers de `BoardEstudos`, `lib/estudos/{board,blueprint,harness-server}`, rota `selos`, gatekeeper, `runChatTurn` (ponto onde o gatekeeper roda).
- **Ligação conversa ↔ blueprint (decisão minha)**: um `Cartolina` por estudo com `surface` nova (ex.: `"blueprint"`) e `scopeId` = thread id da conversa. Sem mudança de schema Prisma se o estado extra (fases, provas, fixos) couber em `cards`/um card-raiz; o construtor pode propor campo novo se ficar feio.
- **Convivência com o que já existe por conversa** (decisão minha): o blueprint é **mais um** registro ao lado de `Conversation.estudavel/mapaId`, da cartolina-memória `surface "estudos"` (`fixarTurno`) e do mapa do Cérebro (bolinha azul, clique pra gerar) — nenhum deles é removido ou redirecionado nesta leva. O compositor **lê** o que já existe (o backbone do mapa, se houver; o prompt do percursor via `harness-server.gerarPassos`) como entrada dos passos, em vez de inventar uma lista paralela — o percurso exibido é um só, o do blueprint.
- Depende de `ESTUDO_GATEKEEPER=1` (o construtor confirma o estado em prod e documenta).
- O board antigo "Meus estudos" (`surface "meus-estudos"`) continua acessível (como hoje o "caderno antigo"), sem migração.
- **Flags**: `NEXT_PUBLIC_BLUEPRINT_PRATICO` (build-arg: UI) + `BLUEPRINT_PRATICO` (servidor: criação/recomposição). Declarar no Dockerfile, `docker-compose.beta.yml`, `deploy.yml` e `.env.example` (convenção do repo). Tudo desligado em prod até o dono ligar.
- **Blueprints alimentam o jogo — são itens raros** (dono). Entram em `lib/estudos/itens.ts` (inventário/livros), vitrine e entrega no Relicário (`app/api/cyber/entrega`) ao lado dos estudos antigos. Raridade e VENDÁVEL passam a vir de **fases aprovadas + provas conferidas + nota da Zaeon** (a fórmula exata é do construtor; quanto mais fundo nas fases, mais raro; VENDÁVEL exige pelo menos a fase 2 aprovada). Os estudos antigos continuam com a regra antiga.
- **GitHub sem token garantido** (dono não respondeu): `GITHUB_TOKEN` opcional (só leitura pública); sem ele, cache longo dos resultados por termo e degrada pra lista vazia sem erro.
- Custo: recompor no máximo ~1× a cada poucos minutos por estudo (o turno mais recente vence) — valor ao construtor.
- Testes vitest colocados (funções puras: layout, mescla com imutáveis, portão de fase, schemas); verificação no navegador por página de prévia local não commitada (padrão `app/zz-*`).
- Merge só com ok do dono; PR por fatia.

## 6. Fatias (ordem combinada)

1. **Base** — conversa válida cria o blueprint; compositor v1 (estudo, percurso, produto, próximos, termos de repo) + busca de repositórios no GitHub; recomposição contínua; **seletor no topo**; prancha **esquerda→direita simétrica** com arrastar/fixar/"reorganizar"; flags.
2. **Críticos, fases e avaliação da Zaeon** — críticos por fase com prova exigida (link); checagens do servidor; **rubrica + crítico cego (harness2)** como segunda condição do portão; card de avaliação no lugar dos críticos quando a fase fecha; trilho de fases; fase 4 = "aguardando mentor"; **blueprint vira item raro** no inventário/vitrine/Relicário com raridade das fases/provas/nota. (Decisão minha: a avaliação veio da antiga fatia 4 pra cá — sem ela o portão só checaria "link vivo", e a fase passaria sem entrega de verdade.)
3. **Figura** — lista de peças → desenho isométrico; estados provada/travada/futura; ligações animadas; críticos apontando pras peças.

## 7. Não-objetivos (agora)

Mentores com rosto e tom entrando na conversa; a Zaeon chamando o mentor/professor e o registro da aprovação humana; o fim do "modo revista" (MagazineAnswerView); cobrança/moeda; checagens on-chain específicas; usar modelos locais para compor/avaliar.

## 8. Anti-objetivos (fracasso mesmo funcionando)

- Prancha caótica: sobreposição, ramos cruzando sem ordem.
- Muro de texto: cards de palavras substituindo a visualização.
- Um estudo novo por turno (duplicatas) em vez de melhorar o mesmo.
- Recomposição que apaga ou regride entrega provada.
- Repositório, citação, mentor ou prova **inventados** pela IA.
- Fase que destrava só com conversa, sem entrega real.

## 9. Deixado ao construtor

Forma exata dos dados dentro de `Cartolina.cards`; algoritmo do layout (contanto que esquerda→direita, simétrico, sem sobreposição); portar iso-kit ou escrever o renderizador; limiar da rubrica; ritmo/debounce da recomposição e onde ela roda (fila existente ou fire-and-forget); textos de UI; como o seletor lista blueprints compartilhados.
