const fs = require('fs');
const path = require('path');

class RebaixarCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.donoFile = path.join(__dirname, '../../database/dono.json');
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.donoFile));
        } catch (error) {
            return { Prefixo: '!', NumeroDono: '' };
        }
    }

    async execute(msg, args, from, sender) {
        const config = this.getConfig();
        const donoJid = config.NumeroDono + '@s.whatsapp.net';
        const prefixo = config.Prefixo || '!';

        // Verificar se está em um grupo
        if (!from.endsWith('@g.us')) {
            await this.sendMessage(from, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            // Obter informações do grupo
            const groupMetadata = await this.sock.groupMetadata(from);
            const participant = groupMetadata.participants.find(p => p.id === sender);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            const isDono = sender === donoJid;

            // Verificar permissões (só admins e dono)
            if (!isAdmin && !isDono) {
                await this.sendMessage(from, '❌ *Acesso Negado!*\n\n🔒 Apenas administradores e o dono podem usar este comando.');
                return;
            }

            // Verificar se o bot é admin (necessário para rebaixar)
            // O bot pode ter um LID (Local ID) diferente do JID principal
            let botNumber = null;
            
            if (this.sock.user.lid) {
                // Usar o LID se existir (formato do grupo)
                botNumber = this.sock.user.lid.replace(/:.*/, ''); // Remove :20@lid
            } else {
                // Fallback para o JID principal
                botNumber = this.sock.user.id.replace(/:.*/, ''); // Remove :20@s.whatsapp.net
            }
            
            // Procurar o bot pelos participantes usando o número correto
            const botParticipant = groupMetadata.participants.find(p => p.id.includes(botNumber));
            const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

            if (!botIsAdmin) {
                let errorMsg = `❌ *Bot sem permissão!*\n\n`;
                errorMsg += `🤖 O bot precisa ser **administrador** do grupo para rebaixar membros.\n\n`;
                errorMsg += `🔧 **Como resolver:**\n`;
                errorMsg += `1. Vá nas configurações do grupo\n`;
                errorMsg += `2. Toque em "Participantes"\n`;
                errorMsg += `3. Encontre o bot\n`;
                errorMsg += `4. Promova para administrador\n\n`;
                errorMsg += `✅ Após isso, tente o comando novamente.`;
                
                await this.sendMessage(from, errorMsg);
                return;
            }

            // Verificar se mencionou alguém ou respondeu mensagem
            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
            
            let targetJid = null;

            if (mentionedJids.length > 0) {
                targetJid = mentionedJids[0];
            } else if (quotedParticipant) {
                targetJid = quotedParticipant;
            } else {
                let helpMsg = `📉 *Comando Rebaixar*\n\n`;
                helpMsg += `📝 *Como usar:*\n`;
                helpMsg += `• Mencione: \`${prefixo}rebaixar @usuario\`\n`;
                helpMsg += `• Responda: Responda uma mensagem e use \`${prefixo}rebaixar\`\n\n`;
                helpMsg += `💡 *Exemplo:*\n`;
                helpMsg += `\`${prefixo}rebaixar @João\`\n\n`;
                helpMsg += `⚠️ *Requisitos:*\n`;
                helpMsg += `• Você deve ser administrador\n`;
                helpMsg += `• O bot deve ser administrador\n`;
                helpMsg += `• O usuário deve ser administrador\n`;
                helpMsg += `• O usuário deve estar no grupo`;
                
                await this.sendMessage(from, helpMsg);
                return;
            }

            // Verificar se o usuário está no grupo
            const targetInGroup = groupMetadata.participants.find(p => p.id === targetJid);
            if (!targetInGroup) {
                const targetNum = targetJid.replace('@s.whatsapp.net', '').replace('@lid', '');
                await this.sendMessage(from, `❌ O usuário @${targetNum} não está neste grupo!`, { mentions: [targetJid] });
                return;
            }

            // Verificar se o usuário é admin
            if (!targetInGroup.admin) {
                const targetNum = targetJid.replace('@s.whatsapp.net', '').replace('@lid', '');
                await this.sendMessage(from, `⚠️ *Usuário não é administrador!*\n\n👤 @${targetNum} já é um membro comum do grupo.`, { mentions: [targetJid] });
                return;
            }

            // Verificar se não está tentando rebaixar o próprio bot
            const botRealJid = this.sock.user.id.replace(/:.*/, '') + '@s.whatsapp.net';
            const botLidJid = this.sock.user.lid ? this.sock.user.lid.replace(/:.*/, '') + '@lid' : null;
            
            if (targetJid === botRealJid || targetJid === botLidJid || 
                (botParticipant && targetJid === botParticipant.id)) {
                await this.sendMessage(from, '🤖 Eu não posso me rebaixar! Preciso continuar sendo administrador para funcionar.');
                return;
            }

            // Verificar se não está tentando rebaixar o dono
            if (targetJid === donoJid) {
                await this.sendMessage(from, '👑 Não é possível rebaixar o dono do bot!');
                return;
            }

            // Verificar se não está tentando rebaixar quem está rebaixando (exceto o dono)
            if (targetJid === sender && !isDono) {
                await this.sendMessage(from, '⚠️ Você não pode rebaixar a si mesmo!');
                return;
            }

            // Rebaixar usuário
            await this.sock.groupParticipantsUpdate(from, [targetJid], 'demote');

            const targetNum = targetJid.replace('@s.whatsapp.net', '').replace('@lid', '');
            const demoterNum = sender.replace('@s.whatsapp.net', '').replace('@lid', '');

            // Mensagem de sucesso
            let successMsg = `📉 *REBAIXAMENTO REALIZADO COM SUCESSO!*\n\n`;
            successMsg += `❌ **Ex-Administrador:** @${targetNum}\n`;
            successMsg += `👤 **Rebaixado por:** @${demoterNum}\n`;
            successMsg += `📍 **Grupo:** ${groupMetadata.subject}\n`;
            successMsg += `📅 **Data:** ${new Date().toLocaleString('pt-BR')}\n`;
            successMsg += `👥 **Total de membros:** ${groupMetadata.participants.length}\n\n`;
            successMsg += `📝 **Status:** Agora é membro comum\n`;
            successMsg += `🚫 **Perdeu os poderes de:**\n`;
            successMsg += `• Remover/adicionar membros\n`;
            successMsg += `• Alterar configurações do grupo\n`;
            successMsg += `• Usar comandos administrativos do bot`;

            await this.sendMessage(from, successMsg, { mentions: [targetJid, sender] });

            // Log para o dono (se não foi o próprio dono que rebaixou)
            if (!isDono) {
                let logMsg = `📉 *LOG: Rebaixamento Realizado*\n\n`;
                logMsg += `📍 **Grupo:** ${groupMetadata.subject}\n`;
                logMsg += `❌ **Rebaixado:** +${targetNum}\n`;
                logMsg += `👤 **Rebaixado por:** +${demoterNum}\n`;
                logMsg += `📅 **Data/Hora:** ${new Date().toLocaleString('pt-BR')}\n`;
                logMsg += `👥 **Membros no grupo:** ${groupMetadata.participants.length}\n`;
                logMsg += `🆔 **ID do Grupo:** ${from}`;
                
                await this.sendMessage(donoJid, logMsg);
            }

            console.log(`📉 Usuário ${targetNum} rebaixado de admin no grupo ${groupMetadata.subject} por ${demoterNum}`);

        } catch (error) {
            console.error("Erro ao rebaixar usuário:", error);
            
            let errorMsg = `❌ **Erro ao rebaixar usuário!**\n\n`;
            
            if (error.output?.statusCode === 403) {
                errorMsg += `🔒 **Causa:** Sem permissão para rebaixar\n`;
                errorMsg += `🔧 **Solução:** Verificar se o bot é administrador`;
            } else if (error.output?.statusCode === 404) {
                errorMsg += `🔍 **Causa:** Usuário ou grupo não encontrado\n`;
                errorMsg += `🔧 **Solução:** Verificar se o usuário está no grupo`;
            } else if (error.output?.statusCode === 400) {
                errorMsg += `⚠️ **Causa:** Usuário não é administrador\n`;
                errorMsg += `🔧 **Solução:** Só é possível rebaixar administradores`;
            } else {
                errorMsg += `⚠️ **Causa:** Erro interno do WhatsApp\n`;
                errorMsg += `🔧 **Solução:** Tente novamente em alguns instantes`;
            }
            
            errorMsg += `\n\n📱 Se o problema persistir, contacte o dono do bot.`;
            
            await this.sendMessage(from, errorMsg);
        }
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = RebaixarCommand;
