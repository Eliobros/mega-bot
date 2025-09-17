class GrupoCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(args, groupJid) {
        // 🔧 CORREÇÃO: Mudança de args[1] para args[0]
        const acao = args[0]?.toLowerCase();
        
        console.log(`🔍 DEBUG GRUPO:
        - Args: ${JSON.stringify(args)}
        - Ação extraída: "${acao}"
        - GroupJid: ${groupJid}`);
        
        // Verificar se está em um grupo
        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        switch (acao) {
            case 'a':
            case 'abrir':
                console.log("✅ Executando ABRIR grupo...");
                await this.abrirGrupo(groupJid);
                break;
                
            case 'f':
            case 'fechar':
                console.log("✅ Executando FECHAR grupo...");
                await this.fecharGrupo(groupJid);
                break;
                
            default:
                console.log(`❌ Ação não reconhecida: "${acao}"`);
                const prefixo = this.dataManager.getDonoData().prefixo;
                await this.sendMessage(groupJid, `❌ Uso correto:\n• ${prefixo}grupo a - Abrir grupo\n• ${prefixo}grupo f - Fechar grupo`);
        }
    }

    async abrirGrupo(groupJid) {
        try {
            // Permitir que todos os membros enviem mensagens
            await this.sock.groupSettingUpdate(groupJid, 'not_announcement');
            
            const donoData = this.dataManager.getDonoData();
            let mensagem = `🔓 *GRUPO ABERTO*\n\n`;
            mensagem += `📢 Todos os membros podem enviar mensagens!\n`;
            mensagem += `💬 O grupo foi liberado pelo ${donoData.NickDono}\n\n`;
            mensagem += `📋 *Lembrete das regras:*\n`;
            mensagem += `• Seja respeitoso com todos\n`;
            mensagem += `• Use "tabela" para ver preços\n`;
            mensagem += `• Envie comprovantes após pagamento\n`;
            mensagem += `• Evite spam ou mensagens desnecessárias`;
            
            await this.sendMessage(groupJid, mensagem);
            console.log("✅ Grupo aberto com sucesso!");
            
        } catch (error) {
            console.error('Erro ao abrir grupo:', error);
            
            if (error.output?.statusCode === 403) {
                await this.sendMessage(groupJid, '❌ Bot não tem permissão de admin! Torne o bot administrador do grupo.');
            } else {
                await this.sendMessage(groupJid, `❌ Erro ao abrir o grupo: ${error.message || 'Erro desconhecido'}`);
            }
        }
    }

    async fecharGrupo(groupJid) {
        try {
            // Permitir apenas admins enviarem mensagens
            await this.sock.groupSettingUpdate(groupJid, 'announcement');
            
            const donoData = this.dataManager.getDonoData();
            let mensagem = `🔒 *GRUPO FECHADO*\n\n`;
            mensagem += `📢 Apenas admins podem enviar mensagens!\n`;
            mensagem += `🛡️ O grupo foi fechado pelo ${donoData.NickDono}\n\n`;
            mensagem += `💡 *Você ainda pode:*\n`;
            mensagem += `• Ver a tabela de preços\n`;
            mensagem += `• Enviar comprovantes de pagamento\n`;
            mensagem += `• Aguardar liberação dos admins\n\n`;
            mensagem += `⏳ O grupo será reaberto em breve.`;
            
            await this.sendMessage(groupJid, mensagem);
            console.log("✅ Grupo fechado com sucesso!");
            
        } catch (error) {
            console.error('Erro ao fechar grupo:', error);
            
            if (error.output?.statusCode === 403) {
                await this.sendMessage(groupJid, '❌ Bot não tem permissão de admin! Torne o bot administrador do grupo.');
            } else {
                await this.sendMessage(groupJid, `❌ Erro ao fechar o grupo: ${error.message || 'Erro desconhecido'}`);
            }
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

module.exports = GrupoCommand;