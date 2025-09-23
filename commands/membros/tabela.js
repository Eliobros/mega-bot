class TabelaCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(msg) {
        try {
            // Extrai o JID do grupo ou do usuário
            const jid = msg.key.remoteJid;
            if (!jid || typeof jid !== 'string') {
                console.error('JID inválido:', msg);
                return;
            }

            const mensagemTabela = `*TABELA   NORMAL PARA CONSUMIDORES DA VODACOM ❤️*

*PACOTES DIÁRIOS(24H🚨)*

• 5MT -------- 270MB📶
• 7MT -------- 378MB📶
• 10MT ------- 550MB📶
• 15MT ------- 810MB📶
• 20MT ------- 1.100MB📶
• 25MT ------- 1.370MB📶
• 30MT ------- 1.630MB📶
• 35MT ------- 1.900MB📶
• 40MT ------- 2.170MB📶
• 45MT ------- 2.430MB📶
• 50MT ------- 2.700MB📶
• 60MT ------- 3.240MB📶
• 70MT ------- 3.790MB📶
• 80MT ------- 4.340MB📶
• 90MT ------- 4.900MB📶
• 100MT ------ 5.400MB📶


*PACOTES SEMANAIS(7DIAS🚨)*

• 30MT -------- 850MB🎮
• 50MT -------- 1.700MB🖥️
• 85MT -------- 2.900MB🕹️
• 100MT ------- 3.400MB🎰
• 160MT ------- 5.200MB👾


`;

            await this.sendMessage(jid, mensagemTabela);
        } catch (err) {
            console.error("Erro no execute do TabelaCommand:", err);
        }
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = TabelaCommand;
