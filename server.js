// server.js
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

// Inicializa a aplicação Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ── Mentor no WhatsApp: tick do scheduler de disparos (docs/WHATSAPP_MENTOR.md) ──
// Chama POST /api/whatsapp/dispatch a cada N min (idempotente por dedupeKey). Só liga se
// houver token interno + um provider de envio configurado. WHATSAPP_DISPATCH=0 desliga.
function startWhatsAppScheduler(port) {
    const token = process.env.WHATSAPP_INTERNAL_TOKEN;
    const hasProvider = !!(process.env.WHATSAPP_PROVIDER || process.env.EVOLUTION_URL || process.env.DISPAROS_URL);
    if (!token || !hasProvider || process.env.WHATSAPP_DISPATCH === "0") return;
    const everyMin = Math.max(1, Number(process.env.WHATSAPP_DISPATCH_EVERY_MIN) || 15);
    const tick = async () => {
        try {
            const res = await fetch(`http://localhost:${port}/api/whatsapp/dispatch`, { method: "POST", headers: { "x-internal-token": token } });
            const body = await res.json().catch(() => ({}));
            if (body && (body.sent || body.errors)) console.log(`[whatsapp:dispatch] users=${body.users} sent=${body.sent} skipped=${body.skipped} errors=${body.errors}`);
        } catch (e) { console.warn("[whatsapp:dispatch] tick falhou:", e?.message || e); }
    };
    setTimeout(tick, 90_000); // deixa o app aquecer
    setInterval(tick, everyMin * 60_000);
    console.log(`> WhatsApp scheduler ligado (a cada ${everyMin} min)`);
}

app.prepare().then(() => {
    const httpServer = createServer(handle);

    // Anexa o Socket.IO ao servidor HTTP do Next.js
    const io = new Server(httpServer);

    io.on("connection", (socket) => {
        console.log("⚡ Novo agente conectado ao Socket:", socket.id);

        // 1. O utilizador junta-se a uma "sala" com o seu próprio ID (para receber mensagens privadas)
        socket.on("join_own_room", (userId) => {
            socket.join(userId);
            console.log(`Agente ${userId} entrou na sua sala pessoal.`);
        });

        // 2. CHAT PRIVADO: Encaminha a mensagem diretamente para o ID do destinatário
        socket.on("send_private_message", (data) => {
            // data contém: { receiverId, messageObj }
            // Transmite a mensagem apenas para a sala do recetor
            socket.to(data.receiverId).emit("receive_private_message", data.messageObj);
        });

        // 3. COMUNIDADE (Preparação para o próximo passo): Junta-se ao Lounge
        socket.on("join_community", (roomName) => {
            socket.join(roomName);
        });

        socket.on("disconnect", () => {
            console.log("Agente desconectado:", socket.id);
        });
    });

    httpServer.once("error", (err) => {
        console.error(err);
        process.exit(1);
    });

    httpServer.listen(port, () => {
        console.log(`> Servidor Zaeon OS pronto e a escutar em http://${hostname}:${port}`);
        startWhatsAppScheduler(port);
    });
});