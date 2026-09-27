/**
 * lib/convite/flag.ts — chave geral dos CONVITES DE CADASTRO.
 *
 * O fluxo de convite (página, cards, código, pending_registrations) continua inteiro no
 * repositório — o design é bom e volta a valer no dia em que a Zaeon quiser fechar a porta
 * de novo. Só que hoje o cadastro é aberto: quem chega entra pelo e-mail ou pelo Google.
 * Em vez de apagar código bom, a gente desliga num lugar só.
 *
 * DESLIGADO por padrão. Pra religar tudo, basta:  CONVITES_ATIVOS=1
 * (use NEXT_PUBLIC_CONVITES_ATIVOS quando a UI do cliente também precisar enxergar —
 * mesmo padrão de lib/auth/roles.ts).
 *
 * NÃO confunde com os outros convites do produto, que seguem ligados:
 *   • /join/[token]  → convite de TURMA (professor → aluno)
 *   • /c/[token]     → convite de COLABORAÇÃO no Lounge
 */
export function convitesAtivos(): boolean {
  // `||` e não `??`: a variável costuma existir vazia no .env — string vazia tem que
  // cair pra próxima, senão um NEXT_PUBLIC="" mascara um CONVITES_ATIVOS=1 no servidor.
  const raw = (process.env.NEXT_PUBLIC_CONVITES_ATIVOS || process.env.CONVITES_ATIVOS || "").trim();
  return /^(1|true|on|sim)$/i.test(raw);
}

/** Resposta padrão das rotas de convite quando a porta está aberta (sem convite). */
export const CONVITES_OFF_PAYLOAD = {
  error: "Convites desativados: o cadastro está aberto — entre com seu e-mail ou com o Google.",
  convitesAtivos: false,
} as const;
