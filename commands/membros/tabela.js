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

            // Construir tabela a partir do JSON estruturado
            const data = this.dataManager.getTabelaData();
            if (!data) {
                await this.sendMessage(jid, '❌ Erro: Tabela indisponível.');
                return;
            }

            let mensagemTabela = `*TABELA   NORMAL PARA CONSUMIDORES DA VODACOM ❤️*\n\n`;

            if (data.megas_diarios?.pacotes?.length) {
                mensagemTabela += `*PACOTES DIÁRIOS(24H🚨)*\n\n`;
                data.megas_diarios.pacotes.forEach(p => {
                    mensagemTabela += `• ${p.nome} -------- ${p.quantidade} (${p.preco})📶\n`;
                });
                mensagemTabela += `\n\n`;
            }

            if (data.megas_semanais?.pacotes?.length) {
                mensagemTabela += `*PACOTES SEMANAIS(7DIAS🚨)*\n\n`;
                data.megas_semanais.pacotes.forEach(p => {
                    mensagemTabela += `• ${p.nome} -------- ${p.quantidade} (${p.preco})🎮\n`;
                });
                mensagemTabela += `\n\n`;
            }

            if (data.megas_mensais?.pacotes?.length) {
                mensagemTabela += `*PACOTES MENSAIS(30DIAS🚨)*\n\n`;
                data.megas_mensais.pacotes.forEach(p => {
                    mensagemTabela += `• ${p.nome} -------- ${p.quantidade} (${p.preco})🗓️\n`;
                });
                mensagemTabela += `\n\n`;
            }

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
