class HelpCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(jid) {
        const botName = this.dataManager.getDonoData().NomeDoBot;
        
        const help = `
❓ *AJUDA DO ${botName.toUpperCase()}*

🔸 Este bot responde a comandos específicos
🔸 Todos os comandos começam com "/"
🔸 Digite /menu para ver todos os comandos
🔸 O bot funciona em grupos e conversas privadas

📋 *Comandos disponíveis:*
• /menu - Menu principal
• /ping - Teste de conexão
• /help - Esta ajuda
• /tabela - Ver preços dos pacotes

🤖 *Recursos especiais:*
• Detecção de status do usuário
• Notificações de chamadas
• Respostas automáticas personalizadas
• Jogos e entretenimento
• Comandos administrativos (para grupos)
• Monitoramento de mensagens

Para mais informações, digite /menu ou consulte o manual completo do bot.
        `;

        await this.sock.sendMessage(jid, { text: help });
    }
}

module.exports = HelpCommand;
