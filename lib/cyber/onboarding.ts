/**
 * Cyberespaço — o NASCIMENTO e o TOUR de quem chega (PURO, sem three).
 *
 * Quem NUNCA entrou no cyberespaço (o servidor sabe: User.cyberNasceuEm) NASCE num TUBO DE ENSAIO — os tubos ficam em
 * volta da Cidade Zaeon, na linha da muralha, entre as torres de cristal; o do novato é um dos perto da Recepção (o lar
 * do DROID, o agente de onboarding — lib/cyber/agentes): o líquido escoa, o vidro sobe e a pessoa sai. O Droid (um
 * ofanim) sai de um mini portal e ENSINA fazendo, como num RPG (out/2026 — docs/superpowers/specs/2026-10-11-tutorial-rpg
 * -design.md): fala numa CAIXA DE DIÁLOGO e em CUTSCENES (lib/cyber/cutscene) e ESPERA a pessoa cumprir cada instrução
 * (andar → correr → voo curto → voo longo até a capela → conhecer a Zaeon (o holograma sai do globo e conversa —
 * lib/cyber/conversaZaeon) → os telões PROBLEMA → SOLUÇÃO → a 1ª missão: o tablet). É de cada um: spawnado só no
 * cliente da própria pessoa (nada vai pela rede), numa INSTÂNCIA (a Zaeon é só dela) até o fim do tutorial.
 */
import type { P2 } from "./colisao";
import { CIDADE, DOCA_ANGULO, anguloDaTorre, mundo, naAberturaDaEscada, TORRES_MURALHA } from "./ceu";
import { LAR_LOCAL, POIS, marcoNav } from "./landmarks";
import { ESTACAO, MIRANTES_ESTACAO, noMirante } from "./terra";
import { LOTES } from "./motos";
import { deEscada } from "./nav";

/** a chave do "já nasci" (localStorage) — só a reserva quando o servidor não diz (prévia/sem sala) */
export const CHAVE_ONBOARDING = "zaeon:cyber:onboarding:v1";
/** o MODO TUTORIAL das Configurações (a engrenagem — components/sub/ConfigMenu): LIGADO, toda entrada no cyberespaço
 *  começa pelo tutorial (pra testar — vale até pro dono); DESLIGADO, volta o normal. Só neste navegador (localStorage) */
export const PREF_TUTORIAL = "zaeon_cyber_tutorial";
export function tutorialLigado(get: (k: string) => string | null): boolean {
  try { return get(PREF_TUTORIAL) === "1"; } catch { return false; }
}
/**
 * O PROGRESSO do tutorial (neste navegador): o tutorial é uma HISTÓRIA (cutscenes, falas, o mesmo fio) — recarregar a
 * página no meio NÃO recomeça tudo: volta no último ponto de retomada (pedido do dono, out/2026). O modo tutorial das
 * Configurações apaga o progresso ao ligar/desligar (desligar e ligar de novo = recomeçar do tubo). Acabou (ou pulou) =
 * "fim": o modo tutorial ligado não força de novo até ser desligado e ligado.
 */
export const CHAVE_PROGRESSO = "zaeon:cyber:tutorial:progresso:v1";
export type PesquisaDoProgresso = { titulo: string; palavras: number; workId: string | null };
export type ProgressoTutorial = { passo: IdPassoGuia | "fim"; pesquisa?: PesquisaDoProgresso | null };
export function lerProgresso(get: (k: string) => string | null): ProgressoTutorial | null {
  try {
    const v = JSON.parse(get(CHAVE_PROGRESSO) ?? "null") as ProgressoTutorial | null;
    if (!v || typeof v !== "object" || typeof v.passo !== "string") return null;
    if (v.passo !== "fim" && !ROTEIRO.some((p) => p.id === v.passo)) return null;
    const pq = v.pesquisa && typeof v.pesquisa === "object" && typeof v.pesquisa.titulo === "string"
      ? { titulo: v.pesquisa.titulo.slice(0, 200), palavras: Math.max(0, Number(v.pesquisa.palavras) || 0), workId: typeof v.pesquisa.workId === "string" ? v.pesquisa.workId : null } : null;
    return { passo: v.passo, pesquisa: pq };
  } catch { return null; }
}
/** onde a pessoa reaparece ao RETOMAR: na frente do tubo, no centro da capela, na frente dos telões ou na Sala do Saber */
export type OndeRetomar = "tubo" | "capela" | "teloes" | "saber";
/** o PONTO DE RETOMADA de um progresso salvo (null = sem progresso; "inicio" = recomeçar do tubo — mal tinha saído
 *  dele; "fim" = sem tutorial). Cada passo volta pro começo
 *  da sua cena (a conversa com a Zaeon recomeça inteira; a missão do tablet reabre; sem a pesquisa salva, a missão) */
