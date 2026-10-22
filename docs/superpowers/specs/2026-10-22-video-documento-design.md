# Vídeo do documento com a Zaeon holograma — design

Data: 2026-10-22 · Status: aprovado pelo dono em 2026-10-22 ("prossiga") · Depende de: blueprint prático (PRs #542→#544)

## 1. Intenção

Pedido do dono: "Os documentos mais importantes citados na conversa (ou os nossos) têm um vídeo gerado num card dentro da sala de estudos. Isso também entra como pedido dentro do chat — se o usuário pedir, deve ser feito. Mas na sala de estudos é um MUST." Inspiração: paper2video (Lunamos/paper2video e showlab/Paper2Video, ambos MIT).

Decisões do dono:
- **A Zaeon falando** — "em forma de holograma, assim como aparece no centro da cidadela".
- **Assistir é o que importa**: toca ao vivo no card (slides + Zaeon holograma ao lado, boca no ritmo da narração), no navegador; **não precisa sair um arquivo MP4**.
- **Um vídeo por documento**, só para documentos **importantes no estudo ou a base dele**.

## 2. O que a pessoa vê

**Na prancha do blueprint** (lado direito, a prática): um card `VÍDEO · V-01` por documento-base (no máximo 3 por estudo — decisão minha). Fechado, o card mostra o título do documento, a duração e um botão ▶; enquanto gera, "a Zaeon está preparando o vídeo…"; sem texto acessível, o motivo ("artigo sem PDF aberto").

**O player** (abre grande por cima da prancha, como o blueprint antigo abria):
- à esquerda, o **slide** (título, 2–4 tópicos que aparecem frase a frase, figura do próprio documento quando houver, legenda da frase falada embaixo); um **destaque** (o "cursor" do paper2video, sem modelo) acende o elemento do slide de que a Zaeon está falando;
- à direita, a **Zaeon holograma** — o `HoloZaeon` do cyberespaço (`components/cyber/HoloZaeon.ts`: rosto anime em shader ciano, varredura, cintilação, sobe do globo de luz) numa cena 3D pequena, com a boca pela voz (`boca(nivel)` alimentado pelo volume do áudio);
- controles: play/pausa, slide anterior/próximo, barra de progresso por slide, legenda liga/desliga;
- 5–8 slides, ~3 min (decisão minha); abre com um slide-título (página 1 do documento) e fecha com "o que isso muda no seu estudo" (ligando ao blueprint).

**No chat**: "faz um vídeo desse artigo/PDF" gera o mesmo player embutido na resposta (como os artefatos do Studio aparecem hoje). Se o documento estiver num estudo, o vídeo também aparece no card do blueprint (mesmo vídeo, sem gerar de novo).

## 3. De onde vêm os documentos

- **Citados na conversa**: artigos da busca acadêmica (`lib/scholar` — título, DOI/URL, PDF aberto via `resolveFullText`), livros com PDF livre (`buscar_livro`), fontes das evidências.
- **Os nossos**: documentos da base da pessoa (RAG — `fontesBase`), trabalhos escritos na plataforma (ResearchWork/TCC/artigo), PDF anexado no chat.
- **Peça nova necessária**: hoje o servidor não guarda, por conversa, quais documentos foram citados (só no `ChatTurn` com `CHAT_BG=1`; anexos ficam no IndexedDB do navegador). O blueprint passa a ter uma lista `documentos` (id, título, tipo, url/ref, `base: boolean`), preenchida no turno a partir da resposta da Aura (sources/evidência/fontesBase/livros/TCC). A Zaeon, ao recompor, marca 1–3 como **base** do estudo. PDF anexado só entra quando a pessoa pede o vídeo no chat: aí sobe pro servidor e **entra na base da pessoa ("Minha base", RAG)** — decisão do dono — e o vídeo sai do texto ingerido.
- **Texto**: PDF aberto → pdf-loader/extração existente; base RAG → os trechos guardados; TCC → o próprio texto. Sem texto acessível = sem vídeo (o card diz por quê). Nunca resumir só pelo título.

## 4. Geração (servidor, sem GPU)

Padrões do paper2video, portados (não o código — as dependências deles exigem GPU e têm licenças não comerciais):
1. extrair texto (+ figuras/página 1 quando o pdf-loader der);
2. **roteiro por cena** (Gemini flash, JSON, pt-BR): por slide — título, tópicos, figura, e por frase o **texto falado** (números por extenso), a **legenda** e o **alvo** do destaque (id do elemento do slide);
3. **checagem dos fatos** contra o texto do documento (Gemini; corrige número errado e exagero; nada fora do documento);
4. **narração frase a frase** com Gemini TTS, voz da Zaeon (Leda), em cache por hash do texto → a duração de cada frase é exata (sem WhisperX);
5. guarda o roteiro + áudios (storage do Studio, `.studio/`) como um `StudioArtifact` novo (`kind: "video-doc"`), ligado ao documento e ao blueprint.

Roda em segundo plano (fire-and-forget como o vídeo do Studio hoje), disparado quando um documento vira base ou quando a pessoa pede no chat; idempotente por documento (não gera duas vezes o mesmo).

### Custo, cache e quem assiste (decisões minhas, após a revisão)
- **Fila com teto**: no máximo 2 vídeos gerando ao mesmo tempo no servidor (o Vertex já deu 429 neste projeto) e no máximo 6 vídeos novos por pessoa por dia; o que passar espera a vez (o card mostra "na fila"). Vale pra todo mundo com o blueprint ligado.
- **Base estável**: documento que já ganhou vídeo continua com o card mesmo se a Zaeon trocar a base depois; no máximo 3 vídeos gerados automaticamente por estudo (pedidos no chat não contam no teto do estudo, contam no diário).
- **Documento público é compartilhado**: artigo com DOI/URL aberta gera UM vídeo pra todo mundo (chave normalizada DOI/URL); o segundo estudo que cita o mesmo artigo reaproveita. Documento da pessoa (base RAG, TCC, anexo) é só dela.
- **Quem assiste**: quem tem papel no blueprint (dono, editor, leitor) vê os vídeos dos cards dele; vídeo de documento público pode ser visto por qualquer pessoa logada que tenha o card.
- **TCC editado**: o vídeo fica como está e o card mostra "o texto mudou — gerar de novo" (gera só se a pessoa pedir).

## 5. Restrições

- Modelos Google (Vertex gemini-3.5-flash + Gemini TTS); nunca os locais da Contabo.
- Sem dependência paga/não comercial (nada de Remotion, F5-TTS, Hallo2, edge-tts).
- Reaproveitar: `HoloZaeon`, a voz da Zaeon (`lib/cyber/vozZaeon`, `lib/voice/gemini-tts`), o storage e o polling do Studio, o pdf-loader, a extração do scholar.
- Atrás de flag (ex.: `NEXT_PUBLIC_VIDEO_DOC` + `VIDEO_DOC`), testes vitest nas partes puras, verificação no navegador.
- Nada inventado: o roteiro só afirma o que está no documento; citação literal só se conferida no texto.

## 6. Não-objetivos

Arquivo MP4 para baixar/postar (pode vir depois — o padrão puppeteer+ffmpeg já está no servidor); rosto fotorrealista ou clonagem de voz; vídeo de documento que não é base nem foi pedido.

## 7. Anti-objetivos

Vídeo que inventa o que o documento não diz; um "vídeo" que é só texto lido sem slide; Zaeon dessincronizada da voz; travar a prancha enquanto gera; gerar o mesmo vídeo várias vezes.

## 8. Fatias (proposta)

1. Documentos no blueprint (lista + marcação de base pela Zaeon) + geração do roteiro/narração (`video-doc`) + card na prancha com o player (slides + HoloZaeon).
2. Pedido no chat ("faz um vídeo desse…") com o player embutido, inclusive PDF anexado.

## 9. Deixado ao construtor

Desenho exato dos slides (dentro da estética blueprint), formato do `StudioArtifact.meta`, como extrair figuras (se o pdf-loader não der, slide sem figura), limiar de "documento sem texto suficiente", número exato de frases por slide.
