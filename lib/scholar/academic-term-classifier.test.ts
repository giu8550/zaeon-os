import { describe, it, expect } from "vitest";
import { isAcademicTerm } from "./academic-term-classifier";

const POSITIVES: string[] = [
  "graphene oxide synthesis",
  "deep learning for cancer diagnosis",
  "revisão sistemática sobre CRISPR",
  "ab initio DFT of graphene",
  "meta-análise de ensaio clínico",
  "transformer neural network architecture",
  "quantum mechanics of a particle",
  "CRISPR gene editing",
  "photovoltaic semiconductor materials",
  "econometria da inflação",
  "systematic review of cancer therapy",
  "fMRI study of the cortex",
  "fine-tuning a large language model LLM",
  "graph neural network and deep learning",
  "photosynthesis in algae cells",
  "spectroscopy of a polymer compound",
  "epidemiology of vaccine efficacy",
  "reinforcement learning algorithm",
  "synthesis of TiO2 nanoparticles",
  "in vitro study of an enzyme",
  "astrophysics and cosmology of black holes",
  "philosophy of epistemology",
  "arXiv:2103.14030",
  "doi:10.1038/s41586-020-2649-2 vaccine",
  "PubMed search for immunology biomarker",
];

const NEGATIVES: string[] = [
  "comprar pão na padaria",
  "qual o horário do ônibus para o centro",
  "receita de bolo de chocolate fácil",
  "jogo de futebol hoje à noite",
  "quanto custa o ingresso do cinema",
  "previsão do tempo para amanhã",
  "melhor restaurante de pizza perto de mim",
  "como trocar o pneu do carro",
  "letra da música nova",
  "promoção de tênis na loja",
  "agendar consulta no salão de beleza",
  "qual o placar do jogo",
  "dieta para emagrecer rápido",
  "piada engraçada para contar",
  "horóscopo de hoje",
  "como fazer compras online",
  "viagem barata para a praia",
  "presente de aniversário para minha mãe",
  "consertar a torneira que está pingando",
  "qual o melhor celular custo benefício",
  "treino de academia para iniciantes",
  "como economizar dinheiro no mês",
  "filme de comédia para assistir",
  "vaga de emprego em vendas",
  "decoração de festa infantil",
];

describe("isAcademicTerm", () => {
  it.each(POSITIVES)("classifica como acadêmico: %s", (input) => {
    const r = isAcademicTerm(input);
    expect(r.isAcademic).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0.55);
    expect(r.matchedTerms.length).toBeGreaterThan(0);
  });

  it.each(NEGATIVES)("classifica como NÃO acadêmico: %s", (input) => {
    const r = isAcademicTerm(input);
    expect(r.isAcademic).toBe(false);
    expect(r.confidence).toBeLessThan(0.55);
  });

  it("identifica domínio de domínio único", () => {
    expect(isAcademicTerm("graphene oxide synthesis").domain).toBe("chem");
    expect(isAcademicTerm("philosophy of epistemology").domain).toBe("human");
    expect(isAcademicTerm("reinforcement learning algorithm").domain).toBe("cs");
  });

  it("trata entrada vazia/curta com segurança", () => {
    expect(isAcademicTerm("").isAcademic).toBe(false);
    expect(isAcademicTerm("ai").isAcademic).toBe(false);
    expect(isAcademicTerm("  ").confidence).toBe(0);
  });

  it("um único termo comum não cruza o threshold (anti-ruído)", () => {
    expect(isAcademicTerm("comprei materiais escolares").isAcademic).toBe(false);
    expect(isAcademicTerm("qual o melhor framework de javascript").isAcademic).toBe(false);
  });
});
