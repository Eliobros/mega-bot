const fs = require('fs');
const path = require('path');

// Memória temporária para avisos
const warnedUsers = {}; // chave: `${groupJid}_${userId}`

class AntiMentionCommand {
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

    saveConfig(config) {
        fs.writeFileSync(this.donoFile, JSON.stringify(config, null, 2));
    }

    getPrefix() {
        const config = this.getConfig();
        return config.Prefixo || '!';
    }

    // Verificar se antimention está ativo para um grupo específico
    isAntiMentionActive(groupJid) {
        const config = this.getConfig();
        return config.groups && config.groups[groupJid] && config.groups[groupJid].antimention === true;
    }

    // Ativar antimention para um grupo específico
    enableAntiMention(groupJid, groupName) {
        let config = this.getConfig();
        
        if (!config.groups) {
            config.groups = {};
        }
        
        if (!config.groups[groupJid]) {
            config.groups[groupJid] = {};
        }
        
        config.groups[groupJid].antimention = true;
        config.groups[groupJid].groupName = groupName;
        config.groups[groupJid].antimention_enabledAt = new Date().toISOString();
        
        this.saveConfig(config);
    }

    // Desativar antimention para um grupo específico
    disableAntiMention(groupJid) {
        let config = this.getConfig();
        
        if (config.groups && config.groups[groupJid]) {
            config.groups[groupJid].antimention = false;
            config.groups[groupJid].antimention_disabledAt = new Date().toISOString();
        }
        
        this.saveConfig(config);
    }

