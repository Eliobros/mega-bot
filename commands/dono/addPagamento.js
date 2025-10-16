const fs = require("fs");
const path = require("path");

module.exports = {
  name: "addPagamento",
  description: "Registra métodos de pagamento para o grupo",
  async execute(sock, msg, args, dataManager) {
    const from = msg.key.remoteJid;
    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { text: "❌ Este comando só funciona em grupos." });
      return;
    }

    // Apenas dono pode usar
    const sender = msg.key.participant || from;
    const senderNumber = sender.split("@")[0];
    const donoData = dataManager.getDonoData();
    if (senderNumber !== donoData.NumeroDono.replace(/\D/g, "")) {
      await sock.sendMessage(from, { text: "⚠️ Apenas o dono pode registrar métodos de pagamento." });
      return;
    }

    // args deve ter os dados: nome, numero, mpesa, emola
    const [nome, numero, mpesa, emola] = args;
    if (!nome || !numero) {
      await sock.sendMessage(from, { text: "❌ Uso: !addPagamento <nome> <numero> [mpesa] [emola]" });
      return;
    }

    // Caminho do arquivo
    const filePath = path.join(__dirname, "..", "..", "data", "pagamentos.json");
    let pagamentosData = {};
    if (fs.existsSync(filePath)) {
      pagamentosData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }

    if (!pagamentosData[from]) pagamentosData[from] = [];

    // Adiciona novo método
    pagamentosData[from].push({ nome, numero, mpesa, emola });

    // Salva
    fs.writeFileSync(filePath, JSON.stringify(pagamentosData, null, 2), "utf8");

    await sock.sendMessage(from, { text: `✅ Método de pagamento registrado com sucesso para este grupo!` });
  }
};
