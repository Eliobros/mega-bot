class ComprovantesCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(jid, args) {
        const subcomando = args[1]?.toLowerCase();
        
        switch (subcomando) {
            case 'limpar':
                await this.limparComprovantesAntigos(jid);
                break;
                
            case 'hoje':
                await this.listarComprovantesHoje(jid);
                break;
                
            default:
                await this.listarComprovantesRecentes(jid);
        }
    }

    async listarComprovantesRecentes(jid) {
        const usersData = this.dataManager.getUsersData();
        const comprovantesRecentes = usersData.comprovantes_utilizados
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10);
        
        if (comprovantesRecentes.length === 0) {
            await this.sendMessage(jid, '📋 Nenhum comprovante foi processado ainda.');
            return;
        }
        
        let mensagem = `📋 *ÚLTIMOS COMPROVANTES PROCESSADOS*\n\n`;
        
        comprovantesRecentes.forEach((comp, index) => {
            const data = new Date(comp.data_uso).toLocaleString('pt-BR');
            const usuario = comp.usuario.replace('@s.whatsapp.net', '');
            const tipo = comp.tipo === 'mpesa' ? 'M-Pesa' : 'E-Mola';
            
            mensagem += `${index + 1}. *${tipo}*\n`;
            mensagem += `   🔑 ${comp.chave}\n`;
            mensagem += `   👤 ${usuario}\n`;
            mensagem += `   💰 ${comp.valor} MT\n`;
            mensagem += `   📅 ${data}\n\n`;
        });
        
        const prefixo = this.dataManager.getDonoData().prefixo;
        mensagem += `📊 *Total registrado:* ${usersData.comprovantes_utilizados.length} comprovantes\n`;
        mensagem += `🔒 *Sistema antifraude:* Ativo\n\n`;
        mensagem += `💡 *Comandos extras:*\n`;
        mensagem += `• ${prefixo}comprovantes hoje - Ver comprovantes de hoje\n`;
        mensagem += `• ${prefixo}comprovantes limpar - Limpar antigos`;
        
        await this.sendMessage(jid, mensagem);
    }

    async listarComprovantesHoje(jid) {
        const usersData = this.dataManager.getUsersData();
        const hoje = new Date().toISOString().split('T')[0];
        
        const comprovantesHoje = usersData.comprovantes_utilizados
            .filter(comp => {
                const dataComp = new Date(comp.data_uso).toISOString().split('T')[0];
                return dataComp === hoje;
            })
            .sort((a, b) => b.timestamp - a.timestamp);
        
        if (comprovantesHoje.length === 0) {
            await this.sendMessage(jid, '📋 Nenhum comprovante foi processado hoje.');
            return;
        }
        
        let mensagem = `📋 *COMPROVANTES DE HOJE*\n`;
        mensagem += `📅 ${new Date().toLocaleDateString('pt-BR')}\n\n`;
        
        // Estatísticas rápidas
        const totalMpesa = comprovantesHoje.filter(c => c.tipo === 'mpesa').length;
        const totalEmola = comprovantesHoje.filter(c => c.tipo === 'emola').length;
        const valorTotal = comprovantesHoje.reduce((total, c) => total + parseFloat(c.valor || 0), 0);
        
        mensagem += `📊 *Resumo:* ${comprovantesHoje.length} comprovantes\n`;
        mensagem += `💳 M-Pesa: ${totalMpesa} | E-Mola: ${totalEmola}\n`;
        mensagem += `💰 Valor total: ${valorTotal.toFixed(2)} MT\n\n`;
        
        comprovantesHoje.forEach((comp, index) => {
            const hora = new Date(comp.data_uso).toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            const usuario = comp.usuario.replace('@s.whatsapp.net', '');
            const tipo = comp.tipo === 'mpesa' ? 'M-Pesa' : 'E-Mola';
            
            mensagem += `${index + 1}. *${tipo}* às ${hora}\n`;
            mensagem += `   👤 ${usuario}\n`;
            mensagem += `   💰 ${comp.valor} MT\n\n`;
        });
        
        await this.sendMessage(jid, mensagem);
    }

    async limparComprovantesAntigos(jid) {
        const usersData = this.dataManager.getUsersData();
        const antes = usersData.comprovantes_utilizados.length;
        const trintaDiasAtras = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        usersData.comprovantes_utilizados = usersData.comprovantes_utilizados.filter(
            comp => comp.timestamp > trintaDiasAtras
        );
        
        const depois = usersData.comprovantes_utilizados.length;
        const removidos = antes - depois;
        
        this.dataManager.saveUsersData();
        
        let mensagem = `🧹 *LIMPEZA DE COMPROVANTES*\n\n`;
        mensagem += `📊 Antes: ${antes} comprovantes\n`;
        mensagem += `📊 Depois: ${depois} comprovantes\n`;
        mensagem += `🗑️ Removidos: ${removidos} comprovantes antigos (>30 dias)\n\n`;
        
        if (removidos > 0) {
            mensagem += `✅ Limpeza concluída com sucesso!\n`;
            mensagem += `💾 Espaço liberado no banco de dados.`;
        } else {
            mensagem += `ℹ️ Nenhum comprovante antigo para remover.`;
        }
        
        await this.sendMessage(jid, mensagem);
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = ComprovantesCommand;
