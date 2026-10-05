/**
 * Realtime do cyberespaço Zaeon (Colyseus self-hosted): posição/presença + signaling da voz.
 * Porta: PORT (padrão 2567). Segredo compartilhado com o app: REALTIME_SECRET (obrigatório).
 * Atrás do Caddy em wss://<domínio>/colyseus (handle_path tira o prefixo). Healthcheck: GET /health.
 */
import { criarServidor } from "./app";

const porta = Number(process.env.PORT) || 2567;
if (!process.env.REALTIME_SECRET) console.warn("[colyseus] REALTIME_SECRET ausente — toda entrada será recusada (o app também não emite token sem ele).");
const { servidor } = criarServidor();
servidor.listen(porta, "0.0.0.0").then(() => console.log(`[colyseus] ouvindo em :${porta}`));
const sair = async () => { try { await servidor.gracefullyShutdown(false); } finally { process.exit(0); } };
process.on("SIGTERM", sair); process.on("SIGINT", sair);
