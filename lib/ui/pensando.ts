/**
 * lib/ui/pensando.ts — o que o indicador de "pensando" PODE dizer. PURO.
 *
 * Regra do dono: enquanto a IA processa, só 3 pontinhos animados ("pensando") — salvo quando a ação é
 * CONCRETA e verificável, fora do modelo (internet, análise de papers, leitura de PDF, áudio, imagem).
 * Raciocinar, planejar, redigir, formatar, revisar, decidir = pontinhos, sem frase. A lista fechada
 * abaixo é a ÚNICA fonte de texto: fase que não bate aqui → `null` → só os pontinhos.
 */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** ação externa → texto. A ordem importa (a 1ª que bater vence). */
const EXTERNAS: [RegExp, string][] = [
  [/internet|\bweb\b|na rede|google/, "Pesquisando na internet…"],
  [/\bpdf\b|documento/, "Lendo o PDF…"],
  [/audio|podcast|\bvoz\b|\btts\b|narra/, "Gerando o áudio…"],
  [/imagem|ilustra|desenh|figura/, "Gerando a imagem…"],
  // bases acadêmicas: papers/literatura/fontes/evidências (a fase `gather` do harness consulta as bases)
  [/trabalhos|papers?|literatura|fontes|evidenc|bases academ|openalex|pubmed|crossref|arxiv/, "Analisando trabalhos…"],
];

/** Texto da ação externa em curso, ou `null` (= só os 3 pontinhos). */
export function rotuloExterno(fase?: string | null): string | null {
  const t = norm(String(fase ?? "")).trim();
  if (!t) return null;
  for (const [re, txt] of EXTERNAS) if (re.test(t)) return txt;
  return null;
}
