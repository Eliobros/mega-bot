const CompraHandler = require('../../handlers/CompraHandler');

class ComprarCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.compraHandler = new CompraHandler(sock, dataManager);
    }

    async execute(msg, args, from, sender) {
        const prefixo = this.dataManager.getDonoData().prefixo;
        
        if (args.length < 2) {
            await this.sendMessage(from, `❌ Uso correto: ${prefixo}comprar <pacote>\nExemplo: ${prefixo}comprar 1100MB`);
            return;
        }
        
        // Verificar se a mensagem foi uma resposta
        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedSender = msg.message.extendedTextMessage.contextInfo.participant;
            await this.compraHandler.processar(quotedSender, args[1], from);
        } else {
            await this.sendMessage(from, '❌ Você precisa marcar a mensagem do cliente para processar a compra!');
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

module.exports = ComprarCommand;
