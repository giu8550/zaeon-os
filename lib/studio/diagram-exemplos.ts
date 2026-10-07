/**
 * lib/studio/diagram-exemplos.ts — um exemplo DIDÁTICO por tipo de diagrama do archify.
 *
 * O modelo aprende a FORMA do JSON-IR pelo exemplo (o SKILL.md do archify faz igual: "examples
 * teach shape, not facts"). Os do upstream são de engenharia de software; estes são de sala de
 * aula, em PT-BR, e curtos — cada um passa no `archify validate` (ver diagram.test.ts). Os campos
 * mecânicos (schema_version, meta.output, locale, traduções, y das mensagens) o código preenche
 * em `normalizarIR`; por isso não aparecem aqui.
 */
import type { TipoDiagrama } from "@/lib/studio/diagram";

export const EXEMPLOS: Record<TipoDiagrama, object> = {
  workflow: {
    diagram_type: "workflow",
    meta: { title: "Como a fotossíntese acontece" },
    lanes: [
      { id: "fase_clara", label: "Fase clara (tilacoide)" },
      { id: "fase_escura", label: "Ciclo de Calvin (estroma)" },
    ],
    nodes: [
      { id: "luz", lane: "fase_clara", col: 0, type: "external", label: "Luz solar", sublabel: "fótons" },
      { id: "clorofila", lane: "fase_clara", col: 1, type: "frontend", label: "Clorofila", sublabel: "absorve a luz" },
      { id: "agua", lane: "fase_clara", col: 2, type: "messagebus", label: "Fotólise da água", sublabel: "libera O₂" },
      { id: "energia", lane: "fase_clara", col: 3, type: "database", label: "ATP + NADPH", sublabel: "energia química" },
      { id: "fixacao", lane: "fase_escura", col: 3, type: "backend", label: "Fixação do CO₂", sublabel: "enzima RuBisCO" },
      { id: "glicose", lane: "fase_escura", col: 4, type: "backend", label: "Glicose", sublabel: "C₆H₁₂O₆" },
    ],
    edges: [
      { id: "luz-clorofila", from: "luz", to: "clorofila", label: "excita" },
      { id: "clorofila-agua", from: "clorofila", to: "agua", label: "quebra" },
      { id: "agua-energia", from: "agua", to: "energia", label: "gera" },
      { id: "energia-fixacao", from: "energia", to: "fixacao", label: "abastece" },
      { id: "fixacao-glicose", from: "fixacao", to: "glicose", label: "produz" },
    ],
    cards: [
      { dot: "emerald", title: "Ideia central", items: ["A luz vira energia química (ATP/NADPH)", "Essa energia transforma CO₂ em glicose"] },
    ],
  },

  sequence: {
    diagram_type: "sequence",
    meta: { title: "Como o DNS encontra um site" },
    participants: [
      { id: "navegador", type: "frontend", label: "Navegador", sublabel: "você digita o endereço" },
      { id: "resolvedor", type: "backend", label: "Resolvedor", sublabel: "do provedor" },
      { id: "raiz", type: "external", label: "Servidor raiz", sublabel: "conhece os .com, .br…" },
      { id: "autoritativo", type: "database", label: "Servidor autoritativo", sublabel: "guarda o IP" },
    ],
    messages: [
      { id: "pergunta", from: "navegador", to: "resolvedor", label: "qual o IP de site.com?", variant: "emphasis" },
      { id: "consulta-raiz", from: "resolvedor", to: "raiz", label: "quem cuida de .com?" },
      { id: "indica", from: "raiz", to: "resolvedor", label: "pergunte a este servidor", variant: "return" },
      { id: "consulta-ip", from: "resolvedor", to: "autoritativo", label: "IP de site.com?", variant: "emphasis" },
      { id: "responde-ip", from: "autoritativo", to: "resolvedor", label: "93.184.216.34", variant: "return" },
      { id: "entrega", from: "resolvedor", to: "navegador", label: "aqui está o IP", variant: "return" },
    ],
  },

  architecture: {
    diagram_type: "architecture",
    meta: { title: "Mapa da célula eucariótica" },
    layout: { mode: "grid", cols: 3 },
    components: [
      { id: "nucleo", type: "backend", label: "Núcleo", sublabel: "guarda o DNA", row: 0, col: 1 },
      { id: "ribossomo", type: "messagebus", label: "Ribossomos", sublabel: "fabricam proteínas", row: 1, col: 0 },
      { id: "reticulo", type: "messagebus", label: "Retículo endoplasmático", sublabel: "transporta e modifica", row: 1, col: 1 },
      { id: "golgi", type: "database", label: "Complexo de Golgi", sublabel: "embala e envia", row: 1, col: 2 },
      { id: "mitocondria", type: "cloud", label: "Mitocôndria", sublabel: "produz ATP", row: 2, col: 0 },
      { id: "membrana", type: "security", label: "Membrana plasmática", sublabel: "controla a entrada", row: 2, col: 2 },
    ],
    connections: [
      { from: "nucleo", to: "ribossomo", label: "envia RNAm" },
      { from: "ribossomo", to: "reticulo", label: "proteínas" },
      { from: "reticulo", to: "golgi", label: "vesículas" },
      { from: "golgi", to: "membrana", label: "secreção" },
      { from: "mitocondria", to: "ribossomo", label: "energia" },
    ],
  },

  lifecycle: {
    diagram_type: "lifecycle",
    meta: { title: "Ciclo de vida de uma estrela como o Sol" },
    lanes: [
      { id: "main", label: "Fases principais" },
      { id: "terminal", label: "Destino final" },
    ],
    states: [
      { id: "nebulosa", type: "start", label: "Nebulosa", sublabel: "nuvem de gás e poeira", lane: "main", col: 0 },
      { id: "protoestrela", type: "active", label: "Protoestrela", sublabel: "colapso gravitacional", lane: "main", col: 1 },
      { id: "sequencia", type: "active", label: "Sequência principal", sublabel: "funde hidrogênio", lane: "main", col: 2 },
      { id: "gigante", type: "waiting", label: "Gigante vermelha", sublabel: "funde hélio", lane: "main", col: 3 },
      { id: "anabranca", type: "success", label: "Anã branca", sublabel: "núcleo exposto", lane: "terminal", col: 4 },
    ],
    transitions: [
      { from: "nebulosa", to: "protoestrela", label: "gravidade" },
      { from: "protoestrela", to: "sequencia", label: "ignição" },
      { from: "sequencia", to: "gigante", label: "acaba o H" },
      { from: "gigante", to: "anabranca", label: "perde camadas" },
    ],
  },

  dataflow: {
    diagram_type: "dataflow",
    meta: { title: "Fluxo de energia numa cadeia alimentar" },
    stages: [
      { label: "Fonte" },
      { label: "Produtores" },
      { label: "Consumidores" },
      { label: "Decompositores" },
    ],
    nodes: [
      { id: "sol", type: "external", label: "Sol", sublabel: "energia luminosa", stage: 0, row: 0 },
      { id: "plantas", type: "frontend", label: "Plantas", sublabel: "fotossíntese", stage: 1, row: 0 },
      { id: "herbivoro", type: "backend", label: "Herbívoros", sublabel: "consumidor 1º", stage: 2, row: 0 },
      { id: "carnivoro", type: "backend", label: "Carnívoros", sublabel: "consumidor 2º", stage: 2, row: 1 },
      { id: "fungos", type: "database", label: "Fungos e bactérias", sublabel: "reciclam nutrientes", stage: 3, row: 1 },
    ],
    flows: [
      { from: "sol", to: "plantas", label: "luz" },
      { from: "plantas", to: "herbivoro", label: "~10% da energia" },
      { from: "herbivoro", to: "carnivoro", label: "~10% da energia" },
      { from: "carnivoro", to: "fungos", label: "matéria morta" },
    ],
  },
};
