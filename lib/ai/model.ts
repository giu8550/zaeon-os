/**
 * Modelos Gemini centrais para toda a aplicação (Vertex AI).
 *
 * Por que existe: o Google aposentou `gemini-2.0-flash-001` em 2026-06-01 sem
 * fallback automático, e ele estava hardcoded em ~9 rotas — o que derrubou o chat
 * widget e os demais endpoints de IA de uma vez. Daqui pra frente, troca de modelo
 * = 1 linha (ou as envs abaixo).
 *
 * Builds (pesquisado + TESTADO AO VIVO no projeto `zaeon-os`/us-central1 em 2026-06-13):
 *   - gemini-2.5-flash / gemini-2.5-pro : ✅ FUNCIONAM neste projeto hoje (default).
 *   - gemini-3.5-flash (GA 2026-05-19) / gemini-3.1-pro (GA 2026-02): existem no
 *     Vertex, mas retornam 404 NESTE projeto (ainda não habilitados/region). Quando
 *     habilitarem, é só apontar as envs abaixo — sem mudar código.
 *   - Atenção: os 2.5 têm retirada prevista para 2026-10-16; migrar para 3.x antes disso.
 *
 * Override por env (assim que o 3.x estiver liberado no projeto):
 *   GEMINI_MODEL=gemini-3.5-flash      (tier rápido)
 *   GEMINI_MODEL_PRO=gemini-3.1-pro    (tier de raciocínio)
 * Ref: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
 */

/** Tier rápido / alto volume (default em quase tudo). */
export const GEMINI_MODEL_FLASH = process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_FLASH || "gemini-2.5-flash";

/** Tier de raciocínio profundo (arquitetura, debug, plano, fallback de Opus). */
export const GEMINI_MODEL_PRO = process.env.GEMINI_MODEL_PRO || "gemini-2.5-pro";

/** Compat: export histórico usado por ~9 rotas. Aponta para o tier rápido. */
export const GEMINI_MODEL = GEMINI_MODEL_FLASH;
