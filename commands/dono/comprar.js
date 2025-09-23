const CompraHandler = require('../../handlers/CompraHandler');

class ComprarCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.compraHandler = new CompraHandler(sock, dataManager);
    }

    async execute(msg, args, from, sender) {
        const prefixo = this.dataManager.getDonoData().prefixo;
        
        // args já vem sem o comando, então verificamos se tem pelo menos 1 elemento
        if (args.length < 1 || !args[0]) {
            await this.sendMessage(from, `❌ Uso correto: ${prefixo}comprar <pacote> [d|s|m]\nExemplos:\n• ${prefixo}comprar 20MT d  (diário)\n• ${prefixo}comprar 50MT s  (semanal)\n• ${prefixo}comprar 10GB m  (mensal)`);
            return;
        }
        
        // Verificar se a mensagem foi uma resposta
        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedSender = msg.message.extendedTextMessage.contextInfo.participant;
            // Tipo preferido opcional no segundo argumento: d/s/m
            const tipoPreferido = args[1] ? args[1].toLowerCase() : null;
            // Usar args[0] pois o array já vem sem o comando
            await this.compraHandler.processar(quotedSender, args[0], from, tipoPreferido);
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
