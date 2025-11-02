class MarcarCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(msg, args, from, sender) {
        try {
            // Verificar se é um grupo
            if (!from.endsWith('@g.us')) {
                await this.sendMessage(from, '❌ Este comando só pode ser usado em grupos!');
                return;
            }

            await this.sendMessage(from, '🔍 Buscando membros do grupo...\nAguarde...');

            // Buscar metadados do grupo
            const groupMetadata = await this.sock.groupMetadata(from);
            const participants = groupMetadata.participants;

            const hoje = new Date().toISOString();
            let marcados = 0;
            let jaExistiam = 0;

            // Marcar cada membro
            for (const participant of participants) {
                const memberJid = participant.id;
                
                // Verificar se já tem data de entrada registrada
                const jaTemData = this.dataManager.getMemberEntryDate(from, memberJid);
                
                if (jaTemData) {
                    jaExistiam++;
                } else {
                    // Adicionar data de hoje
                    this.dataManager.addMemberEntry(from, memberJid, hoje);
                    marcados++;
                }
            }

            // Mensagem de resultado
            let mensagem = `✅ *MARCAÇÃO CONCLUÍDA*\n\n`;
            mensagem += `👥 Total de membros: *${participants.length}*\n`;
            mensagem += `🆕 Marcados agora: *${marcados}*\n`;
            mensagem += `📅 Já tinham data: *${jaExistiam}*\n\n`;
            
            if (marcados > 0) {
                mensagem += `✨ Todos os membros foram registrados como tendo entrado hoje!\n`;
                mensagem += `🔒 Eles estarão protegidos por 15 dias contra limpeza automática.`;
            } else {
                mensagem += `ℹ️ Todos os membros já tinham data de entrada registrada.`;
            }

            await this.sendMessage(from, mensagem);

            console.log(`✅ Marcados ${marcados} membros no grupo ${from}`);

        } catch (err) {
            console.error('Erro no comando marcar:', err);
            await this.sendMessage(from, '❌ Ocorreu um erro ao marcar os membros!');
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

module.exports = MarcarCommand;
