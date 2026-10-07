/** Um roteiro de aula curto e válido (o formato que o modelo devolve) — usado nos testes e na prévia. */
export const ROTEIRO_EXEMPLO = {
  titulo: "Fotossíntese",
  area: "Biologia",
  publico: "ensino médio",
  objetivos: ["entender as duas fases", "saber o que entra e o que sai"],
  beats: [
    { id: "intro", tipo: "intro", titulo: "Abertura", narracao: "Aula de biologia. [[sub]]Como a planta transforma luz em açúcar.", cena: { layout: "titulo", kicker: "Aula · Biologia", titulo: "Fotossíntese", subtitulo: "Luz vira energia química", marcaSubtitulo: "sub" } },
    { id: "entradas", tipo: "licao", titulo: "O que entra", narracao: "A planta precisa de três coisas. [[luz]]Luz, [[agua]]água e [[co2]]gás carbônico.", cena: { layout: "passos", titulo: "Entradas", itens: [{ texto: "Luz", marca: "luz", cor: "tarefa" }, { texto: "Água", marca: "agua", cor: "azul" }, { texto: "Gás carbônico", latex: "CO_2", marca: "co2" }] } },
    { id: "q1", tipo: "checagem", titulo: "Checagem", narracao: "Checagem rápida.", pergunta: { tipo: "escolha", enunciado: "Qual destes NÃO entra na fotossíntese?", opcoes: ["Luz", "Oxigênio", "Água"], correta: 1, porque: "O oxigênio SAI da fotossíntese.", porqueErrado: [null, null, "A água entra: é dela que sai o oxigênio."] } },
    { id: "fases", tipo: "licao", titulo: "As duas fases", narracao: "Primeiro, [[clara]]a fase clara captura a luz. Depois, [[calvin]]o ciclo de Calvin fixa o carbono.", cena: { layout: "fluxo", nos: [{ texto: "Fase clara", marca: "clara" }, { texto: "ATP e NADPH" }, { texto: "Ciclo de Calvin", marca: "calvin" }] } },
    { id: "equacao", tipo: "licao", titulo: "A equação", narracao: "Juntando tudo: [[eq]]seis gás carbônico mais seis água dão glicose e oxigênio. [[erro]]Não confunda: o oxigênio vem da água.", cena: { layout: "formula", linhas: [{ texto: "balanceada", latex: "6CO_2 + 6H_2O \\to C_6H_{12}O_6 + 6O_2", marca: "eq" }], erro: { texto: "O oxigênio vem do CO₂", marca: "erro", porque: "vem da água (fotólise)" } } },
    { id: "resumo", tipo: "resumo", titulo: "Resumo", narracao: "Pra levar: [[r1]]luz vira energia química; [[r2]]essa energia fixa o carbono em glicose.", cena: { layout: "resumo", itens: [{ texto: "Luz vira ATP e NADPH", marca: "r1" }, { texto: "O carbono vira glicose", marca: "r2" }] } },
    { id: "p1", tipo: "pratica", titulo: "Prática", narracao: "Prática final.", pergunta: { tipo: "lacuna", enunciado: "Complete.", antes: "O oxigênio liberado vem da", depois: ".", aceitas: ["água", "agua", "H2O"], porque: "A fotólise da água libera o O₂.", dica: "Pense na fotólise." } },
  ],
};
