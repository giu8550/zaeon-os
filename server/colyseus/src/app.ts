/**
 * Monta o servidor do Colyseus num http.Server próprio (com /health pro healthcheck do compose/Caddy).
 * Separado do index.ts pra os testes subirem um servidor de verdade numa porta livre.
 */
import http from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { LoungeRoom } from "./LoungeRoom";

export function criarServidor(segredo: string = process.env.REALTIME_SECRET ?? "") {
  LoungeRoom.segredo = segredo;
  const httpServer = http.createServer();   // o matchmaking HTTP e o /health são do Colyseus (um só dono da resposta)
  const servidor = new Server({
    transport: new WebSocketTransport({ server: httpServer, pingInterval: 5000, pingMaxRetries: 3 }),
    gracefullyShutdown: false,
    express: (app) => { app.get("/health", (_req: unknown, res: { type(t: string): { send(b: string): void } }) => { res.type("text/plain").send("ok"); }); },
  });
  // uma room POR SALA do app: o convite (mesmo salaId) cai sempre na mesma
  servidor.define("lounge", LoungeRoom).filterBy(["salaId"]);
  return { servidor, httpServer };
}
