/**
 * A EQUIPE da Zaeon (seção "Conheça a equipe" do Sobre nós, em interface de PDA).
 * Fotos em public/team/<id>.jpg — sem a foto, o PDA mostra as iniciais (não quebra).
 * Edite aqui: nome, cargo, bio e redes. (Textos em PT; a página é PT-first.)
 */
export type MembroEquipe = {
  id: string;
  nome: string;
  cargo: string;
  /** caminho público da foto (public/…). Sem foto ainda → sem o campo: o PDA mostra as iniciais SEM pedir a imagem
   *  (#414: o /team/cofundadora.jpg que não existe dava 404 no console de toda visita à página Sobre) */
  foto?: string;
  /** 2–3 frases, na primeira pessoa ou não */
  bio: string;
  /** "o que faz" em 3 pílulas */
  tags: string[];
  /** cor de acento do PDA */
  acento: string;
  redes?: { linkedin?: string; instagram?: string; x?: string; site?: string };
};

export const EQUIPE: MembroEquipe[] = [
  {
    id: "fundador",
    nome: "Don Martinez",
    cargo: "Fundador · CEO",
    foto: "/team/fundador.jpg",
    bio: "Criou a Zaeon pra que estudar deixasse de ser solitário e aprender virasse algo que se prova. Desenha o produto, o cyberespaço e a camada de credenciais — e testa tudo como o primeiro aluno da casa.",
    tags: ["Produto", "Cyberespaço", "Credenciais"],
    acento: "#22d3ee",
  },
  {
    id: "cofundadora",
    nome: "Cofundadora",
    cargo: "Cofundadora",
    // #414: a foto ainda não existe em public/team/ — quando chegar, é só pôr o arquivo e voltar com `foto: "/team/cofundadora.jpg"`
    bio: "Ao lado do fundador desde o início, cuida de que a Zaeon seja útil pra gente de verdade: pessoas, instituições e o que a plataforma entrega no mundo real.",
    tags: ["Pessoas", "Instituições", "Entrega"],
    acento: "#a78bfa",
  },
];
