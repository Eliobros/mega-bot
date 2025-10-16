class TabelaCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(msg) {
        try {
            const jid = msg.key.remoteJid;

            // 🔒 Só funciona em grupos
            if (!jid.endsWith('@g.us')) {
                return this.sendMessage(jid, '❌ Este comando só pode ser usado em grupos.');
            }

            // 🔍 Buscar tabela salva para o grupo
            const tabelaInfo = this.dataManager.getTabelaByGroup(jid);

            if (!tabelaInfo || !tabelaInfo.tabela) {
                return this.sendMessage(jid, '📭 Nenhuma tabela registrada para este grupo ainda.\nPeça ao dono da Tina para registrar uma com o comando *!addTabela*.');
            }

            // 🧾 Mensagem final com tabela
            const mensagemTabela = `📋 *Tabela deste grupo:*\n\n${tabelaInfo.tabela}`;

            await this.sendMessage(jid, mensagemTabela);
        } catch (err) {
            console.error('Erro no execute do TabelaCommand:', err);
            await this.sendMessage(msg.key.remoteJid, '❌ Erro ao carregar a tabela deste grupo.');
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