export function retomadaDe(p: ProgressoTutorial | null): { passo: IdPassoGuia; onde: OndeRetomar } | "fim" | "inicio" | null {
  if (!p) return null;
  if (p.passo === "fim") return "fim";
  const i = passoDe(p.passo), ir = (id: IdPassoGuia, onde: OndeRetomar) => ({ passo: id, onde });
  if (i <= passoDe("andar")) return "inicio";
  if (i <= passoDe("capela")) return ir(p.passo, "tubo");
  if (i <= passoDe("ir-teloes")) return ir(p.passo === "ir-teloes" ? "ir-teloes" : "zaeon", "capela");
  if (i <= passoDe("estudo")) return ir(p.passo === "teloes" ? "teloes" : "missao", "teloes");
  if (i <= passoDe("portal-saber")) return p.pesquisa ? ir("aviso", "teloes") : ir("missao", "teloes");
  return ir("saber", "saber");
}
/** o modo tutorial ligado (ou ?nascer=1) e o progresso salvo → nasce no tutorial? (e de onde) */
export function decidirTutorial(o: { visto: boolean; forcarUrl: boolean; modoTutorial: boolean; fundador: boolean; progresso: ProgressoTutorial | null }): { nascer: boolean; retomar: { passo: IdPassoGuia; onde: OndeRetomar } | null } {
  if (o.forcarUrl) return { nascer: true, retomar: null };   // ?nascer=1: sempre do começo (teste)
  const r = retomadaDe(o.progresso);
  if (r === "fim") return { nascer: false, retomar: null };
  if (r === "inicio") return { nascer: true, retomar: null };
  if (r) return { nascer: true, retomar: r };
  return { nascer: deveNascerNoTubo({ visto: o.visto, forcar: o.modoTutorial, fundador: o.fundador }), retomar: null };
}

/** nasce no tubo? Quem nunca entrou no cyberespaço (`visto` = o servidor já marcou o nascimento); o dono nasce na nave
 *  dele (a não ser forçado: `?nascer=1` ou o modo tutorial ligado) */
export function deveNascerNoTubo(o: { visto: boolean; forcar: boolean; fundador: boolean }): boolean {
  if (o.forcar) return true;
  return !o.visto && !o.fundador;
}

/** o pé da escada da Recepção (mundo) */
export function peDaRecepcao(): P2 {
  const poi = POIS.find((p) => p.id === "zaeon"), mn = poi ? marcoNav(poi) : null;
  if (!mn) return mundo(LAR_LOCAL);
  return deEscada(mn, mn.nav.bordaR + mn.nav.escada.comprimento + 2.5, 0);
}

/**
 * O BERÇÁRIO: os TUBOS DE ENSAIO em volta da Zaeon, na linha da muralha — no lugar dos antigos blocos de granizo, em
 * arcos entre as torres grandes de cristal (lib/cyber/ceu `TORRES_MURALHA`). Livres: o vão da escada do lounge e o
 * setor da doca da nave-QG. Cada tubo é virado pro centro da ilha (sai-se pra dentro).
 */
