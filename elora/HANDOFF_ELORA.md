# HANDOFF — Projeto Élora (login e cadastro)

> Cole este documento inteiro no início da nova conversa e diga: **"Continue de onde paramos, a partir da seção 8."**

---

## 1. O projeto

- **Élora** é uma página de **login e cadastro** para uma plataforma de estudos fictícia.
- É uma **atividade acadêmica** de desenvolvimento web, a primeira aula da disciplina.
- O código deve usar **só HTML e CSS**, sem JavaScript e sem frameworks.

## 2. Como a aluna quer aprender (respeite sempre)

- **Uma etapa por vez.** Não entregar o projeto pronto.
- Explicar **cada propriedade** e **o motivo** de cada decisão, com o link da documentação no MDN.
- Ao fim de cada etapa, dar uma frase pronta para ela justificar a escolha ao professor.
- Ela **digita o código** (não só copia) e manda um print ou os arquivos de volta. Só depois disso se passa para a próxima etapa.
- Sem burocracia. A meta é **sofisticação no resultado e simplicidade na execução**.
- Manter o estilo de nomes dela: **classes em camelCase e em português** (`blocoBemVindo`, `inputNome`…).

## 3. Protótipo final (decisão já tomada, não mudar)

**Layout:** duas colunas.
- **Esquerda:** foto de fundo escura (mesa de estudos à noite: notebook, xícara com o logo, abajur, planta). Por cima ficam o logo "ÉLORA / PLATAFORMA DE ESTUDOS", o sobretítulo "É BOM TER VOCÊ AQUI", o título "Bem-vindo(a) *de volta!*" (com "de volta!" em itálico areia), um parágrafo e um botão "Entrar →" com contorno areia.
- **Direita:** cartão creme com cantos arredondados. Contém o sobretítulo "SEU NOVO COMEÇO", o título "Crie sua conta" e o subtítulo "Preencha seus dados para começar." Depois vêm os campos **Nome completo**, **E-mail** e **Senha**, com o rótulo acima, ícone à esquerda e placeholder. Abaixo, o botão "Cadastrar →" em petróleo e a linha "Já tem uma conta? **Entrar**".

**Paleta:**

| Cor | Hex | Variável |
|---|---|---|
| Petróleo | `#0F3D46` | `--cor-petroleo` |
| Petróleo claro | `#2E6F73` | `--cor-petroleo-claro` |
| Areia | `#D9C6A5` | `--cor-areia` |
| Creme | `#F7F4EF` | `--cor-creme` |
| Texto | `#1E293B` | `--cor-texto` |

**Fontes:** **Playfair Display** nos títulos e destaques, **Poppins** nos textos e botões.

## 4. Problemas do protótipo a corrigir durante o código

1. **O texto se contradiz.** À esquerda está "Bem-vindo(a) de volta" (para quem já tem conta) e à direita "Crie sua conta" (para quem não tem). Sugestão: usar uma saudação neutra na tela de cadastro e deixar o "de volta" só na tela de login.
2. **O ícone de olho (mostrar senha) não funciona sem JavaScript.** Remover e citar isso como limitação consciente.
3. **Falta a tela de login.** Os dois "Entrar" vão trocar o cartão para um formulário de login usando **rádios escondidos + `:checked` + `<label for>`**.
4. **A faixa inferior do protótipo** (paleta, tipografia, tecnologias) é só uma prancha de apresentação. **Não vai para o HTML.**
5. A foto de fundo precisa de uma **camada de gradiente petróleo** por cima, para o texto branco continuar legível.
6. Os placeholders cinza sobre o creme estão com **contraste baixo**. Escurecer um pouco.
7. **Versão para celular:** a foto vira uma faixa curta no topo e o cartão ocupa a largura toda.

## 5. Código atual da aluna (ainda sem a Etapa 1 aplicada)

**index.html**
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Google Fonts-->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
    <title>Login</title>
</head>
<body>
    <div class="container">
        <div class="blocoBemVindo">
            <h1 class="tituloBemVindo">Bem-vindo de volta!</h1>
            <h2 class="subtitBemVindo">Esse site vai servir de exemplo para nossa primeira aula de desenvolvimento web!</h2>
            <button class="botaoEntrar">Entrar</button>
        </div>
        <div class="blocoCadastro">
            <h1 class="tituloCadastro">Crie uma conta</h1>
            <div class="blocoInput">
                <input type="text" placeholder="Nome" class="inputNome">
                <input type="email" placeholder="E-mail" class="inputEmail">
                <input type="password" placeholder="Senha" class="inputSenha">
            </div>
            <button class="botaoCadastrar">Cadastre-se</button>
        </div>
    </div>
</body>
</html>
```

**style.css**
```css
body {
    font-family: "Roboto", sans serif;
}
.container{
    display: flex;
    flex-direction: row;
    background-color: #22223b;
}
.blocoBemVindo{
    color: white;
}
```

**Diagnóstico já passado para a aluna:**
- **Certo:** a estrutura de dois blocos dentro de um container flex, `lang="pt-BR"`, a meta viewport e os `type="email"` e `type="password"`.
- **Erros no CSS:** `sans serif` sem hífen (o certo é `sans-serif`), `#22223b` fora da paleta, Roboto em vez de Playfair e Poppins, e `flex-direction: row` desnecessário (já é o padrão).
- **Erros no HTML (para a Etapa 2):** dois `<h1>`, um `<h2>` usado como parágrafo, campos sem `<label>` e nenhuma tag `<form>`.

