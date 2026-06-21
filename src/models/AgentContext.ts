import mongoose, { Schema, model, models } from "mongoose";

/**
 * AgentContext — o "world-state" durável do workspace do aluno (1 doc por usuário).
 *
 * É a fonte única do que a Zaeon precisa saber pra agir com contexto real do PROJETO
 * (não só da conversa): em que sala/aba a pessoa está, qual estudo/pesquisa/projeto
 * está aberto, o objetivo atual e as ações recentes. Lido a cada turno da IA e
 * injetado no prompt. Ver docs/AGENT_CONTEXT_AND_EXECUTION.md.
 */
const RecentActionSchema = new Schema(
  {
    kind: { type: String, required: true }, // ex.: "open_tab", "create_study", "summon"
    detail: String,                          // texto livre (tópico, id, etc.)
    at: { type: Number, default: () => Date.now() },
  },
  { _id: false }
);

const AgentContextSchema = new Schema(
  {
    // chave por usuário (email é estável em toda a base; mesmo padrão das outras rotas)
    email: { type: String, required: true, unique: true, index: true },

    activeRoom: String,        // "research-lab" | "workstation" | ...
    activeTab: String,         // "pesquisa" | "sala-de-estudos" | "projetos" | ...
    currentStudyId: String,
    currentResearchId: String,
    currentProjectId: String,
    currentGoal: String,       // objetivo declarado ("estudar metaprogramação")

    recentActions: { type: [RecentActionSchema], default: [] }, // mantemos as últimas ~15
  },
  { timestamps: true, strict: false }
);

const AgentContext = models.AgentContext || model("AgentContext", AgentContextSchema);

export default AgentContext;