    async execute(msg, args, groupJid, senderJid) {
        const config = this.getConfig();
        const donoJid = config.NumeroDono + '@s.whatsapp.net';
        const prefix = this.getPrefix();

        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        // Verificar se é admin ou dono
        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            const isDono = senderJid === donoJid;

            if (!isAdmin && !isDono) {
                await this.sendMessage(groupJid, '❌ Apenas admins podem usar este comando!');
                return;
            }

            const groupName = groupMetadata.subject;

            // Se não passou argumentos, mostrar status atual
            if (!args[0] || (args[0] !== '1' && args[0] !== '0')) {
                const isActive = this.isAntiMentionActive(groupJid);
                const statusText = isActive ? 'Ativado ✅' : 'Desativado ❌';
                
                let helpMsg = `🚫 *Anti-Menção Status*\n\n`;
                helpMsg += `📍 *Grupo:* ${groupName}\n`;
                helpMsg += `💡 *Status atual:* ${statusText}\n\n`;
                helpMsg += `📖 *Como usar:*\n`;
                helpMsg += `• \`${prefix}antimention 1\` - Ativar\n`;
                helpMsg += `• \`${prefix}antimention 0\` - Desativar\n\n`;
                helpMsg += `⚠️ *Função:* Avisa usuários que mencionarem o grupo e remove na segunda vez`;
                
                await this.sendMessage(groupJid, helpMsg);
                return;
            }

            const novoStatus = args[0] === '1';
            const currentStatus = this.isAntiMentionActive(groupJid);

            // Verificar se já está no status solicitado
            if (currentStatus === novoStatus) {
                const statusText = novoStatus ? 'ativado' : 'desativado';
                await this.sendMessage(groupJid, `⚠️ O anti-menção já está ${statusText} neste grupo!`);
                return;
            }

            // Ativar antimention
            if (novoStatus) {
                this.enableAntiMention(groupJid, groupName);
                await this.sendMessage(groupJid, `🚫 *ANTI-MENÇÃO ATIVADO ✅*\n\n📍 Grupo: ${groupName}\n⚠️ Usuários que mencionarem o grupo serão avisados e removidos na segunda vez`);
                
                // Log para o dono
                if (!isDono) {
                    await this.sendMessage(donoJid, `✅ *Anti-menção ativado*\n📍 Grupo: ${groupName}\n👤 Ativado por: @${senderJid.replace('@s.whatsapp.net', '')}\n🆔 ID: ${groupJid}`);
                }
            } else {
                // Desativar antimention
                this.disableAntiMention(groupJid);
                
                // Limpar avisos deste grupo
                Object.keys(warnedUsers).forEach(key => {
                    if (key.startsWith(groupJid + '_')) {
                        delete warnedUsers[key];
                    }
                });
                
                await this.sendMessage(groupJid, `💬 *ANTI-MENÇÃO DESATIVADO ❌*\n\n📍 Grupo: ${groupName}\n🔓 Usuários podem mencionar o grupo livremente`);
                
                // Log para o dono
                if (!isDono) {
                    await this.sendMessage(donoJid, `❌ *Anti-menção desativado*\n📍 Grupo: ${groupName}\n👤 Desativado por: @${senderJid.replace('@s.whatsapp.net', '')}\n🆔 ID: ${groupJid}`);
                }
            }

        } catch (error) {
            console.error("Erro ao alterar configuração anti-menção:", error);
            await this.sendMessage(groupJid, '❌ Erro interno ao alterar configuração! Verifique os logs.');
        }
    }

    // Método para processar menções (chamado externamente)
    async handleAntiMention(msg, groupJid, senderJid) {
        // Só processa se o antimention estiver ativo para este grupo
        if (!this.isAntiMentionActive(groupJid)) {
            return false;
        }

        const config = this.getConfig();
        const donoJid = config.NumeroDono + '@s.whatsapp.net';

        try {
            // Verificar se a mensagem contém menção do grupo (@everyone, @all, etc)
            const messageText = msg.message?.conversation || 
                              msg.message?.extendedTextMessage?.text || '';
            
            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            
            // Verificar se mencionou o grupo ou usou @everyone/@all
            const groupMentioned = mentionedJids.includes(groupJid) || 
                                 /@(everyone|all|todos|grupo)/i.test(messageText);

            if (!groupMentioned) {
                return false;
            }

            // Obter informações do grupo
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';

            // Ignorar admins e dono
            if (isAdmin || senderJid === donoJid) {
                console.log(`⚠️ Admin/Dono ${senderJid} mencionou o grupo — ignorado pelo antimention`);
                return false;
            }

            const key = `${groupJid}_${senderJid}`;
            const userNum = senderJid.replace('@s.whatsapp.net', '');

            if (!warnedUsers[key]) {
                // Primeiro aviso
                warnedUsers[key] = true;
                
                let warningMsg = `⚠️ *Primeiro Aviso!*\n\n`;
                warningMsg += `👤 @${userNum}, você não pode mencionar o grupo!\n`;
                warningMsg += `🚨 Na próxima vez você será removido.\n`;
                warningMsg += `🛡️ Anti-menção ativo neste grupo`;
                
                await this.sendMessage(groupJid, warningMsg, { mentions: [senderJid] });

                // Log para o dono
                await this.sendMessage(donoJid, `⚠️ *ANTIMENTION: Primeiro Aviso*\n\n📍 Grupo: ${groupMetadata.subject}\n👤 Usuário: +${userNum}\n💬 Mencionou: ${messageText.substring(0, 100)}...\n📅 Data: ${new Date().toLocaleString('pt-BR')}`);

                console.log(`⚠️ Usuário ${userNum} recebeu aviso de menção no grupo ${groupMetadata.subject}`);
                return true;
                
            } else {
                // Já avisado, remove do grupo
                try {
                    await this.sock.groupParticipantsUpdate(groupJid, [senderJid], 'remove');
                    
                    let removeMsg = `🚨 *Usuário Removido!*\n\n`;
                    removeMsg += `👤 @${userNum} foi removido por mencionar o grupo novamente!\n`;
                    removeMsg += `⚖️ Motivo: Ignorou o primeiro aviso\n`;
                    removeMsg += `🛡️ Anti-menção executado com sucesso`;
                    
                    await this.sendMessage(groupJid, removeMsg, { mentions: [senderJid] });

                    // Resetar aviso
                    delete warnedUsers[key];

                    // Log detalhado para o dono
                    let logMsg = `🚨 *ANTIMENTION EXECUTADO*\n\n`;
                    logMsg += `🏪 *Grupo:* ${groupMetadata.subject}\n`;
                    logMsg += `👤 *Usuário removido:* +${userNum}\n`;
                    logMsg += `💬 *Mensagem:* ${messageText.substring(0, 150)}${messageText.length > 150 ? '...' : ''}\n`;
                    logMsg += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}\n`;
                    logMsg += `🆔 *Grupo ID:* ${groupJid}\n`;
                    logMsg += `👥 *Membros restantes:* ${groupMetadata.participants.length - 1}`;
                    
                    await this.sendMessage(donoJid, logMsg);

                    console.log(`🚨 Usuário ${userNum} removido do grupo ${groupMetadata.subject} por mencionar o grupo novamente`);
                    return true;
                    
                } catch (error) {
                    console.error("Erro ao remover usuário:", error);
                    await this.sendMessage(groupJid, '❌ Erro ao remover usuário. Verifique se o bot é administrador.');
                    return false;
                }
            }

        } catch (error) {
            console.error("Erro ao processar menção:", error);
            return false;
        }
    }

    // Método para limpar avisos de um grupo (útil para manutenção)
    clearWarnings(groupJid) {
        Object.keys(warnedUsers).forEach(key => {
            if (key.startsWith(groupJid + '_')) {
                delete warnedUsers[key];
            }
        });
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = AntiMentionCommand;
