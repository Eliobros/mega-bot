import WebSocket from "ws";

const wsUrl = "wss://web.whatsapp.com/ws/chat";
const ws = new WebSocket(wsUrl, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Origin": "https://web.whatsapp.com",
    "Host": "web.whatsapp.com",
    "Connection": "Upgrade",
    "Upgrade": "websocket",
  },
});

ws.on("open", () => {
  console.log("✅ Conexão WebSocket aberta com sucesso!");
  ws.close();
});

ws.on("error", (err) => {
  console.error("❌ Erro na conexão:", err.message);
});

ws.on("close", (code, reason) => {
  console.log(`🔌 Conexão fechada - Código: ${code}, Motivo: ${reason}`);
});

