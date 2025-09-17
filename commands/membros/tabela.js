class TabelaCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(message) {
        const groupId = message.key.remoteJid; // pega o ID do grupo
        const tabelaData = this.dataManager.getTabelaByGroup(groupId);

        if (!tabelaData) {
            await this.sendMessage(groupId, '❌ Não existe tabela para este grupo.');
            return;
        }

        let tabelaMensagem = '';

        if (tabelaData.tipo === 'megas') {
            // Tabela estruturada
            const t = tabelaData.tabela;
            tabelaMensagem += `${t.titulo}\n\n`;

            if (t.megas_diarios?.pacotes) {
                tabelaMensagem += `${t.megas_diarios.titulo}\n`;
                t.megas_diarios.pacotes.forEach(p => {
                    tabelaMensagem += `- ${p.mb} = ${p.preco} ${p.emoji}\n`;
                });
                tabelaMensagem += '\n';
            }

            if (t.megas_semanais?.pacotes) {
                tabelaMensagem += `${t.megas_semanais.titulo}\n`;
                t.megas_semanais.pacotes.forEach(p => {
                    tabelaMensagem += `• ${p.mb} = ${p.preco}${p.emoji}\n`;
                });
                tabelaMensagem += '\n';
            }

            if (t.megas_mensais?.pacotes) {
                tabelaMensagem += `${t.megas_mensais.titulo}\n`;
                t.megas_mensais.pacotes.forEach(p => {
                    tabelaMensagem += `- ${p.mb} = ${p.preco} ${p.emoji}\n`;
                });
                tabelaMensagem += '\n';
            }

            tabelaMensagem += `${t.nota || ''}\n\n`;
            tabelaMensagem += `${t.contato || ''}\n\n`;

            if (t.formas_pagamento) {
                tabelaMensagem += `${t.formas_pagamento.titulo || ''}\n`;
                tabelaMensagem += `${t.formas_pagamento.admin || ''}\n`;
                tabelaMensagem += `${t.formas_pagamento.mpesa || ''}\n`;
                tabelaMensagem += `${t.formas_pagamento.emola || ''}\n\n`;
            }

            tabelaMensagem += `${t.instrucoes || ''}`;

        } else if (tabelaData.tipo === 'texto') {
            // Tabela simples em texto
            tabelaMensagem = tabelaData.tabela;
        }

        await this.sendMessage(groupId, tabelaMensagem);
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
