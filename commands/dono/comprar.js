class CompraHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    // Processa a compra de um usuário
    async processar(userNumber, pacoteNome, from) {
        try {
            const tabela = this.dataManager.getTabelaData(); // pega todas as tabelas
            if (!tabela || Object.keys(tabela).length === 0) {
                await this.sendMessage(from, '❌ Nenhuma tabela de pacotes encontrada!');
                return;
            }

            // Supondo que você tenha um grupo específico, ou queira pegar a tabela geral
            const pacotes = tabela.pacotes; // aqui você precisa garantir que o JSON tenha "pacotes" no nível root
            if (!pacotes) {
                await this.sendMessage(from, '❌ Nenhum pacote disponível na tabela!');
                return;
            }

            const pacote = pacotes.find(p => p.nome === pacoteNome);
            if (!pacote) {
                await this.sendMessage(from, `❌ Pacote "${pacoteNome}" não encontrado!`);
                return;
            }

            // Aqui você processaria a compra (ex: atualizar userData, confirmar pagamento, etc)
            await this.sendMessage(from, `✅ Pacote "${pacoteNome}" processado com sucesso para ${userNumber}!`);

        } catch (err) {
            console.error('Erro ao processar compra:', err);
            await this.sendMessage(from, '❌ Ocorreu um erro ao processar a compra!');
        }
    }

    async sendMessage(jid, text) {
        try {
            await this.sock.sendMessage(jid, { text });
        } catch (err) {
            console.error('Erro ao enviar mensagem:', err);
        }
    }
}

module.exports = CompraHandler;