export const TUBO = { r: 0.95, alt: 2.7 } as const;
export const ANEL_TUBOS = { r: CIDADE.muralhaR, passo: 3.6, folgaTorre: 7, docaMeia: 0.13 } as const;
export type Tubo = { x: number; z: number; rumo: number; ang: number };
const difAng = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
export const TUBOS: Tubo[] = (() => {
  const out: Tubo[] = [], R = ANEL_TUBOS.r, n = TORRES_MURALHA.n;
  for (let k = 0; k < n; k++) {
    const a0 = anguloDaTorre(k) + ANEL_TUBOS.folgaTorre / R, a1 = anguloDaTorre(k + 1) - ANEL_TUBOS.folgaTorre / R;
    const q = Math.floor(((a1 - a0) * R) / ANEL_TUBOS.passo);
    for (let i = 0; i <= q; i++) {
      const ang = a0 + ((a1 - a0) * i) / q, lx = Math.cos(ang) * R, lz = Math.sin(ang) * R;
      if (naAberturaDaEscada(lx, lz) || difAng(ang, DOCA_ANGULO) < ANEL_TUBOS.docaMeia) continue;
      const w = mundo({ x: lx, z: lz });
      out.push({ x: w.x, z: w.z, rumo: Math.atan2(-lx, -lz), ang });
    }
  }
  return out;
})();
/** os tubos onde os NOVATOS nascem: perto da Recepção, mas um pouco AO LADO dela (bem atrás, a ilha dela tampava a
 *  vista de quem sai do tubo) */
export const TUBOS_DO_NOVATO: number[] = (() => {
  const a = Math.atan2(LAR_LOCAL.z, LAR_LOCAL.x) + 0.24;
  return TUBOS.map((t, i) => ({ i, d: difAng(t.ang, a) })).sort((p, q) => p.d - q.d).slice(0, 12).map((x) => x.i).sort((p, q) => p - q);
})();
/** qual tubo é o de quem nasce (pelo id: sempre o mesmo pra mesma pessoa), entre os perto da Recepção */
export function tuboDe(id: string): number {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TUBOS_DO_NOVATO[h % TUBOS_DO_NOVATO.length]!;
}
/** a cena do nascimento (s): o líquido escoa até `escoa`, o vidro sobe até `abre`, a pessoa sai em `sai` */
export const NASCIMENTO = { escoa: 2.2, abre: 3.3, sai: 3.9 } as const;
/** o estado do tubo no instante `t` (s desde o começo): o nível do líquido (1 cheio → 0) e o quanto o vidro subiu (0..1) */
export function estadoDoTubo(t: number): { liquido: number; vidro: number } {
  const c = (x: number) => Math.max(0, Math.min(1, x)), s = (x: number) => x * x * (3 - 2 * x);
  return { liquido: 1 - s(c(t / NASCIMENTO.escoa)), vidro: s(c((t - NASCIMENTO.escoa) / (NASCIMENTO.abre - NASCIMENTO.escoa))) };
}

/**
 * O que a pessoa tem que FAZER pro Droid seguir (ele espera até ela fazer — `cumpriu`). O tutorial de out/2026 é 100%
 * MOVIMENTO (sem motos, portais nem dash — pedido do dono): nascer (o tubo abriu), ANDAR `m` metros, CORRER `m` metros
 * (Shift andando), VOAR `m` metros acima do chão (Espaço), o VOO LONGO (`m` metros de turbo: Shift no ar), CHEGAR no
 * alvo, conversar com a Zaeon, OUVIR (o passo é só a cena — anda quando as falas acabam) e abrir o TABLET.
 */
export type CondGuia = { tipo: "nascer" } | { tipo: "andar"; m: number } | { tipo: "correr"; m: number } | { tipo: "voar"; m: number } | { tipo: "turbo"; m: number } | { tipo: "chegar" } | { tipo: "conversa" } | { tipo: "ouvir" } | { tipo: "tablet" } | { tipo: "pesquisa" } | { tipo: "inventario"; s: number } | { tipo: "saber"; s: number } | { tipo: "entrega" } | { tipo: "portal" } | { tipo: "montar" } | { tipo: "pilotar"; m: number } | { tipo: "descer" } | { tipo: "fim" };
export type IdPassoGuia = "nascer" | "andar" | "correr" | "voar" | "voo-longo" | "capela" | "zaeon" | "ir-teloes" | "teloes" | "missao" | "estudo" | "aviso" | "inventario" | "despedida" | "portal-saber" | "saber" | "relicario" | "palavra-final" | "entrega" | "recusa" | "motos-aceite" | "motos-ver" | "moto" | "pilotar" | "descer" | "motos-fim" | "fim";
/** a CUTSCENE do passo (lib/cyber/cutscene): enquanto o Droid fala, a câmera enquadra outra coisa — "droid" = ele (a
 *  apresentação e a missão), "teloes" = os telões PROBLEMA → SOLUÇÃO, "capela" = o centro da capela visto do alto (pra
 *  onde a pessoa tem que ir), "relicario" = o Relicário do Saber (lib/cyber/relicario). A câmera solta na INSTRUÇÃO (a última fala),
 *  a não ser que `cenaInteira` (o passo todo é cena — a pessoa não precisa se mexer) */
