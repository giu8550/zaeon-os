# Escritório — card #438 · testes e observações

> Documento de apoio à PR do **#438 — CORREÇÃO ESCRITÓRIO 4** (branch `438-correcao-escritorio-4-tempo-real-agente-foto`).
> Tudo aqui foi tirado do código da branch e de execuções reais dos testes nesta máquina (Windows).
> Onde algo **não foi verificado de verdade**, está marcado como `NÃO VERIFICADO`.

---

## 1. Resumo

| # | Item do card | O que foi feito | Commit |
|---|---|---|---|
| 1 | Mensagem de quem tem foto não chegava ao vivo | **Confirmado no site:** a foto do Martinez está guardada inteira (13 KB) e o aviso em tempo real levava a foto junto, passando do limite de 10 KB do Pusher (que recusava em silêncio). Agora foto inteira não vai no aviso; a tela pega a foto da lista de pessoas. Se ainda assim passar do limite (resposta longa de agente), vai um aviso leve e a tela busca a conversa. | `ec5b532` |
| 2 | Agente não saía quando dispensada | "pode ir", "pode sair", "é só isso"… → ela se despede uma vez (frase fixa, **sem gastar IA**) e entra "Zenita saiu da conversa". Sem @, ninguém mais responde; com @ ela volta. "Tchau" pra outra pessoa não tira a agente. | `493a395` |
| 3 | Foto não salvava pelo Perfil | A rota aceitava só PATCH e o Perfil mandava POST (405). Agora aceita os dois, valida formato (PNG/JPG/WEBP/GIF) e tamanho, e o erro aparece do lado da foto. | `8360073` |
| 4 | Foto do Google não atualizava | A cada login com o Google, a foto do Gmail entra — a não ser que a pessoa tenha posto foto própria na Zaeon. Nunca derruba o login. | `e4ba11a` |

**Banco:** nada muda.

---

## 2. Como rodar

```bash
npx vitest run lib/canal lib/user app/api/canal app/api/user components/office components/research
npx tsc --noEmit
```

---

## 3. O que os testes automáticos garantem

**Item 1** (`lib/canal/aviso.test.ts`)
- o caso real: com a foto de 13 KB o aviso passava de 10 KB; sem ela, a mensagem do Martinez vai **completa** (texto e nome) e dentro do limite;
- foto por link (Google, agentes) continua indo;
- resposta enorme vira aviso leve (`cortada`), sem o texto;
- conta bytes como o Pusher (acento 2, emoji 4);
- na tela, a foto volta pela lista de pessoas (inclusive no "fulano entrou");
- o `publicarPusher` de verdade nunca manda a foto inteira.

**Item 2** (`lib/canal/dispensa.test.ts`, `lib/canal/alvo.test.ts`, `app/api/canal/[id]/mensagem/route.test.ts`)
- 14 frases que dispensam (inclusive "@zenita pode ir embora, vlw", o caso real) e 8 que **não** dispensam ("pode ir pesquisando…", "valeu!", "só isso que você sabe?", "tchaikovsky");
- "tchau" numa conversa com outra pessoa só conta com o nome ou o @ da agente;
- depois de "saiu da conversa", sem @ ninguém responde (nem o primeiro oi da Aura); com @ ela volta e continua;
- a rota: dispensa não dispara turno de IA, grava e publica a despedida e a linha do sistema; "tchau" pra outra pessoa segue indo pra IA.

**Item 3** (`lib/user/avatar.test.ts`, `app/api/user/avatar/route.test.ts`, `components/research/EditableProfile.visitante.test.tsx`)
- POST (Perfil) e PATCH (Workstation) salvam; SVG, HTML e link são recusados; foto grande demais → 413; sem login → 401;
- arquivo que não é imagem mostra o aviso **do lado da foto**.

**Item 4** (`lib/user/fotoNoLogin.test.ts`)
- trocou a foto no Gmail → atualiza no próximo login; foto própria na Zaeon → o Google não sobrescreve;
- login por e-mail ou mesma foto → não mexe; banco fora do ar → o login **não quebra**.

---

## 4. Teste manual no zaeon.com.br (depois do deploy)

Ctrl+F5 antes.

1. **Mensagem ao vivo:** você e o Martinez no mesmo escritório. Ele manda uma mensagem → aparece pra você **sem atualizar a página**, com a foto dele do lado.
2. **Dispensar a agente:** fale com uma agente, depois mande "@zenita pode ir embora, vlw" → ela responde uma despedida curta, aparece a linha "Zenita saiu da conversa", e o campo de mensagem volta a dizer "@agente convoca". Mande outra mensagem sem @ → **ninguém responde**. Mande "@zenita oi" → ela volta.
3. **Tchau pra pessoa:** numa conversa com o Martinez e a agente ativa, mande "tchau, até amanhã" (sem o nome dela) → a agente **não** sai.
4. **Trocar a foto pelo Perfil:** na sua conta, Perfil → clique na foto → escolha uma imagem → ela aparece na hora e continua depois de atualizar a página.
5. **Foto do Google:** na conta giu dev (que já tem a Azula no Gmail), saia e entre de novo com o Google → a Azula aparece. `NÃO VERIFICADO` em produção: depende do Google mandar o link novo no login (é o normal).

---

## 5. Observações

- **"Muita coisa ao mesmo tempo"** nas respostas das agentes é o erro de **limite de uso da IA** (`lib/agent/errors.ts`). Apareceu até com uma mensagem só. É do servidor (cota/chave da IA), não deste card — vale o Martinez olhar os logs.
- **O log do console** que o Martinez mandou tinha erros do **Colyseus** (cyberespaço/lounge 3D, "Wrong protocol for WebSocket") — outra área, fora deste card. Os 502 eram do horário em que o servidor caiu.
- **Foto própria x Google:** a Zaeon considera "foto própria" a que está guardada inteira (enviada pela própria pessoa). A do Martinez é própria — o login com o Google não troca.
