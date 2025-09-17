const fs = require('fs');
const path = require('path');

class LinkGpCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.donoFile = path.join(__dirname, '../../database/dono.json');
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.donoFile));
        } catch (error) {
            return { groups: {}, Prefixo: '!', NumeroDono: '' };
        }
    }

    // Pegar prefixo do dono.json
    getPrefix() {
        const config = this.getConfig();
        return config.Prefixo || '!';
    }

    // Método centralizado para obter dados do dono
    getDonoInfo() {
        const donoData = this.dataManager.getDonoData();
        return {
            jid: donoData.NumeroDono + '@s.whatsapp.net',
            number: donoData.NumeroDono
        };
    }

    // Verificar permissões do usuário
    async checkUserPermissions(groupJid, senderJid) {
        const dono = this.getDonoInfo();
        const isDono = senderJid === dono.jid;
        
        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            
            return {
                isDono,
                isAdmin,
                groupMetadata,
                participant
            };
        } catch (error) {
            console.error("Erro ao verificar permissões:", error);
            return { isDono, isAdmin: false, groupMetadata: null, participant: null };
        }
    }

    // Enviar log para o dono
    async sendLogToDono(message) {
        const dono = this.getDonoInfo();
        await this.sendMessage(dono.jid, message);
    }

    async execute(msg, args, groupJid, senderJid) {
        const prefix = this.getPrefix();

        // Verificar se é um grupo
        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            // Verificar permissões
            const permissions = await this.checkUserPermissions(groupJid, senderJid);
            
            if (!permissions.groupMetadata) {
                await this.sendMessage(groupJid, '❌ Erro ao acessar informações do grupo!');
                return;
            }

            // Verificar se é admin ou dono
            if (!permissions.isAdmin && !permissions.isDono) {
                await this.sendMessage(groupJid, '❌ Apenas admins podem usar este comando!');
                return;
            }

            const groupName = permissions.groupMetadata.subject;
            const memberCount = permissions.groupMetadata.participants.length;

            // Verificar argumentos para diferentes ações
            if (args[0] === 'novo' || args[0] === 'reset' || args[0] === 'renovar') {
                // Revogar link atual e gerar novo
                await this.revokeGroupInvite(groupJid, groupName, senderJid, permissions);
                return;
            }

            if (args[0] === 'revogar' || args[0] === 'desativar') {
                // Apenas revogar o link atual
                await this.revokeGroupInvite(groupJid, groupName, senderJid, permissions, false);
                return;
            }

            // Obter link atual do grupo
            const inviteCode = await this.sock.groupInviteCode(groupJid);
            const groupLink = `https://chat.whatsapp.com/${inviteCode}`;

            // Formatar data/hora atual
            const now = new Date().toLocaleString('pt-BR');

            // Mensagem com o link
            let linkMsg = `🔗 *Link do Grupo*\n\n`;
            linkMsg += `📍 *Nome:* ${groupName}\n`;
            linkMsg += `👥 *Membros:* ${memberCount}\n`;
            linkMsg += `📅 *Gerado em:* ${now}\n\n`;
            linkMsg += `🌐 *Link de convite:*\n${groupLink}\n\n`;
            linkMsg += `⚠️ *Aviso:* Compartilhe com responsabilidade!\n`;
            linkMsg += `💡 *Dica:* Use \`${prefix}linkgp novo\` para gerar um novo link`;

            // Enviar no grupo ou privado dependendo do argumento
            if (args[0] === 'pv' || args[0] === 'privado') {
                // Enviar no privado do usuário
                await this.sendMessage(senderJid, linkMsg);
                await this.sendMessage(groupJid, `✅ Link do grupo enviado no seu privado!`);
                
                // Log para o dono (se não for o próprio dono)
                if (!permissions.isDono) {
                    const userNumber = senderJid.replace('@s.whatsapp.net', '');
                    await this.sendLogToDono(`📱 *Link solicitado (PV)*\n📍 Grupo: ${groupName}\n👤 Por: @${userNumber}\n🆔 ID: ${groupJid}`);
                }
            } else {
                // Enviar no próprio grupo
                await this.sendMessage(groupJid, linkMsg);
                
                // Log para o dono (se não for o próprio dono)
                if (!permissions.isDono) {
                    const userNumber = senderJid.replace('@s.whatsapp.net', '');
                    await this.sendLogToDono(`🔗 *Link compartilhado*\n📍 Grupo: ${groupName}\n👤 Por: @${userNumber}\n🆔 ID: ${groupJid}`);
                }
            }

        } catch (error) {
            console.error("Erro ao obter link do grupo:", error);
            
            if (error.output?.statusCode === 403) {
                await this.sendMessage(groupJid, '❌ Bot não tem permissão para gerar links de convite!\n💡 Verifique se o bot é admin do grupo.');
            } else if (error.output?.statusCode === 404) {
                await this.sendMessage(groupJid, '❌ Grupo não encontrado ou bot foi removido!');
            } else {
                await this.sendMessage(groupJid, `❌ Erro ao obter link do grupo!\n🔧 Erro: ${error.message || 'Desconhecido'}`);
            }
        }
    }

    // Método para revogar link do grupo
    async revokeGroupInvite(groupJid, groupName, senderJid, permissions, generateNew = true) {
        try {
            // Revogar link atual
            await this.sock.groupRevokeInvite(groupJid);

            if (generateNew) {
                // Gerar novo link
                const newInviteCode = await this.sock.groupInviteCode(groupJid);
                const newGroupLink = `https://chat.whatsapp.com/${newInviteCode}`;
                const now = new Date().toLocaleString('pt-BR');

                let msg = `🔄 *Link Renovado com Sucesso!*\n\n`;
                msg += `📍 *Grupo:* ${groupName}\n`;
                msg += `👥 *Membros:* ${permissions.groupMetadata.participants.length}\n`;
                msg += `📅 *Renovado em:* ${now}\n\n`;
                msg += `🌐 *Novo link:*\n${newGroupLink}\n\n`;
                msg += `⚠️ *Importante:* O link anterior foi invalidado!`;

                await this.sendMessage(groupJid, msg);

                // Log para o dono
                if (!permissions.isDono) {
                    const userNumber = senderJid.replace('@s.whatsapp.net', '');
                    await this.sendLogToDono(`🔄 *Link renovado*\n📍 Grupo: ${groupName}\n👤 Por: @${userNumber}\n🆔 ID: ${groupJid}`);
                }
            } else {
                // Apenas revogar sem gerar novo
                let msg = `🚫 *Link Revogado!*\n\n`;
                msg += `📍 *Grupo:* ${groupName}\n`;
                msg += `📅 *Revogado em:* ${new Date().toLocaleString('pt-BR')}\n\n`;
                msg += `⚠️ *Link anterior foi invalidado!*\n`;
                msg += `💡 Use \`${this.getPrefix()}linkgp\` para gerar um novo`;

                await this.sendMessage(groupJid, msg);

                // Log para o dono
                if (!permissions.isDono) {
                    const userNumber = senderJid.replace('@s.whatsapp.net', '');
                    await this.sendLogToDono(`🚫 *Link revogado*\n📍 Grupo: ${groupName}\n👤 Por: @${userNumber}\n🆔 ID: ${groupJid}`);
                }
            }

        } catch (error) {
            console.error("Erro ao revogar link do grupo:", error);
            await this.sendMessage(groupJid, '❌ Erro ao renovar/revogar link do grupo!');
        }
    }

    // Método para mostrar ajuda
    async showHelp(groupJid) {
        const prefix = this.getPrefix();
        
        let helpMsg = `🔗 *Comando Link do Grupo*\n\n`;
        helpMsg += `📝 *Como usar:*\n`;
        helpMsg += `• \`${prefix}linkgp\` - Mostrar link no grupo\n`;
        helpMsg += `• \`${prefix}linkgp pv\` - Enviar link no privado\n`;
        helpMsg += `• \`${prefix}linkgp novo\` - Gerar novo link\n`;
        helpMsg += `• \`${prefix}linkgp revogar\` - Invalidar link atual\n\n`;
        helpMsg += `⚠️ *Requisitos:*\n`;
        helpMsg += `• Apenas admins podem usar\n`;
        helpMsg += `• Bot precisa ser admin do grupo\n\n`;
        helpMsg += `💡 *Dicas:*\n`;
        helpMsg += `• Use "pv" para receber no privado\n`;
        helpMsg += `• Use "novo" se o link foi comprometido`;

        await this.sendMessage(groupJid, helpMsg);
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = LinkGpCommand;