export type CenaGuia = "droid" | "droid-perto" | "teloes" | "saber" | "motos" | "capela" | "relicario";
/** um passo do tutorial: as FALAS do Droid (uma depois da outra; a última — a INSTRUÇÃO — fica na tela até a pessoa
 *  cumprir), o que ela tem que fazer, o alvo de "vem comigo até…" (o Droid vai na frente; o farol marca), a CENA e as
 *  TECLAS que a caixa de diálogo mostra em destaque */
export type PassoGuia = { id: IdPassoGuia; titulo: string; falas: string[]; cond: CondGuia; alvo: (P2 & { r: number }) | null; cena?: CenaGuia; cenaInteira?: boolean; teclas?: string[]; livre?: boolean; /** as falas são um AVISO em destaque (a caixa de diálogo de alerta) */ alerta?: boolean };

/** onde o Droid leva no CENTRO da capela: ao lado do globo (a Zaeon sai dele), do lado de quem vem do leste */
export const CENTRO_DA_CAPELA_LOCAL = { x: 14, z: 3 };
/** onde a pessoa para pra ver os TELÕES (local): na frente da estação PROBLEMA → SOLUÇÃO do mirante 1, do lado do
 *  centro, entre os dois telões — dali se lê o da esquerda (problemas) e o da direita (soluções) */
export const FRENTE_DOS_TELOES_LOCAL: P2 = noMirante(MIRANTES_ESTACAO[0]!, ESTACAO.u + 22, ESTACAO.v);

/** o Droid apresentando o RELICÁRIO: como se entrega e a RECOMPENSA (pedido do dono: "entrega gera recompensa — deixe
 *  isso claro dentro do script") */
export const FALAS_DO_RELICARIO = [
  "Aquele é o Relicário do Saber. Coloque nele o que você criar: um estudo, uma pesquisa, um artigo.",
  "A Zaeon lê cada página ali mesmo — e quem estiver na sala assiste.",
  "Toda entrega aceita tem RECOMPENSA. A primeira libera as MOTOS da cidade.",
];
/** a PALAVRA FINAL do Droid (o fim do tutorial): não volte de mãos vazias */
export const PALAVRA_FINAL = ["Até lá, não apareça aqui de mãos vazias.", "Volte quando tiver algo bom o suficiente. Estarei te esperando. ✦"];
/** onde o portal do Droid deixa a pessoa: dentro da Sala do Saber, perto da porta, de frente pro Relicário (sala local) */
export const FRENTE_DO_SABER_SALA: P2 = { x: 0, z: 15 };

