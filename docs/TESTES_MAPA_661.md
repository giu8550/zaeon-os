# Testes do #661 — Mapa: evidência obrigatória no Apliquei, voltar à conversa e explicações

## Resultado automático

- Testes do mapa e da conexão: 140 de 140 passando.
- Suíte completa: 4863 passando, 10 ignorados, 29 falhas. As 29 são as falhas já conhecidas no Windows (`pg`, sandpack, `leitor/compose`, `octa/fortify`, `octa/genart`, `studio/storage`); nenhuma vem do mapa.
- Checagem de tipos do projeto inteiro: limpa.
- Ainda não testado no navegador com um mapa real: a tela depende de login e banco. Use a lista abaixo em produção.

## Regra que mudou

`POST /api/map/[id]/node/[noId]/apply` agora responde 400 (`motivo: "sem_evidencia"`) quando a evidência está ausente, vazia ou só com espaços. Antes, a etapa avançava mesmo sem evidência. Quem chamar essa rota sem texto passa a receber erro.

## O que os testes cobrem

- `app/api/map/[id]/node/[noId]/apply/route.test.ts`: sem evidência não aplica; com evidência aplica com o texto limpo.
- `components/cerebro/CerebroPanel.test.tsx`: caixinha no lugar da janelinha do navegador; Enviar só com texto; Cancelar e Esc fecham só a caixinha; falha de rede mostra frase em português e mantém o texto; "Voltar à conversa"; "Etapa 2 de 3"; dicas das etiquetas; legenda.
- `lib/map/backbone.test.ts`: `andamentoDoPercurso`.
- `lib/canal/conexao.test.ts`: "HTTP 500" vira frase em português.

## Como testar em produção

1. Abra um mapa no chat da Aura: aparecem "✕ Voltar à conversa" e "Etapa X de Y" no alto.
2. Clique em "✓ Apliquei": abre a caixinha do próprio mapa, e "Enviar" fica apagado até você escrever.
3. Escreva só espaços: "Enviar" continua apagado.
4. Abra a caixinha e aperte Esc: fecha só a caixinha. Esc de novo sai do mapa.
5. Escreva como aplicou e envie: a etapa avança ou vai para o professor.
6. Com F12 → Rede → Sem conexão, tente enviar: aparece "Sem conexão — sua aplicação não foi enviada" e o texto continua na caixinha.
7. Passe o mouse numa etiqueta: aparece a explicação. A legenda das 5 cores está visível.
8. Em um navegador que nunca girou o mapa, aparece "Arraste para girar"; depois de girar, a dica some.
