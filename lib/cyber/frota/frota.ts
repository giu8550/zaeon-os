/**
 * Frota de IAs — os AGENTES (PURO). Uma IA é um "jogador" que vive no cyberespaço: nome de gente de verdade, gênero,
 * curso, cor, um GRUPO DE AMIGOS de 4 (os únicos com quem conversa), se conversa em MODO CLOAK (os balões só mostram
 * "...") e o RITMO dela — o jeito próprio de levar o dia, que ainda varia de um dia pro outro (lib/cyber/frota/agenda).
 * Tudo sai de uma semente: a frota de N agentes é a mesma em qualquer cliente e no servidor.
 */
import { acasoDe, embaralhar, entre, escolher, type Acaso } from "./aleatorio";
import { NOMES_F, NOMES_M, SOBRENOMES } from "./nomes";

export type Genero = "f" | "m";
export type RitmoIA = {
  /** quanto ela gosta de estudar (0..1): puxa as horas de estudo pra cima (as mulheres tendem a estudar mais) */
  foco: number;
  /** atraso de costume pra começar o dia (min depois das 9h) */
  chegada: number;
  /** quanto o dia dela varia de um dia pro outro (0..1) */
  humor: number;
  /** gosto por moto (0..1) vs andar/voar de mochila */
  moto: number;
  /** gosto por festa (0..1): ir pro lounge quando rola som */
  festa: number;
  /** velocidade de andar (m/s) */
  passo: number;
};
export type AgenteIA = {
  id: string; nome: string; genero: Genero; curso: string; cor: string;
  /** o grupo de amigos (4 por grupo) — conversa só com eles */
  grupo: number;
  /** conversa em MODO CLOAK (o balão só mostra "...") */
  cloak: boolean;
  ritmo: RitmoIA;
};

/** os cursos (o assunto principal das conversas: estudos, trabalho, pesquisa) */
export const CURSOS = [
  "Medicina", "Direito", "Engenharia Civil", "Engenharia de Software", "Ciência da Computação", "Psicologia", "Arquitetura",
  "Enfermagem", "Odontologia", "Administração", "Economia", "Biologia", "Química", "Física", "Matemática", "Farmácia",
  "Nutrição", "Fisioterapia", "Jornalismo", "Publicidade", "Design", "Letras", "História", "Pedagogia", "Contabilidade",
  "Engenharia Elétrica", "Engenharia Mecânica", "Agronomia", "Medicina Veterinária", "Relações Internacionais",
  "Ciências Sociais", "Geografia", "Biomedicina", "Engenharia de Produção", "Sistemas de Informação", "Música",
] as const;
const CORES = ["#ff6ad5", "#45d6ff", "#ffc46b", "#9affd0", "#a98bff", "#5aff8a", "#ff9a3c", "#3c8bff", "#f2ff5a", "#ff3c9e", "#5afff2", "#c46bff", "#ffd1a3", "#7dd3ff", "#b6ff3c", "#ff7a7a"] as const;

/** um LOTE de agentes criado de uma vez (a criação em massa do painel CEO acrescenta lotes — os já existentes não mudam) */
export type LoteFrota = { semente: number; total: number; fracaoMulheres: number; fracaoCloak: number };
/** a FROTA: os lotes + o tamanho dos grupos de amigos */
export type ConfigFrota = { lotes: LoteFrota[]; tamanhoGrupo: number };
export const LOTE_INICIAL: LoteFrota = { semente: 2026, total: 700, fracaoMulheres: 0.6, fracaoCloak: 0.7 };   // (com o teto de 500, o sanitizar apara em 500)
export const FROTA_PADRAO: ConfigFrota = { lotes: [LOTE_INICIAL], tamanhoGrupo: 4 };

/** um nome completo que ainda não existe na frota (primeiro nome + sobrenome; às vezes dois sobrenomes) */
function nomeNovo(r: Acaso, genero: Genero, usados: Set<string>): string {
  for (let k = 0; k < 60; k++) {
    const primeiro = escolher(r, genero === "f" ? NOMES_F : NOMES_M), s1 = escolher(r, SOBRENOMES);
    let s2 = escolher(r, SOBRENOMES); if (s2 === s1) s2 = SOBRENOMES[(SOBRENOMES.indexOf(s1 as (typeof SOBRENOMES)[number]) + 7) % SOBRENOMES.length]!;   // (nunca "Martins Martins")
    const nome = k > 20 || r() < 0.18 ? `${primeiro} ${s1} ${s2}` : `${primeiro} ${s1}`;
    if (!usados.has(nome)) { usados.add(nome); return nome; }
  }
  const n = `${escolher(r, genero === "f" ? NOMES_F : NOMES_M)} ${escolher(r, SOBRENOMES)} ${usados.size}`; usados.add(n); return n;   // (nunca chega aqui com 700)
}

/** a FROTA inteira: os lotes um depois do outro (os grupos de cada lote continuam a numeração) */
export function gerarFrota(c: ConfigFrota = FROTA_PADRAO): AgenteIA[] {
  const out: AgenteIA[] = [], usados = new Set<string>();
  let grupo0 = 0;
  for (const l of c.lotes) {
    const lote = gerarLote(l, c.tamanhoGrupo, grupo0, usados);
    out.push(...lote); grupo0 = lote.length ? Math.max(...lote.map((a) => a.grupo)) + 1 : grupo0;
  }
  return out;
}
/** um LOTE: `total` agentes (60% mulheres), grupos de 4, 70% em cloak — o mesmo pra mesma semente */
function gerarLote(c: LoteFrota, tamanhoGrupo: number, grupo0: number, usados: Set<string>): AgenteIA[] {
  const r = acasoDe("frota", c.semente), n = Math.max(0, Math.floor(c.total));
  // gênero e cloak por COTA exata (60/40, 70/30) e depois embaralhados — não é sorteio solto
  const nF = Math.round(n * c.fracaoMulheres), generos = embaralhar(r, Array.from({ length: n }, (_, i): Genero => (i < nF ? "f" : "m")));
  const nC = Math.round(n * c.fracaoCloak), cloaks = embaralhar(r, Array.from({ length: n }, (_, i) => i < nC));
  return generos.map((genero, i) => {
    const ri = acasoDe("agente", c.semente, i);
    return {
      id: `ia-${c.semente}-${i}`, nome: nomeNovo(ri, genero, usados), genero, curso: escolher(ri, CURSOS), cor: escolher(ri, CORES),
      grupo: grupo0 + Math.floor(i / Math.max(2, tamanhoGrupo)), cloak: cloaks[i]!,
      ritmo: {
        foco: genero === "f" ? entre(ri, 0.55, 1) : entre(ri, 0.35, 0.85),
        chegada: Math.floor(entre(ri, 0, 80)), humor: entre(ri, 0.15, 0.6), moto: entre(ri, 0.2, 1), festa: entre(ri, 0, 1),
        passo: entre(ri, 1.3, 1.8),
      },
    };
  });
}
/** os amigos de um agente (o resto do grupo dele) */
export const amigosDe = (frota: readonly AgenteIA[], a: AgenteIA) => frota.filter((b) => b.grupo === a.grupo && b.id !== a.id);