/** o ROTEIRO do Droid (mundo) */
export const ROTEIRO: PassoGuia[] = (() => {
  const centro = mundo(CENTRO_DA_CAPELA_LOCAL), teloes = mundo(FRENTE_DOS_TELOES_LOCAL);
  return [
    { id: "nascer", titulo: "Despertar", falas: [], cond: { tipo: "nascer" }, alvo: null },
    { id: "andar", titulo: "Andar", cena: "droid", teclas: ["W", "A", "S", "D"], falas: ["Ah… você despertou. Bem-vindo ao hiperespaço, viajante.", "Eu sou o Droid, guardião desta cidadela — a Zaeon. Vou guiar os seus primeiros passos.", "Use W A S D para andar. Venha, caminhe um pouco comigo."], cond: { tipo: "andar", m: 6 }, alvo: null },
    { id: "correr", titulo: "Correr", teclas: ["Shift"], falas: ["Bom. Seus pés ainda lembram o caminho.", "Agora segure SHIFT enquanto anda para correr. Mais rápido!"], cond: { tipo: "correr", m: 20 }, alvo: null },
    { id: "voar", titulo: "Voo curto", teclas: ["Espaço"], falas: ["Você é mais rápido do que parece.", "Mas aqui ninguém fica preso ao chão. Aperte ESPAÇO: a mochila a jato te tira do solo."], cond: { tipo: "voar", m: 4 }, alvo: null },
    { id: "voo-longo", titulo: "Voo longo", teclas: ["Espaço", "Shift"], falas: ["Isso! Você está voando.", "Para ir longe, segure SHIFT no ar: o turbo te leva muito mais rápido. Siga-me até a capela, no coração da cidadela!"], cond: { tipo: "turbo", m: 50 }, alvo: { ...centro, r: 7 } },
    // a CUTSCENE da capela: a câmera sobe e mostra o centro (o globo de luz) — e solta na instrução
    { id: "capela", titulo: "A capela", cena: "capela", falas: ["Que voo! Lá embaixo, está vendo? O coração da capela: o globo de luz.", "Pouse no centro da capela, ao lado do globo."], cond: { tipo: "chegar" }, alvo: { ...centro, r: 7 } },
    { id: "zaeon", titulo: "A Zaeon", falas: ["Olhe o globo… alguém quer te conhecer. ✦"], cond: { tipo: "conversa" }, alvo: null },
    { id: "ir-teloes", titulo: "Os telões", teclas: ["Espaço", "Shift"], falas: ["A Zaeon gostou de você.", "Agora venha comigo: quero te mostrar o que move esta cidade."], cond: { tipo: "chegar" }, alvo: { ...teloes, r: 9 } },
    { id: "teloes", titulo: "Problema → solução", cena: "teloes", cenaInteira: true, falas: ["Neste telão, os PROBLEMAS DA TERRA: o clima, as florestas, os oceanos, a água.", "E deste lado, as SOLUÇÕES — ideias e projetos de gente como você.", "Cada solução começou como um ESTUDO. É assim que se cria valor aqui."], cond: { tipo: "ouvir" }, alvo: null },
    { id: "missao", titulo: "A primeira missão", cena: "droid", cenaInteira: true, falas: ["Agora sua primeira missão é criar um estudo sobre qualquer tema que te interessa.", "Vou abrir o seu tablet. ✦"], cond: { tipo: "tablet" }, alvo: null },
    // no TABLET: o tour da 1ª missão (lib/onboarding/tutorialLab) até a pesquisa estar SALVA — aí o Droid interrompe
    { id: "estudo", titulo: "Criar um estudo", falas: [], cond: { tipo: "pesquisa" }, alvo: null },
    { id: "aviso", titulo: "O veredito do Droid", cena: "droid", cenaInteira: true, alerta: true, falas: ["Pare um instante. Deixa eu ver o que você fez…", "Essa pesquisa ainda não tem base de estudos pra ter algum valor ainda. Não dá pra vender nem publicar.", "Mas você pode guardar ela no seu inventário e me entregar algo melhor depois."], cond: { tipo: "ouvir" }, alvo: null },
    // o INVENTÁRIO abre com a pesquisa (o livro-holograma) em destaque; anda quando a pessoa fecha ou depois de `s` s
    { id: "inventario", titulo: "O inventário", falas: [], cond: { tipo: "inventario", s: 11 }, alvo: null },
    // a DESPEDIDA: o Droid abre um PORTAL e leva a pessoa JUNTO até a frente da SALA DO SABER (a biblioteca). Lá ele
    // mostra o RELICÁRIO (lib/cyber/relicario), deixa claro que entrega aceita tem RECOMPENSA e dá a palavra final
    { id: "despedida", titulo: "Até logo", cena: "droid", cenaInteira: true, falas: ["Pressione I quando quiser abrir o seu inventário.", "Agora venha comigo. Vou te levar a um lugar."], cond: { tipo: "ouvir" }, alvo: null },
    { id: "portal-saber", titulo: "O portal", falas: [], cond: { tipo: "portal" }, alvo: null },
    { id: "saber", titulo: "A Sala do Saber", cena: "droid-perto", cenaInteira: true, falas: ["Esta é a Sala do Saber. Aqui só fica o que tem valor."], cond: { tipo: "ouvir" }, alvo: null },
    { id: "relicario", titulo: "O Relicário", cena: "relicario", cenaInteira: true, falas: FALAS_DO_RELICARIO, cond: { tipo: "ouvir" }, alvo: null },
    { id: "palavra-final", titulo: "A palavra final", cena: "droid-perto", cenaInteira: true, alerta: true, falas: PALAVRA_FINAL, cond: { tipo: "ouvir" }, alvo: null },
  ];
})();
/** o índice de um passo */
export const passoDe = (id: IdPassoGuia) => ROTEIRO.findIndex((p) => p.id === id);
/**
 * A ENTREGA (depois do tutorial — lib/cyber/relicario + lib/cyber/entregaAbnt): na SALA DO SABER, a pessoa coloca um
 * item no RELICÁRIO (F ou clique → o inventário com ▶ nos itens que cabem). A câmera vai pro Relicário enquanto o
 * holograma da Zaeon lê o trabalho (todos na sala veem); o veredito chega quando a leitura acaba. Aceita → a RECOMPENSA
 * (o tutorial das MOTOS); recusada → o Droid diz o que falta.
 */
