# PR (próxima): Citações em tempo real — painel de pesquisa ↔ trabalho

> Insight do Martinez. Fazer DEPOIS da voz. Objetivo: o aluno constrói o TCC com as
> citações só conversando com os papers e salvando as que interessam — sem perceber o "como".

## A ideia, em uma frase
Cada documento com que o usuário interage vira uma **referência ABNT** que pode ser salva;
ao salvar, ela aparece no **modal de referências** (estilo característico) E no **rodapé do
trabalho** (seção de referências) — atualizado em **tempo real**, mas de forma discreta.

## Comportamento esperado
1. **Ao dar play / gerar resumo de um documento:** criar a referência (ABNT) com o nome/título
   do documento e jogá-la no painel de escrita **em estado "em andamento"** (rascunho, não salvo).
   - Hoje isso já acontece meio sem querer (a citação do título aparece no painel) — formalizar.
2. **Conversando com o documento:** o usuário pode **salvar** as referências que mais interessam
   (ação manual, mas que não parece burocracia — um clique de "salvar citação").
3. **Ao salvar:** a referência é persistida e aparece em DOIS lugares, em tempo real:
   - **Modal de referências** — visual, no estilo característico do projeto.
   - **Rodapé do trabalho** (a pesquisa em si) — seção de referências ABNT.
4. **Discrição:** o usuário NÃO deve ver a mudança "acontecendo ao vivo" no modal/rodapé.
   A atualização é em tempo real por baixo; ele só percebe quando **abre o documento** e vê
   as referências já lá. (Nada de animação chamativa de "referência entrando".)

## Estado vs. persistência
- **Em andamento (rascunho):** referência gerada ao interagir — fica em memória/estado, NÃO salva.
- **Salva:** só quando o usuário escolhe. Aí persiste (no `ScholarSession`/trabalho) e propaga
  pro modal + rodapé.

## Escopo técnico (o "grosseiro")
- Um **estado/canal compartilhado de referências** entre o painel de pesquisa e o editor de
  escrita (hoje a comunicação é fraca — essa PR melhora a responsividade entre eles).
- Modelo de referência ABNT já existe no fluxo do scholar (`references` no `ScholarSession`,
  `handleGenerateCitations`). Reusar.
- Eventos: `onInteractDoc → addDraftReference`; `onSaveReference → persistReference →
  (modal + rodapé do trabalho)`.
- Persistência em tempo real: salvar incremental no `ScholarSession.references` (ou campo
  dedicado do trabalho) a cada save, sem recarregar a tela.

## Critério de pronto
Aluno conversa com 3 papers, salva 2 citações → abre o documento → as 2 referências ABNT
estão no rodapé, formatadas, e no modal de referências — sem ele ter visto "o pulo do gato".

## Não-objetivos (desta PR)
- Não mexer na voz nem no resumo (já feitos).
- Não auto-salvar referências (salvar é sempre escolha do usuário).
