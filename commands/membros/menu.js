class MenuCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(jid) {
        const botName = this.dataManager.getDonoData().NomeDoBot;
        
        const menu = `
🤖 *${botName}*

📋 *Comandos disponíveis:*
• /menu - Mostrar este menu
• /ping - Testar conexão
• /help - Ajuda
• tabela - Ver tabela de preços 💰

💡 *Dica:* Digite "oi" para uma saudação!

_Bot criado com Baileys_ ⚡
        `;
        
        await this.sendMessage(jid, menu.trim());
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = MenuCommand;
