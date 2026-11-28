# Teste em lote da IA (voz, imagem, laboratórios)

O Martinez pediu (28/11) para parar de testar a IA à mão em produção, um caso por vez, por tentativa e erro. Problema de modelo se acha com **testes automáticos que rodam muitos casos de uma vez** e conferem a resposta por regra. Este PR cria esse teste para o que o #883 já passou para o Hugging Face: **voz, imagem e os laboratórios agênticos**.

## O que muda

### O teste em lote (`lib/eval/loteIa.ts`, novo)
- **17 casos**, cada um rodando N vezes (padrão 3):
  - **10 de laboratório:** 3 no CodeLab (explicar, mudar o código, erro em Python), 4 no QuantumLab (qubit, níveis do hidrogênio, fenda dupla, poço infinito) e 3 no BioSim (cafeína, hemoglobina, célula animal).
  - **4 de voz:** frase curta feminina, voz masculina do podcast, texto longo de aula (vários trechos) e texto com números e siglas.
  - **3 de imagem:** vulcão, coração e uma cena de vídeo.
- **A resposta é conferida por regra, não no olho:**
  - Laboratórios: veio JSON, com os campos certos e a escolha certa (o qubit tem que virar esfera de Bloch, a cafeína tem que virar molécula).
  - Voz: WAV 24 kHz mono, com duração mínima pelo tamanho do texto.
  - Imagem: PNG de verdade, não um pixel.
- **O relatório** traz, por caso: quantas vezes acertou, o tempo (p50 e p95) e o motivo de cada falha. O lote passa com **90% de acerto** (ajustável).
- O token nunca aparece no relatório.

### Os prompts dos laboratórios num lugar só (`lib/agentic/prompts.ts`, novo)
- Os prompts do CodeLab, do QuantumLab e do BioSim saíram de dentro das rotas. Assim **o teste usa exatamente o mesmo texto que o aluno manda**.
- As rotas mudaram só nisso, o comportamento não muda.

### O script e o botão no GitHub
- `scripts/eval-ia-lote.ts`: roda o lote contra o Hugging Face de verdade e escreve o relatório (`eval-ia-lote.md` e `.json`).
- `.github/workflows/eval-ia.yml`: botão **"Run workflow"** na aba Actions do GitHub, com 3 campos: as áreas, quantas vezes e o mínimo.
  - O relatório aparece no resumo do run e fica para baixar.
  - **Só roda quando alguém aperta o botão.** Nunca roda em push, PR ou agenda, porque gasta créditos do HF.
  - Nos laboratórios, o relatório também conta quantas vezes o Google de queda foi acionado. O ideal é 0.

## Para o Martinez

- **Custo é área dele.** Uma rodada completa (3 vezes cada caso) faz cerca de 30 pedidos de texto, 12 de voz (o texto longo vira vários trechos) e 9 imagens, todos no HF.
- Usa o secret `HF_TOKEN` que o deploy já usa. Não tem secret nem variável nova.
- Para rodar: **Actions → "Teste em lote da IA (manual)" → Run workflow**.
- Não mexe em produção nem precisa de `prisma db push`.

## Testes automáticos

- `lib/eval/loteIa.test.ts` (novo, 12 testes, com respostas falsas, sem rede e sem gastar crédito):
  - as conferências de cada laboratório, da voz e da imagem aceitam o certo e recusam o errado, com o motivo;
  - os casos usam o mesmo prompt das rotas, e as rotas usam o arquivo novo;
  - o executor roda cada caso N vezes, e o erro vira falha com motivo, sem o token;
  - a regra de "passou" (mínimo), o percentil, o resumo e o relatório;
  - o workflow só roda à mão, usa o secret e não põe a entrada do formulário direto no shell.
- `lib/agentic/labIa.test.ts`: continua 8/8.
- `tsc`, lint e a checagem de provas reais da CI sem erros.
- O script sem `HF_TOKEN` para com o aviso "sem HF_TOKEN: nada a testar".

## Verificado na prévia

- Não tem tela nova. O script não roda aqui porque a máquina local não tem o token do HF.

## Como testar (depois do merge)

1. No GitHub do repositório, abra **Actions → "Teste em lote da IA (manual)" → Run workflow**.
2. Para um primeiro teste barato, use áreas `labs` e vezes `1`.
3. Abra o run: o resumo mostra a tabela. Confira se passou e se a "queda para o Google" ficou em 0.
4. Depois rode completo (`labs,voz,imagem`, 3 vezes). O relatório completo fica em **Artifacts → eval-ia-lote**.

## Resultado dos testes

| Teste | Resultado |
|---|---|
| `loteIa.test.ts` + `labIa.test.ts` | ✅ 28/11: 20/20 |
| Suíte completa (28/11) | ✅ nenhuma falha nova; só as falhas do Windows de sempre (compose, links simbólicos, caminhos) |
| 1. Rodada barata (labs, 1 vez) | ⏳ depois do merge |
| 2. Rodada completa | ⏳ depois do merge |
