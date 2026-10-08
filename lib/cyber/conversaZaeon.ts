/**
 * Cyberespaço — a CONVERSA com a Zaeon na capela (PURO, sem three). No tutorial, quando a pessoa chega na capela com o
 * Droid, o rosto da Zaeon (o avatar anime dela, em holograma) sobe de dentro do globo central e ela quer CONHECER a
 * pessoa: como chamar, se estuda/trabalha, a área, o que quer alcançar e como aprende melhor. Cada resposta ganha uma
 * reação curta. As respostas viram o PERFIL (User.cyberPerfil) que os agentes vão usar como memória no overhaul.
 */
export type IdPergunta = "nome" | "ocupacao" | "area" | "objetivo" | "estilo";
export type PerguntaZaeon = {
  id: IdPergunta;
  fala: string;
  /** "escolha" = botões (e, com `outro`, também dá pra escrever); "texto" = só escrever */
  tipo: "texto" | "escolha";
  opcoes?: string[];
  outro?: boolean;
  placeholder?: string;
};
export type PerfilZaeon = Partial<Record<IdPergunta, string>>;

export const ABERTURA = ["Oi! Eu sou a Zaeon ✦", "Que bom que você chegou. Antes de começar, quero te conhecer um pouquinho."];
export const PERGUNTAS: PerguntaZaeon[] = [
  { id: "nome", fala: "Como você quer que eu te chame?", tipo: "texto", placeholder: "Seu nome ou apelido" },
  { id: "ocupacao", fala: "Hoje você estuda, trabalha ou os dois?", tipo: "escolha", opcoes: ["Estudo", "Trabalho", "Os dois", "Nenhum dos dois agora"] },
  { id: "area", fala: "E qual é a sua área? Me conta o curso ou o que você faz.", tipo: "texto", placeholder: "Ex.: Medicina, Direito, programação…" },
  { id: "objetivo", fala: "O que você quer alcançar aqui comigo?", tipo: "escolha", outro: true, opcoes: ["Passar numa prova", "Escrever meu TCC", "Aprender algo novo", "Organizar meus estudos", "Crescer na carreira"] },
  { id: "estilo", fala: "Última: como você aprende melhor?", tipo: "escolha", outro: true, opcoes: ["Lendo", "Vendo vídeos", "Fazendo exercícios", "Conversando"] },
];
export const MAX_RESPOSTA = 120;

/** a resposta limpa: sem quebras/controles, espaços colapsados, até MAX_RESPOSTA */
export function limparResposta(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, MAX_RESPOSTA);
}

/** a reação da Zaeon à resposta (curta: cabe no balão) */
export function reacao(id: IdPergunta, r: string, perfil: PerfilZaeon): string {
  const nome = perfil.nome || "você";
  switch (id) {
    case "nome": return `Prazer, ${r}! ✦`;
    case "ocupacao": return r === "Estudo" ? "Que demais! Aqui é o seu lugar." : r === "Trabalho" ? "Legal! Dá pra aprender no seu ritmo, sem pressa." : r === "Os dois" ? "Uau, os dois! Vou te ajudar a render no pouco tempo." : "Tudo bem — é um ótimo momento pra começar algo novo.";
    case "area": return `${r}… adoro! Tenho muita coisa pra te mostrar.`;
    case "objetivo": return `Anotado, ${nome}: ${r.charAt(0).toLowerCase() + r.slice(1)}. Vamos chegar lá juntos.`;
    case "estilo": return "Perfeito, vou lembrar disso.";
  }
}
export const fechamento = (perfil: PerfilZaeon) => [`Obrigada, ${perfil.nome || "viajante"}! Guardei tudo pra te ajudar do jeito certo ✦`, "Agora o Droid vai te mostrar as motos. Até já!"];

/** o perfil que vai pro servidor: só as chaves conhecidas, cada valor limpo (vazios saem) */
export function limparPerfil(v: unknown): PerfilZaeon {
  const out: PerfilZaeon = {};
  if (!v || typeof v !== "object") return out;
  for (const p of PERGUNTAS) { const r = limparResposta((v as Record<string, unknown>)[p.id]); if (r) out[p.id] = r; }
  return out;
}
