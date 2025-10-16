class GrupoCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.timers = new Map(); // Armazena os timers ativos
    }

    async isAdmin(groupJid, userId) {
        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === userId);
            
            // Verifica se é admin ou superadmin (dono)
            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        } catch (error) {
            console.error('Erro ao verificar admin:', error);
            return false;
        }
    }

    async execute(args, groupJid, sender, senderName) {
        const acao = args[0]?.toLowerCase();
        const tempo = args[1]; // Segundo argumento pode ser o tempo

        console.log(`🔍 DEBUG GRUPO:
        - Args: ${JSON.stringify(args)}
        - Ação: "${acao}"
        - Tempo: "${tempo}"
        - GroupJid: ${groupJid}
        - Sender: ${sender}
        - SenderName: ${senderName}`);

        // Verificar se está em um grupo
        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        // ✅ VERIFICAÇÃO DE ADMIN
        const ehAdmin = await this.isAdmin(groupJid, sender);
        if (!ehAdmin) {
            await this.sendMessage(groupJid, '❌ Apenas administradores podem usar este comando!');
            return;
        }

        switch (acao) {
            case 'a':
            case 'abrir':
                if (tempo) {
                    await this.programarAbertura(groupJid, tempo, senderName);
                } else {
                    await this.abrirGrupo(groupJid, senderName);
                }
                break;

            case 'f':
            case 'fechar':
                if (tempo) {
                    await this.programarFechamento(groupJid, tempo, senderName);
                } else {
                    await this.fecharGrupo(groupJid, senderName);
                }
                break;

            case 'cancelar':
                await this.cancelarTimer(groupJid);
                break;

            default:
                const prefixo = this.dataManager.getDonoData().prefixo;
                await this.sendMessage(groupJid, `❌ Uso correto:\n• ${prefixo}grupo a [tempo] - Abrir grupo\n• ${prefixo}grupo f [tempo] - Fechar grupo\n• ${prefixo}grupo cancelar - Cancelar timer\n\nExemplos:\n• ${prefixo}grupo a - Abrir agora\n• ${prefixo}grupo f 1h - Fechar em 1 hora\n• ${prefixo}grupo a 30m - Abrir em 30 minutos`);
        }
    }

    parseTime(timeStr) {
        const match = timeStr.match(/^(\d+)([hms])$/i);
        if (!match) return null;
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            default: return null;
        }
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h${minutes % 60 > 0 ? ` ${minutes % 60}m` : ''}`;
        if (minutes > 0) return `${minutes}m${seconds % 60 > 0 ? ` ${seconds % 60}s` : ''}`;
        return `${seconds}s`;
    }

    async programarAbertura(groupJid, timeStr, senderName) {
        const ms = this.parseTime(timeStr);
        if (!ms) {
            await this.sendMessage(groupJid, '❌ Formato de tempo inválido! Use: 1h, 30m ou 60s');
            return;
        }

        if (this.timers.has(groupJid)) clearTimeout(this.timers.get(groupJid));

        const timeFormatted = this.formatTime(ms);
        await this.sendMessage(groupJid, `⏰ *ABERTURA PROGRAMADA*\n🔓 O grupo será aberto em *${timeFormatted}*\n📅 Data/hora: ${new Date(Date.now() + ms).toLocaleString('pt-BR')}\n👨‍💼 Programado por: ${senderName}\n⚠️ Use \`!grupo cancelar\` para cancelar`);

        const timer = setTimeout(async () => {
            await this.abrirGrupo(groupJid, senderName, true);
            this.timers.delete(groupJid);
        }, ms);

        this.timers.set(groupJid, timer);
    }

    async programarFechamento(groupJid, timeStr, senderName) {
        const ms = this.parseTime(timeStr);
        if (!ms) {
            await this.sendMessage(groupJid, '❌ Formato de tempo inválido! Use: 1h, 30m ou 60s');
            return;
        }

        if (this.timers.has(groupJid)) clearTimeout(this.timers.get(groupJid));

        const timeFormatted = this.formatTime(ms);
        await this.sendMessage(groupJid, `⏰ *FECHAMENTO PROGRAMADO*\n🔒 O grupo será fechado em *${timeFormatted}*\n📅 Data/hora: ${new Date(Date.now() + ms).toLocaleString('pt-BR')}\n👨‍💼 Programado por: ${senderName}\n⚠️ Use \`!grupo cancelar\` para cancelar`);

        const timer = setTimeout(async () => {
            await this.fecharGrupo(groupJid, senderName, true);
            this.timers.delete(groupJid);
        }, ms);

        this.timers.set(groupJid, timer);
    }

    async cancelarTimer(groupJid) {
        if (this.timers.has(groupJid)) {
            clearTimeout(this.timers.get(groupJid));
            this.timers.delete(groupJid);
            await this.sendMessage(groupJid, '❌ *TIMER CANCELADO*\nA programação de abertura/fechamento foi cancelada.');
        } else {
            await this.sendMessage(groupJid, '❌ Não há timer ativo para este grupo.');
        }
    }

    async abrirGrupo(groupJid, senderName, isScheduled = false) {
        try {
            await this.sock.groupSettingUpdate(groupJid, 'not_announcement');

            let mensagem = `🔓 *GRUPO ABERTO${isScheduled ? ' (PROGRAMADO)' : ''}*\n\n`;
            mensagem += `📢 Todos os membros podem enviar mensagens!\n`;
            mensagem += `💬 O grupo foi ${isScheduled ? 'automaticamente ' : ''}liberado por: ${senderName}\n`;
            if (isScheduled) mensagem += `⏰ Executado conforme programação\n`;
            mensagem += `\n📋 *Lembrete das regras:*\n• Seja respeitoso\n• Use "tabela" para ver preços\n• Envie comprovantes de pagamento\n• Evite spam`;

            await this.sendMessage(groupJid, mensagem);
            console.log(`✅ Grupo aberto ${isScheduled ? '(programado) ' : ''}com sucesso!`);
        } catch (error) {
            console.error('Erro ao abrir grupo:', error);
            await this.handleGroupError(groupJid, error, 'abrir');
        }
    }

    async fecharGrupo(groupJid, senderName, isScheduled = false) {
        try {
            await this.sock.groupSettingUpdate(groupJid, 'announcement');

            let mensagem = `🔒 *GRUPO FECHADO${isScheduled ? ' (PROGRAMADO)' : ''}*\n\n`;
            mensagem += `📢 Apenas admins podem enviar mensagens!\n`;
            mensagem += `🛡️ O grupo foi ${isScheduled ? 'automaticamente ' : ''}fechado por: ${senderName}\n`;
            if (isScheduled) mensagem += `⏰ Executado conforme programação\n`;
            mensagem += `\n💡 *Você ainda pode:*\n• Ver a tabela de preços\n• Enviar comprovantes de pagamento\n• Aguardar liberação dos admins\n\n⏳ O grupo será reaberto quando necessário.`;

            await this.sendMessage(groupJid, mensagem);
            console.log(`✅ Grupo fechado ${isScheduled ? '(programado) ' : ''}com sucesso!`);
        } catch (error) {
            console.error('Erro ao fechar grupo:', error);
            await this.handleGroupError(groupJid, error, 'fechar');
        }
    }

    async handleGroupError(groupJid, error, action) {
        if (error.output?.statusCode === 403) {
            await this.sendMessage(groupJid, `❌ Bot não tem permissão de admin! Torne o bot administrador do grupo para ${action}.`);
        } else {
            await this.sendMessage(groupJid, `❌ Erro ao ${action} o grupo: ${error.message || 'Erro desconhecido'}`);
        }
    }

    async sendMessage(jid, text, options = {}) {
        try {
            if (!jid || typeof jid !== 'string') {
                console.error('JID inválido:', jid);
                return;
            }
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = GrupoCommand;