export const ROTEIRO_ENTREGA: PassoGuia[] = [
  { id: "entrega", titulo: "A entrega", cena: "relicario", cenaInteira: true, falas: ["O Relicário aceitou o seu trabalho. A Zaeon vai ler — página por página."], cond: { tipo: "entrega" }, alvo: null },
];
/** o Droid recusando: o que falta (até 3 itens, as falas cabem na caixa) */
export function passoDaRecusa(faltando: string[]): PassoGuia {
  const lista = faltando.slice(0, 3).map((f) => f.replace(/\.$/, ""));
  return { id: "recusa", titulo: "Ainda não", cena: "droid-perto", cenaInteira: true, alerta: true, falas: ["Ainda não tem valor.", `Falta ${lista.join("; ")}${faltando.length > 3 ? "…" : "."}`.slice(0, 168), "Volte quando estiver completa e em ABNT. Estarei aqui."], cond: { tipo: "ouvir" }, alvo: null };
}
export const FALA_DESISTIU = "Sem pressa. Volte quando tiver algo de valor — estarei aqui.";
/** o Droid na Sala do Saber, quando a pessoa chega perto dele (depois do tutorial) */
export const FALA_DICA_RELICARIO = "Trouxe algo de valor? Coloque no Relicário — chegue perto dele e aperte F.";
/** o TUTORIAL DAS MOTOS (a recompensa da entrega): o Droid mostra a garagem e ensina a montar, pilotar e descer */
export const ROTEIRO_MOTOS: PassoGuia[] = (() => {
  const lote = LOTES.find((l) => l.id === "garagem")!;
  return [
    { id: "motos-aceite", titulo: "Aceita", cena: "droid-perto", cenaInteira: true, falas: ["Isso sim tem valor. ✦ Aceito.", "Eu prometi uma recompensa: as MOTOS da Zaeon agora são suas. Vem ver."], cond: { tipo: "ouvir" }, alvo: null },
    { id: "motos-ver", titulo: "A garagem", cena: "motos", cenaInteira: true, falas: ["Elas ficam na GARAGEM, a plataforma laranja na borda da cidade.", "Suba a escada de pedra da borda: ela leva direto até lá."], cond: { tipo: "ouvir" }, alvo: null },
    { id: "moto", titulo: "Montar", teclas: ["F"], falas: ["Vá até a garagem, chegue perto de uma moto e aperte F."], cond: { tipo: "montar" }, alvo: { x: lote.x, z: lote.z, r: 14 } },
    { id: "pilotar", titulo: "Pilotar", teclas: ["W", "A", "D", "Shift"], falas: ["W acelera, A e D fazem a curva e Shift dá o boost. Dá uma volta!"], cond: { tipo: "pilotar", m: 60 }, alvo: null },
    { id: "descer", titulo: "Descer", teclas: ["P", "F"], falas: ["Mandou bem! Pra parar: P pousa a moto e F desce dela."], cond: { tipo: "descer" }, alvo: null },
    { id: "motos-fim", titulo: "As motos são suas", falas: ["As motos são suas. Cada nova entrega de valor, uma nova recompensa — até a próxima, viajante. ✦"], cond: { tipo: "ouvir" }, alvo: null },
  ];
})();