## 6. Plano de etapas

1. **Variáveis de cores e fontes** ← **explicada, a aluna ainda não aplicou**
2. HTML semântico: `form`, `label`, um único `h1`, `p`, textos do protótipo, `name` e `required`
3. Layout: duas colunas, `min-height: 100vh`, foto de fundo com gradiente
4. Estilo do cartão: campos com ícone SVG, botão, links
5. Troca entre login e cadastro (rádios + `:checked`)
6. Versão para celular (`@media`)
7. Animações: cartão surgindo, seta do botão, foco nos campos e **vapor da xícara** (seção 7) + `prefers-reduced-motion`

## 7. Etapa 1 (o código passado para a aluna)

**HTML:** trocar a linha do Roboto por
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
```
e trocar `<title>Login</title>` por `<title>Élora — Crie sua conta</title>`.

**CSS:** substituir tudo por
```css
/* 1. Variáveis: as cores e fontes do protótipo */
:root {
    --cor-petroleo: #0F3D46;
    --cor-petroleo-claro: #2E6F73;
    --cor-areia: #D9C6A5;
    --cor-creme: #F7F4EF;
    --cor-texto: #1E293B;

    --fonte-titulo: "Playfair Display", Georgia, serif;
    --fonte-texto: "Poppins", Arial, sans-serif;
}

/* 2. Reset */
*, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
}

body {
    font-family: var(--fonte-texto);
    color: var(--cor-texto);
    background-color: var(--cor-creme);
}

.container {
    display: flex;
    background-color: var(--cor-petroleo);
}

.blocoBemVindo {
    color: white;
}
```
**Já explicado à aluna:** `:root`, custom properties, `var()`, lista de fontes reserva, `box-sizing`, reset de margin. O petróleo vai temporariamente no `.container` e passa só para a coluna esquerda na Etapa 3.

**Frase para o professor:** "Centralizei a paleta e a tipografia em variáveis no `:root`. Assim o visual fica consistente, e uma mudança de cor é feita num único lugar."

## 8. ONDE PARAMOS

- A aluna **ainda não aplicou a Etapa 1**: esqueceu de salvar com `Ctrl+S` e reenviou os arquivos antigos.
- **Próxima ação:** pedir o `index.html` e o `style.css` salvos, ou um print da página. Confirmar que o fundo ficou **petróleo** e a fonte é **Poppins**. Corrigir o que estiver errado. Só então começar a **Etapa 2 (HTML semântico)**.

## 9. Animação do vapor (já aprovada, para a Etapa 7)

A aluna viu uma colega com animação no projeto e quis uma também. A escolhida foi o **vapor subindo da xícara**, que combina com a calma da marca. Sem raios nem efeitos chamativos.

Foi feita uma demonstração (fundo = imagem do protótipo). A aluna **aprovou estes valores**:

```css
.vapor { position: absolute; left: 34.4%; top: 58%; }   /* boca da xícara, em % da imagem */

.vapor span {
    position: absolute; left: -1.2vw; bottom: 0;
    width: 1.8vw; height: 7vw; border-radius: 50%;
    background: radial-gradient(ellipse at center,
                rgb(255 255 255 / 0.9), rgb(255 255 255 / 0.25) 45%, transparent 70%);
    filter: blur(0.35vw);
    opacity: 0;
    animation: subir 4.5s ease-out infinite;
}
.vapor span:nth-child(2) { animation-delay: 1.5s; left: -0.4vw; }
.vapor span:nth-child(3) { animation-delay: 3s;   left: -2vw; }

@keyframes subir {
    0%   { opacity: 0;   transform: translateY(0)     translateX(0)      scaleX(0.6); }
    25%  { opacity: 0.9; }
    50%  {               transform: translateY(-5vw)  translateX(0.8vw)  scaleX(1.1); }
    100% { opacity: 0;   transform: translateY(-11vw) translateX(-0.6vw) scaleX(1.8); }
}

@media (prefers-reduced-motion: reduce) { .vapor span { animation: none; } }
```
HTML: `<div class="vapor" aria-hidden="true"><span></span><span></span><span></span></div>`

**Observações:**
- As medidas usam `vw` para o vapor acompanhar o tamanho da imagem. A aluna já entendeu isso.
- A posição depende da foto final. Se a foto mudar, recalcular `left` e `top`.
- O ideal é uma foto **sem vapor desenhado**, para não sobrepor ao animado.

## 10. Arquivos no repositório (branch `claude/elora-login-handoff-vx348p`)

- `elora/demos/elora-vapor-demo.html` — demonstração do vapor (o arquivo inteiro numa página só).
- `elora/index.html` e `elora/style.css` — **proposta antiga, DESCARTADA**, feita antes de chegar o protótipo final (tema roxo, Fraunces + Inter). **Não usar como base.** O projeto oficial é o código da aluna da seção 5.
