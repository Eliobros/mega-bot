class BanCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(msg, args, groupJid, senderJid) {
        // Verificar se está em um grupo
        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        // Verificar se a mensagem foi uma resposta
        if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            await this.sendMessage(groupJid, '❌ Você precisa marcar a mensagem da pessoa que deseja banir!');
            return;
        }

        const userToBan = msg.message.extendedTextMessage.contextInfo.participant;
        const donoData = this.dataManager.getDonoData();
        const donoJid = donoData.NumeroDono + '@s.whatsapp.net';

        // Verificar se não está tentando banir o próprio dono
        if (userToBan === donoJid) {
            await this.sendMessage(groupJid, '😅 Você não pode banir a si mesmo!');
            return;
        }

        // Verificar se não está tentando banir o bot
        const botJid = this.sock.user?.id;
        if (userToBan === botJid) {
            await this.sendMessage(groupJid, '🤖 Não posso banir a mim mesmo!');
            return;
        }

        try {
            // Obter informações do grupo
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participantNumber = userToBan.replace('@s.whatsapp.net', '');
            
            // Verificar se o usuário ainda está no grupo
            const isParticipant = groupMetadata.participants.some(p => p.id === userToBan);
            if (!isParticipant) {
                await this.sendMessage(groupJid, '❌ Este usuário não está mais no grupo!');
                return;
            }

            // Verificar se o usuário é admin (opcional - você pode querer permitir banir admins)
            const participant = groupMetadata.participants.find(p => p.id === userToBan);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            
            if (isAdmin) {
                await this.sendMessage(groupJid, '⚠️ Este usuário é administrador do grupo!');
                // Descomentar linha abaixo se quiser impedir banir admins
                // return;
            }

            // Motivo do ban (se fornecido)
            const motivo = args.slice(1).join(' ') || 'Não especificado';

            // Enviar mensagem antes do ban
            let mensagemBan = `🔨 *USUÁRIO BANIDO*\n\n`;
            mensagemBan += `👤 *Usuário:* @${participantNumber}\n`;
            mensagemBan += `⚖️ *Motivo:* ${motivo}\n`;
            mensagemBan += `👨‍💼 *Banido por:* ${donoData.NickDono}\n`;
            mensagemBan += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}\n\n`;
            mensagemBan += `⚠️ *Comportamento inadequado não será tolerado no grupo.*`;

            await this.sendMessage(groupJid, mensagemBan, { mentions: [userToBan] });

            // Aguardar um pouco antes de banir
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Remover o usuário do grupo
            await this.sock.groupParticipantsUpdate(groupJid, [userToBan], 'remove');

            // Log do ban para o dono (privado)
            let logBan = `📋 *LOG DE BAN*\n\n`;
            logBan += `🏪 *Grupo:* ${groupMetadata.subject}\n`;
            logBan += `👤 *Usuário banido:* ${participantNumber}\n`;
            logBan += `⚖️ *Motivo:* ${motivo}\n`;
            logBan += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}\n`;
            logBan += `✅ *Status:* Ban executado com sucesso`;

            await this.sendMessage(donoJid, logBan);

        } catch (error) {
            console.error('Erro ao banir usuário:', error);
            
            let mensagemErro = '❌ Erro ao banir usuário!\n\n';
            
            if (error.output?.statusCode === 403) {
                mensagemErro += '🛡️ *Motivo:* Bot não tem permissão de admin';
            } else if (error.output?.statusCode === 400) {
                mensagemErro += '⚠️ *Motivo:* Usuário não encontrado ou já foi removido';
            } else {
                mensagemErro += `🔧 *Erro técnico:* ${error.message}`;
            }
            
            mensagemErro += '\n\n💡 *Verificar:*\n';
            mensagemErro += '• Bot é admin do grupo?\n';
            mensagemErro += '• Usuário ainda está no grupo?\n';
            mensagemErro += '• Conexão com WhatsApp está OK?';

            await this.sendMessage(groupJid, mensagemErro);
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

module.exports = BanCommand;