/** a SALA DO SABER (local da ilha): a biblioteca — o lar do Droid depois do tutorial ("estarei te esperando…") */
export const SALA_DO_SABER_LOCAL: P2 = { x: CIDADE.salas.biblioteca.x, z: CIDADE.salas.biblioteca.z };
/** antes deste passo, o tablet e as salas ficam travados (o tutorial ainda não chegou na missão) */
export const PASSO_DA_MISSAO: IdPassoGuia = "missao";
/** o Droid, se a pessoa guardar o tablet antes de terminar a missão */
export const FALA_VOLTE_AO_TABLET = "Sua missão ainda não acabou: aperte T pra abrir o tablet e terminar o estudo.";
/** a CONCORRÊNCIA (o tablet guardado enquanto a pesquisa roda — a feature mais importante do tablet) */
export const FALA_CONCORRENCIA = "Isso! A pesquisa continua rodando enquanto você explora. De olho na barra de IA: quando ela ficar neon, a IA entregou.";
export const FALA_IA_ENTREGOU = "A IA entregou! ✦ A barra está neon — aperte T pra voltar ao tablet e seguir a missão.";
/** o lembrete do Droid com o tablet GUARDADO no meio da missão, pela etapa do tour do tablet */
export function lembreteDoTablet(o: { fechado: boolean; etapaLab: string | null; viuConcorrencia: boolean }): "" | "concorrencia" | "entregou" | "volte" {
  if (!o.fechado) return "";
  if (o.etapaLab === "pesquisando") return "concorrencia";
  if (o.viuConcorrencia && o.etapaLab === "gerar") return "entregou";   // a pesquisa terminou → o tour foi pro Gerar
  return "volte";
}

/** o que o engine mede desde que o Droid deu a instrução do passo */
export type CtxGuia = { nascendo: boolean; andou: number; correu: number; noAr: number; turbo: number; chegou: boolean; conversaFeita: boolean; tabletAberto: boolean; pesquisaSalva: boolean; /** s com o inventário aberto no passo (Infinity = a pessoa fechou) */ inventario: number; /** s desde que o Droid chegou na Sala do Saber (-1 = voando) */ droidNoSaber: number; /** a ENTREGA na Sala do Saber: o veredito (null = esperando) */ entrega: "aceita" | "recusada" | "desistiu" | null; naMoto: boolean; motoAndou: number; /** o portal do Droid já levou a pessoa */ portal: boolean };
/** a pessoa fez o que o Droid pediu? */
export function cumpriu(c: CondGuia, x: CtxGuia): boolean {
  switch (c.tipo) {
    case "nascer": return !x.nascendo;
    case "andar": return x.andou >= c.m;
    case "correr": return x.correu >= c.m;
    case "voar": return x.noAr >= c.m;
    case "turbo": return x.turbo >= c.m;
    case "chegar": return x.chegou;
    case "conversa": return x.conversaFeita;
    case "ouvir": return true;   // (o engine só confere depois que as falas acabam)
    case "tablet": return x.tabletAberto;
    case "pesquisa": return x.pesquisaSalva;
    case "inventario": return x.inventario >= c.s;
    case "saber": return x.droidNoSaber >= c.s;
    case "entrega": return x.entrega !== null;
    case "portal": return x.portal;
    case "montar": return x.naMoto;
    case "pilotar": return x.motoAndou >= c.m || (!x.naMoto && x.motoAndou >= 10);
    case "descer": return !x.naMoto;
    case "fim": return false;   // o fim acaba sozinho (o Droid se despede)
  }
}
/** quanto o Droid espera entre uma fala e outra (s) — e depois da última, antes de começar a conferir */
export const RITMO_FALA = { entre: 3.4, antesDeConferir: 0.8, fimSome: 4.5 } as const;
/** quanto tempo uma fala fica na tela antes da próxima (s): o mínimo do ritmo, ou o tempo de LER (a máquina de escrever
 *  + ~17 letras por segundo) — as falas longas (o aviso, os telões) não somem antes de a pessoa terminar de ler */
export const tempoDeLeitura = (texto: string) => Math.max(RITMO_FALA.entre, 1.2 + Array.from(texto).length / 17);
/** depois da ÚLTIMA fala, quanto esperar antes de conferir a ação: nos passos de só OUVIR (cena), o tempo de ler */
export const esperaDepoisDaUltima = (passo: { cond: { tipo: string }; falas: string[] }) =>
  passo.cond.tipo === "ouvir" && passo.falas.length ? tempoDeLeitura(passo.falas[passo.falas.length - 1]!) : RITMO_FALA.antesDeConferir;

/** o Droid/guia está no piso da Zaeon (sanidade) */
export const naZaeon = (p: P2) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z) <= CIDADE.andavelR;
